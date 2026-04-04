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

// Query tasks, ordered by their 'order' number
const tasksCollection = collection(db, 'tasks');
const q = query(tasksCollection, orderBy("order", "asc"));
const taskListDiv = document.getElementById('task-list');

// Initialize SortableJS (Drag and Drop)
new Sortable(taskListDiv, {
  animation: 150,
  ghostClass: 'sortable-ghost',
  handle: '.task',
  onEnd: async function (evt) {
    const items = taskListDiv.children;
    for (let i = 0; i < items.length; i++) {
      const taskId = items[i].getAttribute('data-id');
      if(taskId) {
        await updateDoc(doc(db, 'tasks', taskId), { order: i });
      }
    }
  },
});

// Update Progress Bar
function updateProgress(total, done) {
  document.getElementById('prog-text').textContent = `${done} / ${total} tasks`;
  document.getElementById('prog-fill').style.width = total === 0 ? '0%' : Math.round((done / total) * 100) + '%';
}

// Helper to get priority colors
function getPriorityTag(priority) {
  if (priority === 'high') return '<div class="task-tag tag-system">High Priority</div>';
  if (priority === 'med') return '<div class="task-tag tag-code">Med Priority</div>';
  return '<div class="task-tag tag-setup">Low Priority</div>';
}

// Real-time Database Listener
onSnapshot(q, (snapshot) => {
  taskListDiv.innerHTML = '';
  let totalTasks = 0;
  let doneTasks = 0;
  
  snapshot.forEach((docSnap) => {
    const task = docSnap.data();
    const taskId = docSnap.id;
    totalTasks++;
    if (task.isDone) doneTasks++;
    
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

// Add Task Form Handler
document.getElementById('add-task-btn').addEventListener('click', async () => {
  const input = document.getElementById('new-task-input');
  const priority = document.getElementById('task-priority').value;
  
  if (input.value.trim() === '') return;

  await addDoc(tasksCollection, {
    title: input.value,
    isDone: false,
    priority: priority,
    order: 9999, // High number sends it to bottom
    createdAt: new Date()
  });
  
  input.value = '';
});

// Click Delegation (Checkmarks & Delete)
taskListDiv.addEventListener('click', async (e) => {
  if (e.target.closest('.task-delete')) {
    const id = e.target.closest('.task-delete').getAttribute('data-id');
    await deleteDoc(doc(db, 'tasks', id));
  } 
  else if (e.target.closest('.task-check')) {
    const taskEl = e.target.closest('.task');
    const id = taskEl.getAttribute('data-id');
    const isCurrentlyDone = taskEl.classList.contains('done');
    await updateDoc(doc(db, 'tasks', id), { isDone: !isCurrentlyDone });
  }
});

// Theme Toggle Logic
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
