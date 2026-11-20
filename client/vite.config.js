import crypto from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// =============================================================================
// Helper: Generate a self-signed X.509 Certificate in pure Node.js (zero deps)
// Includes SubjectAlternativeName (SAN) for localhost and all local Wi-Fi IPs
// so mobile browsers unlock the Live In-App Camera (navigator.mediaDevices)
// over https://<laptop-ip>:5174!
// =============================================================================
function asn1Len(len) {
  if (len < 128) return Buffer.from([len])
  const bytes = []
  let n = len
  while (n > 0) {
    bytes.unshift(n & 0xff)
    n >>= 8
  }
  return Buffer.from([0x80 | bytes.length, ...bytes])
}

function asn1Tag(tag, content) {
  return Buffer.concat([Buffer.from([tag]), asn1Len(content.length), content])
}

const seq = (...items) => asn1Tag(0x30, Buffer.concat(items))
const set = (...items) => asn1Tag(0x31, Buffer.concat(items))

function createSelfSignedCert() {
  const { publicKey: spkiDer, privateKey: keyPem } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  const sigAlg = seq(
    Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b, 0x05, 0x00])
  )

  const cnOid = Buffer.from([0x06, 0x03, 0x55, 0x04, 0x03])
  const cnVal = asn1Tag(0x0c, Buffer.from('ScholarsTrack'))
  const name = seq(set(seq(cnOid, cnVal)))

  const validity = seq(
    asn1Tag(0x17, Buffer.from('240101000000Z')),
    asn1Tag(0x17, Buffer.from('340101000000Z'))
  )

  // Collect all local IPv4 addresses so any Wi-Fi IP is covered by SAN
  const sanEntries = [
    asn1Tag(0x82, Buffer.from('localhost')),
    asn1Tag(0x87, Buffer.from([127, 0, 0, 1])),
  ]
  const nets = os.networkInterfaces()
  for (const iface of Object.values(nets)) {
    for (const addr of iface || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        const octets = addr.address.split('.').map((x) => Number(x))
        if (octets.length === 4 && octets.every((n) => n >= 0 && n <= 255)) {
          sanEntries.push(asn1Tag(0x87, Buffer.from(octets)))
        }
      }
    }
  }

  const sanOid = Buffer.from([0x06, 0x03, 0x55, 0x1d, 0x11])
  const sanExtValue = asn1Tag(0x04, seq(...sanEntries))
  const extensions = asn1Tag(0xa3, seq(seq(sanOid, sanExtValue)))

  const version = asn1Tag(0xa0, Buffer.from([0x02, 0x01, 0x02]))
  const serial = asn1Tag(0x02, Buffer.from([0x01, ...crypto.randomBytes(8)]))

  const tbs = seq(version, serial, sigAlg, name, validity, name, spkiDer, extensions)
  const signature = crypto.sign('sha256', tbs, keyPem)
  const sigBitString = asn1Tag(0x03, Buffer.concat([Buffer.from([0x00]), signature]))

  const certDer = seq(tbs, sigAlg, sigBitString)
  const b64 = certDer.toString('base64').match(/.{1,64}/g).join('\n')
  const certPem = `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`

  return { key: keyPem, cert: certPem }
}

// Vite plugin that starts a companion HTTPS mirror on port 5174 so phones over Wi-Fi
// get a Secure Context (window.isSecureContext = true) for the Live In-App Camera!
function mobileHttpsCameraBridge() {
  let httpsServer = null
  return {
    name: 'mobile-https-camera-bridge',
    configureServer(server) {
      try {
        const { key, cert } = createSelfSignedCert()
        httpsServer = https.createServer({ key, cert }, (req, res) => {
          const proxyReq = http.request(
            {
              hostname: '127.0.0.1',
              port: 5173,
              path: req.url,
              method: req.method,
              headers: { ...req.headers, host: 'localhost:5173' },
            },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
              proxyRes.pipe(res, { end: true })
            }
          )
          proxyReq.on('error', () => {
            if (!res.headersSent) res.writeHead(502)
            res.end('Vite dev server warming up...')
          })
          req.pipe(proxyReq, { end: true })
        })

        // Also proxy WebSocket HMR upgrades on port 5174
        httpsServer.on('upgrade', (req, socket, head) => {
          const proxyReq = http.request({
            hostname: '127.0.0.1',
            port: 5173,
            path: req.url,
            method: 'GET',
            headers: { ...req.headers, host: 'localhost:5173' },
          })
          proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
            socket.write(
              'HTTP/1.1 101 Switching Protocols\r\n' +
                Object.entries(proxyRes.headers)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join('\r\n') +
                '\r\n\r\n'
            )
            if (proxyHead && proxyHead.length) socket.write(proxyHead)
            proxySocket.pipe(socket).pipe(proxySocket)
          })
          proxyReq.on('error', () => socket.destroy())
          proxyReq.end()
        })

        httpsServer.on('error', () => {})
        httpsServer.listen(5174, '0.0.0.0', () => {
          console.log('  ➜  Mobile Live Camera (HTTPS): https://192.168.1.7:5174/')
        })

        server.httpServer?.on('close', () => {
          try {
            httpsServer?.close()
          } catch {
            // Ignore
          }
        })
      } catch (e) {
        console.warn('Could not start HTTPS camera bridge:', e)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), mobileHttpsCameraBridge()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
