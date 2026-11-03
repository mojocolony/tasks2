import {cloudClient,cloudUser,cloudLogin,cloudLogout} from './cloud-client.mjs';
import {authorize,synchronize} from './sync-repository.mjs';

const APPROVED='tasks2-cloud-enabled-v1:';
const enabledFor=id=>{try{return localStorage.getItem(APPROVED+id)==='yes';}catch{return false;}};
export function createSyncController({getLocal,adopt,loadBaseline,storeBaseline,onStatus}){
  const status={user:null,enabled:false,kind:'local',error:'',lastSynced:null,busy:false,conflicts:0};
  let queued=false,timer=null,sessionEpoch=0,pollTimer=null;
  const report=patch=>{Object.assign(status,patch);onStatus?.(status);};
  const schedule=(delay=1200)=>{
    if(!status.user||!status.enabled)return;
    clearTimeout(timer);
    timer=setTimeout(()=>{void run();},delay);
  };
  async function login(email,password){
    report({kind:'connecting',error:''});
    try{
      const user=await cloudLogin(email,password);
      const client=await cloudClient();
      try{await authorize(client,user.id);}catch(error){await cloudLogout();throw error;}
      sessionEpoch++;
      report({user,enabled:enabledFor(user.id),kind:enabledFor(user.id)?'pending':'ready',error:''});
      if(status.enabled)schedule(150);
    }catch(error){
      report({kind:'error',error:error.message||'Unable to sign in.'});
      throw error;
    }
  }
  async function initialize(){
    try{
      const user=await cloudUser();
      if(!user){report({kind:'local'});return;}
      const client=await cloudClient();
      await authorize(client,user.id);
      sessionEpoch++;
      report({user,enabled:enabledFor(user.id),kind:enabledFor(user.id)?'pending':'ready',error:''});
      if(status.enabled)schedule(200);
    }catch(error){
      report({kind:'error',error:'Cloud unavailable; tasks remain saved locally.'});
    }
  }
  async function enable(){
    if(!status.user)throw Error('Sign in first.');
    try{localStorage.setItem(APPROVED+status.user.id,'yes');}
    catch{throw Error('Unable to save sync preference on this device.');}
    report({enabled:true,kind:'pending',error:''});
    await run();
  }
  async function run(){
    if(!status.enabled||!status.user)return;
    if(status.busy){queued=true;return;}
    if(!navigator.onLine){report({kind:'offline',error:''});return;}
    const epoch=sessionEpoch,user=status.user;
    report({busy:true,kind:'syncing',error:''});
    let stillDirty=false;
    try{
      const client=await cloudClient();
      const baseline=await loadBaseline(user.id);
      const atStart=getLocal();
      const result=await synchronize({client,userId:user.id,local:atStart,baseline});
      if(epoch!==sessionEpoch||status.user?.id!==user.id)return;
      await storeBaseline(user.id,result.workspace);
      if(epoch!==sessionEpoch)return;
      stillDirty=await adopt(result.workspace,atStart,result.conflicts);
      report({kind:stillDirty?'pending':'synced',lastSynced:new Date(),conflicts:result.conflicts.length,error:''});
    }catch(error){
      if(epoch===sessionEpoch)report({kind:navigator.onLine?'error':'offline',error:error.message||'Could not sync. Local edits are safe.'});
    }finally{
      if(epoch===sessionEpoch){
        report({busy:false});
        if(queued||stillDirty){queued=false;schedule(400);}
      }
    }
  }
  async function logout(){
    clearTimeout(timer);
    sessionEpoch++;
    try{await cloudLogout();}
    finally{
      queued=false;
      report({user:null,enabled:false,busy:false,kind:'local',error:'',lastSynced:null,conflicts:0});
    }
  }
  function changed(){
    if(!status.enabled)return;
    if(!navigator.onLine){report({kind:'offline'});return;}
    report({kind:'pending'});
    schedule();
  }
  function onOnline(){if(status.enabled)schedule(250);}
  function onVisible(){if(status.enabled&&document.visibilityState==='visible')schedule(300);}
  window.addEventListener('online',onOnline);
  document.addEventListener('visibilitychange',onVisible);
  pollTimer=setInterval(()=>{if(status.enabled&&document.visibilityState==='visible')schedule(100);},60000);
  return {status,login,initialize,enable,run,logout,changed};
}