const API_URL = "https://script.google.com/macros/s/AKfycbykFHM1aZjiTze0G2mbCeYpes5rf-Sb1lEkle9D4fDm09kRStnLlVG4CvYpcy03pMeMvA/exec";

// DOM Elements
const taskListDiv = document.getElementById('task-list');
const progText = document.getElementById('prog-text');
const progFill = document.getElementById('prog-fill');
const phase1Prog = document.getElementById('phase-1-prog');
const newTaskInput = document.getElementById('new-task-input');
const taskPriority = document.getElementById('task-priority');
const addTaskBtn = document.getElementById('add-task-btn');
const searchInput = document.getElementById('search-input');
const archiveBtn = document.getElementById('archive-btn');
const kanbanBtn = document.getElementById('kanban-btn');
const themeBtn = document.getElementById('theme-btn');

// State
let tasks = [];
let isArchiveMode = false;

// Audio context for Checkmark Ding
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playDing() {
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
  gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.3);
}

// --- API Helpers ---

async function fetchTasks() {
  try {
    const response = await fetch(API_URL);
    const result = await response.json();
    return result.success ? result.data : [];
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
}

async function apiPost(payload) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      // GAS Web Apps require text/plain to avoid CORS preflight failures on POSTs
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error("API POST Error:", error);
    return { success: false, error };
  }
}

// --- Core Logic ---

async function init() {
  taskListDiv.innerHTML = "<p style='padding: 1rem; color: var(--text-muted);'>Loading tasks...</p>";
  tasks = await fetchTasks();

  if (tasks.length === 0) {
    taskListDiv.innerHTML = "<p style='padding: 1rem; color: var(--text-muted);'>Seeding database...</p>";
    await seedDatabase();
    tasks = await fetchTasks();
  }

  renderTasks();
}

function renderTasks() {
  taskListDiv.innerHTML = '';
  let totalTasks = 0;
  let doneTasks = 0;

  // Sort by order
  tasks.sort((a, b) => Number(a.order) - Number(b.order));

  tasks.forEach(task => {
    // Coerce isDone to boolean (GAS might return 'TRUE' or boolean true)
    const isDone = String(task.isDone).toLowerCase() === 'true';
    totalTasks++;
    if (isDone) doneTasks++;

    if (isArchiveMode && isDone) return;

    const taskEl = document.createElement('div');
    taskEl.className = `task ${isDone ? 'done' : ''}`;
    taskEl.setAttribute('data-id', task.id);
    taskEl.innerHTML = `
      <div class="task-check" data-id="${task.id}"><div class="checkmark"></div></div>
      <div class="task-body">
        <div class="task-title">${task.title}</div>
        ${task.desc ? `<div class="task-desc">${task.desc}</div>` : ''}
        ${getPriorityTag(task.priority)}
      </div>
      <div class="task-delete" data-id="${task.id}" title="Delete">✕</div>
    `;
    taskListDiv.appendChild(taskEl);
  });

  updateProgress(totalTasks, doneTasks);
  
  // Re-apply search filter if there's text in the input
  if (searchInput.value) {
    searchInput.dispatchEvent(new Event('input'));
  }
}

function updateProgress(total, done) {
  progText.textContent = `${done} / ${total} tasks`;
  phase1Prog.textContent = `${done} / ${total} completed`;
  const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
  progFill.style.width = percentage + '%';
  
  if (percentage === 100 && total > 0 && typeof confetti === 'function') {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  }
}

function getPriorityTag(priority) {
  if (priority === 'high') return '<div class="task-tag tag-system">High Priority</div>';
  if (priority === 'med') return '<div class="task-tag tag-code">Med Priority</div>';
  return '<div class="task-tag tag-setup">Low Priority</div>';
}

// --- Event Listeners ---

// Theme Toggle
themeBtn.addEventListener('click', () => {
  const isLight = document.body.getAttribute('data-theme') === 'light';
  if (isLight) {
    document.body.removeAttribute('data-theme');
    themeBtn.textContent = '☀️ Light Mode';
    localStorage.setItem('theme', 'dark');
  } else {
    document.body.setAttribute('data-theme', 'light');
    themeBtn.textContent = '🌙 Dark Mode';
    localStorage.setItem('theme', 'light');
  }
});

if (localStorage.getItem('theme') === 'light') {
  document.body.setAttribute('data-theme', 'light');
  themeBtn.textContent = '🌙 Dark Mode';
}

// Kanban Toggle
kanbanBtn.addEventListener('click', () => {
  document.body.classList.toggle('kanban-active');
});

// Search Filter
searchInput.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('.task').forEach(taskEl => {
    taskEl.classList.toggle('hidden', !taskEl.innerText.toLowerCase().includes(term));
  });
});

// Archive Toggle
archiveBtn.addEventListener('click', (e) => {
  isArchiveMode = !isArchiveMode;
  e.target.textContent = isArchiveMode ? '👁️ Show Completed' : '👁️ Hide Completed';
  renderTasks();
});

// Add Task
addTaskBtn.addEventListener('click', async () => {
  const title = newTaskInput.value.trim();
  const priority = taskPriority.value;
  if (title === '') return;
  
  // Optimistic UI clear
  newTaskInput.value = '';
  addTaskBtn.disabled = true;

  const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => Number(t.order))) : 0;
  
  await apiPost({
    action: 'add',
    title: title,
    desc: "",
    priority: priority,
    order: maxOrder + 1
  });

  tasks = await fetchTasks();
  renderTasks();
  addTaskBtn.disabled = false;
});

// Enter key to add task
newTaskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTaskBtn.click();
});

// Click Events (Checkmarks & Delete)
taskListDiv.addEventListener('click', async (e) => {
  const deleteBtn = e.target.closest('.task-delete');
  const checkBtn = e.target.closest('.task-check') || e.target.closest('.task');

  if (deleteBtn) {
    const id = deleteBtn.getAttribute('data-id');
    
    // Optimistic UI removal
    tasks = tasks.filter(t => String(t.id) !== String(id));
    renderTasks();
    
    await apiPost({ action: 'delete', id: id });
    return;
  } 
  
  if (checkBtn) {
    const taskEl = e.target.closest('.task');
    const id = taskEl.getAttribute('data-id');
    const isCurrentlyDone = taskEl.classList.contains('done');
    
    if (!isCurrentlyDone) playDing();

    // Optimistic UI update
    const taskIndex = tasks.findIndex(t => String(t.id) === String(id));
    if (taskIndex !== -1) {
      tasks[taskIndex].isDone = !isCurrentlyDone;
      renderTasks();
    }
    
    await apiPost({ 
      action: 'update', 
      id: id, 
      isDone: !isCurrentlyDone 
    });
  }
});

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); newTaskInput.focus(); }
  if (e.key === '/') { e.preventDefault(); searchInput.focus(); }
  if (e.key === 'k' || e.key === 'K') { document.body.classList.toggle('kanban-active'); }
});

// Initialize Drag and Drop (SortableJS)
new Sortable(taskListDiv, {
  animation: 150,
  ghostClass: 'sortable-ghost',
  handle: '.task',
  onEnd: async function () {
    const items = Array.from(taskListDiv.children);
    const updatePromises = [];

    items.forEach((item, index) => {
      const taskId = item.getAttribute('data-id');
      if (taskId) {
        // Update local state
        const taskObj = tasks.find(t => String(t.id) === String(taskId));
        if (taskObj) taskObj.order = index;

        // Queue API update
        updatePromises.push(apiPost({
          action: 'update',
          id: taskId,
          order: index
        }));
      }
    });

    // Fire off all updates concurrently
    await Promise.all(updatePromises);
  },
});

// --- Seed Data Logic ---

async function seedDatabase() {
  const seedTasks = [
    {title:'Project setup',desc:'',priority:'med'},
    {title:'Player controller',desc:'Use Unity Input System, not Input.GetKey',priority:'high'},
    {title:'Wagon controller',desc:'',priority:'high'},
    {title:'World & camera',desc:'Use Cinemachine',priority:'med'},
    {title:'GameManager + supply system',desc:'Singleton GameManager owns all global state. ScriptableObjects only.',priority:'high'},
    {title:'Party system',desc:'Plain C# classes, not MonoBehaviours',priority:'high'},
    {title:'EventBus',desc:'Generic pub/sub. No system calls another directly.',priority:'high'},
    {title:'Random event system',desc:'',priority:'high'},
    {title:'HUD + event UI',desc:'UI reads from systems, never owns state',priority:'high'},
    {title:'Win + death conditions',desc:'',priority:'high'},
    {title:'Active resource minigame',desc:'',priority:'high'},
    {title:'Hazard / obstacle system',desc:'',priority:'high'},
    {title:'Trading post / resupply',desc:'',priority:'high'},
    {title:'Vehicle degradation',desc:'',priority:'high'},
    {title:'Rest system',desc:'',priority:'high'},
    {title:'Environmental conditions',desc:'',priority:'med'},
    {title:'Visual art pass',desc:'',priority:'low'},
    {title:'Audio',desc:'',priority:'low'},
    {title:'Save system',desc:'',priority:'high'},
    {title:'Playtesting + tuning',desc:'',priority:'low'},
    {title:'WebGL build → itch.io',desc:'',priority:'low'},
    {title:'[UE5] Blueprint project setup',desc:'',priority:'med'},
    {title:'[UE5] Player controller + Enhanced Input',desc:'Use Enhanced Input not legacy',priority:'high'},
    {title:'[UE5] Nanite terrain + Lumen lighting',desc:'No baked lighting ever',priority:'med'},
    {title:'[UE5] GameMode + GameState + GameInstance',desc:'UE equivalent of GameManager',priority:'high'},
    {title:'[UE5] Supply system → Game Instance',desc:'Persists across level loads',priority:'high'},
    {title:'[UE5] EventBus → Event Dispatchers',desc:'Nothing calls anything directly',priority:'high'},
    {title:'[UE5] Random events → Data Assets',desc:'UE equivalent of ScriptableObjects',priority:'high'},
    {title:'[UE5] UMG HUD',desc:'UI reads state, never owns it',priority:'high'},
    {title:'[UE5] Vehicle → Chaos Wheeled Vehicle',desc:'',priority:'high'},
    {title:'[UE5] World Partition + PCG foliage',desc:'',priority:'med'},
    {title:'[UE5] Dynamic sky + volumetric atmosphere',desc:'',priority:'med'},
    {title:'[UE5] Free realistic assets',desc:'Quixel Megascans, Fab.com, Poly Haven',priority:'low'},
    {title:'[UE5] Animal AI',desc:'',priority:'high'},
    {title:'[UE5] Blueprint replication',desc:'Mark variables Replicated, use Server/Client events',priority:'high'},
    {title:'[UE5] Dedicated server + Edgegap',desc:'',priority:'med'},
    {title:'[UE5] Ship',desc:'The dream version is live',priority:'low'}
  ];

  // Add initial tracking properties
  const tasksToSeed = seedTasks.map((task, index) => ({
    ...task,
    isDone: false,
    order: index
  }));

  await apiPost({
    action: 'seed',
    tasks: tasksToSeed
  });
}

// Boot up
init();
