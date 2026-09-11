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
  if(error) return json({error:error.code==='40001'?'Your board changed on another device. Reload before retrying.':'Save failed. Please retry.'},error.code==='40001'?409:503);
  return json({version:data});
 } catch(err) {return apiError(err);}
}
