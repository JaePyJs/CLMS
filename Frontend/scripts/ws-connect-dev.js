import { io } from 'socket.io-client'

const url = process.env.WS_URL || 'http://localhost:3001'

console.log('[WS DEV TEST] Connecting to', url)

const socket = io(url, {
  path: '/socket.io',
  transports: ['websocket'],
  reconnection: false,
  timeout: 5000,
})

let done = false
let connectedAt = 0

function finish(ok, reason) {
  if (done) return
  done = true
  try { socket.disconnect() } catch {}
  console.log('[WS DEV TEST] Result:', { ok, reason })
  process.exit(ok ? 0 : 1)
}

socket.on('connect', () => {
  connectedAt = Date.now()
  console.log('[WS DEV TEST] Connected. Socket ID:', socket.id)
  // Wait briefly to see if server disconnects unauthenticated client
  setTimeout(() => {
    if (!done) finish(true)
  }, 1500)
})

socket.on('connect_error', (err) => {
  console.log('[WS DEV TEST] connect_error:', err?.message)
  finish(false, err?.message)
})

socket.on('error', (payload) => {
  console.log('[WS DEV TEST] server error:', payload)
})

socket.on('disconnect', (reason) => {
  console.log('[WS DEV TEST] disconnected by server. Reason:', reason)
  finish(false, reason)
})

setTimeout(() => finish(false, 'timeout'), 7000)