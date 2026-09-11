import { CAVEN_SYSTEM, json } from "./_caven";

export const config = { runtime: "edge" };

type Turn = { role: "user" | "assistant"; content: string };

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const GATEWAY_MODEL = process.env.CHAT_MODEL || "anthropic/claude-sonnet-4.6";
const MAX_TOKENS = 220;

function cleanHistory(history: unknown): Turn[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((t: any) => (t?.role === "user" || t?.role === "assistant") && typeof t?.content === "string" && t.content.trim())
    .slice(-8)
    .map((t: any) => ({ role: t.role, content: String(t.content) }));
}

// --- Provider 1: Anthropic Messages API (most direct, used when a key exists) ---
async function viaAnthropic(key: string, message: string, history: Turn[]) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system: CAVEN_SYSTEM,
      messages: [...history, { role: "user", content: message }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { ok: false as const, status: res.status, detail: detail.slice(0, 400) };
  }
  const data = await res.json();
  const reply = (Array.isArray(data?.content) ? data.content : [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join(" ")
    .trim();
  return reply
    ? { ok: true as const, reply, via: "anthropic" }
    : { ok: false as const, status: 502, detail: "anthropic returned no text" };
}

// --- Provider 2: Vercel AI Gateway (OpenAI-compatible) ---
async function viaGateway(token: string, message: string, history: Turn[], via: string) {
  const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: GATEWAY_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: CAVEN_SYSTEM }, ...history, { role: "user", content: message }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { ok: false as const, status: res.status, detail: detail.slice(0, 400) };
  }
  const data = await res.json();
  const reply = String(data?.choices?.[0]?.message?.content ?? "").trim();
  return reply ? { ok: true as const, reply, via } : { ok: false as const, status: 502, detail: "gateway returned no text" };
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  // GET is a non-secret health probe: says which providers are configured, never their values.
  if (req.method === "GET") {
    return json({
      ok: true,
      providers: {
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        gateway: Boolean(process.env.AI_GATEWAY_API_KEY),
        oidc: Boolean(process.env.VERCEL_OIDC_TOKEN),
      },
      models: { anthropic: ANTHROPIC_MODEL, gateway: GATEWAY_MODEL },
    });
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return json({ error: "message required" }, 400);
    const history = cleanHistory(body?.history);

    // Try every configured provider in order; the first that answers wins.
    const attempts: Array<() => Promise<any>> = [];
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const gatewayKey = process.env.AI_GATEWAY_API_KEY;
    const oidc = process.env.VERCEL_OIDC_TOKEN;

    if (anthropicKey) attempts.push(() => viaAnthropic(anthropicKey, message, history));
    if (gatewayKey) attempts.push(() => viaGateway(gatewayKey, message, history, "gateway"));
    if (oidc) attempts.push(() => viaGateway(oidc, message, history, "gateway-oidc"));

    if (!attempts.length) {
      console.error("CAVEN chat: no provider configured (need ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY)");
      return json({ error: "chat_unconfigured", detail: "Set ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY in Vercel." }, 502);
    }

    const failures: string[] = [];
    for (const attempt of attempts) {
      try {
        const result = await attempt();
        if (result.ok) return json({ reply: result.reply, via: result.via });
        failures.push(`${result.status}: ${result.detail}`);
        console.error("CAVEN chat provider failed:", result.status, result.detail);
      } catch (err) {
        failures.push(String(err));
        console.error("CAVEN chat provider threw:", err);
      }
    }

    return json({ error: "chat_unavailable", detail: failures.join(" | ").slice(0, 600) }, 502);
  } catch (err) {
    console.error("CAVEN chat failed:", err);
    return json({ error: "chat_unavailable", detail: String(err).slice(0, 300) }, 502);
  }
}
