import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const PREFIXES = ["", "/make-server-3159d1b2"];
const STATE_KEY = "caven:state";
const EDWARD_VOICE = Deno.env.get("ELEVENLABS_VOICE_ID") ?? "xru6qZB94sJdkyqP12qN";

import { CAVEN_SYSTEM } from "./caven_system.ts";

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

type ChatTurn = { role: "user" | "assistant"; content: string };

function mount(path: string, method: "get" | "post", handler: Parameters<typeof app.get>[1]) {
  for (const prefix of PREFIXES) {
    app[method](`${prefix}${path}`, handler);
  }
}

async function chatReply(message: string, history: ChatTurn[]): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const gatewayKey = Deno.env.get("AI_GATEWAY_API_KEY");

  if (anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 220,
        system: CAVEN_SYSTEM,
        messages: [
          ...history.slice(-8).map((t) => ({ role: t.role, content: t.content })),
          { role: "user", content: message },
        ],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status} ${await res.text()}`);
    const data = await res.json();
    const text = data?.content?.find((b: { type?: string }) => b.type === "text")?.text;
    if (!text) throw new Error("anthropic empty");
    return String(text).trim();
  }

  if (gatewayKey) {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${gatewayKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.6",
        max_tokens: 220,
        messages: [
          { role: "system", content: CAVEN_SYSTEM },
          ...history.slice(-8),
          { role: "user", content: message },
        ],
      }),
    });
    if (!res.ok) throw new Error(`gateway ${res.status} ${await res.text()}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("gateway empty");
    return String(text).trim();
  }

  throw new Error("no chat provider configured");
}

async function elevenLabsSpeak(text: string): Promise<ArrayBuffer> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EDWARD_VOICE}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.42,
        similarity_boost: 0.78,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status} ${await res.text()}`);
  return await res.arrayBuffer();
}

mount("/health", "get", (c) => c.json({ status: "ok" }));

mount("/chat", "post", async (c) => {
  try {
    const body = await c.req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const history = Array.isArray(body?.history) ? body.history : [];
    if (!message) return c.json({ error: "message required" }, 400);
    const reply = await chatReply(message, history);
    return c.json({ reply });
  } catch (err) {
    console.error("CAVEN chat failed:", err);
    return c.json({ error: "chat_unavailable" }, 502);
  }
});

mount("/tts", "post", async (c) => {
  try {
    const body = await c.req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return c.json({ error: "text required" }, 400);
    const audio = await elevenLabsSpeak(text);
    return new Response(audio, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("CAVEN tts failed:", err);
    return c.json({ error: "tts_unavailable" }, 502);
  }
});

mount("/state", "get", async (c) => {
  try {
    const value = await kv.get(STATE_KEY);
    return c.json({ state: value ?? null });
  } catch (err) {
    console.error("CAVEN state get failed:", err);
    return c.json({ error: "state_unavailable" }, 502);
  }
});

mount("/state", "post", async (c) => {
  try {
    const body = await c.req.json();
    const state = body?.state ?? body;
    await kv.set(STATE_KEY, state);
    return c.json({ ok: true });
  } catch (err) {
    console.error("CAVEN state set failed:", err);
    return c.json({ error: "state_unavailable" }, 502);
  }
});

Deno.serve(app.fetch);
