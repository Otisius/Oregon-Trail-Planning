import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-srP3VuHYD2pvNYp5UyTDqXtTq-69bp8",
  authDomain: "oregon-trail-outline.firebaseapp.com",
  projectId: "oregon-trail-outline",
  storageBucket: "oregon-trail-outline.firebasestorage.app",
  messagingSenderId: "608355546531",
  appId: "1:608355546531:web:85db061b1fa53d42fe9616",
  measurementId: "G-ENLDR85BRF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'char');

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
      if (taskId) await updateDoc(doc(db, 'tasks', taskId), { order: i });
    }
  },
});

// Update Progress Bar & Trigger Confetti
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

if (localStorage.getItem('theme') === 'light') {
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
  onSnapshot(q, () => {});
});

// Add Task
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

// Enter key to add task
document.getElementById('new-task-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('add-task-btn').click();
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

// ==========================================
// TRUE "RUN-ONCE" V2 ROADMAP INJECTOR
// ==========================================
async function autoSeedDatabase() {
  const configRef = doc(db, 'system', 'config');
  const configSnap = await getDoc(configRef);

  if (configSnap.exists() && configSnap.data().v2Loaded === true) {
    console.log("V2 Roadmap already loaded. Skipping.");
    return;
  }

  console.log("First run detected. Injecting V2 roadmap...");

  const fullRoadmap = [
    { title: "Project setup", desc: "", priority: "med" },
    { title: "Player controller", desc: "Use Unity's Input System, not Input.GetKey — remote players are driven by the network, not a keyboard.", priority: "high" },
    { title: "Wagon controller", desc: "", priority: "high" },
    { title: "World & camera", desc: "Use Cinemachine — manually managing cameras will cause pain when you add multiplayer.", priority: "med" },
    { title: "GameManager + supply system", desc: "Singleton GameManager owns all global state. Resources must be configurable via ScriptableObjects — never hardcoded.", priority: "high" },
    { title: "Party system", desc: "Store members as plain C# classes, not MonoBehaviours — so they can sync over the network later without refactoring.", priority: "high" },
    { title: "EventBus", desc: "A generic pub/sub event bus all systems communicate through. No system calls another directly. Get this in before anything else.", priority: "high" },
    { title: "Random event system", desc: "", priority: "high" },
    { title: "HUD + event UI", desc: "UI reads from systems — never owns state or calculates anything.", priority: "high" },
    { title: "Win + death conditions", desc: "", priority: "high" },
    { title: "Active resource minigame", desc: "", priority: "high" },
    { title: "Hazard / obstacle system", desc: "", priority: "high" },
    { title: "Trading post / resupply", desc: "", priority: "high" },
    { title: "Vehicle degradation", desc: "", priority: "high" },
    { title: "Rest system", desc: "", priority: "high" },
    { title: "Environmental conditions", desc: "", priority: "med" },
    { title: "Visual art pass", desc: "", priority: "low" },
    { title: "Audio", desc: "", priority: "low" },
    { title: "Save system", desc: "", priority: "high" },
    { title: "Playtesting + tuning", desc: "", priority: "low" },
    { title: "WebGL build → itch.io", desc: "", priority: "low" },
    { title: "[UE5] Blueprint project setup", desc: "", priority: "med" },
    { title: "[UE5] Player controller + Enhanced Input", desc: "Use Enhanced Input, not the legacy input system.", priority: "high" },
    { title: "[UE5] Nanite terrain + Lumen lighting", desc: "Get Lumen stable before building gameplay on top. No baked lighting — ever.", priority: "med" },
    { title: "[UE5] GameMode + GameState + GameInstance", desc: "UE's equivalent of GameManager. Map these three to what you built in Unity before writing any gameplay code.", priority: "high" },
    { title: "[UE5] Supply system → Game Instance", desc: "Rebuild SupplySystem inside the Blueprint Game Instance — persists across level loads, accessible from anywhere.", priority: "high" },
    { title: "[UE5] EventBus → Event Dispatchers", desc: "Blueprint Event Dispatchers are the UE equivalent. Same rule: nothing calls anything directly.", priority: "high" },
    { title: "[UE5] Random events → Data Assets", desc: "UE's equivalent of ScriptableObjects. Define fields in a Blueprint Data Asset, edit instances in the content browser.", priority: "high" },
    { title: "[UE5] UMG HUD", desc: "Blueprint widgets. Same rule as Unity: UI reads state, never owns it.", priority: "high" },
    { title: "[UE5] Vehicle → Chaos Wheeled Vehicle", desc: "", priority: "high" },
    { title: "[UE5] World Partition + PCG foliage", desc: "World Partition handles the open world. PCG scatters rocks, grass, trees.", priority: "med" },
    { title: "[UE5] Dynamic sky + volumetric atmosphere", desc: "", priority: "med" },
    { title: "[UE5] Free realistic assets", desc: "Quixel Megascans are free with UE. Fab.com free tier and Poly Haven cover the rest.", priority: "low" },
    { title: "[UE5] Animal AI", desc: "", priority: "high" },
    { title: "[UE5] Blueprint replication", desc: "No external library needed. Mark variables as Replicated in Blueprint, use Server/Client events.", priority: "high" },
    { title: "[UE5] Dedicated server + Edgegap", desc: "", priority: "med" },
    { title: "[UE5] Ship", desc: "The dream version is live.", priority: "low" }
  ];

  for (let i = 0; i < fullRoadmap.length; i++) {
    await addDoc(tasksCollection, {
      title: fullRoadmap[i].title,
      desc: fullRoadmap[i].desc,
      isDone: false,
      priority: fullRoadmap[i].priority,
      order: i,
      createdAt: new Date()
    });
  }

  await setDoc(configRef, { v2Loaded: true });
  console.log("V2 Roadmap injection complete.");
}

autoSeedDatabase();
