export { CAVEN_SYSTEM } from "../shared/cavenSystem";

export const STATE_KEY = "caven:state";
export const EDWARD_VOICE = process.env.ELEVENLABS_VOICE_ID ?? "goT3UYdM9bhm0n2lmKQx";

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "https://egtzpvitcgquzppvlcrj.supabase.co";
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY missing");
  return { url, key };
}

const KV_TABLE = "kv_store_3159d1b2";

export function restHeaders(key: string) {
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    prefer: "return=minimal",
  };
}

export function kvEndpoint(url: string) {
  return `${url}/rest/v1/${KV_TABLE}`;
}

export async function loadCavenState(): Promise<unknown | null> {
  const { url, key } = supabaseAdmin();
  const res = await fetch(`${kvEndpoint(url)}?key=eq.${encodeURIComponent(STATE_KEY)}&select=value`, {
    headers: restHeaders(key),
  });
  if (!res.ok) throw new Error(`supabase get ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows?.[0]?.value ?? null;
}
