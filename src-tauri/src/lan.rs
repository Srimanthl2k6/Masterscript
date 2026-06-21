use crate::models::{LanHostOptions, LanHostResult, LanJoinOptions, LanJoinResult};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::async_runtime::{self, JoinHandle};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio_tungstenite::accept_hdr_async;
use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};
use tokio_tungstenite::tungstenite::Message;
use url::Url;

type PeerSender = mpsc::UnboundedSender<Message>;

#[derive(Default)]
struct RelayRooms {
    next_peer_id: u64,
    peers: HashMap<String, HashMap<u64, PeerSender>>,
    last_state: HashMap<String, Message>,
}

struct RunningRelay {
    room_id: String,
    port: u16,
    host_urls: Vec<String>,
    shutdown: oneshot::Sender<()>,
    task: JoinHandle<()>,
}

#[derive(Default)]
pub struct LanRelayState {
    running: Mutex<Option<RunningRelay>>,
}

fn create_room_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or_default();
    format!("masterscript-{timestamp:x}")
}

fn room_from_request(request: &Request, fallback: &str) -> String {
    request
        .uri()
        .path()
        .trim_start_matches('/')
        .split('/')
        .next()
        .filter(|value| !value.is_empty())
        .and_then(|value| urlencoding::decode(value).ok())
        .map(|value| value.into_owned())
        .unwrap_or_else(|| fallback.to_owned())
}

fn host_urls(port: u16) -> Vec<String> {
    let mut urls = Vec::new();
    if let Ok(address) = local_ip_address::local_ip() {
        if address.is_ipv4() {
            urls.push(format!("ws://{address}:{port}"));
        }
    }
    urls.push(format!("ws://127.0.0.1:{port}"));
    urls.sort();
    urls.dedup();
    urls
}

fn is_state_message(message: &Message) -> bool {
    let Message::Text(payload) = message else {
        return false;
    };
    serde_json::from_str::<serde_json::Value>(payload)
        .ok()
        .and_then(|value| {
            value
                .get("type")
                .and_then(|kind| kind.as_str())
                .map(str::to_owned)
        })
        .is_some_and(|kind| kind == "state")
}

async fn handle_peer(stream: TcpStream, rooms: Arc<Mutex<RelayRooms>>, fallback_room: String) {
    let selected_room = Arc::new(std::sync::Mutex::new(fallback_room.clone()));
    let callback_room = selected_room.clone();
    let websocket = accept_hdr_async(stream, move |request: &Request, response: Response| {
        if let Ok(mut room) = callback_room.lock() {
            *room = room_from_request(request, &fallback_room);
        }
        Ok(response)
    })
    .await;
    let Ok(websocket) = websocket else {
        return;
    };
    let room_id = selected_room
        .lock()
        .map(|room| room.clone())
        .unwrap_or(fallback_room);
    let (mut sink, mut source) = websocket.split();
    let (sender, mut receiver) = mpsc::unbounded_channel::<Message>();

    let (peer_id, cached_state, peers_to_notify) = {
        let mut state = rooms.lock().await;
        state.next_peer_id += 1;
        let peer_id = state.next_peer_id;
        let cached = state.last_state.get(&room_id).cloned();
        let room = state.peers.entry(room_id.clone()).or_default();
        let peers = room.values().cloned().collect::<Vec<_>>();
        room.insert(peer_id, sender.clone());
        (peer_id, cached, peers)
    };

    if let Some(message) = cached_state {
        let _ = sender.send(message);
    }
    for peer in peers_to_notify {
        let _ = peer.send(Message::Text(
            r#"{"type":"sync-request"}"#.to_owned().into(),
        ));
    }

    let writer = async_runtime::spawn(async move {
        while let Some(message) = receiver.recv().await {
            if sink.send(message).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(message)) = source.next().await {
        if message.is_close() {
            break;
        }
        let peers = {
            let mut state = rooms.lock().await;
            if is_state_message(&message) {
                state.last_state.insert(room_id.clone(), message.clone());
            }
            state
                .peers
                .get(&room_id)
                .map(|room| {
                    room.iter()
                        .filter(|(id, _)| **id != peer_id)
                        .map(|(_, peer)| peer.clone())
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default()
        };
        for peer in peers {
            let _ = peer.send(message.clone());
        }
    }

    {
        let mut state = rooms.lock().await;
        if let Some(room) = state.peers.get_mut(&room_id) {
            room.remove(&peer_id);
            if room.is_empty() {
                state.peers.remove(&room_id);
            }
        }
    }
    writer.abort();
}

impl LanRelayState {
    pub async fn host(&self, options: LanHostOptions) -> LanHostResult {
        self.stop().await;
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
        let relay_rooms = Arc::new(Mutex::new(RelayRooms::default()));
        let fallback_room = room_id.clone();
        let task = async_runtime::spawn(async move {
            loop {
                tokio::select! {
                    _ = &mut shutdown_rx => break,
                    accepted = listener.accept() => {
                        let Ok((stream, _)) = accepted else {
                            break;
                        };
                        async_runtime::spawn(handle_peer(
                            stream,
                            relay_rooms.clone(),
                            fallback_room.clone(),
                        ));
                    }
                }
            }
        });

        *self.running.lock().await = Some(RunningRelay {
            room_id: room_id.clone(),
            port,
            host_urls: urls.clone(),
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
    let valid = Url::parse(&server_url)
        .ok()
        .is_some_and(|url| matches!(url.scheme(), "ws" | "wss"));
    if !valid {
        return LanJoinResult {
            ok: false,
            server_url: None,
            room_id: None,
            error: Some("LAN server URL must be a valid ws:// or wss:// URL".into()),
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
    use super::validate_join;
    use crate::models::LanJoinOptions;

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
    }
}
