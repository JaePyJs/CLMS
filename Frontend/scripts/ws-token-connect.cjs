const crypto = require('crypto')
const io = require('socket.io-client')

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function sign(secret, data) {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

const secret = process.env.JWT_SECRET
if (!secret) {
  console.error('JWT_SECRET env is required')
  process.exit(1)
}

const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
const payload = b64url(
  JSON.stringify({ id: 'dev-user', role: 'developer', iat: Math.floor(Date.now() / 1000) })
)
const token = `${header}.${payload}.${sign(secret, `${header}.${payload}`)}`

const url = process.env.WS_URL || 'http://localhost:3001'
const path = process.env.WS_PATH || '/socket.io'

const subs = (process.env.SUBS || '').split(',').filter(Boolean)
const socket = io(url, { path, auth: { token }, transports: ['polling', 'websocket'] })

socket.on('connect', () => {
  console.log('WS connected', { id: socket.id })
  for (const s of subs) socket.emit('subscribe', { subscription: s })
  if (!subs.length) {
    socket.close()
    process.exit(0)
  }
})

socket.on('connect_error', (e) => {
  console.error('WS connect_error', e && e.message ? e.message : e)
  process.exit(1)
})

socket.on('error', (e) => {
  console.error('WS error', e)
  process.exit(1)
})

socket.on('subscription_confirmed', (data) => {
  console.log('Subscription confirmed', data)
  socket.close()
  process.exit(0)
})

setTimeout(() => {
  console.error('Timeout during WS connect')
  process.exit(1)
}, 8000)