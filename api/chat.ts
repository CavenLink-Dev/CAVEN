import { boardBrief } from "../shared/boardBrief";
import { CAVEN_SYSTEM, json, loadCavenState } from "./_caven";

export const config = { runtime: "edge" };

type Turn = { role: "user" | "assistant"; content: string };

const MAX_TOKENS = 200;
// Free tiers meter tokens per minute, so a rate-limited turn is normal, not
// exceptional. Retry briefly, then step down to a cheaper model.
const MAX_ATTEMPTS = 3;
const MAX_BACKOFF_MS = 2500;

// Every provider below except Anthropic speaks the OpenAI chat/completions
// shape, so one code path covers all of them. They are ordered fastest first:
// for a voice assistant, time-to-first-word matters more than raw model size.
// Set whichever key you actually have — the first configured one wins, and the
// rest act as automatic fallbacks if it errors or rate-limits.
type Provider = {
  name: string;
  url: string;
  key: string;
  model: string;
  kind: "openai" | "anthropic";
  headers?: Record<string, string>;
};

function providers(): Provider[] {
  const env = process.env as Record<string, string | undefined>;
  const list: Provider[] = [];

  // Groq — free tier, no card, ~10x the tokens/sec of anything else.
  if (env.GROQ_API_KEY) {
    list.push({
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: env.GROQ_API_KEY,
      model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
      kind: "openai",
    });
  }

  // Cerebras — free tier, also very fast.
  if (env.CEREBRAS_API_KEY) {
    list.push({
      name: "cerebras",
      url: "https://api.cerebras.ai/v1/chat/completions",
      key: env.CEREBRAS_API_KEY,
      model: env.CEREBRAS_MODEL || "llama-3.3-70b",
      kind: "openai",
    });
  }

  // Google AI Studio — free tier, no card, strong at holding a persona.
  if (env.GEMINI_API_KEY) {
    list.push({
      name: "gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL || "gemini-3.8-flash",
      kind: "openai",
    });
  }

  // OpenRouter — one key, many free models.
  if (env.OPENROUTER_API_KEY) {
    list.push({
      name: "openrouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
      kind: "openai",
      headers: { "http-referer": "https://caven-green.vercel.app", "x-title": "CAVEN" },
    });
  }

  // Escape hatch: any other OpenAI-compatible endpoint.
  if (env.CHAT_API_KEY && env.CHAT_BASE_URL) {
    list.push({
      name: "custom",
      url: `${env.CHAT_BASE_URL.replace(/\/+$/, "")}/chat/completions`,
      key: env.CHAT_API_KEY,
      model: env.CHAT_MODEL || "gpt-4o-mini",
      kind: "openai",
    });
  }

  // Paid paths, kept so nothing breaks if a key is added later.
  if (env.ANTHROPIC_API_KEY) {
    list.push({
      name: "anthropic",
      url: "https://api.anthropic.com/v1/messages",
      key: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL || "claude-sonnet-5",
      kind: "anthropic",
    });
  }
  const gatewayToken = env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN;
  if (gatewayToken) {
    list.push({
      name: env.AI_GATEWAY_API_KEY ? "gateway" : "gateway-oidc",
      url: "https://ai-gateway.vercel.sh/v1/chat/completions",
      key: gatewayToken,
      model: env.GATEWAY_MODEL || "anthropic/claude-sonnet-4.6",
      kind: "openai",
    });
  }

  return list;
}

// Providers retire model ids without warning (Groq especially), which used to
// mean a hard 404 and a dead assistant. So: on model_not_found we ask the
// provider what it actually serves and retry once with the best match.
const resolved = new Map<string, string>();

async function listModels(p: Provider): Promise<string[]> {
  const base = p.url.replace(/\/chat\/completions$/, "");
  const res = await fetch(`${base}/models`, {
    headers: { authorization: `Bearer ${p.key}`, ...(p.headers ?? {}) },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (Array.isArray(data?.data) ? data.data : []).map((m: any) => String(m?.id ?? "")).filter(Boolean);
}

// Skip anything that isn't a general chat model, then prefer the bigger,
// better-instruction-following ones — persona work needs the headroom.
const NOT_CHAT = /whisper|tts|embed|guard|moderation|rerank|ocr|image|vision|diarization|safety|prompt-?guard/i;
const PREFERENCES = [
  /llama-4.*(maverick|scout)/i,
  /llama-3\.3-70b/i,
  /70b/i,
  /qwen3\.8/i,
  /qwen3\.6/i,
  /qwen/i,
  /compound$/i,
  /gpt-oss-20b/i,
  /instant/i,
];

// Ordered best-first, so a rate-limited or missing model can step down the list.
export function rankModels(ids: string[]): string[] {
  const chat = ids.filter((id) => !NOT_CHAT.test(id));
  const ranked: string[] = [];
  for (const re of PREFERENCES) {
    for (const id of chat) if (re.test(id) && !ranked.includes(id)) ranked.push(id);
  }
  for (const id of chat) if (!ranked.includes(id)) ranked.push(id);
  return ranked;
}

export function pickModel(ids: string[]): string | null {
  return rankModels(ids)[0] ?? null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Groq reports "Please try again in 1.5s" in the error body.
function retryAfterMs(res: Response, body: string): number {
  const header = Number(res.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, MAX_BACKOFF_MS);
  const m = body.match(/try again in ([\d.]+)\s*s/i);
  return m ? Math.min(Math.ceil(parseFloat(m[1]) * 1000) + 150, MAX_BACKOFF_MS) : 0;
}

function cleanHistory(history: unknown): Turn[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (t: any) =>
        (t?.role === "user" || t?.role === "assistant") && typeof t?.content === "string" && t.content.trim(),
    )
    .slice(-8)
    .map((t: any) => ({ role: t.role, content: String(t.content) }));
}

function openaiReply(data: unknown): string {
  const msg = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message;
  const content = msg?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : textPart(part)))
      .join(" ")
      .trim();
  }
  return "";
}

function textPart(part: unknown): string {
  if (!part || typeof part !== "object") return "";
  const p = part as { text?: unknown; content?: unknown };
  return typeof p.text === "string" ? p.text : typeof p.content === "string" ? p.content : "";
}

async function callOnce(p: Provider, model: string, message: string, history: Turn[], board: string) {
  const isAnthropic = p.kind === "anthropic";
  const system = board ? `${CAVEN_SYSTEM}\n\n${board}` : CAVEN_SYSTEM;

  const res = await fetch(p.url, {
    method: "POST",
    headers: isAnthropic
      ? { "x-api-key": p.key, "anthropic-version": "2023-06-01", "content-type": "application/json" }
      : { authorization: `Bearer ${p.key}`, "content-type": "application/json", ...(p.headers ?? {}) },
    body: JSON.stringify(
      isAnthropic
        ? {
            model,
            max_tokens: MAX_TOKENS,
            system,
            messages: [...history, { role: "user", content: message }],
          }
        : {
            model,
            max_tokens: MAX_TOKENS,
            // A touch of heat, or the fillers and varied sentence lengths get
            // ironed flat and CAVEN starts sounding like a form letter again.
            temperature: 0.9,
            // gpt-oss reasons before answering; at default effort it spends the
            // whole budget thinking and returns empty content.
            ...(/gpt-oss/i.test(model) ? { reasoning_effort: "low" } : {}),
            messages: [
              { role: "system", content: CAVEN_SYSTEM },
              ...(board ? [{ role: "system" as const, content: board }] : []),
              ...history,
              { role: "user", content: message },
            ],
          },
    ),
  });

  if (!res.ok) {
    const detail = await res.text();
    return {
      ok: false as const,
      status: res.status,
      detail: `${p.name} ${res.status}: ${detail.slice(0, 300)}`,
      raw: detail,
      waitMs: res.status === 429 ? retryAfterMs(res, detail) : 0,
    };
  }

  const data = await res.json();
  const reply = isAnthropic
    ? (Array.isArray(data?.content) ? data.content : [])
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join(" ")
        .trim()
    : openaiReply(data);

  return reply
    ? { ok: true as const, reply, via: p.name, model }
    : { ok: false as const, status: 502, detail: `${p.name} returned no text`, raw: "" };
}

async function callProvider(p: Provider, message: string, history: Turn[], board: string) {
  const queue: string[] = [resolved.get(p.name) ?? p.model];
  let discovered = false;
  let last: any = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS && queue.length; attempt++) {
    const model = queue.shift() as string;
    last = await callOnce(p, model, message, history, board);

    if (last.ok) {
      if (model !== p.model) resolved.set(p.name, model);
      return last;
    }

    // A brief rate limit is worth simply waiting out — free tiers meter per
    // minute and the provider tells us how long.
    if (last.status === 429 && last.waitMs && attempt < MAX_ATTEMPTS - 1) {
      await sleep(last.waitMs);
      last = await callOnce(p, model, message, history, board);
      if (last.ok) {
        if (model !== p.model) resolved.set(p.name, model);
        return last;
      }
    }

    if (p.kind === "anthropic") break;

    // Missing, still limited, or silent — step down to the next best model the
    // provider actually serves.
    const worthStepping =
      last.status === 404 ||
      last.status === 429 ||
      last.status === 502 ||
      /model_not_found|does not exist|unknown model/i.test(last.raw ?? "");
    if (!worthStepping) break;

    if (!discovered) {
      discovered = true;
      const ranked = rankModels(await listModels(p));
      for (const id of ranked) if (id !== model && !queue.includes(id)) queue.push(id);
      if (!ranked.length) {
        last = { ...last, detail: `${last.detail} | ${p.name} lists no usable chat models` };
        break;
      }
      console.log(`CAVEN chat: ${p.name}/${model} failed (${last.status}); trying ${queue.slice(0, 2).join(", ")}`);
    }
  }

  return last;
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  // Non-secret health probe: says which providers are wired up, never a key.
  // ?models=1 also asks each one what it currently serves.
  if (req.method === "GET") {
    const configured = providers();

    if (new URL(req.url).searchParams.has("models")) {
      const listed = await Promise.all(
        configured.map(async (p) => {
          if (p.kind === "anthropic") return { provider: p.name, configured: p.model };
          const ids = await listModels(p);
          return { provider: p.name, configured: p.model, picked: pickModel(ids), available: ids };
        }),
      );
      return json({ ok: true, listed });
    }

    const { present: board } = await loadBoard();
    return json({
      ok: configured.length > 0,
      configured: configured.map((p) => ({ provider: p.name, model: p.model })),
      board,
      hint: configured.length
        ? undefined
        : "Set one of GROQ_API_KEY, GEMINI_API_KEY, CEREBRAS_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY.",
    });
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return json({ error: "message required" }, 400);
    const history = cleanHistory(body?.history);
    const { brief: board } = await loadBoard();

    const configured = providers();
    if (!configured.length) {
      console.error("CAVEN chat: no provider configured");
      return json(
        {
          error: "chat_unconfigured",
          detail: "Set GROQ_API_KEY (free, fastest) or GEMINI_API_KEY in Vercel.",
        },
        502,
      );
    }

    const failures: string[] = [];
    for (const p of configured) {
      try {
        const result = await callProvider(p, message, history, board);
        if (result.ok) return json({ reply: result.reply, via: result.via });
        failures.push(result.detail);
        console.error("CAVEN chat provider failed:", result.detail);
      } catch (err) {
        failures.push(`${p.name} threw: ${String(err).slice(0, 200)}`);
        console.error("CAVEN chat provider threw:", p.name, err);
      }
    }

    return json({ error: "chat_unavailable", detail: failures.join(" | ").slice(0, 600) }, 502);
  } catch (err) {
    console.error("CAVEN chat failed:", err);
    return json({ error: "chat_unavailable", detail: String(err).slice(0, 300) }, 502);
  }
}
