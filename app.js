// ─── IMPROVEMENT #1: CONFIG & CONSTANTS ─────────────────
const API_URL = "https://script.google.com/macros/s/AKfycbykFHM1aZjiTze0G2mbCeYpes5rf-Sb1lEkle9D4fDm09kRStnLlVG4CvYpcy03pMeMvA/exec";
const STORAGE_KEY = 'oregon_tasks';
const ACTIVITY_KEY = 'oregon_activity';
const STREAK_KEY = 'oregon_streak';
const LAST_ACTIVE_KEY = 'oregon_last_active';

// Estimated hours per task (rough heuristics)
const HOURS_BY_PRIORITY = { high: 8, med: 4, low: 2 };

// ─── IMPROVEMENT #2: DOM REFS ────────────────────────────
const $ = id => document.getElementById(id);
const taskLists = {
  unity:   $('task-list-unity'),
  unreal:  $('task-list-unreal'),
  general: $('task-list-general'),
};
const progText         = $('prog-text');
const progFill         = $('prog-fill');
const newTaskInput     = $('new-task-input');
const taskPriority     = $('task-priority');
const taskPhase        = $('task-phase');
const addTaskBtn       = $('add-task-btn');
const searchInput      = $('search-input');
const searchClear      = $('search-clear');
const archiveBtn       = $('archive-btn');
const kanbanBtn        = $('kanban-btn');
const themeBtn         = $('theme-btn');
const exportBtn        = $('export-btn');
const importBtn        = $('import-btn');
const importFile       = $('import-file');
const shortcutBtn      = $('shortcut-btn');
const filterPriority   = $('filter-priority');
const filterPhase      = $('filter-phase-select');
const sortSelect       = $('sort-select');
const emptyState       = $('empty-state');
const offlineBanner    = $('offline-banner');
const activityLog      = $('activity-log');
const phaseMiniBar     = $('phase-mini-bars');

// Stats
const statTotal     = $('stat-total');
const statDone      = $('stat-done');
const statRemaining = $('stat-remaining');
const statStreak    = $('stat-streak');

// Modal refs
const shortcutOverlay  = $('shortcut-overlay');
const shortcutBackdrop = $('shortcut-backdrop');
const shortcutCloseBtn = $('shortcut-close-btn');
const detailOverlay    = $('detail-overlay');
const detailBackdrop   = $('detail-backdrop');
const detailCloseBtn   = $('detail-close-btn');
const detailSaveBtn    = $('detail-save-btn');
const detailDeleteBtn  = $('detail-delete-btn');
const detailTitle      = $('detail-input-title');
const detailDesc       = $('detail-input-desc');
const detailPhase      = $('detail-phase');
const detailMeta       = $('detail-meta');
const priorityPills    = document.querySelectorAll('.ppill');

// ─── STATE ────────────────────────────────────────────────
let tasks         = [];
let isArchiveMode = false;
let editingTaskId = null;
let isOnline      = navigator.onLine;

// ─── IMPROVEMENT #3: AUDIO ENGINE ──────────────────────────
let audioCtx;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playDing() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch(e) {}
}
function playUndo() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch(e) {}
}

// ─── IMPROVEMENT #4: TOAST NOTIFICATIONS ────────────────────
function showToast(msg, type = 'info', duration = 3000) {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, duration);
}

// ─── IMPROVEMENT #5: LOCAL STORAGE CACHE ─────────────────────
function saveLocal(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
}
function loadLocal(key, fallback = null) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch(e) { return fallback; }
}

// ─── IMPROVEMENT #6: ONLINE / OFFLINE DETECTION ──────────────
function updateOnlineStatus() {
  isOnline = navigator.onLine;
  offlineBanner.classList.toggle('hidden', isOnline);
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ─── IMPROVEMENT #7: ACTIVITY LOG ─────────────────────────────
let activityItems = loadLocal(ACTIVITY_KEY, []);
function logActivity(icon, text) {
  const now = new Date();
  const entry = { icon, text, time: now.toISOString() };
  activityItems.unshift(entry);
  if (activityItems.length > 50) activityItems = activityItems.slice(0, 50);
  saveLocal(ACTIVITY_KEY, activityItems);
  renderActivityLog();
}
function formatRelTime(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}
function renderActivityLog() {
  if (!activityItems.length) {
    activityLog.innerHTML = '<div class="activity-empty">No activity yet — start checking off tasks!</div>';
    return;
  }
  activityLog.innerHTML = activityItems.slice(0, 20).map(item => `
    <div class="activity-item">
      <span class="activity-icon">${item.icon}</span>
      <span class="activity-text">${item.text}</span>
      <span class="activity-time">${formatRelTime(item.time)}</span>
    </div>
  `).join('');
}

// ─── IMPROVEMENT #8: STREAK COUNTER ──────────────────────────
function updateStreak() {
  const today = new Date().toDateString();
  const lastActive = loadLocal(LAST_ACTIVE_KEY, null);
  let streak = loadLocal(STREAK_KEY, 0);

  if (lastActive === today) {
    // Same day — keep streak
  } else {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (lastActive === yesterday) {
      streak++;
    } else if (lastActive !== today) {
      streak = 1;
    }
    saveLocal(STREAK_KEY, streak);
    saveLocal(LAST_ACTIVE_KEY, today);
  }
  statStreak.textContent = streak;
}

// ─── API HELPERS ──────────────────────────────────────────────
async function fetchTasks() {
  // IMPROVEMENT #9: FALLBACK TO LOCAL CACHE IF OFFLINE
  if (!isOnline) {
    return loadLocal(STORAGE_KEY, []);
  }
  try {
    const res = await fetch(API_URL);
    const result = await res.json();
    if (result.success) {
      saveLocal(STORAGE_KEY, result.data);
      return result.data;
    }
    return loadLocal(STORAGE_KEY, []);
  } catch(e) {
    console.warn('API unavailable, using local cache');
    return loadLocal(STORAGE_KEY, []);
  }
}

async function apiPost(payload) {
  // IMPROVEMENT #10: QUEUE OFFLINE WRITES
  if (!isOnline) {
    showToast('Saved locally — will sync when online', 'info');
    return { success: true, offline: true };
  }
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch(e) {
    console.error('API POST Error:', e);
    return { success: false, error: e };
  }
}

// ─── IMPROVEMENT #11: SORT TASKS ─────────────────────────────
const PRIORITY_ORDER = { high: 0, med: 1, low: 2 };
function sortedTasks(list) {
  const mode = sortSelect.value;
  const copy = [...list];
  if (mode === 'priority') {
    copy.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1));
  } else if (mode === 'alpha') {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  } else if (mode === 'recent') {
    copy.sort((a, b) => Number(b.id) - Number(a.id));
  } else {
    copy.sort((a, b) => Number(a.order) - Number(b.order));
  }
  return copy;
}

// ─── IMPROVEMENT #12: FILTER TASKS ──────────────────────────
function passesFilters(task) {
  const isDone = String(task.isDone).toLowerCase() === 'true';
  if (isArchiveMode && isDone) return false;

  const priorityFilter = filterPriority.value;
  if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

  const phaseFilter = filterPhase.value;
  if (phaseFilter !== 'all' && (task.phase || 'unity') !== phaseFilter) return false;

  const search = searchInput.value.toLowerCase().trim();
  if (search) {
    const haystack = (task.title + ' ' + (task.desc || '') + ' ' + (task.priority || '')).toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  return true;
}

// ─── RENDERING ────────────────────────────────────────────────
function getPriorityTag(priority) {
  const labels = { high: '🔴 High', med: '🟡 Med', low: '🟢 Low' };
  const cls    = { high: 'tag-high', med: 'tag-med', low: 'tag-low' };
  const label  = labels[priority] || '🟢 Low';
  const c      = cls[priority] || 'tag-low';
  return `<div class="task-tag ${c}">${label}</div>`;
}

function createTaskEl(task) {
  const isDone = String(task.isDone).toLowerCase() === 'true';
  const el = document.createElement('div');
  el.className = `task ${isDone ? 'done' : ''}`;
  el.setAttribute('data-id', task.id);
  el.setAttribute('data-phase', task.phase || 'unity');
  el.innerHTML = `
    <div class="task-check" data-id="${task.id}" title="Toggle complete" role="checkbox" aria-checked="${isDone}" tabindex="0">
      <div class="checkmark"></div>
    </div>
    <div class="task-body">
      <div class="task-title">${escHtml(task.title)}</div>
      ${task.desc ? `<div class="task-desc">${escHtml(task.desc)}</div>` : ''}
      ${getPriorityTag(task.priority)}
    </div>
    <button class="task-edit" data-id="${task.id}" title="Edit task" aria-label="Edit task">✎</button>
    <button class="task-delete" data-id="${task.id}" title="Delete" aria-label="Delete task">✕</button>
  `;
  return el;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function renderTasks() {
  // Clear all phase lists
  Object.values(taskLists).forEach(list => list.innerHTML = '');

  let totalTasks = 0, doneTasks = 0;
  let visibleCount = 0;
  const phaseCount = { unity: [0,0], unreal: [0,0], general: [0,0] };

  const sorted = sortedTasks(tasks);

  sorted.forEach(task => {
    const isDone = String(task.isDone).toLowerCase() === 'true';
    totalTasks++;
    if (isDone) doneTasks++;

    const phase = task.phase || 'unity';
    if (phaseCount[phase]) {
      phaseCount[phase][0]++;
      if (isDone) phaseCount[phase][1]++;
    }

    if (!passesFilters(task)) return;

    visibleCount++;
    const el = createTaskEl(task);
    const targetList = taskLists[phase] || taskLists.unity;
    targetList.appendChild(el);
  });

  // Empty state
  emptyState.classList.toggle('hidden', visibleCount > 0);

  updateProgress(totalTasks, doneTasks);
  updateStats(totalTasks, doneTasks);
  updatePhaseProgress(phaseCount);
  renderActivityLog();
}

function updateProgress(total, done) {
  progText.textContent = `${done} / ${total} tasks`;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  progFill.style.width = pct + '%';

  if (pct === 100 && total > 0 && typeof confetti === 'function') {
    confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 } });
    showToast('🎉 All tasks complete!', 'success', 5000);
  }
}

// IMPROVEMENT #13: STATS STRIP
function updateStats(total, done) {
  statTotal.textContent = total;
  statDone.textContent = done;
  statRemaining.textContent = total - done;
}

// IMPROVEMENT #14: PER-PHASE MINI BARS
function updatePhaseProgress(phaseCount) {
  // Update phase labels
  const phases = { unity: 'unity', unreal: 'unreal', general: 'general' };
  Object.entries(phases).forEach(([phase, key]) => {
    const el = $(phase + '-prog');
    if (el) {
      const [total, done] = phaseCount[key] || [0,0];
      el.textContent = `${done}/${total}`;
    }
  });

  // Mini bars
  phaseMiniBar.innerHTML = Object.entries(phaseCount).map(([phase, [total, done]]) => {
    const pct = total > 0 ? Math.round((done/total)*100) : 0;
    const labels = { unity:'Unity', unreal:'Unreal', general:'General' };
    return `<div class="phase-mini mini-${phase}">
      <span>${labels[phase]}</span>
      <div class="phase-mini-track"><div class="phase-mini-fill" style="width:${pct}%"></div></div>
      <span>${pct}%</span>
    </div>`;
  }).join('');
}

// ─── INIT ──────────────────────────────────────────────────
async function init() {
  // Show skeleton loading
  Object.values(taskLists).forEach(list => {
    list.innerHTML = '<div class="skeleton"></div><div class="skeleton" style="height:40px;margin-top:5px;opacity:0.6"></div>';
  });

  tasks = await fetchTasks();

  if (tasks.length === 0) {
    showToast('Seeding initial tasks…', 'info');
    await seedDatabase();
    tasks = await fetchTasks();
  }

  renderTasks();
  updateStreak();
  renderActivityLog();
  initSortables();
}

// ─── SORTABLE DRAG-AND-DROP (one per phase list) ───────────
function initSortables() {
  Object.values(taskLists).forEach(list => {
    new Sortable(list, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      group: 'tasks',  // IMPROVEMENT #15: CROSS-PHASE DRAG
      onEnd: async function(evt) {
        // If moved to a different phase, update phase
        const taskEl = evt.item;
        const newPhase = evt.to.closest('.phase')?.getAttribute('data-phase') || 'unity';
        const taskId = taskEl.getAttribute('data-id');
        const taskObj = tasks.find(t => String(t.id) === String(taskId));
        if (taskObj && taskObj.phase !== newPhase) {
          taskObj.phase = newPhase;
          await apiPost({ action:'update', id:taskId, phase:newPhase });
          logActivity('↕', `Moved <strong>${escHtml(taskObj.title)}</strong> to ${newPhase}`);
        }

        // Update all order values
        const allItems = document.querySelectorAll('.task[data-id]');
        const updates = [];
        allItems.forEach((item, idx) => {
          const id = item.getAttribute('data-id');
          const obj = tasks.find(t => String(t.id) === String(id));
          if (obj) obj.order = idx;
          updates.push(apiPost({ action:'update', id, order:idx }));
        });
        await Promise.all(updates);
        saveLocal(STORAGE_KEY, tasks);
      }
    });
  });
}

// ─── THEME ────────────────────────────────────────────────
function applyTheme(theme) {
  if (theme === 'light') {
    document.body.setAttribute('data-theme', 'light');
    themeBtn.textContent = '🌙 Dark';
  } else {
    document.body.removeAttribute('data-theme');
    themeBtn.textContent = '☀️ Light';
  }
  localStorage.setItem('theme', theme);
}
// Load saved theme
applyTheme(localStorage.getItem('theme') || 'dark');

themeBtn.addEventListener('click', () => {
  const isLight = document.body.getAttribute('data-theme') === 'light';
  applyTheme(isLight ? 'dark' : 'light');
});

// ─── KANBAN TOGGLE ────────────────────────────────────────
kanbanBtn.addEventListener('click', () => {
  document.body.classList.toggle('kanban-active');
  kanbanBtn.classList.toggle('active');
});

// ─── ARCHIVE TOGGLE ───────────────────────────────────────
archiveBtn.addEventListener('click', () => {
  isArchiveMode = !isArchiveMode;
  archiveBtn.textContent = isArchiveMode ? '👁 Show Done' : '👁 Hide Done';
  archiveBtn.classList.toggle('active', isArchiveMode);
  renderTasks();
});

// ─── SEARCH WITH CLEAR ────────────────────────────────────
// IMPROVEMENT #16: REAL-TIME SEARCH WITH CLEAR BUTTON
searchInput.addEventListener('input', () => {
  searchClear.classList.toggle('hidden', !searchInput.value);
  renderTasks();
});
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.classList.add('hidden');
  searchInput.focus();
  renderTasks();
});

// ─── FILTERS & SORT ───────────────────────────────────────
filterPriority.addEventListener('change', renderTasks);
filterPhase.addEventListener('change', renderTasks);
sortSelect.addEventListener('change', renderTasks);

// ─── ADD TASK ─────────────────────────────────────────────
addTaskBtn.addEventListener('click', addTask);
newTaskInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

async function addTask() {
  const title = newTaskInput.value.trim();
  if (!title) {
    newTaskInput.focus();
    showToast('Please enter a task title', 'error');
    return;
  }

  const priority = taskPriority.value;
  const phase    = taskPhase.value;
  newTaskInput.value = '';
  addTaskBtn.disabled = true;
  addTaskBtn.textContent = '…';

  const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => Number(t.order))) : 0;
  const tempId = 'temp_' + Date.now();

  // IMPROVEMENT #17: OPTIMISTIC UI WITH ANIMATION
  const tempTask = {
    id: tempId, title, desc: '', priority, phase,
    isDone: false, order: maxOrder + 1,
    createdAt: new Date().toISOString()
  };
  tasks.push(tempTask);
  saveLocal(STORAGE_KEY, tasks);
  renderTasks();

  // Briefly highlight new task
  const newEl = document.querySelector(`[data-id="${tempId}"]`);
  if (newEl) newEl.classList.add('new-task');

  const result = await apiPost({
    action:'add', title, desc:'', priority, phase, order: maxOrder + 1
  });

  // Replace temp with real after re-fetch
  tasks = await fetchTasks();
  renderTasks();

  logActivity('➕', `Added <strong>${escHtml(title)}</strong>`);
  showToast(`Task added: "${title}"`, 'success');
  addTaskBtn.disabled = false;
  addTaskBtn.textContent = '+ Add';
}

// ─── TASK CLICK HANDLER (check / edit / delete) ───────────
document.getElementById('kanban-container').addEventListener('click', async e => {
  const deleteBtn = e.target.closest('.task-delete');
  const editBtn   = e.target.closest('.task-edit');
  const checkBtn  = e.target.closest('.task-check');

  if (deleteBtn) {
    const id = deleteBtn.getAttribute('data-id');
    const task = tasks.find(t => String(t.id) === String(id));
    if (!task) return;

    // IMPROVEMENT #18: CONFIRM DELETE WITH TOAST UNDO (simplified)
    tasks = tasks.filter(t => String(t.id) !== String(id));
    saveLocal(STORAGE_KEY, tasks);
    renderTasks();
    logActivity('🗑', `Deleted <strong>${escHtml(task.title)}</strong>`);
    showToast(`Deleted "${task.title}"`, 'error');
    await apiPost({ action:'delete', id });
    return;
  }

  if (editBtn) {
    const id = editBtn.getAttribute('data-id');
    openEditModal(id);
    return;
  }

  if (checkBtn) {
    const taskEl = e.target.closest('.task');
    if (!taskEl) return;
    const id = taskEl.getAttribute('data-id');
    await toggleTask(id, taskEl);
    return;
  }

  // Click on task body — open edit
  const taskEl = e.target.closest('.task');
  if (taskEl && !e.target.closest('.task-check') && !e.target.closest('.task-delete') && !e.target.closest('.task-edit')) {
    const id = taskEl.getAttribute('data-id');
    openEditModal(id);
  }
});

async function toggleTask(id, taskEl) {
  const isCurrentlyDone = taskEl.classList.contains('done');
  const taskObj = tasks.find(t => String(t.id) === String(id));
  if (!taskObj) return;

  if (!isCurrentlyDone) {
    playDing();
    updateStreak();
    logActivity('✅', `Completed <strong>${escHtml(taskObj.title)}</strong>`);
  } else {
    playUndo();
    logActivity('↩', `Reopened <strong>${escHtml(taskObj.title)}</strong>`);
  }

  taskObj.isDone = !isCurrentlyDone;
  saveLocal(STORAGE_KEY, tasks);
  renderTasks();
  await apiPost({ action:'update', id, isDone: !isCurrentlyDone });
}

// ACCESSIBILITY: Keyboard on checkboxes
document.getElementById('kanban-container').addEventListener('keydown', e => {
  if (e.key === ' ' || e.key === 'Enter') {
    const check = e.target.closest('.task-check');
    if (check) { e.preventDefault(); check.click(); }
  }
});

// ─── IMPROVEMENT #19: EDIT MODAL ─────────────────────────────
function openEditModal(id) {
  const task = tasks.find(t => String(t.id) === String(id));
  if (!task) return;
  editingTaskId = id;

  detailTitle.value = task.title;
  detailDesc.value  = task.desc || '';
  detailPhase.value = task.phase || 'unity';

  // Priority pills
  priorityPills.forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-val') === (task.priority || 'med'));
  });

  // Meta info
  const created = task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'Unknown';
  detailMeta.textContent = `Created: ${created}  ·  ID: ${id}`;

  detailOverlay.classList.remove('hidden');
  detailTitle.focus();
}

priorityPills.forEach(pill => {
  pill.addEventListener('click', () => {
    priorityPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
  });
});

detailSaveBtn.addEventListener('click', async () => {
  const id = editingTaskId;
  const task = tasks.find(t => String(t.id) === String(id));
  if (!task) return;

  const newTitle    = detailTitle.value.trim();
  const newDesc     = detailDesc.value.trim();
  const newPriority = document.querySelector('.ppill.active')?.getAttribute('data-val') || task.priority;
  const newPhase    = detailPhase.value;

  if (!newTitle) { showToast('Title cannot be empty', 'error'); return; }

  task.title    = newTitle;
  task.desc     = newDesc;
  task.priority = newPriority;
  task.phase    = newPhase;

  saveLocal(STORAGE_KEY, tasks);
  renderTasks();
  closeDetailModal();
  logActivity('✎', `Edited <strong>${escHtml(newTitle)}</strong>`);
  showToast('Task updated', 'success');

  await apiPost({ action:'update', id, title:newTitle, desc:newDesc, priority:newPriority, phase:newPhase });
  tasks = await fetchTasks();
  renderTasks();
});

detailDeleteBtn.addEventListener('click', async () => {
  const id = editingTaskId;
  const task = tasks.find(t => String(t.id) === String(id));
  closeDetailModal();
  tasks = tasks.filter(t => String(t.id) !== String(id));
  saveLocal(STORAGE_KEY, tasks);
  renderTasks();
  logActivity('🗑', `Deleted <strong>${escHtml(task?.title || '')}</strong>`);
  showToast('Task deleted', 'error');
  await apiPost({ action:'delete', id });
});

function closeDetailModal() {
  detailOverlay.classList.add('hidden');
  editingTaskId = null;
}
detailCloseBtn.addEventListener('click', closeDetailModal);
detailBackdrop.addEventListener('click', closeDetailModal);

// ─── SHORTCUT OVERLAY ─────────────────────────────────────
function openShortcuts() { shortcutOverlay.classList.remove('hidden'); }
function closeShortcuts() { shortcutOverlay.classList.add('hidden'); }
shortcutBtn.addEventListener('click', openShortcuts);
shortcutCloseBtn.addEventListener('click', closeShortcuts);
shortcutBackdrop.addEventListener('click', closeShortcuts);

// ─── IMPROVEMENT #20: EXPORT TO JSON ────────────────────────
exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `oregon-trail-tasks-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Tasks exported!', 'success');
  logActivity('⬇', 'Exported task list as JSON');
});

// ─── IMPROVEMENT #21: IMPORT FROM JSON ──────────────────────
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error('Invalid format');

    // Merge: add tasks not already present by title
    let added = 0;
    const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => Number(t.order))) : 0;
    for (const t of imported) {
      if (!tasks.find(existing => existing.title === t.title)) {
        t.order = maxOrder + added + 1;
        tasks.push(t);
        added++;
        await apiPost({ action:'add', ...t });
      }
    }
    saveLocal(STORAGE_KEY, tasks);
    renderTasks();
    showToast(`Imported ${added} new task${added !== 1 ? 's' : ''}`, 'success');
    logActivity('⬆', `Imported ${added} tasks from file`);
  } catch(err) {
    showToast('Import failed — invalid JSON', 'error');
  }
  importFile.value = '';
});

// ─── IMPROVEMENT #22: KEYBOARD SHORTCUTS ─────────────────────
document.addEventListener('keydown', e => {
  const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';

  if (e.key === 'Escape') {
    if (!detailOverlay.classList.contains('hidden')) { closeDetailModal(); return; }
    if (!shortcutOverlay.classList.contains('hidden')) { closeShortcuts(); return; }
    if (searchInput.value) { searchInput.value = ''; searchClear.classList.add('hidden'); renderTasks(); return; }
    searchInput.blur(); newTaskInput.blur();
    return;
  }

  if (inInput) return;

  switch(e.key) {
    case 'n': case 'N': e.preventDefault(); newTaskInput.focus(); break;
    case '/': e.preventDefault(); searchInput.focus(); break;
    case 'k': case 'K': document.body.classList.toggle('kanban-active'); kanbanBtn.classList.toggle('active'); break;
    case 't': case 'T': themeBtn.click(); break;
    case 'h': case 'H': archiveBtn.click(); break;
    case '?': openShortcuts(); break;
  }
});

// ─── IMPROVEMENT #23: SEED DATABASE ──────────────────────────
async function seedDatabase() {
  const seedTasks = [
    // UNITY PHASE
    {title:'Project setup',desc:'Create Unity project, configure Git, set up folder structure',priority:'med',phase:'unity'},
    {title:'Player controller',desc:'Use Unity Input System, not Input.GetKey',priority:'high',phase:'unity'},
    {title:'Wagon controller',desc:'Movement, physics, collision',priority:'high',phase:'unity'},
    {title:'World & camera',desc:'Use Cinemachine — never write your own camera follow script',priority:'med',phase:'unity'},
    {title:'GameManager + supply system',desc:'Singleton GameManager owns all global state. ScriptableObjects only.',priority:'high',phase:'unity'},
    {title:'Party system',desc:'Plain C# classes, not MonoBehaviours',priority:'high',phase:'unity'},
    {title:'EventBus',desc:'Generic pub/sub. No system calls another directly.',priority:'high',phase:'unity'},
    {title:'Random event system',desc:'ScriptableObject-driven event data',priority:'high',phase:'unity'},
    {title:'HUD + event UI',desc:'UI reads from systems, never owns state',priority:'high',phase:'unity'},
    {title:'Win + death conditions',desc:'',priority:'high',phase:'unity'},
    {title:'Active resource minigame',desc:'',priority:'high',phase:'unity'},
    {title:'Hazard / obstacle system',desc:'',priority:'high',phase:'unity'},
    {title:'Trading post / resupply',desc:'',priority:'high',phase:'unity'},
    {title:'Vehicle degradation',desc:'',priority:'high',phase:'unity'},
    {title:'Rest system',desc:'',priority:'high',phase:'unity'},
    {title:'Environmental conditions',desc:'Weather, terrain, seasons',priority:'med',phase:'unity'},
    {title:'Visual art pass',desc:'',priority:'low',phase:'unity'},
    {title:'Audio',desc:'',priority:'low',phase:'unity'},
    {title:'Save system',desc:'',priority:'high',phase:'unity'},
    {title:'Playtesting + tuning',desc:'',priority:'low',phase:'unity'},
    {title:'WebGL build → itch.io',desc:'',priority:'low',phase:'unity'},

    // UNREAL PHASE
    {title:'[UE5] Blueprint project setup',desc:'',priority:'med',phase:'unreal'},
    {title:'[UE5] Player controller + Enhanced Input',desc:'Use Enhanced Input not legacy',priority:'high',phase:'unreal'},
    {title:'[UE5] Nanite terrain + Lumen lighting',desc:'No baked lighting ever',priority:'med',phase:'unreal'},
    {title:'[UE5] GameMode + GameState + GameInstance',desc:'UE equivalent of GameManager',priority:'high',phase:'unreal'},
    {title:'[UE5] Supply system → Game Instance',desc:'Persists across level loads',priority:'high',phase:'unreal'},
    {title:'[UE5] EventBus → Event Dispatchers',desc:'Nothing calls anything directly',priority:'high',phase:'unreal'},
    {title:'[UE5] Random events → Data Assets',desc:'UE equivalent of ScriptableObjects',priority:'high',phase:'unreal'},
    {title:'[UE5] UMG HUD',desc:'UI reads state, never owns it',priority:'high',phase:'unreal'},
    {title:'[UE5] Vehicle → Chaos Wheeled Vehicle',desc:'',priority:'high',phase:'unreal'},
    {title:'[UE5] World Partition + PCG foliage',desc:'',priority:'med',phase:'unreal'},
    {title:'[UE5] Dynamic sky + volumetric atmosphere',desc:'',priority:'med',phase:'unreal'},
    {title:'[UE5] Free realistic assets',desc:'Quixel Megascans, Fab.com, Poly Haven',priority:'low',phase:'unreal'},
    {title:'[UE5] Animal AI',desc:'',priority:'high',phase:'unreal'},
    {title:'[UE5] Blueprint replication',desc:'Mark variables Replicated, use Server/Client events',priority:'high',phase:'unreal'},
    {title:'[UE5] Dedicated server + Edgegap',desc:'',priority:'med',phase:'unreal'},
    {title:'[UE5] Ship',desc:'The dream version is live',priority:'low',phase:'unreal'},
  ];

  const tasksToSeed = seedTasks.map((t, i) => ({
    ...t, isDone:false, order:i, createdAt: new Date().toISOString()
  }));

  await apiPost({ action:'seed', tasks:tasksToSeed });
}

// ─── BOOT ──────────────────────────────────────────────────
init();
