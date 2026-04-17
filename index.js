
/* ================= UTIL ================= */
let focusedNodeId = null;
let searchQuery = "";

let isAdmin = true;
let pyqFilters = new Set(); // 🔥 multi-select
let activeRenderTree = null; // 🔥 global

let searchResults = [];
let searchIndex = -1;
let quizMode = false;
let quizRevealed = new Set();


const uid = () => Math.random().toString(36).slice(2);
const clone = o => JSON.parse(JSON.stringify(o));
const safeName = n => (n||"mindmap").replace(/[<>:"/\\|?*]+/g,"").replace(/\s+/g,"_");

function resetQuizState() {
  quizMode = false;
  quizRevealed = new Set();
}

function isNodeHiddenInQuiz(node) {
  return quizMode && node.id !== currentMap.id && !quizRevealed.has(node.id);
}

/* ===== Node Color by Level ===== */
function nodeColor(depth) {
  const palette = [
  //      "#d1cfee", // very light blue-violet
  // "#c9dbf0", // very light pastel blue
  // "#b8d6dd", // very light blue-teal

  // "#c7e3d6", // very light pastel green

  // "#d7f5ef", // very light mint-teal
  // "#dcf6cf", // very light leaf green
  // "#dff5ea", // very light airy mint

  // "#dceff9", // very light sky-blue
  // "#c8f7e5", // very light fresh green

  // "#ddece4", // very light sage
  // "#edf2df",  // very light sage-pastel
  //   "#bfe5e1" // very light pastel teal
  "#bcb9ed", // soft blue-violet
  "#a4c9eb", // pastel blue
  "#8fbea6", // pastel green
  "#96b8bf", // blue-teal
  "#a8e2d6", // mint-teal
  "#72b9b3", // pastel teal
  
  
  "#b3e2a2",  // leaf green
  "#b8e4cb", // airy mint
  "#b3e1f2", // airy sky-blue
  "#8aeac1", // fresh light green
  "#b7d6c6", // soft sage
  "#ccd9b7", // sage pastel

];



  return palette[Math.min(depth, palette.length - 1)];
}

function getTodayPassword() {
  const d = new Date();

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}${month}${year}@YT`; // 🔑 your pattern
}

function enableAdminMode() {
  const pass = prompt("Enter Admin Password:");

  if (pass === getTodayPassword()) {
    isAdmin = true;
    localStorage.setItem("isAdmin", "true");
    alert("Admin mode enabled");
    render();
  } else {
    alert("Wrong password");
  }
}
function disableAdminMode() {
  isAdmin = false;
  alert("Admin mode disabled");
  render();
}

function searchNodes(q){
  searchQuery = q.toLowerCase();

  searchResults = [];
  collectSearchResults(currentMap);

  searchIndex = searchResults.length ? 0 : -1;

  if (searchIndex !== -1) {
    expandPathToNode(currentMap, searchResults[0]);
  }

  render().then(() => {
    if (searchIndex !== -1) {
      focusNode(searchResults[searchIndex]);
    }
    updateSearchIndicator();
  });
}

function nodeMatchesSearch(node) {
  if (!searchQuery) return false;

  const textMatch = node.text.toLowerCase().includes(searchQuery);
  const noteMatch = (node.note || "").toLowerCase().includes(searchQuery);

  return textMatch || noteMatch;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightSearchMatch(text, query) {
  const raw = String(text || "");
  if (!query) return escapeHtml(raw);

  const source = raw.toLowerCase();
  const needle = query.toLowerCase();
  if (!needle) return escapeHtml(raw);

  let out = "";
  let start = 0;

  while (true) {
    const idx = source.indexOf(needle, start);
    if (idx === -1) {
      out += escapeHtml(raw.slice(start));
      break;
    }

    out += escapeHtml(raw.slice(start, idx));
    out += `<span class="search-match">${escapeHtml(raw.slice(idx, idx + needle.length))}</span>`;
    start = idx + needle.length;
  }

  return out;
}

function collectSearchResults(node){
  if (!searchQuery) return;   // ✅ FIX

  if (nodeMatchesSearch(node)) {
    searchResults.push(node.id);
  }
  node.children.forEach(collectSearchResults);
}

function toggleFocus(id){
  if (focusedNodeId === id) {
    focusedNodeId = null;   // unfocus
  } else {
    focusedNodeId = id;     // focus
  }
  render();
}


function isInFocusedPath(node, focusId) {
  if (!focusId) return true;
  if (node.id === focusId) return true;
  return node.children.some(c => isInFocusedPath(c, focusId));
}




/* ================= INDEXED DB ================= */
const DB_NAME="mindmapDB", STORE="files";

function openDB(){
  return new Promise(res=>{
    const r=indexedDB.open(DB_NAME,1);
    r.onupgradeneeded=e=>{
      e.target.result.createObjectStore(STORE,{keyPath:"key"});
    };
    r.onsuccess=()=>res(r.result);
  });
}

async function saveMap(id,name,data){
  const db=await openDB();
  db.transaction(STORE,"readwrite")
    .objectStore(STORE)
    .put({key:`mindmaps/${id}.json`,id,name,json:data});
}

async function loadMap(id){
  const db=await openDB();
  return new Promise(res=>{
    db.transaction(STORE)
      .objectStore(STORE)
      .get(`mindmaps/${id}.json`)
      .onsuccess=e=>res(e.target.result?.json);
  });
}

async function listMaps(){
  const db=await openDB();
  return new Promise(res=>{
    const out=[];
    db.transaction(STORE)
      .objectStore(STORE)
      .openCursor().onsuccess=e=>{
        const c=e.target.result;
        if(!c) return res(out);
        out.push({id:c.value.id,name:c.value.name});
        c.continue();
      };
  });
}

async function deleteMapDB(id){
  const db=await openDB();
  db.transaction(STORE,"readwrite")
    .objectStore(STORE)
    .delete(`mindmaps/${id}.json`);
}

/* ================= STATE ================= */
let currentMap=null, activeId=null;
let undoStack=[], redoStack=[];

/* ================= INIT ================= */
(async()=>{
  await document.fonts.ready;
  const maps=await listMaps();
  if(!maps.length){
    activeId=uid();
currentMap={
  id: activeId,
  text: "Untitled Map",
  collapsed: false,
  important: false,
  note: "",
  youtube: "",   // ✅ ADD
  children: []
};

    await saveMap(activeId,currentMap.text,currentMap);
  } else {
    activeId=maps[0].id;
    currentMap=await loadMap(activeId);
  }
  refreshSelector();
  render();
})();

/* ================= MAP MGMT ================= */
async function refreshSelector(){
  mapSelector.innerHTML="";
  const maps=await listMaps();
  maps.forEach(m=>{
    const o=document.createElement("option");
    o.value=m.id; o.textContent=m.name;
    if(m.id===activeId) o.selected=true;
    mapSelector.appendChild(o);
  });
}

let allCollapsed = false;

/* Collapse / Expand ALL nodes */
function toggleAllNodes() {
  pushHistory();

  allCollapsed = !allCollapsed;
  toggleRecursive(currentMap, allCollapsed);

  render();
}


/* Recursively apply collapsed state */
function toggleRecursive(node, collapse) {
  if (node !== currentMap) {
    node.collapsed = collapse;
  }
  node.children.forEach(c => toggleRecursive(c, collapse));
}




mapSelector.onchange = async e => {
  activeId = e.target.value;
  currentMap = await loadMap(activeId);
  undoStack = [];
  redoStack = [];
  allCollapsed = false; // ✅ reset icon state
  resetQuizState();
  render();
};


async function createMap(){
  const n=prompt("Map name"); if(!n) return;
  activeId=uid();
  currentMap={id:activeId,text:n,collapsed:false,children:[]};
  undoStack=[]; redoStack=[];
  resetQuizState();
  await saveMap(activeId,n,currentMap);
  refreshSelector(); render();
}

async function renameMap(){
  const n=prompt("Rename",currentMap.text); if(!n) return;
  currentMap.text=n;
  await saveMap(activeId,n,currentMap);
  refreshSelector(); render();
}

async function deleteMap(){
  if(!confirm("Delete map?")) return;
  await deleteMapDB(activeId);
  const maps=await listMaps();
  if(!maps.length) location.reload();
  activeId=maps[0].id;
  currentMap=await loadMap(activeId);
  resetQuizState();
  refreshSelector(); render();
}

/* ================= UNDO / REDO ================= */
function pushHistory(){ undoStack.push(clone(currentMap)); redoStack=[]; }
function undo(){ if(!undoStack.length) return;
  redoStack.push(clone(currentMap));
  currentMap=undoStack.pop(); render();
}
function redo(){ if(!redoStack.length) return;
  undoStack.push(clone(currentMap));
  currentMap=redoStack.pop(); render();
}

/* ================= TREE ================= */
function find(n,id){
  if(n.id===id) return n;
  for(const c of n.children){ const f=find(c,id); if(f) return f; }
}
function removeNode(p,id){
  p.children=p.children.filter(c=>c.id!==id);
  p.children.forEach(c=>removeNode(c,id));
}


/* Find parent of a node */
function findParent(root, childId, parent = null) {
  if (root.id === childId) return parent;
  for (const c of root.children) {
    const found = findParent(c, childId, root);
    if (found) return found;
  }
  return null;
}

/* Prevent circular nesting */
function isDescendant(node, targetId) {
  if (node.id === targetId) return true;
  return node.children.some(c => isDescendant(c, targetId));
}

function toggleImportant(id){
  pushHistory();
  const node = find(activeRenderTree, id);
  node.important = !node.important;
  render();
}



function addChild(id){
  pushHistory();
  find(currentMap,id).children.push({
  id: uid(),
  text: "New Node",
  collapsed: false,
  important: false,
  note: "",
  youtube: "",
  examHistory: [],   // ✅ NEW
  children: []
});
  render();
}

/* ================= PYQ FEATURE ================= */

// 🔐 ADMIN EDIT
function editExamHistory(id) {
  if (!isAdmin) return;

  const node = find(activeRenderTree, id);

const input = prompt(
"Enter PYQ (e.g., SSC-2022, UPSC-2021).\nLeave empty to remove.",
(node.examHistory || [])
  .map(e => `${e.exam}-${e.year}`)
  .join(", ")
);

  if (input === null) return; // cancel

  pushHistory();

  // ✅ CLEAN PARSE
  const parsed = input.split(",").map(x => {
    const [exam, year] = x.trim().split("-");
    return {
      exam: exam?.trim() || "",
      year: year?.trim() || ""
    };
  }).filter(e => e.exam);  // 🔥 REMOVE EMPTY

  // ✅ FINAL DECISION
  node.examHistory = parsed.length ? parsed : [];

  // ✅ REMOVE OPEN POPUP
  document.querySelectorAll(".exam-popup").forEach(p => p.remove());

  render();
}


// 👁 USER VIEW
function viewExamHistory(id){
  const node = find(activeRenderTree, id);
  const nodeEl = document.querySelector(`.node[data-id="${id}"]`);
  if (!nodeEl || !node.examHistory?.length) return;

  // ❌ remove old popups
  document.querySelectorAll(".exam-popup").forEach(p => p.remove());

  const list = node.examHistory
    .map(e => `• ${e.exam}${e.year ? " " + e.year : ""}`)
    .join("<br>");

  const popup = document.createElement("div");
  popup.className = "exam-popup";

  popup.innerHTML = `
    <div class="exam-popup-header">
      <span>📚 PYQ</span>
      <button onclick="this.closest('.exam-popup').remove()">✖</button>
    </div>
    <div class="exam-popup-body">${list}</div>
  `;

  // ✅ IMPORTANT: append inside canvas
  const canvasEl = document.getElementById("canvas");
  canvasEl.appendChild(popup);

  // ✅ POSITION FIX (KEY PART)
  const rect = nodeEl.getBoundingClientRect();
  const canvasRect = canvasEl.getBoundingClientRect();

  let left = rect.right - canvasRect.left;
  let top = rect.top - canvasRect.top;

  // adjust with scroll
  left += canvasEl.scrollLeft;
  top += canvasEl.scrollTop;

  // ✅ keep popup near node (not far right)
  const POPUP_WIDTH = 240;

  if (left + POPUP_WIDTH > canvasEl.scrollWidth) {
    left = rect.left - canvasRect.left - POPUP_WIDTH;
  }

  popup.style.left = left + "px";
  popup.style.top = top + "px";
}

function editNote(id){
  const node = find(activeRenderTree, id);
  const nodeEl = document.querySelector(`.node[data-id="${id}"]`);
  if (!nodeEl) return;

  closeNoteEditors();

  const editor = document.createElement("div");
  editor.className = "note-editor";
  editor.dataset.id = id;

  editor.innerHTML = `
    <div class="note-editor-header"><span>${node.text}</span></div>
    <textarea class="note-editor-textarea">${node.note || ""}</textarea>
    <div class="note-editor-actions">
      <button class="cancel">Cancel</button>
      <button class="save">Save</button>
    </div>
  `;

  canvas.appendChild(editor);

  // ✅ NEW POSITION (THIS IS THE FIX)
  let left = node._x + (node._realW || 200) + 12;
  let top = node._y - 20;

  if (left + 420 > canvas.scrollWidth) {
    left = node._x - 430;
  }

  editor.style.left = left + "px";
  editor.style.top = top + "px";

  const textarea = editor.querySelector("textarea");
  textarea.focus();

  editor.querySelector(".cancel").onclick = () => editor.remove();

  editor.querySelector(".save").onclick = () => {
    pushHistory();
    node.note = textarea.value.trim();
    editor.remove();
    render();
  };
}

function closeNoteEditors(){
  document.querySelectorAll(".note-editor").forEach(e => e.remove());
}


function editYoutube(id){
  const node = find(activeRenderTree, id);
  const nodeEl = document.querySelector(`.node[data-id="${id}"]`);
  if (!nodeEl) return;

  closeYoutubeEditors(); // only one open

  const rect = nodeEl.getBoundingClientRect();

  const editor = document.createElement("div");
  editor.className = "youtube-editor";
  editor.dataset.id = id;

  editor.innerHTML = `
    <div class="youtube-editor-header">YouTube Link</div>

    <input type="text"
      class="youtube-input"
      placeholder="Paste YouTube link..."
      value="${node.youtube || ""}"
    />

    <div class="youtube-editor-actions">
      <button class="open">▶ Open</button>
      <button class="remove">Remove</button>
      <button class="cancel">Cancel</button>
      <button class="save">Save</button>
    </div>
  `;

  document.body.appendChild(editor);

  /* 📍 POSITION */
  let left = rect.right + 12;
  let top = rect.top;

  if (left + 320 > window.innerWidth) {
    left = rect.left - 332;
  }

  if (top + 180 > window.innerHeight) {
    top = window.innerHeight - 200;
  }

  editor.style.left = left + "px";
  editor.style.top = top + "px";

  const input = editor.querySelector(".youtube-input");
  input.focus();

  /* BUTTON ACTIONS */

  editor.querySelector(".open").onclick = () => {
    if (input.value.trim()) {
      window.open(input.value.trim(), "_blank");
    }
  };

  editor.querySelector(".remove").onclick = () => {
    if (confirm("Remove YouTube link?")) {
      pushHistory();
      node.youtube = "";
      editor.remove();
      render();
    }
  };

  editor.querySelector(".cancel").onclick = () => editor.remove();

  editor.querySelector(".save").onclick = () => {
    pushHistory();
    node.youtube = input.value.trim();
    editor.remove();
    render();
  };

}

function closeYoutubeEditors(){
  document.querySelectorAll(".youtube-editor").forEach(e => e.remove());
}


function toggleNode(id){
  pushHistory();
  find(currentMap, id).collapsed ^= true;
  render().then(() => {
    focusNode(id);
  });
}

function toggleQuizMode() {
  quizMode = !quizMode;
  quizRevealed = quizMode ? new Set([currentMap.id]) : new Set();
  render();
}

function revealQuizNode(id) {
  if (!quizMode || quizRevealed.has(id)) return;

  quizRevealed.add(id);
  render().then(() => {
    focusNode(id);
  });
}

function revealAllQuizAnswers() {
  if (!quizMode) return;

  (function reveal(node) {
    quizRevealed.add(node.id);
    node.children.forEach(reveal);
  })(currentMap);

  render();
}

function expandBranch(node) {
  node.collapsed = false;
  node.children.forEach(expandBranch);
}

function expandAllChildren(id) {
  const node = find(activeRenderTree, id);
  if (!node || !node.children.length) return;

  pushHistory();
  expandBranch(node);
  render().then(() => {
    focusNode(id);
  });
}

function focusNode(id){
  const el = document.querySelector(`.node[data-id="${id}"]`);
  if(!el) return;

  el.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center"
  });
}

function deleteNode(id){
  if(id===currentMap.id) return alert("Root cannot be deleted");
  if(!confirm("Delete node?")) return;
  pushHistory(); removeNode(currentMap,id); render();
}

/* ================= LAYOUT ================= */
const NODE_H=36, GAP_X=220, GAP_Y=24;

function computeH(n){
  const h = n._realH || 44; // fallback
  if(n.collapsed || !n.children.length){
    n._h = h;
    return n._h;
  }
  let total = 0;
  n.children.forEach(c => total += computeH(c) + GAP_Y);
  n._h = Math.max(total - GAP_Y, h);
  return n._h;
}


const MIN_GAP_X = 120;     // minimum horizontal gap
const GAP_FACTOR = 0.6;   // gap grows with node width

function layout(n, x, y) {
  n._x = x;
  n._y = y;

  if (n.collapsed) return;

  let cy = y - n._h / 2;

  const parentWidth = n._realW || 120;
  const dynamicGapX = Math.max(
    MIN_GAP_X,
    parentWidth * GAP_FACTOR
  );

  n.children.forEach(c => {
    const childX = x + parentWidth + dynamicGapX;
    layout(c, childX, cy + c._h / 2);
    cy += c._h + GAP_Y;
  });
}


function resize(n){
  let mx=0,my=0;
  (function w(n){
    mx=Math.max(mx,n._x+320);
    my=Math.max(my,n._y+160);
    n.children.forEach(w);
  })(n);
  canvas.style.width=mx+"px";
  canvas.style.height=my+"px";
  svg.setAttribute("width",mx);
  svg.setAttribute("height",my);
}

/* ================= RENDER ================= */
function renderTree() {
  document.querySelectorAll(".node, .connector-toggle").forEach(el => el.remove());
  svg.innerHTML = "";

  activeRenderTree =
    pyqFilters.size === 0
      ? currentMap
      : filterTree(currentMap);

  if (!activeRenderTree) return;

  computeH(activeRenderTree);
  layout(activeRenderTree, 80, activeRenderTree._h / 2 + 40);
  draw(activeRenderTree, 0);
  measureNodes();
}

async function render(){
  renderTree();
  renderDynamicFilters();

  positionToggles();
  resize(currentMap);

  await saveMap(activeId,currentMap.text,currentMap);

  const btn = document.getElementById("toggleAllBtn");
  if (btn) {
    btn.classList.toggle("expand", allCollapsed);
  }

  const quizBtn = document.getElementById("quizModeBtn");
  if (quizBtn) {
    quizBtn.textContent = quizMode ? "Exit Quiz" : "Quiz Mode";
    quizBtn.classList.toggle("active", quizMode);
  }

  const revealBtn = document.getElementById("revealQuizBtn");
  if (revealBtn) {
    revealBtn.hidden = !quizMode;
  }

  updateSearchIndicator(); // ✅ add here
}

function renderExamBadge(node) {
if (!node.examHistory?.some(e => e.exam)) return "";
  const exams = node.examHistory;

  const format = (e) => {
    return e.year ? `${e.exam} ${e.year}` : e.exam;
  };

  // ✅ ALWAYS clickable for everyone
  const clickHandler = `onclick="event.stopPropagation(); viewExamHistory('${node.id}')"`;


  // ✅ 1 or 2 → comma
  if (exams.length <= 2) {
    const text = exams.map(format).join(", ");

    return `
      <div class="exam-badge-group">
        <div class="exam-badge" ${clickHandler}>
          ${text}
        </div>
      </div>
    `;
  }

  // ✅ >2 → count
  return `
    <div class="exam-badge-group">
      <div class="exam-badge count-badge" ${clickHandler}>
        ${exams.length} PYQ
      </div>
    </div>
  `;
}

function draw(n, depth){
const el = document.createElement("div");
const hiddenInQuiz = isNodeHiddenInQuiz(n);
const nodeLabel = hiddenInQuiz ? "?" : n.text;


el.className =
  "node" +
  (n.important ? " important" : "") +
  (n.note ? " has-note" : "") +
  (hiddenInQuiz ? " quiz-hidden" : "") +
  (nodeMatchesSearch(n) ? " search-hit" : "") +
  (searchResults[searchIndex] === n.id ? " active-hit" : "");

// 🔥 ADD AFTER className


if (focusedNodeId && !isInFocusedPath(n, focusedNodeId)) {
  el.classList.add("faded");
} else {
  el.classList.remove("faded");
}

  el.style.left = n._x + "px";
  el.style.top = (n._y - NODE_H / 2) + "px";
  el.style.background = nodeColor(depth);
  el.dataset.id = n.id;

  /* ================= DRAG ================= */
  el.draggable = n.id !== currentMap.id; // root locked

  el.ondragstart = e => {
    dragNodeId = n.id;
    el.classList.add("dragging");
    e.dataTransfer.setData("text/plain", n.id);
  };

  el.ondragend = () => {
    dragNodeId = null;
    el.classList.remove("dragging");
  };

el.ondragover = e => {
  e.preventDefault();
  const rect = el.getBoundingClientRect();
  const y = e.clientY - rect.top;

  el.classList.remove("drop-before", "drop-after", "drop-child");

  if (y < rect.height * 0.25) {
    el.classList.add("drop-before");
  } else if (y > rect.height * 0.75) {
    el.classList.add("drop-after");
  } else {
    el.classList.add("drop-child");
  }
};

  el.ondragleave = () => {
    el.classList.remove("drop-before", "drop-after");
  };

  el.ondrop = e => {
    e.preventDefault();
    el.classList.remove("drop-before", "drop-after");
    handleDrop(n.id, e.clientY);
  };
  /* ======================================== */

  const h = document.createElement("div");
  h.className = "node-header";

h.innerHTML = `
  <div class="node-body">
    <div class="node-body">
  <span class="node-text">${nodeLabel}</span>
  ${renderExamBadge(n)}
</div>
  </div>
  <button class="menu-btn${quizMode ? " quiz-disabled" : ""}">⋮</button>
`;

  const m = document.createElement("div");
  m.className = "menu";

  m.innerHTML = `
  <button onclick="addChild('${n.id}')">➕ Add</button>
  <button onclick="editNode('${n.id}')">✏️ Edit</button>
  <button onclick="expandAllChildren('${n.id}')">Expand branch</button>
  <button onclick="toggleImportant('${n.id}')">${n.important ? "Remove Important" : "Mark Important"}</button>
  <button onclick="toggleFocus('${n.id}')">${focusedNodeId === n.id ? "Exit focus" : "Focus"}</button>
  <button onclick="editNote('${n.id}')">Add note</button>
${isAdmin ? `
<button onclick="editExamHistory('${n.id}')">
📚 Add PYQ</button>
` : ""}
${isAdmin 
  ? `
    <button onclick="editYoutube('${n.id}')">
      ${n.youtube ? "🎬 Edit Explanation" : "➕ Add Explanation"}
    </button>
  `
  : (n.youtube 
      ? `
        <button onclick="openYoutube('${n.id}')">
          🎬 View Explanation
        </button>
      `
      : ""
    )
}
  <button onclick="deleteNode('${n.id}')">🗑 Delete</button>
`;

  const menuBtn = h.querySelector("button");
  if (quizMode) {
    menuBtn.disabled = true;
    m.remove();
  } else {
    menuBtn.onclick = e => {
      e.stopPropagation();
      closeMenus();
      m.style.display = "block";
    };
  }

  el.onclick = e => {
    e.stopPropagation();
    if (hiddenInQuiz) {
      revealQuizNode(n.id);
      return;
    }
    closeMenus();
  };

  el.append(h, m);

if (n.note && !hiddenInQuiz) {
  const noteIcon = document.createElement("div");
  noteIcon.className = "note-icon";
  noteIcon.textContent = "📝";

  noteIcon.onclick = (e) => {
    e.stopPropagation();
    openNoteViewer(n.id);
  };

  el.appendChild(noteIcon);
}

function openNoteViewer(id){
  const node = find(activeRenderTree, id);
  const nodeEl = document.querySelector(`.node[data-id="${id}"]`);
  if (!nodeEl) return;

  closeNoteViewers();

  const canvasRect = canvas.getBoundingClientRect();
  const rect = nodeEl.getBoundingClientRect();

  const viewer = document.createElement("div");
  viewer.className = "note-viewer";

  const noteText = node.note || "No note";
  const highlightedNote = highlightSearchMatch(noteText, searchQuery);
  const safeTitle = escapeHtml(node.text || "");

  viewer.innerHTML = `
    <div class="note-viewer-header">
      <span>${safeTitle}</span>
      <button class="close">✖</button>
    </div>
    <div class="note-viewer-body">${highlightedNote}</div>
  `;

  canvas.appendChild(viewer);

  /* ✅ CORRECT POSITION */
// ✅ include scroll offset (IMPORTANT)
let left = rect.right - canvasRect.left + canvas.scrollLeft + 12;
let top = rect.top - canvasRect.top + canvas.scrollTop;

  // smart flip (optional)
  if (left + 320 > canvas.scrollWidth){
    left = rect.left - canvasRect.left - 332;
  }

  viewer.style.left = left + "px";
  viewer.style.top = top + "px";

  viewer.querySelector(".close").onclick = () => {
    viewer.remove();
  };
}


function closeNoteViewers(){
  document.querySelectorAll(".note-viewer").forEach(e => e.remove());
}


  canvas.appendChild(el);

  /* ===== Toggle ===== */
  if (n.children.length && n._realW) {
    const toggle = document.createElement("div");
    toggle.className = "connector-toggle";
    toggle.textContent = n.collapsed ? ">" : "<";

    toggle.style.left = (n._x + n._realW + 8) + "px";
    toggle.dataset.id = n.id;
    toggle.style.top = (n._y - 11) + "px";


    toggle.onclick = e => {
      e.stopPropagation();
      toggleNode(n.id);
    };

    canvas.appendChild(toggle);
  }

  if (n.collapsed) return;

  n.children.forEach(c => {
    drawLine(
      n._x + n._realW,
      n._y,
      c._x,
      c._y
    );
    draw(c, depth + 1);
  });
}

function positionToggles() {
  document.querySelectorAll(".connector-toggle").forEach(toggle => {
    const id = toggle.dataset.id;
    const node = find(activeRenderTree, id); // 🔥 FIX

    if (!node) return;

    const GAP = 16;

    toggle.style.left =
      (node._x + (node._realW || 120) + GAP) + "px";

    toggle.style.top =
      (node._y - 11) + "px";
  });
}

function handleDrop(targetId, mouseY) {
  if (!dragNodeId || dragNodeId === targetId) return;

  const dragged = find(currentMap, dragNodeId);
  const target = find(currentMap, targetId);
  if (!dragged || !target) return;

  // ❌ Prevent circular nesting
  if (isDescendant(dragged, targetId)) {
    alert("Cannot move a node inside its own child.");
    return;
  }

  pushHistory();

  const sourceParent = findParent(currentMap, dragNodeId);
  const targetParent = findParent(currentMap, targetId);

  const sourceSiblings = sourceParent ? sourceParent.children : currentMap.children;
  const targetSiblings = targetParent ? targetParent.children : currentMap.children;

  // Remove dragged from old location
  const fromIndex = sourceSiblings.findIndex(c => c.id === dragNodeId);
  if (fromIndex === -1) return;
  sourceSiblings.splice(fromIndex, 1);

  const targetEl = document.querySelector(`[data-id="${targetId}"]`);
  const rect = targetEl.getBoundingClientRect();

  const relativeY = mouseY - rect.top;
  const height = rect.height;

  const isTop = relativeY < height * 0.25;
  const isBottom = relativeY > height * 0.75;
  const isMiddle = !isTop && !isBottom;

  // 🎯 DROP AS CHILD (MIDDLE ZONE)
  if (isMiddle) {
    target.children.push(dragged);
    target.collapsed = false; // auto-expand
    render();
    return;
  }

  // 🔁 REORDER (TOP / BOTTOM)
  const targetIndex = targetSiblings.findIndex(c => c.id === targetId);
  if (targetIndex === -1) return;

  const insertIndex = isTop ? targetIndex : targetIndex + 1;
  targetSiblings.splice(insertIndex, 0, dragged);

  render();
}

/* ================= SVG ================= */
function drawLine(x1,y1,x2,y2){
  const p=document.createElementNS("http://www.w3.org/2000/svg","path");
  p.setAttribute("d",`M${x1} ${y1} C ${x1+60} ${y1}, ${x2-60} ${y2}, ${x2} ${y2}`);
  p.setAttribute("stroke","#3b7d5a");
  p.setAttribute("fill","none");
  svg.appendChild(p);
}


function openYoutube(id){
  const node = find(activeRenderTree, id);

  if (node.youtube) {
    window.open(node.youtube, "_blank");
  }
}

/* ================= EXPORT ================= */
function exportJSON(){
  const b=new Blob([JSON.stringify(currentMap,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(b);
  a.download=`${safeName(currentMap.text)}.json`;
  a.click();
}
async function importJSON(e){
  const f = e.target.files[0];
  if(!f) return;

  const r = new FileReader();
  r.onload = async () => {
    const data = JSON.parse(r.result);

    if(!data.text){
      alert("Invalid mind map file.");
      return;
    }

    const rootText = data.text.trim().toLowerCase();
    const maps = await listMaps();

    const exists = maps.some(m =>
      m.name && m.name.trim().toLowerCase() === rootText
    );

    if(exists){
      alert("Mind map already exists.");
      e.target.value = "";
      return;
    }

    // ✅ safe to import
    activeId = uid();
    currentMap = { ...data, id: activeId };

    await saveMap(
      activeId,
      currentMap.text || "Imported Map",
      currentMap
    );

    refreshSelector();
    render();
    e.target.value = "";
  };

  r.readAsText(f);
}

function exportPNG() {
  const SCALE = 2;

  const fullHeight = Math.max(
    canvas.scrollHeight,
    canvas.offsetHeight
  );

  const effectiveHeight = fullHeight * SCALE;

  // 🚫 Browser GPU limit
  if (effectiveHeight > 30000) {
    alert(
      "This mind map is too large for a single PNG.\n\n" +
      "Please use Export PDF instead."
    );
    return;
  }

  html2canvas(canvas, {
    backgroundColor: "#ffffff",
    scale: SCALE,
    scrollX: 0,
    scrollY: 0
  }).then(c => {
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `${safeName(currentMap.text)}.png`;
    a.click();
  });
}



function exportPDF() {
  html2canvas(canvas, {
    backgroundColor: "#ffffff",
    scale: 1.5,        // keep reasonable
    useCORS: true
  }).then(srcCanvas => {

    const pdf = new jspdf.jsPDF("l", "pt", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 20;
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;

    const scale = printableWidth / srcCanvas.width;
    const tileHeight = printableHeight / scale;
    const tileWidth = srcCanvas.width; // FULL width per tile

    let y = 0;
    let firstPage = true;

    while (y < srcCanvas.height) {

      const tileCanvas = document.createElement("canvas");
      tileCanvas.width = tileWidth;
      tileCanvas.height = Math.min(tileHeight, srcCanvas.height - y);

      const ctx = tileCanvas.getContext("2d");
      ctx.drawImage(
        srcCanvas,
        0, y,
        tileWidth, tileCanvas.height,
        0, 0,
        tileWidth, tileCanvas.height
      );

      const imgData = tileCanvas.toDataURL("image/jpeg", 0.85); // ✅ JPEG = smaller

      if (!firstPage) pdf.addPage();
      firstPage = false;

      pdf.addImage(
        imgData,
        "JPEG",
        margin,
        margin,
        printableWidth,
        tileCanvas.height * scale
      );

      y += tileHeight;
    }

    pdf.save(`${safeName(currentMap.text)}.pdf`);
  });
}

function measureNodes() {
  document.querySelectorAll(".node").forEach(el => {
    const id = el.dataset.id;
    const node = find(activeRenderTree, id);
    if (node) {
      node._realH = el.offsetHeight;
      node._realW = el.offsetWidth;
    }
  });
}


function closeMenus(){
  document.querySelectorAll(".menu").forEach(m=>m.style.display="none");
}
document.body.onclick=closeMenus;



function fitToolbar() {
  const toolbar = document.querySelector('.toolbar');
  const inner = document.querySelector('.toolbar-inner');
  if (!toolbar || !inner) return;

  const available = toolbar.clientWidth;
  const DESIGN_WIDTH = 1400; // must match CSS

  let scale = available / DESIGN_WIDTH;
  scale = Math.min(scale, 1);     // no zoom-in
  scale = Math.max(scale, 0.65);  // readable minimum

  inner.style.transform = `scale(${scale})`;
}


function editNode(id) {
  const nodeEl = document.querySelector(`[data-id="${id}"]`);
  if (!nodeEl) return;

  const span = nodeEl.querySelector(".node-text");
  const oldText = span.textContent;

  pushHistory();

  // Enable inline editing
  span.contentEditable = "true";
  span.focus();

  // Place caret at end
  const range = document.createRange();
  range.selectNodeContents(span);
  range.collapse(false);

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function finish(save) {
    span.contentEditable = "false";
    span.removeEventListener("keydown", onKey);
    span.removeEventListener("blur", onBlur);

    if (save) {
      const n = find(currentMap, id);
      n.text = span.textContent.trim() || oldText;
    } else {
      span.textContent = oldText;
    }

    render();
  }

  function onKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    }

    if (e.key === "Escape") {
      finish(false);
    }
  }

  function onBlur() {
    finish(true);
  }

  span.addEventListener("keydown", onKey);
  span.addEventListener("blur", onBlur);
}

document.querySelector('input[type="search"]')
  .addEventListener("keydown", function(e){

    if (e.key === "Enter") {
      e.preventDefault();

      if (!searchResults.length) return;

      searchIndex = (searchIndex + 1) % searchResults.length;

      const id = searchResults[searchIndex];

     expandPathToNode(currentMap, id);

render().then(() => {
  focusNode(id);
  updateSearchIndicator();
});
    }
});

function updateSearchIndicator() {
  const countEl = document.getElementById("searchCount");

  if (!searchQuery || searchResults.length === 0) {
    countEl.textContent = "0/0";
    return;
  }

  countEl.textContent =
    `${searchIndex >= 0 ? searchIndex + 1 : 0}/${searchResults.length}`;
}

function nextSearch() {
  if (!searchResults.length) return;

  searchIndex = (searchIndex + 1) % searchResults.length;
  jumpToSearch();
}

function prevSearch() {
  if (!searchResults.length) return;

  searchIndex =
    (searchIndex - 1 + searchResults.length) % searchResults.length;

  jumpToSearch();
}

function jumpToSearch() {
  const id = searchResults[searchIndex];

  expandPathToNode(currentMap, id);

  render().then(() => {
    focusNode(id);
    updateSearchIndicator();
  });
}

function clearSearch() {
  searchQuery = "";
  searchResults = [];
  searchIndex = -1;

  document.getElementById("searchInput").value = "";
  document.querySelectorAll(".note-viewer").forEach(e => e.remove());

  render();
  updateSearchIndicator();
}

function expandPathToNode(node, targetId){
  if (node.id === targetId) return true;

  for (const child of node.children) {
    if (expandPathToNode(child, targetId)) {
      node.collapsed = false;
      return true;
    }
  }
  return false;
}


function extractFiltersFromPYQ() {
  const exams = new Set();
  const years = new Set();

  function traverse(node) {
    (node.examHistory || []).forEach(e => {
      if (e.exam) {
        exams.add(e.exam.trim().toUpperCase());
      }
      if (e.year && !isNaN(e.year)) {
        years.add(e.year);
      }
    });
    node.children.forEach(traverse);
  }

  traverse(currentMap);

  return {
    exams: Array.from(exams).sort(),
    years: Array.from(years).sort((a, b) => b - a)
  };
}

function renderDynamicFilters() {
  const box = document.getElementById("pyqFilterBox");
  if (!box) return;

  const { exams, years } = extractFiltersFromPYQ();

  let html = `<div class="filter-title">Filter PYQ</div>`;

  // Exams
  if (exams.length) {
    html += `<div class="filter-group"><b>Exam</b>`;
    exams.forEach(e => {
      const checked = pyqFilters.has(`EXAM:${e}`) ? "checked" : "";
      html += `
        <label>
          <input type="checkbox" value="EXAM:${e}" ${checked}
            onchange="toggleFilter(this.value)">
          ${e}
        </label>
      `;
    });
    html += `</div>`;
  }

  // Years
  if (years.length) {
    html += `<div class="filter-group"><b>Year</b>`;
    years.forEach(y => {
      const checked = pyqFilters.has(`YEAR:${y}`) ? "checked" : "";
      html += `
        <label>
          <input type="checkbox" value="YEAR:${y}" ${checked}
            onchange="toggleFilter(this.value)">
          ${y}
        </label>
      `;
    });
    html += `</div>`;
  }

  box.innerHTML = html;
}

function toggleFilter(value){
  if (pyqFilters.has(value)) {
    pyqFilters.delete(value);
  } else {
    pyqFilters.add(value);
  }

  render();
}


function hasMatchingPYQ(node){
  if (pyqFilters.size === 0) return true;

  return node.examHistory?.some(e => {
    for (let filter of pyqFilters) {
      const [type, value] = filter.split(":");

      if (type === "EXAM" && e.exam?.toUpperCase().includes(value)) {
        return true;
      }

      if (type === "YEAR" && e.year == value) {
        return true;
      }
    }
    return false;
  });
} 


function filterTree(node) {
  // root always stays
  if (node.id === currentMap.id) {
    return {
      ...node,
      children: node.children
        .map(filterTree)
        .filter(Boolean)
    };
  }

  const match = hasMatchingPYQ(node);

  // filter children
  const filteredChildren = node.children
    .map(filterTree)
    .filter(Boolean);

  // ✅ KEEP node if:
  // 1. it matches OR
  // 2. any child matches (important for structure)
  if (match || filteredChildren.length) {
    return {
      ...node,
      children: filteredChildren
    };
  }

  return null; // ❌ remove node
}

function toggleFilterDropdown(e){
  e.stopPropagation();

  const btn = document.getElementById("filterBtn");
  const box = document.getElementById("pyqFilterBox");

  const rect = btn.getBoundingClientRect();

  box.style.left = rect.left + "px";
  box.style.top = (rect.bottom + 6) + "px";

  box.classList.toggle("hidden");
}

document.addEventListener("click", function(e){
  const dropdown = document.querySelector(".filter-dropdown");
  if (!dropdown) return;

  if (!dropdown.contains(e.target)) {
    document.getElementById("pyqFilterBox").classList.add("hidden");
  }
});

/* 🔥 ADD THIS RIGHT AFTER */
document.addEventListener("DOMContentLoaded", function () {
  const box = document.getElementById("pyqFilterBox");
  if (!box) return;

  box.addEventListener("click", function(e){
    e.stopPropagation();   // ✅ prevent closing when clicking inside
  });
});

document.addEventListener("click", function(e){
  const box = document.getElementById("pyqFilterBox");
  const btn = document.getElementById("filterBtn");

  if (!box.contains(e.target) && !btn.contains(e.target)) {
    box.classList.add("hidden");
  }
});
