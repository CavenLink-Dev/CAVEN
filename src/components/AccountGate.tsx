import {useEffect,useState,type ReactNode} from 'react';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '../lib/supabase';
export function AccountGate({children}:{children:ReactNode}) {
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 if(loading)return <div className="grid h-full place-items-center">Opening CAVEN…</div>;
 if(session)return <div key={session.user.id} className="size-full">{children}</div>;
 return <main className="grid min-h-dvh place-items-center p-6"><form className="metal-surface w-full max-w-sm space-y-5 rounded-3xl p-7" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{const {error}=signup?await supabase.auth.signUp({email,password,options:{emailRedirectTo:location.origin}}):await supabase.auth.signInWithPassword({email,password});if(error)throw error;if(signup)setMessage('Check your email to confirm your account, then sign in.')}catch(e){setMessage(e instanceof Error?e.message:'Could not sign in.')}finally{setBusy(false)}}}>
 <h1 className="font-display text-3xl tracking-widest text-cyan-300">CAVEN</h1><p>Your life, your private board.</p>
 <label className="block">Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl bg-black/30 p-3" /></label>
 <label className="block">Password<input required minLength={8} type="password" autoComplete={signup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl bg-black/30 p-3" /></label>
 <button disabled={busy} className="min-h-12 w-full rounded-xl bg-cyan-900">{busy?'Please wait…':signup?'Create private account':'Sign in'}</button>
 <button type="button" className="min-h-11 w-full text-cyan-300" onClick={()=>{setSignup(!signup);setMessage('')}}>{signup?'Already have an account? Sign in':'Create an account'}</button>
 {message&&<p role="status">{message}</p>}<p className="text-sm opacity-70">Your previous shared board is preserved privately. It is not automatically assigned to a new account.</p>
 </form></main>
}
