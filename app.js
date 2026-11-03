import {
  NOW, LATER, SOMEDAY, VERSION, APP_ID, makeId, emptyState, normalizeState, activeTasks,
  addTask, toggleCompleted, clearCompleted, restoreCleared, removeTask, restoreTask,
  moveTask, addList, deleteListToLater
} from './core.mjs?v=012';

const DB_NAME = 'tasks-now-later-v1';
const DB_STORE = 'documents';
const DB_KEY = 'workspace';
const BACKUP_KEY = 'tasks-now-later-v1-backup';
const DEMO = new URLSearchParams(location.search).get('demo') === '1';
const root = document.querySelector('#app');
const icons = {
  check: '<path d="m5 12 4 4L19 6"/>',
  logo: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m16 9-5.5 5.5L8 12"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sparkles: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
  square: '<rect width="18" height="18" x="3" y="3" rx="5"/>',
  checked: '<rect width="18" height="18" x="3" y="3" rx="5"/><path d="m7 12 3 3 7-7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  grip: '<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>',
  dots: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>',
  note: '<path d="M4 3h16v18H4zM8 8h8M8 12h8M8 16h5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  rotate: '<path d="M3 11a9 9 0 1 1 3 7M3 17v-6h6"/>',
  chevronleft: '<path d="m15 18-6-6 6-6"/>',
};
const icon = (name, label='') => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"${label?` data-icon="${esc(label)}"`:''}>${icons[name]||icons.square}</svg>`;
const esc = (v='') => String(v??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validUrl = candidate => {try { const url = new URL(candidate); return ['http:','https:'].includes(url.protocol) ? url.href : null; } catch{return null;} };
function urls(text){
  const found = [...String(text||'').matchAll(/https?:\/\/[^\s<>"']+/gi)]
    .map(m=>m[0].replace(/[.,;!?)}\]]+$/,''))
    .map(validUrl).filter(Boolean);
  return [...new Set(found)].slice(0,18);
}
function renderLinks(note){
  return urls(note).map(url => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon('link')}<span>${esc(url)}</span></a>`).join('');
}
let dbPromise = null;
let writeQueue = Promise.resolve();
function openDb(){
  if(!('indexedDB' in window)) return Promise.resolve(null);
  if(dbPromise)return dbPromise;
  dbPromise = new Promise(resolve=>{
    let request;
    try { request=indexedDB.open(DB_NAME,1); } catch { resolve(null); return; }
    request.onupgradeneeded=()=>{const d=request.result;if(!d.objectStoreNames.contains(DB_STORE))d.createObjectStore(DB_STORE);};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>resolve(null);
    request.onblocked=()=>resolve(null);
  });
  return dbPromise;
}
async function dbGet(){
  const db=await openDb(); if(!db)return null;
  return new Promise(resolve=>{
    const tx=db.transaction(DB_STORE,'readonly');
    const r=tx.objectStore(DB_STORE).get(DB_KEY);
    r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null);
  });
}
async function dbPut(snapshot){
  const db=await openDb(); if(!db)return;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(DB_STORE,'readwrite');
    tx.objectStore(DB_STORE).put(snapshot,DB_KEY);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
function localBackup(){try{return normalizeState(JSON.parse(localStorage.getItem(BACKUP_KEY)||'null'));}catch{return null;}}
function save(){
  state.updatedAt=new Date().toISOString();
  const snapshot=structuredClone(state);
  try {localStorage.setItem(BACKUP_KEY,JSON.stringify(snapshot));}catch(err){console.warn('Backup storage unavailable',err);}
  writeQueue=writeQueue.then(()=>dbPut(snapshot)).catch(err=>{console.warn('Offline storage failed',err);showToast('Storage error — export a backup');});
}
let state=emptyState();
let ui={menu:false,sheet:null,page:'main',expanded:new Set(),swipeOpen:null,toast:null,toastTimer:null,dragging:false};
function setToast(msg,undo){
  clearTimeout(ui.toastTimer);
  ui.toast={msg,undo};
  render();
  ui.toastTimer=setTimeout(()=>{ui.toast=null;render();},8500);
}
function showToast(msg,undo){setToast(msg,undo);}
function closeToast(){clearTimeout(ui.toastTimer);ui.toast=null;render();}
function persistAndRender(){save();render();}
function listTasks(id){
  const all=activeTasks(state,id);
  return state.prefs.starredOnly ? all.filter(t=>t.starred) : all;
}
function countPageDone(){
  const main = ui.page==='main';
  const ids=new Set(state.lists.filter(l=>main?l.permanent:!l.permanent).map(l=>l.id));
  return state.tasks.filter(t=>ids.has(t.listId)&&t.completed&&!t.clearedAt&&!t.deletedAt).length;
}
function sectionHtml(list){
  const filtered=listTasks(list.id);
  const all=activeTasks(state,list.id);
  const collapsed=list.collapsed;
  return `<section class="section" data-list-id="${esc(list.id)}">
    <div class="section-controls">
      <button class="section-heading" type="button" data-action="toggle-list" data-list-id="${esc(list.id)}" aria-expanded="${!collapsed}">
        <span class="heading-label">${esc(list.name.toUpperCase())}</span>
        <span class="section-count">${all.filter(t=>!t.completed).length}</span>
        ${icon(collapsed?'down':'up')}
      </button>
      ${!list.permanent?`<button class="mini-icon" type="button" data-action="edit-list" data-list-id="${esc(list.id)}" aria-label="Edit ${esc(list.name)}">${icon('dots')}</button>`:''}
    </div>
    ${!collapsed?`<div class="task-items" data-drop-list="${esc(list.id)}">
      ${filtered.map(taskHtml).join('')}
      ${!filtered.length?`<div class="empty-message">${state.prefs.starredOnly?'No Sparkles tasks here. Tap Show all, then expand a task to mark it important.':'No tasks.'}</div>`:''}
    </div>`:''}
  </section>`;
}
function taskHtml(t){
  const expanded=ui.expanded.has(t.id);
  return `<article class="task-shell ${t.completed?'completed':''} ${ui.swipeOpen===t.id?'swipe-open':''}" data-task-id="${esc(t.id)}" data-list-id="${esc(t.listId)}">
    <div class="task-row">
      <button class="swipe-delete" type="button" data-action="delete-task" data-task-id="${esc(t.id)}" aria-label="Delete ${esc(t.title)}">${icon('trash')} Delete</button>
      <div class="task-body">
      <button class="task-check ${t.completed?'checked':''}" role="checkbox" aria-checked="${t.completed}" type="button" data-action="toggle-complete" data-task-id="${esc(t.id)}" aria-label="${t.completed?'Uncomplete':'Complete'} ${esc(t.title)}">${icon(t.completed?'checked':'square')}</button>
      <button class="task-main" type="button" data-action="toggle-expand" data-task-id="${esc(t.id)}" aria-expanded="${expanded}"><span class="task-title">${esc(t.title)}</span>${t.notes.trim()&&!expanded?`<span class="note-presence">${icon('note')}</span>`:''}</button>
      ${t.starred?`<button class="task-star active" type="button" data-action="toggle-star" data-task-id="${esc(t.id)}" aria-label="Remove Sparkles from ${esc(t.title)}">${icon('sparkles')}</button>`:''}
      <button class="task-menu" type="button" data-action="edit-task" data-task-id="${esc(t.id)}" aria-label="Task actions for ${esc(t.title)}">${icon('dots')}</button>
      <button class="drag-grip" type="button" data-drag-task="${esc(t.id)}" aria-label="Drag to reorder ${esc(t.title)}">${icon('grip')}</button>
      </div>
    </div>
    ${expanded?`<div class="task-details"><textarea data-note-id="${esc(t.id)}" rows="2" placeholder="Notes or links…" aria-label="Notes for ${esc(t.title)}">${esc(t.notes)}</textarea><div class="note-links">${renderLinks(t.notes)}</div><button class="detail-star-button" type="button" data-action="toggle-star" data-task-id="${esc(t.id)}" aria-pressed="${t.starred}">${icon('sparkles')}<span>${t.starred?'Unmark important':'Mark important'}</span></button></div>`:''}
  </article>`;
}
function menuHtml(){
  if(!ui.menu)return '';
  const f=state.prefs.font,t=state.prefs.theme;
  const clearedCount=state.tasks.filter(t=>t.clearedAt&&!t.deletedAt).length;
  return `<div class="menu-scrim" data-action="close-menu"></div><aside class="menu" aria-label="Settings">
    <div class="sheet-header"><h2>Settings</h2><button class="icon-button" data-action="close-menu" aria-label="Close settings">${icon('x')}</button></div>
    <div class="menu-label">Font · IBM Plex Mono</div>
    <div class="menu-row">${[['small','A−'],['medium','A'],['large','A+'],['xlarge','A++']].map(([v,n])=>`<button type="button" class="${v===f?'selected':''}" data-action="font" data-value="${v}" aria-pressed="${v===f}">${n}</button>`).join('')}</div>
    <div class="menu-label">Theme</div>
    <div class="menu-row">${[['light','Light'],['system','System'],['dark','Dark']].map(([v,n])=>`<button type="button" class="${v===t?'selected':''}" data-action="theme" data-value="${v}" aria-pressed="${v===t}">${n}</button>`).join('')}</div>
    <p class="menu-subtitle">Dark colours are provisional until the final palette is supplied.</p>
    <button class="menu-action" data-action="collapse-all">Collapse all lists ${icon('up')}</button>
    <button class="menu-action" data-action="clear-completed">Clear completed on this page (${countPageDone()}) ${icon('trash')}</button>
    <button class="menu-action" data-action="restore-cleared" ${clearedCount?'':'disabled'}>Recently cleared (${clearedCount}) ${icon('rotate')}</button>
    <button class="menu-action" data-action="export">Export Tasks backup ${icon('download')}</button>
    <button class="menu-action" data-action="import">Import Tasks backup ${icon('upload')}</button>
    <div class="menu-label">Account</div>
    <p class="menu-subtitle">Local preview · saved on this device. Cloud account syncing has not been connected.</p>
    <button class="menu-action" disabled title="Available after cloud account setup">Sign out ${icon('arrow')}</button>
    <div class="menu-version">Tasks v${VERSION}</div>
  </aside>`;
}
function formHtml(){
  if(!ui.sheet)return '';
  let inner='';
  if(ui.sheet.type==='add'){
    const target = state.lists.find(l=>l.id===ui.sheet.listId)??state.lists.find(l=>l.id===NOW);
    inner = `<div class="sheet-header"><h2>Add task</h2><button class="icon-button" data-action="close-sheet" aria-label="Close">${icon('x')}</button></div>
      <form data-form="add">
        <label for="taskTitle">Task</label><input id="taskTitle" name="title" maxlength="300" placeholder="What needs doing?" autocomplete="off" required>
        <label for="taskNotes">Notes / URLs (optional)</label><textarea id="taskNotes" name="notes" rows="2" placeholder="Add details or a URL…"></textarea>
        <label for="taskList">List</label><select id="taskList" name="listId">${listOptions(target.id)}</select>
        <div class="sheet-actions"><button type="submit" class="primary-btn">Add task</button></div>
      </form>`;
  }else if(ui.sheet.type==='list'){
    const list=state.lists.find(l=>l.id===ui.sheet.listId);
    inner = `<div class="sheet-header"><h2>${list?'Edit list':'New list'}</h2><button class="icon-button" data-action="close-sheet" aria-label="Close">${icon('x')}</button></div>
      <form data-form="list"><label for="listName">Name</label><input id="listName" name="name" maxlength="100" value="${esc(list?.name??'')}" placeholder="e.g. Movies" required>
        <div class="sheet-actions"><button type="submit" class="primary-btn">${list?'Save changes':'Create list'}</button></div></form>
      ${list?`<div class="sheet-actions"><button type="button" class="secondary-btn danger-btn" data-action="delete-list" data-list-id="${esc(list.id)}">Delete list…</button></div>`:''}`;
  }else if(ui.sheet.type==='task'){
    const t=state.tasks.find(t=>t.id===ui.sheet.taskId);
    if(t){inner=`<div class="sheet-header"><h2>Edit task</h2><button class="icon-button" data-action="close-sheet" aria-label="Close">${icon('x')}</button></div>
      <form data-form="task"><label for="editTitle">Task</label><input id="editTitle" name="title" maxlength="300" required value="${esc(t.title)}">
      <label for="editNotes">Notes / URLs</label><textarea id="editNotes" name="notes">${esc(t.notes)}</textarea>
      <label for="editList">Move to list</label><select id="editList" name="listId">${listOptions(t.listId)}</select>
      <div class="sheet-actions"><button type="submit" class="primary-btn">Save changes</button></div></form>
      <div class="sheet-actions"><button type="button" class="secondary-btn" data-action="duplicate-task" data-task-id="${esc(t.id)}">Duplicate</button><button class="secondary-btn danger-btn" type="button" data-action="delete-task" data-task-id="${esc(t.id)}">Delete</button></div>`;}
  }
  return `<div class="backdrop" data-action="close-sheet"></div><section class="sheet" role="dialog" aria-modal="true">${inner}</section>`;
}
function listOptions(selected){return state.lists.map(l=>`<option value="${esc(l.id)}" ${selected===l.id?'selected':''}>${esc(l.name)}</option>`).join('');}
function render(){
  if(!root)return;
  document.documentElement.dataset.font=state.prefs.font;
  document.documentElement.dataset.theme=state.prefs.theme;
  ui.page=state.prefs.page;
  root.innerHTML=`<div class="app">
    <header class="topbar">
      <div class="brand">${icon('logo')}<span>Tasks</span></div>
      <button type="button" class="icon-button" data-action="menu" aria-label="Open menu">${icon('menu')}</button>
    </header>
    <nav class="pages-tabs" aria-label="Pages">
      <button class="tab ${ui.page==='main'?'active':''}" type="button" data-action="page" data-page="main" aria-current="${ui.page==='main'?'page':'false'}">TASKS</button>
      <button class="tab ${ui.page==='lists'?'active':''}" type="button" data-action="page" data-page="lists" aria-current="${ui.page==='lists'?'page':'false'}">LISTS</button>
    </nav>
    ${state.prefs.starredOnly?`<p class="filter-banner">${icon("sparkles")} Showing only Sparkles tasks. <button type="button" data-action="filter">Show all</button></p>`:''}
    <main class="page ${ui.page==='main'?'active':''}" data-page="main">
      ${sectionHtml(state.lists.find(l=>l.id===NOW))}
      ${sectionHtml(state.lists.find(l=>l.id===LATER))}
      ${sectionHtml(state.lists.find(l=>l.id===SOMEDAY))}
    </main>
    <main class="page ${ui.page==='lists'?'active':''}" data-page="lists">
      ${state.lists.filter(l=>!l.permanent).sort((a,b)=>a.order-b.order).map(sectionHtml).join('')}
      <button type="button" class="add-list" data-action="new-list">${icon('plus')} New list</button>
    </main>
  </div>
  <div class="pill" aria-label="Quick actions">
    <button type="button" data-action="add" aria-label="Add task">${icon('plus')}</button>
    <span class="pill-divider"></span>
    <button type="button" class="${state.prefs.starredOnly?'is-active':''}" data-action="filter" aria-label="${state.prefs.starredOnly?'Show all tasks':'Show Sparkles tasks'}" aria-pressed="${state.prefs.starredOnly}">${icon('sparkles')}</button>
  </div>
  <div id="pullHint" class="pull-hint" aria-live="polite">Pull down further to clear completed</div>
  ${menuHtml()}${formHtml()}
  ${ui.toast?`<div class="toast" role="status"><span>${esc(ui.toast.msg)}</span>${ui.toast.undo?`<button type="button" data-action="undo">Undo</button>`:''}</div>`:''}
  <input type="file" id="backupImport" accept=".json,application/json" hidden>
  `;
}
function quickPage(page){
  if(!['main','lists'].includes(page)||ui.page===page)return;
  ui.page=page;state.prefs.page=page;save();
  root.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
  root.querySelectorAll('.tab').forEach(el=>{el.classList.toggle('active',el.dataset.page===page);el.setAttribute('aria-current',el.dataset.page===page?'page':'false');});
}
function setPage(page){if(!['main','lists'].includes(page))return;ui.page=page;state.prefs.page=page;ui.swipeOpen=null;persistAndRender();}
function openSheet(type,other={}){ui.sheet={type,...other};ui.menu=false;ui.swipeOpen=null;render();requestAnimationFrame(()=>root.querySelector('#taskTitle,#listName,#editTitle')?.focus());}
function applyMutation(callback){callback();persistAndRender();}
function clearCurrent(){
  const affected=clearCompleted(state,ui.page);
  ui.menu=false;
  if(!affected.length){showToast('No completed tasks to clear');return;}
  save();
  showToast(`${affected.length} completed task${affected.length===1?'':'s'} cleared`,()=>{
    restoreCleared(state,affected);save();showToast('Tasks restored');
  });
}
function deleteTaskAction(id){
  if(!removeTask(state,id))return;
  ui.sheet=null;ui.swipeOpen=null;save();
  showToast('Task deleted',()=>{restoreTask(state,id);save();showToast('Task restored');});
}
function extractForm(form){return Object.fromEntries(new FormData(form).entries());}
function exportBackup(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=`tasks-now-later-${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
  ui.menu=false;showToast('Backup exported');
}
function seedDemo(){
  const demoTasks=[
    {title:'Review article bookmarks',listId:NOW,notes:'https://fmhy.net/',starred:true},
    {title:'Order replacement cartridge',listId:NOW},
    {title:'Finish newspaper recipe',listId:NOW},
    {title:'Watch the new documentary',listId:LATER},
  ];
  for(const item of demoTasks)addTask(state,item);
  toggleCompleted(state,state.tasks[1].id);
  const movies=addList(state,'Upcoming Movies');
  addTask(state,{title:'Check release dates',listId:movies.id,notes:'https://www.imdb.com/'});
}
function collapseAll(){state.lists.forEach(l=>l.collapsed=true);ui.menu=false;persistAndRender();}
function onClick(event){
  const target=event.target.closest('[data-action]');if(!target)return;
  const {action,taskId,listId,value,page}=target.dataset;
  if(root.dataset.suppressClick==='1' && ['toggle-expand','toggle-complete','toggle-star','edit-task','toggle-list'].includes(action))return;
  if(action==='page'){setPage(page);return;}
  if(action==='menu'){ui.menu=true;render();return;}
  if(action==='close-menu'){ui.menu=false;render();return;}
  if(action==='add'){openSheet('add',{listId:ui.page==='main'?NOW:state.lists.find(l=>!l.permanent)?.id||NOW});return;}
  if(action==='filter'){state.prefs.starredOnly=!state.prefs.starredOnly;ui.menu=false;persistAndRender();return;}
  if(action==='toggle-list'){applyMutation(()=>{const l=state.lists.find(l=>l.id===listId);if(l)l.collapsed=!l.collapsed;});return;}
  if(action==='toggle-complete'){applyMutation(()=>{toggleCompleted(state,taskId);});return;}
  if(action==='toggle-star'){applyMutation(()=>{const t=state.tasks.find(t=>t.id===taskId);if(t){t.starred=!t.starred;t.updatedAt=new Date().toISOString();}});return;}
  if(action==='toggle-expand'){
    if(ui.expanded.has(taskId))ui.expanded.delete(taskId);else ui.expanded.add(taskId);
    ui.swipeOpen=null;render();return;
  }
  if(action==='edit-task'){openSheet('task',{taskId});return;}
  if(action==='delete-task'){deleteTaskAction(taskId);return;}
  if(action==='duplicate-task'){
    const t=state.tasks.find(t=>t.id===taskId);if(!t)return;
    addTask(state,{title:t.title,notes:t.notes,listId:t.listId,starred:t.starred});ui.sheet=null;save();showToast('Task duplicated');return;
  }
  if(action==='new-list'){openSheet('list');return;}
  if(action==='edit-list'){openSheet('list',{listId});return;}
  if(action==='delete-list'){
    const l=state.lists.find(l=>l.id===listId&&!l.permanent);if(!l)return;
    if(!confirm(`Delete “${l.name}”? Its active tasks will be moved to Later.`))return;
    const count=deleteListToLater(state,listId);
    ui.sheet=null;save();showToast(`List deleted · ${count} task${count===1?'':'s'} moved to Later`);return;
  }
  if(action==='close-sheet'){ui.sheet=null;render();return;}
  if(action==='font'){state.prefs.font=value;ui.menu=true;persistAndRender();return;}
  if(action==='theme'){state.prefs.theme=value;ui.menu=true;persistAndRender();return;}
  if(action==='collapse-all'){collapseAll();return;}
  if(action==='clear-completed'){clearCurrent();return;}
  if(action==='restore-cleared'){
    const ids=state.tasks.filter(t=>t.clearedAt&&!t.deletedAt).map(t=>t.id);
    const restored=restoreCleared(state,ids);ui.menu=false;save();showToast(`${restored} task${restored===1?'':'s'} restored`);return;
  }
  if(action==='export'){exportBackup();return;}
  if(action==='import'){root.querySelector('#backupImport')?.click();return;}
  if(action==='undo'){const callback=ui.toast?.undo;ui.toast=null;if(callback)callback();else render();return;}
}
function onSubmit(event){
  const form=event.target.closest('[data-form]');if(!form)return;
  event.preventDefault();const values=extractForm(form);
  try{
    if(form.dataset.form==='add'){
      const selected=state.lists.some(l=>l.id===values.listId)?values.listId:NOW;
      addTask(state,{title:values.title,notes:values.notes,listId:selected});
      state.lists.find(l=>l.id===selected).collapsed=false;
      ui.sheet=null;save();showToast('Task added');return;
    }
    if(form.dataset.form==='list'){
      if(ui.sheet?.listId){const l=state.lists.find(l=>l.id===ui.sheet.listId);if(l)l.name=values.name.trim();}
      else{addList(state,values.name);state.prefs.page='lists';}
      ui.sheet=null;persistAndRender();return;
    }
    if(form.dataset.form==='task'){
      const t=state.tasks.find(t=>t.id===ui.sheet?.taskId);if(!t)return;
      if(!values.title?.trim())throw Error('Task title is required.');
      if(t.listId!==values.listId)moveTask(state,t.id,values.listId,activeTasks(state,values.listId).length);
      t.title=values.title.trim();t.notes=values.notes||'';t.updatedAt=new Date().toISOString();
      ui.sheet=null;save();showToast('Task saved');return;
    }
  }catch(err){showToast(err.message||'Could not save');}
}
function onInput(event){
  const id=event.target.dataset.noteId;if(!id)return;
  const t=state.tasks.find(t=>t.id===id);if(!t)return;
  t.notes=event.target.value;t.updatedAt=new Date().toISOString();save();
  const linkHost=event.target.nextElementSibling;
  if(linkHost?.classList.contains('note-links'))linkHost.innerHTML=renderLinks(t.notes);
}
async function onImport(event){
  if(event.target.id!=='backupImport')return;
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>6_000_000)throw Error('Backup is too large.');
    const parsed=JSON.parse(await file.text());const restored=normalizeState(parsed);
    if(!restored)throw Error('Not a Tasks Now & Later backup. Other Tasks data is not compatible.');
    if(!confirm(`Replace this preview's data with the ${restored.tasks.length} tasks from this backup? This will not affect the older Tasks app.`))return;
    state=restored;ui.menu=false;ui.sheet=null;ui.expanded.clear();save();showToast('Backup imported');
  }catch(err){showToast(err.message||'Could not import backup');}
}

// Mobile gestures: horizontal swipe on a row reveals Delete; horizontal swipe on the page switches pages.
// A deliberate downward pull from empty space near the top clears completed tasks on the current page.
// Prevent default early on the intended gesture to avoid invoking browser pull-to-refresh.
let touch=null;
function onTouchStart(event){
  if(event.touches.length!==1||ui.sheet||ui.menu||ui.dragging)return;
  const e=event.touches[0],target=event.target;
  if(target.closest('input,textarea,select,a,.pill,.task-details'))return;
  const row=target.closest('.task-shell');
  const atTop=window.scrollY<5;
  const topStart=e.clientY<Math.min(460,Math.max(300,innerHeight*.55))&&e.clientY>18;
  const pullEligible=atTop&&topStart&&!target.closest('button,.task-shell,.pill,.menu,.sheet,.icon-button')&&countPageDone()>0;
  touch={startX:e.clientX,startY:e.clientY,row:row?.dataset.taskId??null,pullEligible,gesture:null,dx:0,dy:0};
}
function onTouchMove(event){
  if(!touch||event.touches.length!==1||ui.dragging)return;
  const e=event.touches[0];touch.dx=e.clientX-touch.startX;touch.dy=e.clientY-touch.startY;
  // Claim only a clear downward pull. Do this before Safari turns it into refresh.
  if(!touch.gesture&&touch.pullEligible&&touch.dy>7&&touch.dy>Math.abs(touch.dx)*1.25){
    touch.gesture='pull';
  }
  if(!touch.gesture&&Math.hypot(touch.dx,touch.dy)>14){
    if(Math.abs(touch.dx)>Math.abs(touch.dy)*1.3)touch.gesture='horizontal';
    else touch.gesture='scroll';
  }
  if(touch.gesture==='horizontal'){
    if(event.cancelable)event.preventDefault();
    if(touch.row){
      const row=root.querySelector(`[data-task-id="${CSS.escape(touch.row)}"]`);
      if(row){row.classList.toggle('swipe-open',touch.dx< -38);}
    }
  }
  if(touch.gesture==='pull'){
    if(event.cancelable)event.preventDefault();
    const hint=root.querySelector('#pullHint');
    if(hint){
      const ready=touch.dy>=120;
      hint.classList.add('show');
      hint.classList.toggle('ready',ready);
      hint.textContent=ready?`Release to clear ${countPageDone()} completed`:'Pull down further to clear completed';
    }
  }
}
function onTouchEnd(){
  if(!touch)return;const g=touch;touch=null;
  root.querySelector('#pullHint')?.classList.remove('show','ready');
  if(ui.dragging)return;
  if(g.gesture==='pull'&&g.dy>=120){
    root.dataset.suppressClick='1';setTimeout(()=>{delete root.dataset.suppressClick;},350);
    if(countPageDone())clearCurrent();else showToast('No completed tasks to clear');
  }else if(g.gesture==='horizontal'){
    if(g.row){
      if(g.dx< -55)ui.swipeOpen=g.row;
      else if(g.dx>35)ui.swipeOpen=null;
      render();
    }else if(Math.abs(g.dx)>75){
      if(g.dx<0)setPage('lists');else setPage('main');
    }
  }
}

// Pointer drag uses a deliberate hold on touch, or the dedicated grip; drop also works on collapsed/empty lists.
let pendingDrag=null,activeDrag=null,holdTimer=null,pageFlipTimer=null,dropLine=null,dropSection=null,ghost=null;
const stopHold=()=>{clearTimeout(holdTimer);holdTimer=null;};
const clearFlip=()=>{clearTimeout(pageFlipTimer);pageFlipTimer=null;};
function cleanupDrag(){
  stopHold();clearFlip();pendingDrag=null;activeDrag=null;
  ghost?.remove();ghost=null;dropLine?.remove();dropLine=null;
  dropSection?.classList.remove('is-drop-target');dropSection=null;
  root.querySelectorAll('.drag-source').forEach(e=>e.classList.remove('drag-source'));
  document.documentElement.classList.remove('dragging');ui.dragging=false;
}
function beginDrag(event){
  if(!pendingDrag)return;
  const task=state.tasks.find(t=>t.id===pendingDrag.taskId);if(!task)return;
  activeDrag={pointerId:pendingDrag.pointerId,taskId:task.id,listId:task.listId,index:0};
  ui.dragging=true;document.documentElement.classList.add('dragging');
  pendingDrag.row.classList.add('drag-source');
  ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=task.title;
  document.body.append(ghost);updateDrag(event.clientX,event.clientY);
}
function updateDrag(x,y){
  if(!activeDrag)return;
  if(ghost){ghost.style.left=`${Math.max(8,Math.min(x+16,innerWidth-ghost.offsetWidth-8))}px`;ghost.style.top=`${Math.max(8,Math.min(y+16,innerHeight-60))}px`;}
  const nextPage = x<28?'main':x>innerWidth-28?'lists':null;
  if(nextPage&&nextPage!==ui.page){
    if(!pageFlipTimer){pageFlipTimer=setTimeout(()=>{pageFlipTimer=null;quickPage(nextPage);},650);}
  }else clearFlip();
  const page=root.querySelector(`.page.active`);
  const sections=[...page.querySelectorAll('.section')];
  if(!sections.length)return;
  const hit=document.elementFromPoint(x,y)?.closest?.('.section');
  const target=hit&&sections.includes(hit)?hit:sections.reduce((best,section)=>{
    const rect=section.getBoundingClientRect();
    const distance=y<rect.top?rect.top-y:y>rect.bottom?y-rect.bottom:0;
    return !best||distance<best.distance?{section,distance}:best;
  },null)?.section;
  if(!target)return;
  if(dropSection!==target){dropSection?.classList.remove('is-drop-target');target.classList.add('is-drop-target');dropSection=target;}
  const id=target.dataset.listId;
  const items=target.querySelector('.task-items');
  const rows=items?[...items.querySelectorAll('.task-shell')].filter(el=>el.dataset.taskId!==activeDrag.taskId):[];
  const index=rows.findIndex(el=>y<el.getBoundingClientRect().top+el.getBoundingClientRect().height/2);
  const i=index===-1?rows.length:index;
  activeDrag.listId=id;activeDrag.index=i;
  if(!dropLine){dropLine=document.createElement('div');dropLine.className='drop-marker';}
  if(items){if(i>=rows.length)items.append(dropLine);else items.insertBefore(dropLine,rows[i]);}
  else{target.append(dropLine);}
  if(y<72)window.scrollBy(0,-8);if(y>innerHeight-72)window.scrollBy(0,8);
}
function onPointerDown(event){
  if(ui.sheet||ui.menu||event.button!==0)return;
  const grip=event.target.closest('[data-drag-task]');
  const title=event.target.closest('.task-main');
  if(!grip&&!title)return;
  const row=event.target.closest('.task-shell');if(!row)return;
  pendingDrag={pointerId:event.pointerId,taskId:row.dataset.taskId,row,x:event.clientX,y:event.clientY,kind:event.pointerType,fromGrip:Boolean(grip)};
  stopHold();
  if(event.pointerType!=='mouse')holdTimer=setTimeout(()=>beginDrag(event),grip?200:410);
}
function onPointerMove(event){
  if(activeDrag){if(event.pointerId!==activeDrag.pointerId)return;event.preventDefault();updateDrag(event.clientX,event.clientY);return;}
  if(!pendingDrag||event.pointerId!==pendingDrag.pointerId)return;
  const distance=Math.hypot(event.clientX-pendingDrag.x,event.clientY-pendingDrag.y);
  if(pendingDrag.kind==='mouse'&&distance>5){beginDrag(event);return;}
  if(distance>9){stopHold();pendingDrag=null;}
}
function onPointerUp(event){
  if(activeDrag&&activeDrag.pointerId===event.pointerId){
    event.preventDefault();
    const {taskId,listId,index}=activeDrag;
    root.dataset.suppressClick='1';setTimeout(()=>{delete root.dataset.suppressClick;},150);
    cleanupDrag();moveTask(state,taskId,listId,index);ui.swipeOpen=null;persistAndRender();return;
  }
  stopHold();pendingDrag=null;
}
function onPointerCancel(){cleanupDrag();}

async function boot(){
  const [remote,backup]=await Promise.all([dbGet(),Promise.resolve(localBackup())]);
  const indexed=normalizeState(remote);
  state = indexed && backup ? (indexed.updatedAt>=backup.updatedAt?indexed:backup) : indexed||backup||emptyState();
  if(DEMO&&state.tasks.length===0){seedDemo();save();}
  render();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('PWA offline setup unavailable',error));
  }
}
root.addEventListener('click',onClick);
root.addEventListener('submit',onSubmit);
root.addEventListener('input',onInput);
root.addEventListener('change',onImport);
root.addEventListener('touchstart',onTouchStart,{passive:true});
root.addEventListener('touchmove',onTouchMove,{passive:false});
root.addEventListener('touchend',onTouchEnd,{passive:true});
root.addEventListener('touchcancel',()=>{touch=null;root.querySelector('#pullHint')?.classList.remove('show','ready');},{passive:true});
root.addEventListener('pointerdown',onPointerDown);
document.addEventListener('pointermove',onPointerMove,{passive:false});
document.addEventListener('pointerup',onPointerUp);
document.addEventListener('pointercancel',onPointerCancel);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&(ui.sheet||ui.menu)){ui.sheet=null;ui.menu=false;render();}
  if(event.key==='q'&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!event.target.closest('input,textarea,select,[contenteditable]'))openSheet('add',{listId:ui.page==='main'?NOW:state.lists.find(l=>!l.permanent)?.id||NOW});
});
boot();
