import {validateWorkspace, mergeWorkspaces, cloudEqual} from './sync-core.mjs';
const WORKSPACES='tasks2_workspaces';
export async function authorize(client,userId){
  const {data,error}=await client.from('tasks2_access').select('user_id').eq('user_id',userId).maybeSingle();
  if(error)throw error;
  if(!data)throw Error('This account does not have access to Tasks 2.');
}
export async function getCloudSnapshot(client,userId){
  const {data,error}=await client.from(WORKSPACES).select('snapshot,revision,updated_at').eq('user_id',userId).maybeSingle();
  if(error)throw error;
  return data||null;
}
async function tryWrite(client,userId,workspace,revision){
  validateWorkspace(workspace);
  if(revision==null){
    const {data,error}=await client.from(WORKSPACES).insert({user_id:userId,snapshot:workspace,revision:1}).select('revision').maybeSingle();
    if(error?.code==='23505')return null;
    if(error)throw error;
    if(!data)throw Error('First cloud save was not confirmed.');
    return data.revision;
  }
  const {data,error}=await client.from(WORKSPACES)
    .update({snapshot:workspace,revision:revision+1,updated_at:new Date().toISOString()})
    .eq('user_id',userId).eq('revision',revision).select('revision').maybeSingle();
  if(error)throw error;
  return data?.revision??null; // compare-and-swap: retry if another device won.
}
export async function synchronize({client,userId,local,baseline=null}){
  validateWorkspace(local);
  await authorize(client,userId);
  for(let attempt=0;attempt<5;attempt++){
    const row=await getCloudSnapshot(client,userId);
    const merged=mergeWorkspaces(local,row?.snapshot??null,baseline);
    if(row&&cloudEqual(merged.workspace,row.snapshot))
      return {...merged,revision:row.revision,written:false};
    const revision=await tryWrite(client,userId,merged.workspace,row?.revision??null);
    if(revision!=null) return {...merged,revision,written:true};
  }
  throw Error('Another device changed Tasks repeatedly. Local edits were kept; try Sync now.');
}