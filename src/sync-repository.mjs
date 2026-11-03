import {assertTasksWorkspace, mergeWorkspaces, snapshotMatches} from './sync-core.mjs';
/*
 * No service-role key is used. Supabase Auth and tasks2_* RLS authorize every request.
 * Expected-revision compare-and-swap avoids silently replacing a newer cloud snapshot.
 */
const TABLE='tasks2_workspaces';
export async function checkTasks2Access(client,userId) {
  const {data,error}=await client.from('tasks2_access').select('user_id').eq('user_id',userId).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('This account is not authorized for Tasks 2 synchronization.');
  return true;
}
export async function readTasks2Cloud(client,userId) {
  const {data,error}=await client.from(TABLE).select('snapshot,revision,updated_at').eq('user_id',userId).maybeSingle();
  if(error)throw error;
  return data||null;
}
export async function writeTasks2Cloud(client,userId,snapshot,expectedRevision) {
  assertTasksWorkspace(snapshot);
  if(expectedRevision==null) {
    const {data,error}=await client.from(TABLE)
      .insert({user_id:userId,snapshot,revision:1})
      .select('revision').maybeSingle();
    if(error?.code==='23505')return {conflict:true};
    if(error)throw error;
    if(!data)throw new Error('Cloud workspace could not be created.');
    return {conflict:false,revision:data.revision};
  }
  const {data,error}=await client.from(TABLE)
    .update({snapshot,revision:expectedRevision+1,updated_at:new Date().toISOString()})
    .eq('user_id',userId).eq('revision',expectedRevision)
    .select('revision').maybeSingle();
  if(error)throw error;
  if(!data)return {conflict:true};
  return {conflict:false,revision:data.revision};
}
export async function syncTasks2Snapshot({client,userId,local,baseline=null,maxAttempts=4}) {
  assertTasksWorkspace(local);
  await checkTasks2Access(client,userId);
  for(let attempt=0;attempt<maxAttempts;attempt++){
    const row=await readTasks2Cloud(client,userId);
    const {workspace,conflicts}=mergeWorkspaces(local,row?.snapshot??null,baseline);
    if(row && snapshotMatches(workspace,row.snapshot)){
      return {workspace,revision:row.revision,conflicts,uploaded:false};
    }
    const saved=await writeTasks2Cloud(client,userId,workspace,row?.revision??null);
    if(!saved.conflict){
      return {workspace,revision:saved.revision,conflicts,uploaded:true};
    }
  }
  throw new Error('Other devices changed Tasks during synchronization. Nothing was overwritten; retry syncing.');
}
