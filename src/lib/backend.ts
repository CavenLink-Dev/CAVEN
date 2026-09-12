import { supabase } from './supabase';
export async function apiFetch(path: string, init: RequestInit = {}) {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) throw new Error('Please sign in.');
 const headers = new Headers(init.headers);
 headers.set('Authorization', `Bearer ${session.access_token}`);
 if(init.body) headers.set('Content-Type','application/json');
 return fetch(`/api/${path}`,{...init,headers});
}
