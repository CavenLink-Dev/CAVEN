import { supabase } from './supabase';
export async function apiFetch(path: string, init: RequestInit = {}) {
 const { data: { session } } = await supabase.auth.getSession();
 // #region agent log
 fetch('http://127.0.0.1:7792/ingest/0c9af2b6-971e-47f4-ab55-4bfb6bcae431',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bd4e06'},body:JSON.stringify({sessionId:'bd4e06',runId:'pre-fix',hypothesisId:'C',location:'backend.ts:apiFetch',message:'apiFetch session',data:{path,method:init.method||'GET',hasSession:Boolean(session),anonymous:Boolean(session?.user?.is_anonymous),origin:typeof location!=='undefined'?location.origin:''},timestamp:Date.now()})}).catch(()=>{});
 // #endregion
 if (!session) throw new Error('Please sign in.');
 const headers = new Headers(init.headers);
 headers.set('Authorization', `Bearer ${session.access_token}`);
 if(init.body) headers.set('Content-Type','application/json');
 const res = await fetch(`/api/${path}`,{...init,headers});
 // #region agent log
 fetch('http://127.0.0.1:7792/ingest/0c9af2b6-971e-47f4-ab55-4bfb6bcae431',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bd4e06'},body:JSON.stringify({sessionId:'bd4e06',runId:'pre-fix',hypothesisId:'A',location:'backend.ts:apiFetch:response',message:'apiFetch response',data:{path,status:res.status,ok:res.ok,contentType:res.headers.get('content-type')},timestamp:Date.now()})}).catch(()=>{});
 // #endregion
 return res;
}
