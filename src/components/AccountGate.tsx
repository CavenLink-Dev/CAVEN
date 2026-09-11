import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5"><path d="m3 3 18 18M10.6 6.2A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3.2 3.8M6.2 6.8C3.7 8.5 2.5 12 2.5 12s3.5 6 9.5 6c.9 0 1.8-.2 2.6-.4" /></svg>
  );
}

export function AccountGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signup, setSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = signup
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: import.meta.env.VITE_SUPABASE_REDIRECT_URL ?? location.origin } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (signup) setMessage('Account created. Check your email to confirm your address, then sign in.');
    } catch (error) {
      const raw = error instanceof Error ? error.message.toLowerCase() : '';
      if (raw.includes('confirm')) setMessage('Please confirm your email before signing in.');
      else if (raw.includes('password') || raw.includes('credential') || raw.includes('user')) setMessage('Invalid email or password.');
      else if (raw.includes('rate')) setMessage('Too many attempts. Please try again shortly.');
      else setMessage('Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="auth-loading"><span className="auth-mark">C</span><span>Preparing your private board</span></div>;
  if (session) return <div key={session.user.id} className="size-full">{children}</div>;

  return (
    <main className="auth-shell">
      <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-brand"><span className="auth-brand-mark">C</span><span className="font-display tracking-[0.35em]">CAVEN</span></div>
        <div className="auth-intro"><p className="auth-kicker">PRIVATE INTELLIGENCE SYSTEM</p><h1 id="auth-title">{signup ? 'Create your account' : 'Welcome back'}</h1><p>{signup ? 'A calmer, sharper place to keep your life in order.' : 'Your private board is ready when you are.'}</p></div>
        <form className="auth-form" onSubmit={submit}>
          <label className="auth-label" htmlFor="auth-email">Email address</label>
          <input id="auth-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="auth-input" placeholder="you@example.com" />
          <div className="auth-password-heading"><label className="auth-label" htmlFor="auth-password">Password</label>{signup && <span className="auth-hint">8 characters minimum</span>}</div>
          <div className="auth-password-wrap"><input id="auth-password" required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="auth-input" placeholder="••••••••" /><button type="button" className="auth-eye" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}><EyeIcon visible={showPassword} /></button></div>
          {message && <p className="auth-message" role="status">{message}</p>}
          <button disabled={busy} className="auth-submit" type="submit">{busy ? 'Working…' : signup ? 'Create private account' : 'Sign in'}<span aria-hidden="true">→</span></button>
        </form>
        <div className="auth-switch">{signup ? 'Already have an account?' : 'New to CAVEN?'} <button type="button" onClick={() => { setSignup((value) => !value); setMessage(''); setShowPassword(false); }}>{signup ? 'Sign in' : 'Create an account'}</button></div>
        <p className="auth-privacy"><span aria-hidden="true">◈</span> Your board is private by design. We never share your personal data.</p>
      </section>
    </main>
  );
}
