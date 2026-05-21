export const DEFAULT_SIGNALING_SERVERS = ['wss://signaling.yjs.dev']

export const DEFAULT_RTC_CONFIGURATION: RTCConfiguration = {
  // TURN is intentionally omitted for the zero-cost v1; restrictive NATs may block WebRTC.
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export const COLLABORATION_AUTOSAVE_KEY = 'masterscript-autosave-v1'

