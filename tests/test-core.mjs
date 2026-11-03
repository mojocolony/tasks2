import assert from 'node:assert/strict';
import {
  emptyState,normalizeState,activeTasks,addTask,toggleCompleted,clearCompleted,
  restoreCleared,moveTask,addList,deleteListToLater,removeTask,restoreTask
} from '../core.mjs';
const s=emptyState();
assert.equal(s.lists.length,2);
const first=addTask(s,{title:'First',listId:'now'});
assert.equal(first.starred,false,'new tasks are unstarred by default');
const second=addTask(s,{title:'Second',listId:'now',notes:'https://example.com/',starred:true});
assert.equal(second.starred,true,'explicit star should be retained');
assert.equal(activeTasks(s,'now').length,2);
assert.equal(toggleCompleted(s,first.id),true);
assert.equal(s.tasks.find(x=>x.id===first.id).completed,true);
assert.deepEqual(clearCompleted(s,'main'),[first.id]);
assert.equal(activeTasks(s,'now').length,1);
assert.equal(restoreCleared(s,[first.id]),1);
assert.equal(activeTasks(s,'now').length,2);
moveTask(s,second.id,'later',0);
assert.deepEqual(activeTasks(s,'later').map(x=>x.id),[second.id]);
const custom=addList(s,'Movies');
moveTask(s,second.id,custom.id,0);
assert.equal(clearCompleted(s,'main').length,1);
assert.equal(activeTasks(s,'now').length,0);
assert.equal(deleteListToLater(s,custom.id),1);
assert.equal(activeTasks(s,'later').length,1);
removeTask(s,second.id);
assert.equal(activeTasks(s,'later').length,0);
restoreTask(s,second.id);
assert.equal(activeTasks(s,'later').length,1);
const clone=normalizeState(JSON.parse(JSON.stringify(s)));
assert.equal(clone.tasks.length,2);
assert.equal(normalizeState({app:'old-tasks',tasks:[],lists:[]}),null);
console.log('Core state tests passed');
