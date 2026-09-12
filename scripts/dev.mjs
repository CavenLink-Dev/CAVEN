#!/usr/bin/env node
/**
 * Figma Make / v0 writes `.env.development.local` after the first `pnpm run dev`,
 * then starts Vite a second time. The first process still owns $PORT (8443),
 * so a strict second bind exits 1 and the preview dies.
 *
 * If something healthy is already serving that port, exit 0 and let the first
 * Vite keep running — v0 treats a second hung `dev.mjs` as a failed start.
 */
import { createConnection } from "node:net"
import http from "node:http"
import { spawn } from "node:child_process"
import path from "node:path"

const port = Number(process.env.PORT || 8443)

function isListening(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" })
    socket.setTimeout(750)
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("timeout", () => {
      socket.destroy()
      resolve(false)
    })
    socket.once("error", () => {
      socket.destroy()
      resolve(false)
    })
  })
}

/** True when the process on $PORT is serving a Vite dev page, not some other listener. */
function probeVite(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: "127.0.0.1", port, path: "/", timeout: 2000 },
      (res) => {
        let body = ""
        res.setEncoding("utf8")
        res.on("data", (chunk) => {
          body += chunk
          if (body.length > 16_384) req.destroy()
        })
        res.on("end", () => {
          resolve(
            res.statusCode !== undefined &&
              res.statusCode < 500 &&
              (body.includes("@vite/client") ||
                body.includes("/@react-refresh") ||
                (body.includes('id="root"') && body.includes("<script"))),
          )
        })
      },
    )
    req.on("timeout", () => {
      req.destroy()
      resolve(false)
    })
    req.on("error", () => resolve(false))
  })
}

if (await isListening(port)) {
  if (await probeVite(port)) {
    console.log(
      `Dev server already running at http://127.0.0.1:${port} — reusing it.`,
    )
    process.exit(0)
  }
  console.error(
    `Port ${port} is in use but does not look like Vite. Stop the other process or set PORT to a free port.`,
  )
  process.exit(1)
}

const viteJs = path.resolve(process.cwd(), "node_modules/vite/bin/vite.js")
const child = spawn(process.execPath, [viteJs], { stdio: "inherit" })
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal)
  })
}
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
