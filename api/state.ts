import { STATE_KEY, json, supabaseAdmin } from "./_caven";

export const config = { runtime: "edge" };

function restHeaders(key: string) {
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    prefer: "return=minimal",
  };
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  try {
    const { url, key } = supabaseAdmin();
    const endpoint = `${url}/rest/v1/kv_store_3159d1b2`;

    if (req.method === "GET") {
      const res = await fetch(`${endpoint}?key=eq.${encodeURIComponent(STATE_KEY)}&select=value`, {
        headers: restHeaders(key),
      });
      if (!res.ok) throw new Error(`supabase get ${res.status} ${await res.text()}`);
      const rows = await res.json();
      return json({ state: rows?.[0]?.value ?? null });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const state = body?.state ?? body;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { ...restHeaders(key), prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ key: STATE_KEY, value: state }),
      });
      if (!res.ok) throw new Error(`supabase set ${res.status} ${await res.text()}`);
      return json({ ok: true });
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (err) {
    console.error("CAVEN state failed:", err);
    return json({ error: "state_unavailable" }, 502);
  }
}
