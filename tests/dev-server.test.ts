import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts', 'dev.mjs');

function listen(port: number) {
  const server = createServer();
  return new Promise<typeof server>((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });
}

test('second pnpm run dev reuses a busy PORT instead of exiting 1', async () => {
  const dummy = await listen(0);
  const address = dummy.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;

  const child = spawn(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let out = '';
  child.stdout.on('data', (chunk) => {
    out += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    out += String(chunk);
  });

  await new Promise((resolve) => setTimeout(resolve, 1200));

  assert.equal(child.exitCode, null, `script exited early: ${out}`);
  assert.match(out, /already in use/);

  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 1000))]);
  dummy.close();
});
