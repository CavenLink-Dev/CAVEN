import * as chrono from 'chrono-node';
import type {CavenData} from '../src/lib/store';
export type ActionKind='reminder'|'tasks'|'journal'|'voicenote'|'calendar'|'habits'|'finance'|'brain';
export function applyCommand(kind:ActionKind,text:string,prev:CavenData,now=new Date()):{data:CavenData;message:string;changed:boolean} {
 const said=text.trim(), id=crypto.randomUUID(), day=now.toLocaleDateString('en-AU'), unchanged={data:prev,message:'Here it is.',changed:false};
 // Queries and negations never mutate data. Viewing and writing are separate operations.
 if(/^(show|what|how|when|where|do i|did i|have i|can you show|tell me|open|check|don'?t (add|save|create|log|delete)|do not)\b/i.test(said)) return unchanged;
 if(kind==='reminder' && /\b(remind me|set a reminder|reminder for|nudge me|wake me|let me forget)\b/i.test(said)) {
  const match=chrono.en.GB.parse(said,now,{forwardDate:true})[0];
  if(!match||!match.start.isCertain('hour'))throw new Error('What date and time should I remind you, sir? Nothing has been saved yet.');
  const due=match.start.date();
  if(due.getTime()<=now.getTime())throw new Error('That time has already passed, sir. Please give me a future date and time.');
  const title=(said.slice(0,match.index)+said.slice(match.index+match.text.length)).replace(/^(?:caven[, ]*)?(?:remind me(?: to)?|set a reminder(?: for)?|nudge me(?: to)?|wake me|don'?t let me forget(?: to)?)\s*/i,'').replace(/\b(at|on|for)\s*$/i,'').trim()||'Reminder';
  return {data:{...prev,reminders:[{id,title,date:due.toLocaleDateString('en-AU'),time:due.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'}),dueAt:due.toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},...prev.reminders]},message:`It's down for ${due.toLocaleString('en-AU')}. I'll see to it.`,changed:true};
 }
 if(kind==='tasks') {
  const done=said.match(/^(?:please )?(?:tick|cross) (.+?) off(?: my (?:list|tasks))?$/i)||said.match(/^(?:complete|finish|mark complete) (.+)$/i);
  if(done){const target=prev.tasks.filter(t=>t.title.toLowerCase()===done[1].toLowerCase());if(target.length!==1)throw new Error('Please use the exact task name, sir. Nothing changed.');return{data:{...prev,tasks:prev.tasks.map(t=>t.id===target[0].id?{...t,done:true}:t)},message:"That's done.",changed:true};}
  const add=said.match(/^(?:please )?(?:add (?:a |an )?task[: ]*|new task[: ]*|add )(.+?)(?: to my (?:tasks|list))?$/i);
  if(add)return{data:{...prev,tasks:[{id,title:add[1],done:false},...prev.tasks]},message:"Noted. It's on the list.",changed:true};
 }
 if(kind==='journal'&&/^(?:journal[: ]|(?:add|write|save|log)\b)/i.test(said))return{data:{...prev,journal:[{id,date:day,mood:'',title:'Journal entry',body:said.replace(/^journal[: ]*/i,'')},...prev.journal]},message:"It's in the journal.",changed:true};
 if(kind==='voicenote'&&/^(?:make|take|save|add|note|jot|remember)\b/i.test(said))return{data:{...prev,voiceNotes:[{id,text:said,when:day},...prev.voiceNotes]},message:"I've got that down.",changed:true};
 if(kind==='calendar'&&/^(book|schedule|add)\b/i.test(said))throw new Error('Calendar booking is not connected yet, sir. I can save a reminder with a date and time.');
 return unchanged;
}
