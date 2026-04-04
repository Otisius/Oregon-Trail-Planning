import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ⚠️ PASTE YOUR FIREBASE CONFIG HERE ⚠️
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

// Audio context for the satisfying 'ding'
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playDing() {
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // High pitch
  oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
  gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.3);
}

new Sortable(taskListDiv, {
  animation: 150,
  ghostClass: 'sortable-ghost',
  handle: '.task',
  onEnd: async function (evt) {
    const items = taskListDiv.children;
    for (let i = 0; i < items.length; i++) {
      const taskId = items[i].getAttribute('data-id');
      if(taskId) await updateDoc(doc(db, 'tasks', taskId), { order: i });
    }
  },
});

function updateProgress(total, done) {
  document.getElementById('prog-text').textContent = `${done} / ${total} tasks`;
  document.getElementById('phase-1-prog').textContent = `${done} / ${total} completed`;
  
  const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById('prog-fill').style.width = percentage + '%';

  // Trigger Confetti!
  if (percentage === 100 && total > 0) {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  }
}

function getPriorityTag(priority) {
  if (priority === 'high') return '<div class="task-tag tag-system">High Priority</div>';
  if (priority === 'med') return '<div class="task-tag tag-code">Med Priority</div>';
  return '<div class="task-tag tag-setup">Low Priority</div>';
}

onSnapshot(q, (snapshot) => {
  taskListDiv.innerHTML = '';
  let totalTasks = 0;
  let doneTasks = 0;
  
  snapshot.forEach((docSnap) => {
    const task = docSnap.data();
    const taskId = docSnap.id;
    totalTasks++;
    if (task.isDone) doneTasks++;
    
    // Skip rendering if archive mode is on and task is done
    if (isArchiveMode && task.isDone) return;

    const taskEl = document.createElement('div');
    taskEl.className = `task ${task.isDone ? 'done' : ''}`;
    taskEl.setAttribute('data-id', taskId);
    taskEl.innerHTML = `
      <div class="task-check" data-id="${taskId}"><div class="checkmark"></div></div>
      <div class="task-body">
        <div class="task-title">${task.title}</div>
        ${getPriorityTag(task.priority)}
      </div>
      <div class="task-delete" data-id="${taskId}" title="Delete">✕</div>
    `;
    taskListDiv.appendChild(taskEl);
  });
  
  updateProgress(totalTasks, doneTasks);
});

// Archive Toggle Logic
document.getElementById('archive-btn').addEventListener('click', (e) => {
  isArchiveMode = !isArchiveMode;
  e.target.textContent = isArchiveMode ? '👁️ Show Completed' : '👁️ Hide Completed';
  // Force a re-render by fetching data again
  onSnapshot(q, () => {}); 
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
if(localStorage.getItem('theme') === 'light') {
  document.body.setAttribute('data-theme', 'light');
  document.getElementById('theme-btn').textContent = '🌙 Dark Mode';
}

// Add Task
document.getElementById('add-task-btn').addEventListener('click', async () => {
  const input = document.getElementById('new-task-input');
  const priority = document.getElementById('task-priority').value;
  if (input.value.trim() === '') return;
  await addDoc(tasksCollection, {
    title: input.value, isDone: false, priority: priority, order: 9999, createdAt: new Date()
  });
  input.value = '';
});

// Click Delegation
taskListDiv.addEventListener('click', async (e) => {
  if (e.target.closest('.task-delete')) {
    const id = e.target.closest('.task-delete').getAttribute('data-id');
    await deleteDoc(doc(db, 'tasks', id));
  } 
  else if (e.target.closest('.task-check') || e.target.closest('.task')) {
    if (e.target.closest('.task-delete')) return;
    const taskEl = e.target.closest('.task');
    const id = taskEl.getAttribute('data-id');
    const isCurrentlyDone = taskEl.classList.contains('done');
    
    if (!isCurrentlyDone) playDing(); // Play sound when completing a task
    await updateDoc(doc(db, 'tasks', id), { isDone: !isCurrentlyDone });
  }
});
