import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ⚠️ PASTE YOUR FIREBASE CONFIG HERE BEFORE UPLOADING ⚠️
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdefg"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const tasksCollection = collection(db, 'tasks');
const q = query(tasksCollection, orderBy("order", "asc"));
const taskListDiv = document.getElementById('task-list');

let isArchiveMode = false;

// Audio context for satisfying Checkmark Ding
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

// Initialize Drag and Drop
new Sortable(taskListDiv, {
  animation: 150, 
  ghostClass: 'sortable-ghost', 
  handle: '.task',
  onEnd: async function () {
    const items = taskListDiv.children;
    for (let i = 0; i < items.length; i++) {
      const taskId = items[i].getAttribute('data-id');
      if(taskId) await updateDoc(doc(db, 'tasks', taskId), { order: i });
    }
  },
});

// Update Progress Bars & Trigger Confetti
function updateProgress(total, done) {
  document.getElementById('prog-text').textContent = `${done} / ${total} tasks`;
  document.getElementById('phase-1-prog').textContent = `${done} / ${total} completed`;
  
  const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById('prog-fill').style.width = percentage + '%';
  
  if (percentage === 100 && total > 0) {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  }
}

// Helper to color-code priorities
function getPriorityTag(priority) {
  if (priority === 'high') return '<div class="task-tag tag-system">High Priority</div>';
  if (priority === 'med') return '<div class="task-tag tag-code">Med Priority</div>';
  return '<div class="task-tag tag-setup">Low Priority</div>';
}

// Real-Time Firebase Listener
onSnapshot(q, (snapshot) => {
  taskListDiv.innerHTML = '';
  let totalTasks = 0; let doneTasks = 0;
  
  snapshot.forEach((docSnap) => {
    const task = docSnap.data(); 
    const taskId = docSnap.id;
    
    totalTasks++; 
    if (task.isDone) doneTasks++;
    
    // Hide if Archive Mode is active
    if (isArchiveMode && task.isDone) return;

    const taskEl = document.createElement('div');
    taskEl.className = `task ${task.isDone ? 'done' : ''}`;
    taskEl.setAttribute('data-id', taskId);
    taskEl.innerHTML = `
      <div class="task-check" data-id="${taskId}"><div class="checkmark"></div></div>
      <div class="task-body">
        <div class="task-title">${task.title}</div>
        ${task.desc ? `<div class="task-desc">${task.desc}</div>` : ''}
        ${getPriorityTag(task.priority)}
      </div>
      <div class="task-delete" data-id="${taskId}" title="Delete">✕</div>
    `;
    taskListDiv.appendChild(taskEl);
  });
  updateProgress(totalTasks, doneTasks);
});

// Theme Toggle
document.getElementById('theme-btn').addEventListener('click', () => {
  const isLight = document.body.getAttribute('data-theme') === 'light';
  if (isLight) {
    document.body.removeAttribute('data-theme');
    document.getElementById('theme-btn').textContent = '☀️ Light Mode';
    localStorage.setItem('theme', 'dark');
  } else {
    document.body.setAttribute('data-theme', 'light');
    document.getElementById('theme-btn').textContent = '🌙 Dark Mode';
    localStorage.setItem('theme', 'light');
  }
});

// Load Theme on Boot
if(localStorage.getItem('theme') === 'light') {
  document.body.setAttribute('data-theme', 'light');
  document.getElementById('theme-btn').textContent = '🌙 Dark Mode';
}

// Kanban Toggle
document.getElementById('kanban-btn').addEventListener('click', () => {
  document.body.classList.toggle('kanban-active');
});

// Search Filter
document.getElementById('search-input').addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('.task').forEach(task => {
    task.classList.toggle('hidden', !task.innerText.toLowerCase().includes(term));
  });
});

// Archive Toggle
document.getElementById('archive-btn').addEventListener('click', (e) => {
  isArchiveMode = !isArchiveMode;
  e.target.textContent = isArchiveMode ? '👁️ Show Completed' : '👁️ Hide Completed';
  onSnapshot(q, () => {}); // Force refresh
});

// Add Task Button
document.getElementById('add-task-btn').addEventListener('click', async () => {
  const input = document.getElementById('new-task-input');
  const priority = document.getElementById('task-priority').value;
  if (input.value.trim() === '') return;
  
  await addDoc(tasksCollection, { 
    title: input.value, 
    desc: "", 
    isDone: false, 
    priority: priority, 
    order: 9999 
  });
  input.value = '';
});

// Click Events (Checkmarks & Delete)
taskListDiv.addEventListener('click', async (e) => {
  if (e.target.closest('.task-delete')) {
    await deleteDoc(doc(db, 'tasks', e.target.closest('.task-delete').getAttribute('data-id')));
  } else if (e.target.closest('.task-check') || e.target.closest('.task')) {
    if (e.target.closest('.task-delete')) return;
    const taskEl = e.target.closest('.task');
    const isCurrentlyDone = taskEl.classList.contains('done');
    
    if (!isCurrentlyDone) playDing(); 
    await updateDoc(doc(db, 'tasks', taskEl.getAttribute('data-id')), { isDone: !isCurrentlyDone });
  }
});

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return; 
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); document.getElementById('new-task-input').focus(); }
  if (e.key === '/') { e.preventDefault(); document.getElementById('search-input').focus(); }
  if (e.key === 'k' || e.key === 'K') { document.body.classList.toggle('kanban-active'); }
});

// V2 AUTO-LOADER SCRIPT
document.getElementById('load-v2-btn').addEventListener('click', async () => {
  if(!confirm("This will load the original V2 Roadmap into your live database. Proceed?")) return;
  
  const v2Tasks = [
    { title: "Project setup", desc: "", priority: "low" },
    { title: "Player controller", desc: "Use Unity's Input System, not Input.GetKey.", priority: "high" },
    { title: "Wagon controller", desc: "", priority: "med" },
    { title: "World & camera", desc: "Use Cinemachine.", priority: "med" },
    { title: "GameManager + supply system", desc: "Singleton GameManager owns all global state.", priority: "high" },
    { title: "Party system", desc: "Store members as plain C# classes, not MonoBehaviours.", priority: "high" },
    { title: "EventBus", desc: "A generic pub/sub event bus.", priority: "high" },
    { title: "Random event system", desc: "", priority: "med" },
    { title: "HUD + event UI", desc: "UI reads from systems — never owns state.", priority: "low" },
    { title: "Visual art pass", desc: "Megascans and styling.", priority: "low" }
  ];

  for (let i = 0; i < v2Tasks.length; i++) {
    await addDoc(tasksCollection, {
      title: v2Tasks[i].title, 
      desc: v2Tasks[i].desc, 
      isDone: false, 
      priority: v2Tasks[i].priority, 
      order: i
    });
  }
  alert("V2 Roadmap Loaded! You can now drag, edit, and check them off.");
});
