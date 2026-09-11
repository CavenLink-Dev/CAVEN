#!/usr/bin/env node
/**
 * Figma Make writes `.env.development.local` after the first `pnpm run dev`,
 * then starts Vite a second time. The first process still owns $PORT (8443),
 * so a strict second bind exits 1 and the preview dies.
 *
 * If something is already serving that port, stay attached to it instead of
 * launching another Vite.
 */
import { createConnection } from 'node:net'
import { spawn } from 'node:child_process'

const port = Number(process.env.PORT || 8443)

function isListening(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    socket.setTimeout(750)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

if (await isListening(port)) {
  console.log(`Port ${port} already in use — keeping the existing Vite server.`)
  await new Promise(() => {})
}

const child = spawn('vite', { stdio: 'inherit', shell: true })
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal)
  })
}
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
