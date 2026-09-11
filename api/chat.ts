import { CAVEN_SYSTEM, json } from "./_caven";

export const config = { runtime: "edge" };

type Turn = { role: "user" | "assistant"; content: string };

const MAX_TOKENS = 300;

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

async function callProvider(p: Provider, message: string, history: Turn[]) {
  const isAnthropic = p.kind === "anthropic";

  const res = await fetch(p.url, {
    method: "POST",
    headers: isAnthropic
      ? { "x-api-key": p.key, "anthropic-version": "2023-06-01", "content-type": "application/json" }
      : { authorization: `Bearer ${p.key}`, "content-type": "application/json", ...(p.headers ?? {}) },
    body: JSON.stringify(
      isAnthropic
        ? {
            model: p.model,
            max_tokens: MAX_TOKENS,
            system: CAVEN_SYSTEM,
            messages: [...history, { role: "user", content: message }],
          }
        : {
            model: p.model,
            max_tokens: MAX_TOKENS,
            // A touch of heat, or the fillers and varied sentence lengths get
            // ironed flat and CAVEN starts sounding like a form letter again.
            temperature: 0.9,
            messages: [
              { role: "system", content: CAVEN_SYSTEM },
              ...history,
              { role: "user", content: message },
            ],
          },
    ),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { ok: false as const, status: res.status, detail: `${p.name} ${res.status}: ${detail.slice(0, 300)}` };
  }

  const data = await res.json();
  const reply = isAnthropic
    ? (Array.isArray(data?.content) ? data.content : [])
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join(" ")
        .trim()
    : String(data?.choices?.[0]?.message?.content ?? "").trim();

  return reply
    ? { ok: true as const, reply, via: p.name }
    : { ok: false as const, status: 502, detail: `${p.name} returned no text` };
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  // Non-secret health probe: says which providers are wired up, never a key.
  if (req.method === "GET") {
    const configured = providers();
    return json({
      ok: configured.length > 0,
      configured: configured.map((p) => ({ provider: p.name, model: p.model })),
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
        const result = await callProvider(p, message, history);
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
