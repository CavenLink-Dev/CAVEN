import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {apiFetch} from './backend';
import {DEFAULT_ADDRESS} from '../../shared/address';
export {addressOf, checkAddress, ADDRESS_LIMIT, DEFAULT_ADDRESS} from '../../shared/address';
import {applyCommand,runAction,type ActionKind,type CavenAction} from '../../shared/actions';
import type {Task,Habit,Reminder,CalendarEvent,VoiceNote,Transaction,Budget,JournalEntry,BrainMetric} from './mockData';
export type CavenData={tasks:Task[];habits:Habit[];reminders:Reminder[];calendar:CalendarEvent[];voiceNotes:VoiceNote[];transactions:Transaction[];budgets:Budget[];journal:JournalEntry[];brainMetrics:BrainMetric[];interests:string[];brainNotes:string[];address:string};
export const seedData=():CavenData=>({tasks:[],habits:[],reminders:[],calendar:[],voiceNotes:[],transactions:[],budgets:[],journal:[],brainMetrics:[],interests:[],brainNotes:[],address:DEFAULT_ADDRESS});
type Patch=Partial<CavenData>|((prev:CavenData)=>CavenData);
type Store={data:CavenData;ready:boolean;status:string;reload:()=>Promise<void>;update:(patch:Patch)=>Promise<void>;capture:(kind:ActionKind,text:string)=>Promise<{message:string;changed:boolean}>;perform:(actions:CavenAction[])=>Promise<{message:string;changed:boolean}>};
const Context=createContext<Store|null>(null);
export function CavenStoreProvider({children}:{children:ReactNode}) {
 const [data,setData]=useState(seedData),[ready,setReady]=useState(false),[status,setStatus]=useState('Loading your board…');
 const current=useRef(data),version=useRef(0),queue=useRef<Promise<unknown>>(Promise.resolve()),loaded=useRef(false),mounted=useRef(true);
 const reload=useCallback(async()=>{try{const res=await apiFetch('state');if(!res.ok)throw new Error('Could not load your board. Retry before editing.');const body=await res.json();if(!mounted.current)return;current.current={...seedData(),...body.state};version.current=body.version;setData(current.current);loaded.current=true;setReady(true);setStatus('Saved to your private account');}catch(e){setStatus(e instanceof Error?e.message:'Load failed');}},[]);
 useEffect(()=>{mounted.current=true;void reload();return()=>{mounted.current=false}},[reload]);
 const enqueue=useCallback(<T,>(work:()=>Promise<T>):Promise<T>=>{const next=queue.current.then(work);queue.current=next.catch(()=>{});return next},[]);
 const save=useCallback(async(next:CavenData)=>{if(!loaded.current)throw new Error('Load your board before editing.');setStatus('Saving…');const res=await apiFetch('state',{method:'POST',body:JSON.stringify({state:next,version:version.current})});const body=await res.json();if(!res.ok){if(res.status===409)loaded.current=false;throw new Error(body.error||'Save failed. Please retry.');}version.current=body.version;current.current=next;if(mounted.current){setData(next);setStatus('Saved to your private account');}},[]);
 const update=useCallback((patch:Patch)=>enqueue(async()=>{try{await save(typeof patch==='function'?patch(current.current):{...current.current,...patch});}catch(e){setStatus(e instanceof Error?e.message:'Save failed. Please retry.');}}),[enqueue,save]);
 const capture=useCallback((kind:ActionKind,text:string)=>enqueue(async()=>{try{const result=applyCommand(kind,text,current.current);if(result.changed)await save(result.data);return{message:result.message,changed:result.changed};}catch(e){setStatus(e instanceof Error?e.message:'Save failed');throw e;}}),[enqueue,save]);
 // Model-proposed actions. Same serialised queue and same optimistic `version`
 // handling as capture: the whole batch runs against current.current inside the
 // queued slot, so a concurrent capture can't be lost, and one save lands at the
 // end. runAction throws spoken English when it can't do a thing — let it through
 // untouched so the caller can say that instead of pretending it worked.
 const perform=useCallback((actions:CavenAction[])=>enqueue(async()=>{try{let next=current.current,changed=false;const said:string[]=[];for(const action of actions){const result=runAction(action,next);next=result.data;if(result.message)said.push(result.message);if(result.changed)changed=true;}if(changed)await save(next);return{message:said.join(' '),changed};}catch(e){setStatus(e instanceof Error?e.message:'Save failed');throw e;}}),[enqueue,save]);
 return <Context.Provider value={{data,ready,status,reload,update,capture,perform}}>{children}</Context.Provider>
}
export function useCavenStore(){const s=useContext(Context);if(!s)throw new Error('Missing CAVEN store');return s}
