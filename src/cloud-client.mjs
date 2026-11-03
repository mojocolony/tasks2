/* Tasks 2 uses the same Supabase Auth identities as Watching,
   but its own session storage and tasks2_* RLS-protected tables. */
const SDK_URL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm';
const URL='https://appesztafatypbxzdunr.supabase.co';
const KEY='sb_publishable_70RugEcKQxZWUa5eQfmyeg_y7AkVz9V';
let clientPromise;
export async function cloudClient(){
  if(!clientPromise)clientPromise=import(SDK_URL).then(({createClient})=>
    createClient(URL,KEY,{auth:{
      persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
      storageKey:'tasks2-auth-session-v1'
    }})
  ).catch(error=>{clientPromise=null;throw error;});
  return clientPromise;
}
export async function cloudUser(){
  const client=await cloudClient();
  const {data,error}=await client.auth.getUser();
  if(error)return null;
  return data.user||null;
}
export async function cloudLogin(email,password){
  const client=await cloudClient();
  const {data,error}=await client.auth.signInWithPassword({email:String(email).trim(),password});
  if(error)throw error;
  return data.user;
}
export async function cloudLogout(){
  const client=await cloudClient();
  const {error}=await client.auth.signOut({scope:'local'});
  if(error)throw error;
}