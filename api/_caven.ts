import { createClient } from '@supabase/supabase-js';
export { CAVEN_SYSTEM } from '../shared/cavenSystem';
export const EDWARD_VOICE = process.env.ELEVENLABS_VOICE_ID ?? 'xru6qZB94sJdkyqP12qN';
export const SUPABASE_URL = 'https://egtzpvitcgquzppvlcrj.supabase.co';
const PUBLIC_KEY = 'sb_publishable_jSmTpEKgEQEDZm4DW8Mnkg_fnL9_Tle';
export function json(data: unknown, status=200) { return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}}); }
export async function authenticate(req: Request) {
 const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');
 if (!token) throw new Response('Sign in required',{status:401});
 const db=createClient(SUPABASE_URL,PUBLIC_KEY,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.auth.getUser(token);
 if(error || !data.user || data.user.is_anonymous) throw new Response('Sign in required',{status:401});
 return {db,user:data.user};
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
