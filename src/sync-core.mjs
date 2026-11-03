/*
 * Tasks 2 sync domain. Pure functions: no browser globals or network access.
 * Local edits remain canonical until a successful conditional cloud commit.
 * IMPORTANT: every task carries an updatedAt and a soft-delete tombstone.
 */
export const SYNC_APP_ID = 'tasks-now-later';
export const CANONICAL_IDS = ['now', 'later', 'someday'];

const clone = value => JSON.parse(JSON.stringify(value));
function canonical(value) {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
const same = (a,b) => canonical(a) === canonical(b);
const newer = (a,b) => {
  const x = Date.parse(a?.updatedAt ?? a?.createdAt ?? 0) || 0;
  const y = Date.parse(b?.updatedAt ?? b?.createdAt ?? 0) || 0;
  return x >= y ? a : b;
};
function hash(text) {
  let h=2166136261;
  for(const c of text) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
  return h.toString(36);
}
function choose(local,remote,base) {
  if(!local)return remote ? clone(remote) : null;
  if(!remote)return clone(local);
  if(same(local,remote))return clone(local);
  if(base){
    if(same(local,base))return clone(remote);
    if(same(remote,base))return clone(local);
  }
  return clone(newer(local,remote));
}
export function assertTasksWorkspace(snapshot) {
  if(!snapshot || snapshot.app!==SYNC_APP_ID || !Array.isArray(snapshot.tasks) || !Array.isArray(snapshot.lists))
    throw new Error('Not a Tasks 2 workspace.');
  if(JSON.stringify(snapshot).length > 1900000)throw new Error('Workspace is too large for cloud synchronization.');
  return snapshot;
}
export function mergeWorkspaces(localInput,remoteInput,baseInput=null) {
  const local=assertTasksWorkspace(clone(localInput));
  if(!remoteInput)return {workspace:local,conflicts:[]};
  const remote=assertTasksWorkspace(clone(remoteInput));
  const base=baseInput ? assertTasksWorkspace(clone(baseInput)) : null;
  const result={...local,tasks:[],lists:[]};
  const conflicts=[];
  const map=arr=>new Map(arr.map(x=>[x.id,x]));
  const mergeCollection=(key)=>{
    const l=map(local[key]),r=map(remote[key]),b=map(base?.[key]||[]);
    const combined=[];
    for(const id of new Set([...r.keys(),...l.keys()])) {
      const left=l.get(id),right=r.get(id),prior=b.get(id);
      // On removed custom lists prefer retention until a deletion tombstone is available.
      const winner=choose(left,right,prior);
      if(!winner)continue;
      combined.push(winner);
      if(key==='tasks'&&left&&right&&!same(left,right)) {
        const changedL=!prior||!same(left,prior);
        const changedR=!prior||!same(right,prior);
        if(changedL&&changedR){
          const loser=same(winner,left)?right:left;
          if(!loser.deletedAt&&!loser.clearedAt){
            const suffix=hash(canonical(loser));
            const conflictId='conflict-'+id+'-'+suffix;
            if(!combined.some(x=>x.id===conflictId) && !l.has(conflictId) && !r.has(conflictId)) {
              combined.push({...clone(loser),id:conflictId,title:loser.title+' (conflict copy)'});
              conflicts.push(id);
            }
          }
        }
      }
    }
    return combined;
  };
  result.lists=mergeCollection('lists');
  result.tasks=mergeCollection('tasks');
  for(const [order,id] of CANONICAL_IDS.entries()){
    let list=result.lists.find(x=>x.id===id);
    if(!list){list={id,name:id[0].toUpperCase()+id.slice(1),order,collapsed:false,permanent:true};result.lists.push(list);}
    list.permanent=true;
  }
  // A list removed from one device must never orphan tasks from another.
  const valid=new Set(result.lists.map(x=>x.id));
  for(const task of result.tasks)if(!valid.has(task.listId))task.listId='later';
  // Appearance and active page remain device-local.
  result.prefs=clone(local.prefs||remote.prefs||{});
  result.updatedAt=new Date(Math.max(Date.parse(local.updatedAt)||0,Date.parse(remote.updatedAt)||0)).toISOString();
  assertTasksWorkspace(result);
  return {workspace:result,conflicts};
}
export function snapshotMatches(a,b) {
  if(!a||!b)return false;
  return same(a.tasks,b.tasks)&&same(a.lists,b.lists);
}
