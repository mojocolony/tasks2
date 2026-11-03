/* Tasks 2: pure, deterministic merge helpers. No secrets or browser APIs. */
export const APP_ID = 'tasks-now-later';
export const DEFAULT_LIST_IDS = ['now', 'later', 'someday'];

const copy = value => JSON.parse(JSON.stringify(value));
function stable(value) {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return '['+value.map(stable).join(',')+']';
  if (value && typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
const eq=(a,b)=>stable(a)===stable(b);
const timestamp=value=>Date.parse(value?.updatedAt||value?.createdAt||'')||0;
function fingerprint(text) {
  let x=2166136261;
  for(const char of text)x=Math.imul(x^char.charCodeAt(0),16777619)>>>0;
  return x.toString(36);
}
export function validateWorkspace(value) {
  if(!value||value.app!==APP_ID||!Array.isArray(value.tasks)||!Array.isArray(value.lists)) throw Error('Invalid Tasks 2 workspace.');
  if(JSON.stringify(value).length>1800000)throw Error('This workspace exceeds the cloud size limit. Export a backup first.');
  return value;
}
export function cloudEqual(a,b) {
  return Boolean(a&&b&&eq(a.tasks,b.tasks)&&eq(a.lists,b.lists));
}
export function mergeWorkspaces(localInput,remoteInput,baselineInput=null) {
  const local=copy(validateWorkspace(localInput));
  if(!remoteInput)return {workspace:local,conflicts:[]};
  const remote=copy(validateWorkspace(remoteInput));
  const base=baselineInput?copy(validateWorkspace(baselineInput)):null;
  const result={...local,lists:[],tasks:[]};
  const conflicts=[];
  const maps=key=>[
    new Map(local[key].map(x=>[x.id,x])),
    new Map(remote[key].map(x=>[x.id,x])),
    new Map((base?.[key]||[]).map(x=>[x.id,x]))
  ];
  function choose(left,right,prior) {
    if(!left)return right;
    if(!right)return left;
    if(eq(left,right))return left;
    if(prior) {
      if(eq(left,prior))return right;
      if(eq(right,prior))return left;
    }
    return timestamp(left)>=timestamp(right)?left:right;
  }
  const [ll,rl,bl]=maps('lists');
  for(const id of new Set([...rl.keys(),...ll.keys()])){
    const left=ll.get(id),right=rl.get(id),prior=bl.get(id);
    // A custom list deleted after the last common snapshot stays deleted.
    // The original delete operation moves its tasks to Later.
    if(!DEFAULT_LIST_IDS.includes(id)&&prior&&(!left||!right))continue;
    const list=choose(left,right,prior);
    if(list)result.lists.push(copy(list));
  }
  for(const [order,id] of DEFAULT_LIST_IDS.entries()){
    let list=result.lists.find(l=>l.id===id);
    if(!list){
      list={id,name:id[0].toUpperCase()+id.slice(1),order,collapsed:false,permanent:true};
      result.lists.push(list);
    }
    list.permanent=true;
  }
  const [lt,rt,bt]=maps('tasks');
  const allTaskIds=new Set([...rt.keys(),...lt.keys()]);
  for(const id of allTaskIds){
    const left=lt.get(id),right=rt.get(id),prior=bt.get(id);
    const winner=choose(left,right,prior);
    if(!winner)continue;
    result.tasks.push(copy(winner));
    if(!left||!right||eq(left,right))continue;
    const localChanged=!prior||!eq(left,prior);
    const remoteChanged=!prior||!eq(right,prior);
    const textsDiffer=left.title!==right.title||left.notes!==right.notes;
    if(localChanged&&remoteChanged&&textsDiffer){
      const loser=eq(left,winner)?right:left;
      // Preserve the losing text rather than dropping an edit.
      if(!loser.deletedAt&&!loser.clearedAt){
        const conflictId='conflict-'+id+'-'+fingerprint(stable(loser));
        if(!allTaskIds.has(conflictId)&&!result.tasks.some(t=>t.id===conflictId)){
          result.tasks.push({...copy(loser),id:conflictId,title:loser.title+' (conflict copy)'});
          conflicts.push(id);
        }
      }
    }
  }
  const valid=new Set(result.lists.map(l=>l.id));
  for(const t of result.tasks)if(!valid.has(t.listId))t.listId='later';
  // Preferences are per device, including font, theme, page and star filter.
  result.prefs=local.prefs||remote.prefs;
  result.updatedAt=new Date(Math.max(Date.parse(local.updatedAt)||0,Date.parse(remote.updatedAt)||0,Date.now())).toISOString();
  return {workspace:validateWorkspace(result),conflicts};
}