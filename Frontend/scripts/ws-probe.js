import http from 'http'

const url = 'http://localhost:3001/socket.io/?EIO=4&transport=polling'
console.log('[WS PROBE] GET', url)

http.get(url, (res) => {
  console.log('[WS PROBE] status', res.statusCode)
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    console.log('[WS PROBE] body length', data.length)
    console.log('[WS PROBE] body (first 200):', data.slice(0, 200))
    process.exit(0)
  })
}).on('error', (err) => {
  console.log('[WS PROBE] error', err.message)
  process.exit(1)
})