/* Shared authentication provider, isolated Tasks 2 data and auth session.
 * The publishable key is intentionally safe for browser use; no secret keys are used.
 */
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm';
const PUBLIC_CONFIG = { url: "https://appesztafatypbxzdunr.supabase.co", publishableKey: "sb_publishable_70RugEcKQxZWUa5eQfmyeg_y7AkVz9V" };
let pending=null;
export async function getTasks2Client(){
  if(!pending)pending=import(SDK_URL).then(({createClient})=>createClient(
    PUBLIC_CONFIG.url, PUBLIC_CONFIG.publishableKey, {
      auth: {persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'tasks2-supabase-auth'}
    }
  )).catch(error=>{pending=null;throw error;});
  return pending;
}
export async function signInTasks2(email,password){
  const client=await getTasks2Client();
  const {data,error}=await client.auth.signInWithPassword({email:String(email).trim(),password});
  if(error)throw error;
  return data.user;
}
export async function getTasks2User(){
  const client=await getTasks2Client();
  const {data,error}=await client.auth.getUser();
  if(error)return null;
  return data.user??null;
}
export async function signOutTasks2(){
  const client=await getTasks2Client();
  const {error}=await client.auth.signOut();
  if(error)throw error;
}
