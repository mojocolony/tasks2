export const NOW = 'now';
export const LATER = 'later';
export const VERSION = '0.1.6-preview';
export const APP_ID = 'tasks-now-later';
const stamp = () => new Date().toISOString();
export const makeId = () => crypto.randomUUID();

export function emptyState(){
  return {
    app: APP_ID, version: 1, updatedAt: stamp(),
    lists: [
      {id: NOW, name:'Now', order:0, collapsed:false, permanent:true},
      {id: LATER, name:'Later', order:1, collapsed:false, permanent:true},
    ],
    tasks: [],
    prefs: {page:'main',font:'medium',theme:'light',starredOnly:false}
  };
}
export function normalizeState(input){
  if (!input || input.app !== APP_ID || !Array.isArray(input.lists) || !Array.isArray(input.tasks)) return null;
  const s = structuredClone(input);
  s.lists = s.lists.filter(l=>l&&typeof l.id==='string'&&typeof l.name==='string');
  for(const [i,id] of [NOW,LATER].entries()) {
    if (!s.lists.some(l=>l.id===id)) s.lists.unshift({id,name:id==='now'?'Now':'Later',order:i,collapsed:false,permanent:true});
  }
  s.lists = s.lists.map(l=>({...l,permanent:l.id===NOW||l.id===LATER,collapsed:Boolean(l.collapsed),order:Number.isFinite(l.order)?l.order:100}));
  s.tasks = s.tasks.filter(t=>t&&typeof t.id==='string'&&typeof t.title==='string'&&typeof t.listId==='string').map(t=>({
    ...t,notes:String(t.notes??''),completed:Boolean(t.completed),starred:Boolean(t.starred),
    order:Number.isFinite(t.order)?t.order:0,deletedAt:t.deletedAt||null,clearedAt:t.clearedAt||null,
  }));
  s.prefs={page:s.prefs?.page==='lists'?'lists':'main',font:['small','medium','large','xlarge'].includes(s.prefs?.font)?s.prefs.font:'medium',theme:['light','dark','system'].includes(s.prefs?.theme)?s.prefs.theme:'light',starredOnly:Boolean(s.prefs?.starredOnly)};
  s.version=1;s.app=APP_ID;s.updatedAt=s.updatedAt||stamp();
  return s;
}
export function activeTasks(s,listId){
  return s.tasks.filter(t=>t.listId===listId && !t.deletedAt && !t.clearedAt).sort((a,b)=>a.order-b.order||a.createdAt?.localeCompare(b.createdAt||'')||0);
}
export function addTask(s,{title,notes='',listId=NOW,starred=false}){
  const text=String(title||'').trim();
  if(!text) throw Error('A task title is required.');
  if(!s.lists.some(l=>l.id===listId)) throw Error('That list does not exist.');
  const at=stamp();
  const task={id:makeId(),listId,title:text,notes:String(notes),starred:Boolean(starred),completed:false,createdAt:at,updatedAt:at,order:activeTasks(s,listId).length,deletedAt:null,clearedAt:null};
  s.tasks.push(task);s.updatedAt=at;return task;
}
export function toggleCompleted(s,id){
  const task=s.tasks.find(t=>t.id===id&&!t.deletedAt&&!t.clearedAt);
  if (!task) return false;
  task.completed=!task.completed;task.updatedAt=stamp();s.updatedAt=task.updatedAt;return true;
}
export function clearCompleted(s,page){
  const listIds = new Set(s.lists.filter(l=>page==='main'?l.permanent:!l.permanent).map(l=>l.id));
  const affected=[];
  const at=stamp();
  for(const t of s.tasks){if(t.completed&&!t.clearedAt&&!t.deletedAt&&listIds.has(t.listId)){t.clearedAt=at;t.updatedAt=at;affected.push(t.id);}}
  if (affected.length) s.updatedAt=at;
  return affected;
}
export function restoreCleared(s,ids){
  const idset = new Set(ids);let count=0;
  for(const t of s.tasks) if(idset.has(t.id)&&t.clearedAt&&!t.deletedAt){t.clearedAt=null;t.updatedAt=stamp();count++;}
  if(count)s.updatedAt=stamp();return count;
}
export function removeTask(s,id){
  const t=s.tasks.find(t=>t.id===id&&!t.deletedAt);if(!t)return false;
  t.deletedAt=stamp();t.updatedAt=t.deletedAt;s.updatedAt=t.deletedAt;return true;
}
export function restoreTask(s,id){
  const t=s.tasks.find(t=>t.id===id&&t.deletedAt);if(!t)return false;
  t.deletedAt=null;t.clearedAt=null;t.updatedAt=stamp();s.updatedAt=t.updatedAt;return true;
}
export function moveTask(s,id,targetListId,targetIndex){
  const t=s.tasks.find(t=>t.id===id&&!t.deletedAt&&!t.clearedAt);
  if (!t || !s.lists.some(l=>l.id===targetListId)) return false;
  const sourceId=t.listId;
  const dest=activeTasks(s,targetListId).filter(item=>item.id!==id);
  const index=Math.max(0,Math.min(dest.length,Number.isFinite(targetIndex)?targetIndex:dest.length));
  t.listId=targetListId;
  dest.splice(index,0,t);
  const at=stamp();dest.forEach((item,i)=>{item.order=i;item.updatedAt=at;});
  if (sourceId!==targetListId) activeTasks(s,sourceId).forEach((item,i)=>{item.order=i;item.updatedAt=at;});
  s.updatedAt=at;return true;
}
export function addList(s,name){
  const title=String(name||'').trim();if(!title)throw Error('A list name is required.');
  if(s.lists.some(l=>!l.permanent&&l.name.toLowerCase()===title.toLowerCase()))throw Error('A list with that name already exists.');
  const list={id:makeId(),name:title,collapsed:false,permanent:false,order:s.lists.length};
  s.lists.push(list);s.updatedAt=stamp();return list;
}
export function deleteListToLater(s,id){
  const l=s.lists.find(l=>l.id===id&&!l.permanent);if(!l)return 0;
  // Preserve even cleared/deleted tasks so later restoration never creates orphans.
  const moving=s.tasks.filter(t=>t.listId===id);
  let nextOrder=activeTasks(s,LATER).length;
  for(const t of moving){t.listId=LATER;if(!t.deletedAt&&!t.clearedAt)t.order=nextOrder++;t.updatedAt=stamp();}
  s.lists=s.lists.filter(l=>l.id!==id);s.updatedAt=stamp();
  return moving.filter(t=>!t.deletedAt&&!t.clearedAt).length;
}
