import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {apiFetch} from './backend';
import {DEFAULT_ADDRESS} from '../../shared/address';
export {addressOf, checkAddress, ADDRESS_LIMIT, DEFAULT_ADDRESS} from '../../shared/address';
import {applyCommand,runAction,type ActionKind,type CavenAction} from '../../shared/actions';
import type {Task,Habit,Reminder,CalendarEvent,VoiceNote,Transaction,Budget,JournalEntry,BrainMetric} from './mockData';
// lastDeleted is the undo slot: a delete verb stashes what it removed here so a
// spoken "undo" can put it back. Kept in the saved state (rather than in memory)
// so it survives a reload — a mishear noticed a minute later is still reversible.
export type DeletedRow={kind:'tasks';row:Task}|{kind:'reminders';row:Reminder}|{kind:'calendar';row:CalendarEvent}|{kind:'habits';row:Habit}|{kind:'voiceNotes';row:VoiceNote};
export type CavenData={tasks:Task[];habits:Habit[];reminders:Reminder[];calendar:CalendarEvent[];voiceNotes:VoiceNote[];transactions:Transaction[];budgets:Budget[];journal:JournalEntry[];brainMetrics:BrainMetric[];interests:string[];brainNotes:string[];address:string;lastDeleted?:DeletedRow};
export const seedData=():CavenData=>({tasks:[],habits:[],reminders:[],calendar:[],voiceNotes:[],transactions:[],budgets:[],journal:[],brainMetrics:[],interests:[],brainNotes:[],address:DEFAULT_ADDRESS});
type Patch=Partial<CavenData>|((prev:CavenData)=>CavenData);
// `status` is the boot-time line the board cards show in place of their content
// while !ready (loading, or the error that stopped us getting there). `lastError`
// is separate: a failure from a save/capture/perform *after* the board is already
// showing real data, so it doesn't blank the board out — it's meant to be shown
// as a small, dismissible strip instead. `loadFailed` lets a card tell "still
// loading" apart from "loading stopped, and here is a real Retry button".
type Store={data:CavenData;ready:boolean;status:string;loadFailed:boolean;lastError:string|null;reload:()=>Promise<void>;clearError:()=>void;update:(patch:Patch)=>Promise<void>;capture:(kind:ActionKind,text:string)=>Promise<{message:string;changed:boolean}>;perform:(actions:CavenAction[])=>Promise<{message:string;changed:boolean}>};
const Context=createContext<Store|null>(null);
export function CavenStoreProvider({children}:{children:ReactNode}) {
 const [data,setData]=useState(seedData),[ready,setReady]=useState(false),[status,setStatus]=useState('Loading your board…'),[loadFailed,setLoadFailed]=useState(false),[lastError,setLastError]=useState<string|null>(null);
 const current=useRef(data),version=useRef(0),queue=useRef<Promise<unknown>>(Promise.resolve()),loaded=useRef(false),mounted=useRef(true);
 const reload=useCallback(async()=>{setLoadFailed(false);setStatus('Loading your board…');try{const res=await apiFetch('state');if(!res.ok)throw new Error('Could not load your board.');const body=await res.json();if(!mounted.current)return;current.current={...seedData(),...body.state};version.current=body.version;setData(current.current);loaded.current=true;setReady(true);setStatus('Saved to your private account')}catch(e){if(!mounted.current)return;setStatus(e instanceof Error?e.message:'Load failed');setLoadFailed(true)}},[]);
 useEffect(()=>{mounted.current=true;void reload();return()=>{mounted.current=false}},[reload]);
 const enqueue=useCallback(<T,>(work:()=>Promise<T>):Promise<T>=>{const next=queue.current.then(work);queue.current=next.catch(()=>{});return next},[]);
 const save=useCallback(async(next:CavenData)=>{if(!loaded.current)throw new Error('Load your board before editing.');setStatus('Saving…');const res=await apiFetch('state',{method:'POST',body:JSON.stringify({state:next,version:version.current})});const body=await res.json();if(!res.ok){if(res.status===409)loaded.current=false;throw new Error(body.error||'Save failed. Please retry.')}version.current=body.version;current.current=next;if(mounted.current){setData(next);setStatus('Saved to your private account')}},[]);
 const update=useCallback((patch:Patch)=>enqueue(async()=>{try{await save(typeof patch==='function'?patch(current.current):{...current.current,...patch});setLastError(null)}catch(e){const msg=e instanceof Error?e.message:'Save failed. Please retry.';setStatus(msg);setLastError(msg)}}),[enqueue,save]);
 const capture=useCallback((kind:ActionKind,text:string)=>enqueue(async()=>{try{const result=applyCommand(kind,text,current.current);if(result.changed)await save(result.data);setLastError(null);return{message:result.message,changed:result.changed}}catch(e){const msg=e instanceof Error?e.message:'Save failed';setStatus(msg);setLastError(msg);throw e}}),[enqueue,save]);
 // Model-proposed actions. Same serialised queue and same optimistic `version`
 // handling as capture: the whole batch runs against current.current inside the
 // queued slot, so a concurrent capture can't be lost, and one save lands at the
 // end. runAction throws spoken English when it can't do a thing — let it through
 // untouched so the caller can say that instead of pretending it worked.
 const perform=useCallback((actions:CavenAction[])=>enqueue(async()=>{try{let next=current.current,changed=false;const said:string[]=[];for(const action of actions){const result=runAction(action,next);next=result.data;if(result.message)said.push(result.message);if(result.changed)changed=true}if(changed)await save(next);setLastError(null);return{message:said.join(' '),changed}}catch(e){const msg=e instanceof Error?e.message:'Save failed';setStatus(msg);setLastError(msg);throw e}}),[enqueue,save]);
 const clearError=useCallback(()=>setLastError(null),[]);
 return <Context.Provider value={{data,ready,status,loadFailed,lastError,reload,clearError,update,capture,perform}}>{children}</Context.Provider>
}
export function useCavenStore(){const s=useContext(Context);if(!s)throw new Error('Missing CAVEN store');return s}
