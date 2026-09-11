import assert from "node:assert/strict"
import { createServer as createHttpServer } from "node:http"
import { spawn } from "node:child_process"
import { once } from "node:events"
import test from "node:test"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const script = path.join(root, "scripts", "dev.mjs")

function listenFakeVite(port: number) {
  const server = createHttpServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" })
    res.end(
      '<html><body><div id="root"></div><script type="module" src="/@vite/client"></script></body></html>',
    )
  })
  return new Promise<typeof server>((resolve, reject) => {
    server.listen(port, "127.0.0.1", () => resolve(server))
    server.once("error", reject)
  })
}

test("second pnpm run dev reuses a busy PORT instead of exiting 1", async () => {
  const dummy = await listenFakeVite(0)
  const address = dummy.address()
  assert.ok(address && typeof address === "object")
  const port = address.port

  const child = spawn(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  })

  let out = ""
  child.stdout.on("data", (chunk) => {
    out += String(chunk)
  })
  child.stderr.on("data", (chunk) => {
    out += String(chunk)
  })

  try {
    await once(child, "exit")
    assert.equal(child.exitCode, 0, out)
    assert.match(out, /already running|reusing it/)
  } finally {
    dummy.close()
  }
})
