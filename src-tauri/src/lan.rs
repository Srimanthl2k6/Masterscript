use crate::models::{
    LanHostOptions, LanHostResult, LanJoinOptions, LanJoinResult, LanTransportEvent,
    LanTransportOpenOptions, LanTransportOpenResult, OperationResult,
};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use hmac::{Hmac, Mac};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::{HashMap, VecDeque};
use std::net::IpAddr;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::{Duration, Instant};
use tauri::async_runtime::{self, JoinHandle};
use tauri::ipc::Channel;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, mpsc, oneshot, Mutex};
use tokio::time::timeout;
use tokio_tungstenite::tungstenite::handshake::server::{
    ErrorResponse, Request, Response as HandshakeResponse,
};
use tokio_tungstenite::tungstenite::http::{Response as HttpResponse, StatusCode};
use tokio_tungstenite::tungstenite::protocol::WebSocketConfig;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{accept_hdr_async_with_config, connect_async_with_config};
use url::Url;

type HmacSha256 = Hmac<Sha256>;
type PeerSender = mpsc::Sender<Message>;

pub const MAX_AUTHENTICATED_PEERS: usize = 8;
pub const MAX_PENDING_HANDSHAKES: usize = 32;
pub const MAX_MESSAGE_BYTES: usize = 8 * 1024 * 1024;
const MAX_PEERS_PER_IP: usize = 4;
const MAX_PENDING_PER_IP: usize = 4;
const MAX_CONNECTION_ATTEMPTS_PER_MINUTE: usize = 12;
const MAX_MESSAGES_PER_SECOND: usize = 120;
const MAX_BYTES_PER_MINUTE: usize = 64 * 1024 * 1024;
const PEER_QUEUE_CAPACITY: usize = 32;
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(5);
const CONNECTION_RATE_WINDOW: Duration = Duration::from_secs(60);
const MESSAGE_RATE_WINDOW: Duration = Duration::from_secs(1);
const BYTE_RATE_WINDOW: Duration = Duration::from_secs(60);
const AUTH_CONTEXT: &[u8] = b"masterscript-lan-v2-auth";

#[derive(Clone)]
struct Peer {
    sender: PeerSender,
    ip: IpAddr,
}

#[derive(Default)]
struct RelayRoom {
    next_peer_id: u64,
    peers: HashMap<u64, Peer>,
    reserved_peers: usize,
    reserved_by_ip: HashMap<IpAddr, usize>,
    rates_by_ip: HashMap<IpAddr, PeerRate>,
    last_state: Option<Message>,
}

fn try_reserve_peer(room: &mut RelayRoom, ip: IpAddr) -> bool {
    let peers_from_ip = room.peers.values().filter(|peer| peer.ip == ip).count();
    let reserved_from_ip = room.reserved_by_ip.get(&ip).copied().unwrap_or_default();
    if room.peers.len() + room.reserved_peers >= MAX_AUTHENTICATED_PEERS
        || peers_from_ip + reserved_from_ip >= MAX_PEERS_PER_IP
    {
        return false;
    }
    room.reserved_peers += 1;
    *room.reserved_by_ip.entry(ip).or_default() += 1;
    true
}

fn release_reserved_peer(room: &mut RelayRoom, ip: IpAddr) {
    room.reserved_peers = room.reserved_peers.saturating_sub(1);
    if let Some(value) = room.reserved_by_ip.get_mut(&ip) {
        *value = value.saturating_sub(1);
        if *value == 0 {
            room.reserved_by_ip.remove(&ip);
        }
    }
}

#[derive(Default)]
struct AdmissionState {
    pending_total: usize,
    pending_by_ip: HashMap<IpAddr, usize>,
    attempts_by_ip: HashMap<IpAddr, VecDeque<Instant>>,
}

struct HandshakePermit {
    state: Arc<StdMutex<AdmissionState>>,
    ip: IpAddr,
}

impl Drop for HandshakePermit {
    fn drop(&mut self) {
        if let Ok(mut state) = self.state.lock() {
            state.pending_total = state.pending_total.saturating_sub(1);
            if let Some(value) = state.pending_by_ip.get_mut(&self.ip) {
                *value = value.saturating_sub(1);
                if *value == 0 {
                    state.pending_by_ip.remove(&self.ip);
                }
            }
        }
    }
}

struct RunningRelay {
    room_id: String,
    port: u16,
    host_urls: Vec<String>,
    peer_shutdown: broadcast::Sender<()>,
    shutdown: oneshot::Sender<()>,
    task: JoinHandle<()>,
}

struct TransportSession {
    sender: PeerSender,
    task: JoinHandle<()>,
}

#[derive(Default)]
pub struct LanRelayState {
    running: Mutex<Option<RunningRelay>>,
}

#[derive(Default)]
pub struct LanTransportState {
    sessions: Mutex<HashMap<String, TransportSession>>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthChallenge {
    #[serde(rename = "type")]
    kind: String,
    version: u8,
    room_id: String,
    nonce: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthResponse {
    #[serde(rename = "type")]
    kind: String,
    version: u8,
    room_id: String,
    proof: String,
}

#[derive(Serialize)]
struct AuthOk {
    #[serde(rename = "type")]
    kind: &'static str,
    version: u8,
}

#[derive(Default)]
struct PeerRate {
    message_window_started: Option<Instant>,
    message_count: usize,
    byte_window_started: Option<Instant>,
    byte_count: usize,
}

impl PeerRate {
    fn accepts(&mut self, bytes: usize, now: Instant) -> bool {
        if self.message_window_started.map_or(true, |started| {
            now.duration_since(started) >= MESSAGE_RATE_WINDOW
        }) {
            self.message_window_started = Some(now);
            self.message_count = 0;
        }
        if self.byte_window_started.map_or(true, |started| {
            now.duration_since(started) >= BYTE_RATE_WINDOW
        }) {
            self.byte_window_started = Some(now);
            self.byte_count = 0;
        }

        self.message_count += 1;
        self.byte_count = self.byte_count.saturating_add(bytes);
        self.message_count <= MAX_MESSAGES_PER_SECOND && self.byte_count <= MAX_BYTES_PER_MINUTE
    }
}

fn accepts_peer_message(room: &mut RelayRoom, ip: IpAddr, bytes: usize, now: Instant) -> bool {
    room.rates_by_ip.entry(ip).or_default().accepts(bytes, now)
}

fn remove_peer(room: &mut RelayRoom, peer_id: u64) {
    let Some(peer) = room.peers.remove(&peer_id) else {
        return;
    };
    if !room.peers.values().any(|candidate| candidate.ip == peer.ip) {
        room.rates_by_ip.remove(&peer.ip);
    }
}

pub fn create_room_id() -> String {
    let mut bytes = [0_u8; 16];
    OsRng.fill_bytes(&mut bytes);
    format!("ms2-{}", URL_SAFE_NO_PAD.encode(bytes))
}

fn create_session_id() -> String {
    let mut bytes = [0_u8; 16];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn random_nonce() -> [u8; 32] {
    let mut bytes = [0_u8; 32];
    OsRng.fill_bytes(&mut bytes);
    bytes
}

fn decode_auth_key(value: &str) -> Result<Vec<u8>, String> {
    let bytes = URL_SAFE_NO_PAD
        .decode(value.trim())
        .map_err(|_| "LAN authentication key is invalid".to_owned())?;
    if bytes.len() != 32 {
        return Err("LAN authentication key must contain 256 bits".into());
    }
    Ok(bytes)
}

pub fn create_auth_proof(auth_key: &[u8], room_id: &str, nonce: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(auth_key).expect("HMAC accepts arbitrary key lengths");
    mac.update(AUTH_CONTEXT);
    mac.update(&[0]);
    mac.update(room_id.as_bytes());
    mac.update(&[0]);
    mac.update(nonce);
    mac.finalize().into_bytes().to_vec()
}

pub fn verify_auth_proof(auth_key: &[u8], room_id: &str, nonce: &[u8], proof: &[u8]) -> bool {
    let mut mac = match HmacSha256::new_from_slice(auth_key) {
        Ok(mac) => mac,
        Err(_) => return false,
    };
    mac.update(AUTH_CONTEXT);
    mac.update(&[0]);
    mac.update(room_id.as_bytes());
    mac.update(&[0]);
    mac.update(nonce);
    mac.verify_slice(proof).is_ok()
}

pub fn room_from_path(path: &str, hosted_room: &str) -> Option<String> {
    let mut parts = path.trim_matches('/').split('/');
    let version = parts.next()?;
    let encoded_room = parts.next()?;
    if version != "v2" || parts.next().is_some() {
        return None;
    }
    let room = urlencoding::decode(encoded_room).ok()?.into_owned();
    (room == hosted_room).then_some(room)
}

pub fn is_allowed_peer(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => ip.is_private() || ip.is_loopback(),
        IpAddr::V6(ip) => ip.is_loopback() || (ip.segments()[0] & 0xfe00) == 0xfc00,
    }
}

fn websocket_config() -> WebSocketConfig {
    let mut config = WebSocketConfig::default();
    config.max_message_size = Some(MAX_MESSAGE_BYTES);
    config.max_frame_size = Some(MAX_MESSAGE_BYTES);
    config.accept_unmasked_frames = false;
    config
}

fn rejection(status: StatusCode, message: &str) -> ErrorResponse {
    let mut response: ErrorResponse = HttpResponse::new(Some(message.to_owned()));
    *response.status_mut() = status;
    response
}

fn try_acquire_handshake(
    state: &Arc<StdMutex<AdmissionState>>,
    ip: IpAddr,
    now: Instant,
) -> Option<HandshakePermit> {
    let mut admission = state.lock().ok()?;
    {
        let attempts = admission.attempts_by_ip.entry(ip).or_default();
        while attempts
            .front()
            .is_some_and(|started| now.duration_since(*started) >= CONNECTION_RATE_WINDOW)
        {
            attempts.pop_front();
        }
    }
    let attempt_count = admission
        .attempts_by_ip
        .get(&ip)
        .map(VecDeque::len)
        .unwrap_or_default();
    if attempt_count >= MAX_CONNECTION_ATTEMPTS_PER_MINUTE
        || admission.pending_total >= MAX_PENDING_HANDSHAKES
        || admission
            .pending_by_ip
            .get(&ip)
            .copied()
            .unwrap_or_default()
            >= MAX_PENDING_PER_IP
    {
        return None;
    }
    admission
        .attempts_by_ip
        .entry(ip)
        .or_default()
        .push_back(now);
    admission.pending_total += 1;
    *admission.pending_by_ip.entry(ip).or_default() += 1;
    drop(admission);
    Some(HandshakePermit {
        state: state.clone(),
        ip,
    })
}

fn host_urls(port: u16) -> Vec<String> {
    let mut urls = Vec::new();
    if let Ok(IpAddr::V4(address)) = local_ip_address::local_ip() {
        if address.is_private() || address.is_loopback() {
            urls.push(format!("ws://{address}:{port}"));
        }
    }
    let loopback = format!("ws://127.0.0.1:{port}");
    if !urls.contains(&loopback) {
        urls.push(loopback);
    }
    urls
}

fn is_state_message(message: &Message) -> bool {
    let Message::Text(payload) = message else {
        return false;
    };
    serde_json::from_str::<serde_json::Value>(payload)
        .ok()
        .is_some_and(|value| {
            value.get("type").and_then(|kind| kind.as_str()) == Some("state")
                && value.get("version").and_then(|version| version.as_u64()) == Some(2)
        })
}

async fn send_json<T: Serialize>(
    websocket: &mut tokio_tungstenite::WebSocketStream<TcpStream>,
    value: &T,
) -> Result<(), String> {
    let payload = serde_json::to_string(value).map_err(|error| error.to_string())?;
    websocket
        .send(Message::Text(payload.into()))
        .await
        .map_err(|error| error.to_string())
}

async fn authenticate_server_peer(
    websocket: &mut tokio_tungstenite::WebSocketStream<TcpStream>,
    room_id: &str,
    auth_key: &[u8],
) -> Result<(), String> {
    let nonce = random_nonce();
    send_json(
        websocket,
        &AuthChallenge {
            kind: "auth-challenge".into(),
            version: 2,
            room_id: room_id.to_owned(),
            nonce: URL_SAFE_NO_PAD.encode(nonce),
        },
    )
    .await?;

    let response = timeout(HANDSHAKE_TIMEOUT, websocket.next())
        .await
        .map_err(|_| "LAN authentication timed out".to_owned())?
        .ok_or_else(|| "LAN authentication connection closed".to_owned())?
        .map_err(|error| error.to_string())?;
    let Message::Text(payload) = response else {
        return Err("LAN authentication response must be text".into());
    };
    let response: AuthResponse =
        serde_json::from_str(&payload).map_err(|_| "LAN authentication response is invalid")?;
    let proof = URL_SAFE_NO_PAD
        .decode(response.proof)
        .map_err(|_| "LAN authentication proof is invalid")?;
    if response.kind != "auth-response"
        || response.version != 2
        || response.room_id != room_id
        || !verify_auth_proof(auth_key, room_id, &nonce, &proof)
    {
        return Err("LAN authentication failed".into());
    }

    send_json(
        websocket,
        &AuthOk {
            kind: "auth-ok",
            version: 2,
        },
    )
    .await
}

#[allow(clippy::result_large_err)]
async fn handle_peer(
    stream: TcpStream,
    ip: IpAddr,
    room: Arc<Mutex<RelayRoom>>,
    hosted_room: String,
    auth_key: Arc<Vec<u8>>,
    permit: HandshakePermit,
    mut shutdown: broadcast::Receiver<()>,
) {
    let callback_room = hosted_room.clone();
    let websocket = timeout(
        HANDSHAKE_TIMEOUT,
        accept_hdr_async_with_config(
            stream,
            move |request: &Request, response: HandshakeResponse| {
                if room_from_path(request.uri().path(), &callback_room).is_none() {
                    return Err(rejection(StatusCode::NOT_FOUND, "Unknown LAN room"));
                }
                Ok(response)
            },
            Some(websocket_config()),
        ),
    )
    .await;
    let Ok(Ok(mut websocket)) = websocket else {
        return;
    };
    let reserved = {
        let mut state = room.lock().await;
        try_reserve_peer(&mut state, ip)
    };
    if !reserved {
        let _ = websocket.close(None).await;
        return;
    }
    let authenticated = tokio::select! {
        result = authenticate_server_peer(&mut websocket, &hosted_room, &auth_key) => result.is_ok(),
        _ = shutdown.recv() => false,
    };
    if !authenticated {
        let mut state = room.lock().await;
        release_reserved_peer(&mut state, ip);
        drop(state);
        let _ = websocket.close(None).await;
        return;
    }

    let (mut sink, mut source) = websocket.split();
    let (sender, mut receiver) = mpsc::channel::<Message>(PEER_QUEUE_CAPACITY);
    let (peer_id, cached_state, peers_to_notify) = {
        let mut state = room.lock().await;
        release_reserved_peer(&mut state, ip);
        state.next_peer_id += 1;
        let peer_id = state.next_peer_id;
        let cached = state.last_state.clone();
        let peers = state
            .peers
            .values()
            .map(|peer| peer.sender.clone())
            .collect::<Vec<_>>();
        state.peers.insert(
            peer_id,
            Peer {
                sender: sender.clone(),
                ip,
            },
        );
        (peer_id, cached, peers)
    };
    drop(permit);

    if let Some(message) = cached_state {
        let _ = sender.try_send(message);
    }
    for peer in peers_to_notify {
        let _ = peer.try_send(Message::Text(
            r#"{"type":"sync-request","version":2}"#.to_owned().into(),
        ));
    }

    let writer = async_runtime::spawn(async move {
        while let Some(message) = receiver.recv().await {
            if sink.send(message).await.is_err() {
                break;
            }
        }
    });

    loop {
        let result = tokio::select! {
            _ = shutdown.recv() => break,
            result = source.next() => result,
        };
        let Some(result) = result else {
            break;
        };
        let Ok(message) = result else {
            break;
        };
        if message.is_close() {
            break;
        }
        if message.is_ping() {
            let _ = sender.try_send(Message::Pong(message.into_data()));
            continue;
        }
        let Message::Text(_) = &message else {
            break;
        };
        let message_bytes = message.len();
        let peers = {
            let mut state = room.lock().await;
            if message_bytes > MAX_MESSAGE_BYTES
                || !accepts_peer_message(&mut state, ip, message_bytes, Instant::now())
            {
                break;
            }
            if is_state_message(&message) {
                state.last_state = Some(message.clone());
            }
            state
                .peers
                .iter()
                .filter(|(id, _)| **id != peer_id)
                .map(|(id, peer)| (*id, peer.sender.clone()))
                .collect::<Vec<_>>()
        };
        let mut lagging = Vec::new();
        for (id, peer) in peers {
            if peer.try_send(message.clone()).is_err() {
                lagging.push(id);
            }
        }
        if !lagging.is_empty() {
            let mut state = room.lock().await;
            for id in lagging {
                remove_peer(&mut state, id);
            }
        }
    }

    {
        let mut state = room.lock().await;
        remove_peer(&mut state, peer_id);
    }
    writer.abort();
}

fn validate_transport_url(server_url: &str) -> Result<Url, String> {
    let mut url = Url::parse(server_url.trim())
        .map_err(|_| "LAN server URL must be a valid ws:// or wss:// URL".to_owned())?;
    if !matches!(url.scheme(), "ws" | "wss") {
        return Err("LAN server URL must be a valid ws:// or wss:// URL".into());
    }
    let allowed_host = match url.host_str() {
        Some("localhost") => true,
        Some(host) => host.parse::<IpAddr>().ok().is_some_and(is_allowed_peer),
        None => false,
    };
    if !allowed_host {
        return Err("LAN server must use a private or loopback address".into());
    }
    url.set_query(None);
    url.set_fragment(None);
    Ok(url)
}

async fn authenticate_client(
    websocket: &mut tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<TcpStream>,
    >,
    room_id: &str,
    auth_key: &[u8],
) -> Result<(), String> {
    let challenge = timeout(HANDSHAKE_TIMEOUT, websocket.next())
        .await
        .map_err(|_| "LAN authentication timed out".to_owned())?
        .ok_or_else(|| "LAN authentication connection closed".to_owned())?
        .map_err(|error| error.to_string())?;
    let Message::Text(payload) = challenge else {
        return Err("LAN authentication challenge must be text".into());
    };
    let challenge: AuthChallenge =
        serde_json::from_str(&payload).map_err(|_| "LAN authentication challenge is invalid")?;
    if challenge.kind != "auth-challenge" || challenge.version != 2 || challenge.room_id != room_id
    {
        return Err("LAN authentication challenge did not match the requested room".into());
    }
    let nonce = URL_SAFE_NO_PAD
        .decode(challenge.nonce)
        .map_err(|_| "LAN authentication challenge nonce is invalid")?;
    let response = AuthResponse {
        kind: "auth-response".into(),
        version: 2,
        room_id: room_id.to_owned(),
        proof: URL_SAFE_NO_PAD.encode(create_auth_proof(auth_key, room_id, &nonce)),
    };
    send_json_client(websocket, &response).await?;

    let acknowledgement = timeout(HANDSHAKE_TIMEOUT, websocket.next())
        .await
        .map_err(|_| "LAN authentication timed out".to_owned())?
        .ok_or_else(|| "LAN authentication connection closed".to_owned())?
        .map_err(|error| error.to_string())?;
    let Message::Text(payload) = acknowledgement else {
        return Err("LAN authentication acknowledgement must be text".into());
    };
    let value: serde_json::Value = serde_json::from_str(&payload)
        .map_err(|_| "LAN authentication acknowledgement is invalid")?;
    if value.get("type").and_then(|kind| kind.as_str()) != Some("auth-ok")
        || value.get("version").and_then(|version| version.as_u64()) != Some(2)
    {
        return Err("LAN authentication failed".into());
    }
    Ok(())
}

async fn send_json_client<T: Serialize>(
    websocket: &mut tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<TcpStream>,
    >,
    value: &T,
) -> Result<(), String> {
    let payload = serde_json::to_string(value).map_err(|error| error.to_string())?;
    websocket
        .send(Message::Text(payload.into()))
        .await
        .map_err(|error| error.to_string())
}

impl LanRelayState {
    pub async fn host(&self, options: LanHostOptions) -> LanHostResult {
        self.stop().await;
        let auth_key = match decode_auth_key(&options.auth_key) {
            Ok(value) => Arc::new(value),
            Err(error) => return LanHostResult::failure(error),
        };
        let room_id = options
            .room_id
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(create_room_id);
        let requested_port = options.port.unwrap_or(0);
        let listener = match TcpListener::bind(("0.0.0.0", requested_port)).await {
            Ok(listener) => listener,
            Err(error) => return LanHostResult::failure(error.to_string()),
        };
        let port = match listener.local_addr() {
            Ok(address) => address.port(),
            Err(error) => return LanHostResult::failure(error.to_string()),
        };
        let urls = host_urls(port);
        let primary_host_url = urls.first().cloned();
        let (shutdown, mut shutdown_rx) = oneshot::channel();
        let (peer_shutdown, _) = broadcast::channel(1);
        let peer_shutdown_for_accept = peer_shutdown.clone();
        let relay_room = Arc::new(Mutex::new(RelayRoom::default()));
        let admission = Arc::new(StdMutex::new(AdmissionState::default()));
        let fallback_room = room_id.clone();
        let task = async_runtime::spawn(async move {
            loop {
                tokio::select! {
                    _ = &mut shutdown_rx => break,
                    accepted = listener.accept() => {
                        let Ok((stream, address)) = accepted else {
                            break;
                        };
                        let ip = address.ip();
                        if !is_allowed_peer(ip) {
                            continue;
                        }
                        let Some(permit) = try_acquire_handshake(&admission, ip, Instant::now()) else {
                            continue;
                        };
                        async_runtime::spawn(handle_peer(
                            stream,
                            ip,
                            relay_room.clone(),
                            fallback_room.clone(),
                            auth_key.clone(),
                            permit,
                            peer_shutdown_for_accept.subscribe(),
                        ));
                    }
                }
            }
        });

        *self.running.lock().await = Some(RunningRelay {
            room_id: room_id.clone(),
            port,
            host_urls: urls.clone(),
            peer_shutdown,
            shutdown,
            task,
        });

        LanHostResult {
            ok: true,
            room_id: Some(room_id),
            port: Some(port),
            host_urls: urls,
            primary_host_url,
            running: Some(true),
            error: None,
        }
    }

    pub async fn stop(&self) {
        if let Some(running) = self.running.lock().await.take() {
            let _ = running.peer_shutdown.send(());
            let _ = running.shutdown.send(());
            running.task.abort();
        }
    }

    pub async fn status(&self) -> LanHostResult {
        let running = self.running.lock().await;
        match running.as_ref() {
            Some(value) => LanHostResult {
                ok: true,
                room_id: Some(value.room_id.clone()),
                port: Some(value.port),
                host_urls: value.host_urls.clone(),
                primary_host_url: value.host_urls.first().cloned(),
                running: Some(true),
                error: None,
            },
            None => LanHostResult {
                ok: true,
                room_id: None,
                port: None,
                host_urls: Vec::new(),
                primary_host_url: None,
                running: Some(false),
                error: None,
            },
        }
    }
}

impl LanTransportState {
    pub async fn open(
        &self,
        options: LanTransportOpenOptions,
        on_event: Channel<LanTransportEvent>,
    ) -> LanTransportOpenResult {
        let auth_key = match decode_auth_key(&options.auth_key) {
            Ok(value) => value,
            Err(error) => return LanTransportOpenResult::failure(error),
        };
        let room_id = options.room_id.trim().to_owned();
        if room_id.is_empty() {
            return LanTransportOpenResult::failure("LAN room ID is required");
        }
        let mut url = match validate_transport_url(&options.server_url) {
            Ok(url) => url,
            Err(error) => return LanTransportOpenResult::failure(error),
        };
        url.set_path(&format!("/v2/{}", urlencoding::encode(&room_id)));

        let connected = timeout(
            HANDSHAKE_TIMEOUT,
            connect_async_with_config(url.as_str(), Some(websocket_config()), false),
        )
        .await;
        let (mut websocket, _) = match connected {
            Ok(Ok(value)) => value,
            Ok(Err(error)) => return LanTransportOpenResult::failure(error.to_string()),
            Err(_) => return LanTransportOpenResult::failure("LAN connection timed out"),
        };
        if let Err(error) = authenticate_client(&mut websocket, &room_id, &auth_key).await {
            let _ = websocket.close(None).await;
            return LanTransportOpenResult::failure(error);
        }

        let session_id = create_session_id();
        let (mut sink, mut source) = websocket.split();
        let (sender, mut receiver) = mpsc::channel::<Message>(PEER_QUEUE_CAPACITY);
        let event_channel = on_event.clone();
        let task = async_runtime::spawn(async move {
            loop {
                tokio::select! {
                    outbound = receiver.recv() => {
                        let Some(message) = outbound else {
                            break;
                        };
                        if sink.send(message).await.is_err() {
                            break;
                        }
                    }
                    inbound = source.next() => {
                        match inbound {
                            Some(Ok(Message::Text(payload))) => {
                                let _ = event_channel.send(LanTransportEvent::message(payload.to_string()));
                            }
                            Some(Ok(Message::Ping(payload))) => {
                                if sink.send(Message::Pong(payload)).await.is_err() {
                                    break;
                                }
                            }
                            Some(Ok(Message::Close(_))) | None => break,
                            Some(Ok(_)) => {}
                            Some(Err(error)) => {
                                let _ = event_channel.send(LanTransportEvent::disconnected(Some(error.to_string())));
                                return;
                            }
                        }
                    }
                }
            }
            let _ = event_channel.send(LanTransportEvent::disconnected(None));
        });

        let mut sessions = self.sessions.lock().await;
        sessions.retain(|_, session| !session.task.inner().is_finished());
        sessions.insert(session_id.clone(), TransportSession { sender, task });
        LanTransportOpenResult::success(session_id)
    }

    pub async fn send(&self, session_id: &str, payload: String) -> OperationResult {
        if payload.len() > MAX_MESSAGE_BYTES {
            return OperationResult::failure("LAN message exceeds the 8 MiB limit");
        }
        let sessions = self.sessions.lock().await;
        let Some(session) = sessions.get(session_id) else {
            return OperationResult::failure("LAN transport session was not found");
        };
        match session.sender.try_send(Message::Text(payload.into())) {
            Ok(()) => OperationResult::success(),
            Err(_) => OperationResult::failure("LAN transport queue is full or disconnected"),
        }
    }

    pub async fn close(&self, session_id: &str) -> OperationResult {
        let session = self.sessions.lock().await.remove(session_id);
        if let Some(session) = session {
            let _ = session.sender.try_send(Message::Close(None));
            session.task.abort();
        }
        OperationResult::success()
    }

    pub async fn stop_all(&self) {
        let sessions = std::mem::take(&mut *self.sessions.lock().await);
        for (_, session) in sessions {
            session.task.abort();
        }
    }
}

pub fn validate_join(options: LanJoinOptions) -> LanJoinResult {
    let server_url = options.server_url.trim().to_owned();
    let room_id = options.room_id.trim().to_owned();
    if server_url.is_empty() || room_id.is_empty() {
        return LanJoinResult {
            ok: false,
            server_url: None,
            room_id: None,
            error: Some("LAN server URL and room ID are required".into()),
        };
    }
    if let Err(error) = validate_transport_url(&server_url) {
        return LanJoinResult {
            ok: false,
            server_url: None,
            room_id: None,
            error: Some(error),
        };
    }
    LanJoinResult {
        ok: true,
        server_url: Some(server_url),
        room_id: Some(room_id),
        error: None,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        accepts_peer_message, create_auth_proof, create_room_id, is_allowed_peer,
        release_reserved_peer, room_from_path, try_acquire_handshake, try_reserve_peer,
        validate_join, verify_auth_proof, LanRelayState, LanTransportState, PeerRate, RelayRoom,
        MAX_AUTHENTICATED_PEERS, MAX_MESSAGE_BYTES, MAX_PENDING_HANDSHAKES,
    };
    use crate::models::{
        LanHostOptions, LanJoinOptions, LanTransportEvent, LanTransportOpenOptions,
    };
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    use std::net::{IpAddr, Ipv4Addr};
    use std::sync::{Arc, Mutex as StdMutex};
    use std::time::{Duration, Instant};
    use tauri::ipc::{Channel, InvokeResponseBody};
    use tokio::time::sleep;

    #[test]
    fn validates_lan_join_urls() {
        assert!(
            validate_join(LanJoinOptions {
                server_url: "ws://127.0.0.1:4567".into(),
                room_id: "room-a".into(),
            })
            .ok
        );
        assert!(
            !validate_join(LanJoinOptions {
                server_url: "https://example.com".into(),
                room_id: "room-a".into(),
            })
            .ok
        );
        assert!(
            !validate_join(LanJoinOptions {
                server_url: "ws://8.8.8.8:4567".into(),
                room_id: "room-a".into(),
            })
            .ok
        );
    }

    #[test]
    fn generates_128_bit_protocol_v2_room_ids() {
        let first = create_room_id();
        let second = create_room_id();

        assert_ne!(first, second);
        assert!(first.starts_with("ms2-"));
        assert_eq!(
            URL_SAFE_NO_PAD
                .decode(first.trim_start_matches("ms2-"))
                .expect("valid room id")
                .len(),
            16
        );
    }

    #[test]
    fn authenticates_a_fresh_challenge_and_rejects_wrong_or_replayed_proofs() {
        let auth_key = [7_u8; 32];
        let room_id = "ms2-room";
        let first_nonce = [1_u8; 32];
        let second_nonce = [2_u8; 32];
        let proof = create_auth_proof(&auth_key, room_id, &first_nonce);

        assert!(verify_auth_proof(&auth_key, room_id, &first_nonce, &proof));
        assert!(!verify_auth_proof(
            &[8_u8; 32],
            room_id,
            &first_nonce,
            &proof
        ));
        assert!(!verify_auth_proof(
            &auth_key,
            room_id,
            &second_nonce,
            &proof
        ));
    }

    #[test]
    fn accepts_only_the_hosted_protocol_v2_room_path() {
        assert_eq!(
            room_from_path("/v2/ms2-room", "ms2-room"),
            Some("ms2-room".into())
        );
        assert_eq!(room_from_path("/v2/other", "ms2-room"), None);
        assert_eq!(room_from_path("/ms2-room", "ms2-room"), None);
        assert_eq!(room_from_path("/v1/ms2-room", "ms2-room"), None);
    }

    #[test]
    fn allows_only_private_or_loopback_lan_peers() {
        assert!(is_allowed_peer(IpAddr::V4(Ipv4Addr::LOCALHOST)));
        assert!(is_allowed_peer(IpAddr::V4(Ipv4Addr::new(10, 1, 2, 3))));
        assert!(is_allowed_peer(IpAddr::V4(Ipv4Addr::new(172, 16, 1, 2))));
        assert!(is_allowed_peer(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 2))));
        assert!(!is_allowed_peer(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8))));
    }

    #[test]
    fn fixes_resource_limits_at_the_security_boundary() {
        assert_eq!(MAX_AUTHENTICATED_PEERS, 8);
        assert_eq!(MAX_PENDING_HANDSHAKES, 32);
        assert_eq!(MAX_MESSAGE_BYTES, 8 * 1024 * 1024);
    }

    #[test]
    fn reserves_no_more_than_eight_authenticated_peer_slots() {
        let mut room = RelayRoom::default();
        for host in 1..=8 {
            assert!(try_reserve_peer(
                &mut room,
                IpAddr::V4(Ipv4Addr::new(192, 168, 1, host)),
            ));
        }
        assert!(!try_reserve_peer(
            &mut room,
            IpAddr::V4(Ipv4Addr::new(192, 168, 1, 20)),
        ));
    }

    #[test]
    fn releases_failed_authentication_reservations() {
        let mut room = RelayRoom::default();
        let ip = IpAddr::V4(Ipv4Addr::new(192, 168, 1, 10));

        assert!(try_reserve_peer(&mut room, ip));
        release_reserved_peer(&mut room, ip);
        assert_eq!(room.reserved_peers, 0);
        assert!(!room.reserved_by_ip.contains_key(&ip));
    }

    #[test]
    fn limits_pending_handshakes_and_connection_attempts_per_ip() {
        let admission = Arc::new(StdMutex::new(Default::default()));
        let ip = IpAddr::V4(Ipv4Addr::new(192, 168, 1, 10));
        let now = Instant::now();
        let permits = (0..4)
            .map(|_| try_acquire_handshake(&admission, ip, now).expect("pending permit"))
            .collect::<Vec<_>>();

        assert!(try_acquire_handshake(&admission, ip, now).is_none());
        drop(permits);

        for _ in 0..8 {
            drop(try_acquire_handshake(&admission, ip, now).expect("rate permit"));
        }
        assert!(try_acquire_handshake(&admission, ip, now).is_none());
    }

    #[test]
    fn disconnects_message_floods_at_the_fixed_rate() {
        let now = Instant::now();
        let mut rate = PeerRate::default();
        for _ in 0..120 {
            assert!(rate.accepts(1, now));
        }
        assert!(!rate.accepts(1, now));

        assert!(rate.accepts(1, now + Duration::from_secs(1)));
        assert!(!rate.accepts(64 * 1024 * 1024, now + Duration::from_secs(1),));
    }

    #[test]
    fn shares_the_message_rate_budget_across_connections_from_one_ip() {
        let now = Instant::now();
        let mut room = RelayRoom::default();
        let ip = IpAddr::V4(Ipv4Addr::new(192, 168, 1, 10));

        for _ in 0..120 {
            assert!(accepts_peer_message(&mut room, ip, 1, now));
        }
        assert!(!accepts_peer_message(&mut room, ip, 1, now));
    }

    fn capture_channel() -> (
        Channel<LanTransportEvent>,
        Arc<StdMutex<Vec<LanTransportEvent>>>,
    ) {
        let events = Arc::new(StdMutex::new(Vec::new()));
        let captured = events.clone();
        let channel = Channel::new(move |body| {
            if let InvokeResponseBody::Json(json) = body {
                if let Ok(event) = serde_json::from_str::<LanTransportEvent>(&json) {
                    captured.lock().expect("event lock").push(event);
                }
            }
            Ok(())
        });
        (channel, events)
    }

    async fn start_test_host(room_id: &str, auth_key: &str) -> (LanRelayState, String) {
        let host = LanRelayState::default();
        let result = host
            .host(LanHostOptions {
                room_id: Some(room_id.into()),
                auth_key: auth_key.into(),
                port: Some(0),
            })
            .await;
        assert!(result.ok, "{:?}", result.error);
        (
            host,
            result
                .host_urls
                .into_iter()
                .find(|url| url.starts_with("ws://127.0.0.1:"))
                .expect("loopback test host URL"),
        )
    }

    async fn wait_for_payload(events: &Arc<StdMutex<Vec<LanTransportEvent>>>, expected: &str) {
        for _ in 0..100 {
            if events
                .lock()
                .expect("event lock")
                .iter()
                .any(|event| event.payload.as_deref() == Some(expected))
            {
                return;
            }
            sleep(Duration::from_millis(10)).await;
        }
        panic!("timed out waiting for relayed payload");
    }

    async fn wait_for_disconnect(events: &Arc<StdMutex<Vec<LanTransportEvent>>>) {
        for _ in 0..100 {
            if events
                .lock()
                .expect("event lock")
                .iter()
                .any(|event| event.event_type == "disconnected")
            {
                return;
            }
            sleep(Duration::from_millis(10)).await;
        }
        panic!("timed out waiting for transport disconnect");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn relays_messages_only_between_authenticated_protocol_v2_clients() {
        let room_id = "ms2-integration-room";
        let auth_key = URL_SAFE_NO_PAD.encode([9_u8; 32]);
        let (host, server_url) = start_test_host(room_id, &auth_key).await;
        let transports = LanTransportState::default();
        let (first_channel, _) = capture_channel();
        let (second_channel, second_events) = capture_channel();
        let first = transports
            .open(
                LanTransportOpenOptions {
                    server_url: server_url.clone(),
                    room_id: room_id.into(),
                    auth_key: auth_key.clone(),
                },
                first_channel,
            )
            .await;
        let second = transports
            .open(
                LanTransportOpenOptions {
                    server_url,
                    room_id: room_id.into(),
                    auth_key,
                },
                second_channel,
            )
            .await;
        assert!(first.ok, "{:?}", first.error);
        assert!(second.ok, "{:?}", second.error);

        let payload = r#"{"type":"update","version":2,"iv":"a","ciphertext":"b"}"#;
        assert!(
            transports
                .send(
                    first.session_id.as_deref().expect("first session"),
                    payload.into()
                )
                .await
                .ok
        );
        wait_for_payload(&second_events, payload).await;

        transports.stop_all().await;
        host.stop().await;
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn rejects_wrong_keys_unknown_rooms_and_oversized_messages() {
        let room_id = "ms2-integration-room";
        let auth_key = URL_SAFE_NO_PAD.encode([9_u8; 32]);
        let wrong_key = URL_SAFE_NO_PAD.encode([8_u8; 32]);
        let (host, server_url) = start_test_host(room_id, &auth_key).await;
        let transports = LanTransportState::default();

        let (wrong_channel, _) = capture_channel();
        let wrong = transports
            .open(
                LanTransportOpenOptions {
                    server_url: server_url.clone(),
                    room_id: room_id.into(),
                    auth_key: wrong_key,
                },
                wrong_channel,
            )
            .await;
        assert!(!wrong.ok);

        let (unknown_channel, _) = capture_channel();
        let unknown = transports
            .open(
                LanTransportOpenOptions {
                    server_url: server_url.clone(),
                    room_id: "ms2-unknown".into(),
                    auth_key: auth_key.clone(),
                },
                unknown_channel,
            )
            .await;
        assert!(!unknown.ok);

        let (valid_channel, _) = capture_channel();
        let valid = transports
            .open(
                LanTransportOpenOptions {
                    server_url,
                    room_id: room_id.into(),
                    auth_key,
                },
                valid_channel,
            )
            .await;
        assert!(valid.ok, "{:?}", valid.error);
        let oversized = "x".repeat(MAX_MESSAGE_BYTES + 1);
        assert!(
            !transports
                .send(
                    valid.session_id.as_deref().expect("valid session"),
                    oversized
                )
                .await
                .ok
        );

        transports.stop_all().await;
        host.stop().await;
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn reconnects_after_a_transport_session_is_closed() {
        let room_id = "ms2-reconnect-room";
        let auth_key = URL_SAFE_NO_PAD.encode([3_u8; 32]);
        let (host, server_url) = start_test_host(room_id, &auth_key).await;
        let transports = LanTransportState::default();
        let (first_channel, _) = capture_channel();
        let first = transports
            .open(
                LanTransportOpenOptions {
                    server_url: server_url.clone(),
                    room_id: room_id.into(),
                    auth_key: auth_key.clone(),
                },
                first_channel,
            )
            .await;
        assert!(first.ok, "{:?}", first.error);
        assert!(
            transports
                .close(first.session_id.as_deref().expect("first session"))
                .await
                .ok
        );

        let (second_channel, _) = capture_channel();
        let second = transports
            .open(
                LanTransportOpenOptions {
                    server_url,
                    room_id: room_id.into(),
                    auth_key,
                },
                second_channel,
            )
            .await;
        assert!(second.ok, "{:?}", second.error);

        transports.stop_all().await;
        host.stop().await;
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn stopping_the_host_disconnects_authenticated_clients() {
        let room_id = "ms2-stop-room";
        let auth_key = URL_SAFE_NO_PAD.encode([4_u8; 32]);
        let (host, server_url) = start_test_host(room_id, &auth_key).await;
        let transports = LanTransportState::default();
        let (channel, events) = capture_channel();
        let opened = transports
            .open(
                LanTransportOpenOptions {
                    server_url,
                    room_id: room_id.into(),
                    auth_key,
                },
                channel,
            )
            .await;
        assert!(opened.ok, "{:?}", opened.error);

        host.stop().await;
        wait_for_disconnect(&events).await;
        transports.stop_all().await;
    }
}
