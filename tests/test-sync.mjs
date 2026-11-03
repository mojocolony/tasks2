import assert from 'node:assert/strict';
import {mergeWorkspaces,assertTasksWorkspace} from '../src/sync-core.mjs';
const local = {
  app:'tasks-now-later',version:1,updatedAt:'2026-11-03T12:00:00Z',
  lists:[{id:'now',name:'Now',permanent:true,order:0},{id:'later',name:'Later',permanent:true,order:1},{id:'someday',name:'Someday',permanent:true,order:2}],
  tasks:[{id:'one',title:'Original task',listId:'now',notes:'https://example.com',completed:false,updatedAt:'2026-11-03T12:00:00Z'}],
  prefs:{theme:'dark',font:'large'}
};
assertTasksWorkspace(local);
let result=mergeWorkspaces(local,null).workspace;
assert.equal(result.tasks[0].notes,'https://example.com','No first-sync data loss');
let remote=structuredClone(local);
remote.tasks.push({id:'two',title:'Cloud-only task',listId:'later',notes:'',updatedAt:'2026-11-03T13:00:00Z'});
result=mergeWorkspaces(local,remote).workspace;
assert.deepEqual(result.tasks.map(t=>t.id).sort(),['one','two'],'Merges locally and remotely created tasks');
assert.equal(result.prefs.theme,'dark','Retains local appearance');
const base=structuredClone(local);
remote=structuredClone(local);
remote.tasks[0].title='From iPad';
remote.tasks[0].updatedAt='2026-11-03T13:00:00Z';
const edited=structuredClone(local);
edited.tasks[0].title='From iPhone';
edited.tasks[0].updatedAt='2026-11-03T14:00:00Z';
const divergent=mergeWorkspaces(edited,remote,base);
assert.equal(divergent.workspace.tasks.find(t=>t.id==='one').title,'From iPhone');
assert.equal(divergent.conflicts.length,1,'Concurrent edits flagged');
assert.ok(divergent.workspace.tasks.some(t=>t.title.includes('From iPad (conflict copy)')),'Losing edit retained');
const deleted=structuredClone(local);
deleted.tasks[0].deletedAt='2026-11-03T14:00:00Z';
deleted.tasks[0].updatedAt='2026-11-03T14:00:00Z';
result=mergeWorkspaces(deleted,local,base).workspace;
assert.ok(result.tasks.find(t=>t.id==='one').deletedAt,'Soft deletion is preserved');
const orphan=structuredClone(local);
orphan.tasks[0].listId='removed-list-id';
result=mergeWorkspaces(orphan,remote,base).workspace;
assert.ok(result.tasks.every(t=>result.lists.some(l=>l.id===t.listId)),'Orphan list IDs repaired');
assert.throws(()=>assertTasksWorkspace({tasks:[],lists:[]}),/Not a Tasks 2/);
console.log('Tasks 2 sync merge tests passed');
