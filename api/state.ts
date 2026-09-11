import { json, kvEndpoint, loadCavenState, restHeaders, STATE_KEY, supabaseAdmin } from "./_caven";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  try {
    if (req.method === "GET") {
      const state = await loadCavenState();
      return json({ state });
    }

    if (req.method === "POST") {
      const { url, key } = supabaseAdmin();
      const body = await req.json();
      const state = body?.state ?? body;
      const res = await fetch(kvEndpoint(url), {
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
