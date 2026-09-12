// `.js` on every relative import. This file is pulled into both an Edge bundle
// (api/chat) and a Node one (api/push-dispatch); extensionless worked while it
// was Edge-only, but Node resolves the specifier literally and throws
// ERR_MODULE_NOT_FOUND at invocation. `.js` is correct for both — the emitted
// siblings are .js either way.
import { createClient } from '@supabase/supabase-js';
import { signedInUser } from '../shared/authUser.js';
import { GEORGE_VOICE, preferredVoice } from '../shared/ttsVoice.js';
export { CAVEN_SYSTEM } from '../shared/cavenSystem.js';
export const EDWARD_VOICE = preferredVoice(process.env.ELEVENLABS_VOICE_ID);
export const PREMADE_VOICE = GEORGE_VOICE;
export const SUPABASE_URL = 'https://egtzpvitcgquzppvlcrj.supabase.co';
const PUBLIC_KEY = 'sb_publishable_jSmTpEKgEQEDZm4DW8Mnkg_fnL9_Tle';
export function json(data: unknown, status=200) { return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}}); }

async function userFromAccessToken(token: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: PUBLIC_KEY },
  });
  if (!res.ok) throw new Response('Sign in required', { status: 401 });
  const user = signedInUser(await res.json());
  if (!user) throw new Response('Sign in required', { status: 401 });
  return user;
}

export async function authenticate(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token) throw new Response('Sign in required', { status: 401 });
  const user = await userFromAccessToken(token);
  const db = createClient(SUPABASE_URL, PUBLIC_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { db, user };
}
export function adminDb() {
 const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key) throw new Error('Storage unavailable');
 return createClient(SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function loadCavenState(req: Request) {
 const {db,user}=await authenticate(req);
 const {data,error}=await db.from('caven_boards').select('state,version').eq('user_id',user.id).maybeSingle();
 if(error) throw new Error('Could not load your board');
 return data ?? {state:null,version:0};
}
export function apiError(err: unknown) { return err instanceof Response ? err : json({error:'Service unavailable. Please retry.'},503); }
