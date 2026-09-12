import {authenticate,loadCavenState,json,apiError} from './_caven';
export const config={runtime:'edge'};
const fields=['tasks','habits','reminders','calendar','voiceNotes','transactions','budgets','journal','brainMetrics','interests','brainNotes'];
export default async function handler(req: Request) {
 try {
  if(req.method==='GET') return json(await loadCavenState(req));
  if(req.method!=='POST') return json({error:'method_not_allowed'},405);
  const {db}=await authenticate(req);
  const raw=await req.text();
  if(raw.length>500000) return json({error:'Board too large'},413);
  const {state,version}=JSON.parse(raw);
  if(!Number.isSafeInteger(version)||version<0||!state||fields.some(f=>!Array.isArray(state[f]))||fields.some(f=>state[f].length>2000)) return json({error:'Invalid board'},400);
  if(state.reminders.some((r:any)=>!r.id||typeof r.title!=='string'||(r.dueAt&&!Number.isFinite(Date.parse(r.dueAt))))) return json({error:'Invalid reminder'},400);
  const {data,error}=await db.rpc('save_caven_board',{expected_version:version,new_state:state});
  // A version conflict is 'PT409' — the deployed function raises that so PostgREST
  // maps it straight to an HTTP 409. This route only looked for '40001', which the
  // function stopped raising, so every conflict came back as a bare 503 "Save
  // failed. Please retry." — a retry that could never succeed, which is exactly
  // the dead end the two-tab test hit. Both codes are honoured now.
  if(error){const conflict=error.code==='PT409'||error.code==='40001';return json({error:conflict?'Your board changed on another device. Reload before retrying.':'Save failed. Please retry.'},conflict?409:503);}
  return json({version:data});
 } catch(err) {return apiError(err);}
}
