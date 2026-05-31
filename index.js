
/* ================= CONFIG ================= */
const APP_CONFIG = {
  features: {
    notes: true,
    youtube: true,
    pyq: true,
    quizMode: false,
    focusMode: true,
    importantMarker: true,
    search: true,
    darkMode: true,
    exportImage: false,
    exportPDF: false
  },
  dev: {
    mockAIQuizResponse: false, // Set to true to return mock quiz data
    alwaysPromptApiKey: false, // Set to true to always ask for API key
    inspectMode: true          // Set to false to disable DevTools and right-click
  },
  preImportedMaps: [
    { label: "1. Maths", file: "maths.json" },
    { label: "2. Reasoning", file: "Reasoning.json" },
    { label: "3. English", file: "English.json" },
    { label: "4. Polity", file: "Polity.json" },
    { label: "5. Static Gk", file: "Static_Gk.json" },
    { label: "6. History", file: "History.json" },
    { label: "7. Economy", file: "Economy.json" },
    { label: "8. Battles", file: "Battles.json" },
    { label: "TRE4 Computer Science", file: "TRE4_Computer_Science.json" }
  ],
  preImportedQuizzes: [
    
    { label: "6. History - Indus Valley (2500-1600 BCE)", file: "ivc_quiz.json" },
    { label: "7. Economy - FYP", file: "fyp_quiz.json" },
    { label: "4. Polity - Articles 12-35→ Fundamental Rights", file: "fm_quiz.json" }
  ],
  preImportedTests: [
    {
      label: "SSC CGL 12-09-2025 Shift 1",
      file: "ssc/cgl/ssc_cgl_12-9-2025_shift_1.json"
    },
    {
      label: "SSC CGL 12-09-2025 Shift 2",
      file: "ssc/cgl/ssc_cgl_12-9-2025_shift_2.json"
    },
    {
      label: "SSC CGL 13-09-2025 Shift 1",
      file: "ssc/cgl/ssc_cgl_13-9-2025_shift_1.json"
    }
  ]
};

if (!APP_CONFIG.dev.inspectMode) {
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });
  document.addEventListener("keydown", function (e) {
    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J")) ||
      (e.ctrlKey && e.key === "U")
    ) {
      e.preventDefault();
    }
  });
  setInterval(function () {
    const start = performance.now();
    debugger;
    const end = performance.now();
    if (end - start > 100) {
      alert("DevTools is open!");
      window.location.reload();
    }
  }, 1000);
}

/* ================= UTIL ================= */
let focusedNodeId = null;
let searchQuery = "";

let isAdmin = false;
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
        if (!c.value.key || c.value.key.startsWith("mindmaps/")) {
          out.push({id:c.value.id,name:c.value.name});
        }
        c.continue();
      };
  });
}

async function saveTest(id, name, data){
  const db=await openDB();
  db.transaction(STORE,"readwrite")
    .objectStore(STORE)
    .put({key:`tests/${id}.json`, id, name, json: data});
}

async function loadTest(id){
  const db=await openDB();
  return new Promise(res=>{
    db.transaction(STORE)
      .objectStore(STORE)
      .get(`tests/${id}.json`)
      .onsuccess=e=>res(e.target.result?.json);
  });
}

async function deleteTestDB(id){
  const db=await openDB();
  db.transaction(STORE,"readwrite")
    .objectStore(STORE)
    .delete(`tests/${id}.json`);
}

async function listTests(){
  const db=await openDB();
  return new Promise(res=>{
    const out=[];
    db.transaction(STORE)
      .objectStore(STORE)
      .openCursor().onsuccess=e=>{
        const c=e.target.result;
        if(!c) return res(out);
        if (c.value.key && c.value.key.startsWith("tests/")) {
          out.push({id:c.value.id,name:c.value.name});
        }
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

async function saveQuiz(id, name, data){
  const db=await openDB();
  db.transaction(STORE,"readwrite")
    .objectStore(STORE)
    .put({key:`quizzes/${id}.json`, id, name, json: data});
}

async function loadQuiz(id){
  const db=await openDB();
  return new Promise(res=>{
    db.transaction(STORE)
      .objectStore(STORE)
      .get(`quizzes/${id}.json`)
      .onsuccess=e=>res(e.target.result?.json);
  });
}

async function deleteQuizDB(id){
  const db=await openDB();
  db.transaction(STORE,"readwrite")
    .objectStore(STORE)
    .delete(`quizzes/${id}.json`);
}

async function listQuizzes(){
  const db=await openDB();
  return new Promise(res=>{
    const out=[];
    db.transaction(STORE)
      .objectStore(STORE)
      .openCursor().onsuccess=e=>{
        const c=e.target.result;
        if(!c) return res(out);
        if (c.value.key && c.value.key.startsWith("quizzes/")) {
          out.push({id:c.value.id,name:c.value.name});
        }
        c.continue();
      };
  });
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

  if (APP_CONFIG.features.darkMode) {
    const toolbarInner = document.querySelector('.toolbar-inner');
    if (toolbarInner && !document.getElementById('darkModeBtn')) {
      const darkModeBtn = document.createElement('button');
      darkModeBtn.id = 'darkModeBtn';
      darkModeBtn.textContent = '🌙 Dark Mode';
      darkModeBtn.onclick = toggleDarkMode;
      toolbarInner.prepend(darkModeBtn);
    }

    // Restore preference
    if (localStorage.getItem('darkMode') === 'true') {
      document.body.classList.add('dark-mode');
      const btn = document.getElementById('darkModeBtn');
      if (btn) btn.textContent = '☀️ Light Mode';
    }
  }

  refreshSelector();
  refreshQuizSelector();
  refreshTestSelector();
  render();
  showBackupWarningPopup();
})();

function showBackupWarningPopup() {
  const existingOverlay = document.getElementById('backupWarningOverlay');
  const existingModal = document.getElementById('backupWarningModal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();

  const overlay = document.createElement('div');
  overlay.id = 'backupWarningOverlay';
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99998;";
  document.body.appendChild(overlay);

  const modal = document.createElement('div');
  modal.id = 'backupWarningModal';
  modal.className = "note-editor";
  modal.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:90%;max-width:400px;padding:24px;z-index:99999;box-sizing:border-box;cursor:default;text-align:center;";

  modal.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div style="font-size: 40px; margin-bottom: 10px;">⚠️</div>
      <h3 style="margin: 0 0 10px 0; font-size: 20px;">Important Notice</h3>
      <p style="margin: 0; font-size: 15px; line-height: 1.5; color: inherit; opacity: 0.9;">
        Your mindmaps and quizzes are stored locally on your device. 
        <br><br>
        <strong>Before clearing your browser cache, make sure to export and back up your mindmaps to avoid losing your data.</strong>
      </p>
    </div>
    <div class="note-editor-actions" style="justify-content: center; margin-top: 0;">
      <button id="closeBackupWarningBtn" class="save" style="width: 100%; padding: 12px; font-weight: bold;">I Understand</button>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.remove();
    overlay.remove();
  };

  document.getElementById('closeBackupWarningBtn').onclick = closeModal;
}

/* ================= MAP MGMT ================= */
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDark);
  const btn = document.getElementById('darkModeBtn');
  if (btn) {
    btn.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  }
}

async function refreshSelector(){
  mapSelector.innerHTML="";
  const maps=await listMaps();
  maps.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const savedGroup = document.createElement("optgroup");
  savedGroup.label = "Saved Mind Maps";
  maps.forEach(m=>{
    const o=document.createElement("option");
    o.value=m.id; o.textContent=m.name;
    if(m.id===activeId) o.selected=true;
    savedGroup.appendChild(o);
  });
  mapSelector.appendChild(savedGroup);

  const preImportedGroup = document.createElement("optgroup");
  preImportedGroup.label = "Pre Imported";
  APP_CONFIG.preImportedMaps.forEach(map=>{
    const option = document.createElement("option");
    option.value = `preimport:${map.file}`;
    option.textContent = map.label;
    preImportedGroup.appendChild(option);
  });
  mapSelector.appendChild(preImportedGroup);
}

async function refreshQuizSelector() {
  let quizSelector = document.getElementById('quizSelector');
  if (!quizSelector) {
    quizSelector = document.createElement('select');
    quizSelector.id = 'quizSelector';
    
    const toolbarInner = document.querySelector('.toolbar-inner');
    if (toolbarInner) {
      toolbarInner.appendChild(quizSelector);
    }
  }

  quizSelector.onchange = async e => {
    if (!e.target.value) return;

    if (e.target.value.startsWith("preimport:")) {
      await importPreImportedQuiz(e.target.value.replace("preimport:", ""));
      e.target.value = "";
      return;
    }

    const quizId = e.target.value;
    const quizData = await loadQuiz(quizId);
    if (quizData && quizData.questions) {
      showAIQuizModal(JSON.parse(JSON.stringify(quizData.questions)), true, quizId, quizData.timerSeconds !== undefined ? quizData.timerSeconds : 600, null, undefined, (quizData.quizName || quizData.mapName || quizData.name));
    }
    e.target.value = ""; 
  };
  
  const defaultOpt = document.createElement('option');
  defaultOpt.value = "";
  defaultOpt.textContent = "🧠 Start Saved Quiz...";
  quizSelector.innerHTML = "";
  quizSelector.appendChild(defaultOpt);
  
  const quizzes = await listQuizzes();
  quizzes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  
  if (quizzes.length > 0) {
    const savedGroup = document.createElement("optgroup");
    savedGroup.label = "Saved Quizzes";
    quizzes.forEach(q => {
      const o = document.createElement("option");
      o.value = q.id;
      o.textContent = q.name;
      savedGroup.appendChild(o);
    });
    quizSelector.appendChild(savedGroup);
  }

  if (APP_CONFIG.preImportedQuizzes && APP_CONFIG.preImportedQuizzes.length > 0) {
    const preImportedGroup = document.createElement("optgroup");
    preImportedGroup.label = "Pre Imported";
    APP_CONFIG.preImportedQuizzes.forEach(quiz => {
      const option = document.createElement("option");
      option.value = `preimport:${quiz.file}`;
      option.textContent = quiz.label;
      preImportedGroup.appendChild(option);
    });
    quizSelector.appendChild(preImportedGroup);
  }
  
  quizSelector.style.display = (quizzes.length > 0 || (APP_CONFIG.preImportedQuizzes && APP_CONFIG.preImportedQuizzes.length > 0)) ? "inline-block" : "none";
}

async function refreshTestSelector() {
  let selector = document.getElementById("testSelector");
  if (!selector) {
    selector = document.createElement('select');
    selector.id = 'testSelector';
    
    const toolbarInner = document.querySelector('.toolbar-inner');
    if (toolbarInner) {
      toolbarInner.appendChild(selector);
    }
  }

  selector.onchange = async e => {
    if (!e.target.value) return;

    if (e.target.value.startsWith("preimport:")) {
      await startSelectedTest(e.target.value.replace("preimport:", ""));
      e.target.value = "";
      return;
    }

    const testId = e.target.value;
    const testData = await loadTest(testId);
    if (testData) {
      try {
        const examJson = normalizeExamTestJSON(testData, testId);
        validateExamTestJSON(examJson);
        activeExamTest = examJson;
        activeExamTest.savedTestId = testId;
        openExamTestScreen(examJson);
      } catch(err) {
          alert(err.message || "Invalid test data");
      }
    }
    e.target.value = ""; 
  };

  const defaultOption = document.createElement('option');
  defaultOption.value = "";
  defaultOption.textContent = "📝 Start Test...";
  selector.innerHTML = "";
  selector.appendChild(defaultOption);

  const savedTests = await listTests();
  savedTests.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  if (savedTests.length > 0) {
    const savedGroup = document.createElement("optgroup");
    savedGroup.label = "Saved Tests";
    savedTests.forEach(t => {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.name;
      savedGroup.appendChild(o);
    });
    selector.appendChild(savedGroup);
  }

  const preImportedTests = APP_CONFIG.preImportedTests || [];
  if (preImportedTests.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "Pre Imported Tests";
    preImportedTests.forEach(test => {
      const option = document.createElement("option");
      option.value = `preimport:${test.file}`;
      option.textContent = test.label;
      group.appendChild(option);
    });
    selector.appendChild(group);
  }

  selector.style.display = (savedTests.length > 0 || preImportedTests.length > 0) ? "inline-block" : "none";

  let genAiTestBtn = document.getElementById("genAiTestBtn");
  if (!genAiTestBtn) {
    genAiTestBtn = document.createElement("button");
    genAiTestBtn.id = "genAiTestBtn";
    genAiTestBtn.textContent = "🤖 Generate AI Test";
    genAiTestBtn.onclick = openTestSettingsModal;
    
    if (selector.parentNode) {
      selector.parentNode.insertBefore(genAiTestBtn, selector.nextSibling);
    }
  }
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
  if (e.target.value.startsWith("preimport:")) {
    await importPreImportedMap(e.target.value.replace("preimport:", ""));
    return;
  }

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

function showFlashMessage(msg) {
  let flashMsg = document.getElementById('flashMsg');
  if (!flashMsg) {
    flashMsg = document.createElement('div');
    flashMsg.id = 'flashMsg';
    flashMsg.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:8px 16px;border-radius:20px;font-size:14px;z-index:99999;opacity:0;transition:opacity 0.2s ease;pointer-events:none;";
    document.body.appendChild(flashMsg);
  }
  flashMsg.textContent = msg;
  flashMsg.style.opacity = "1";
  
  clearTimeout(flashMsg.hideTimeout);
  flashMsg.hideTimeout = setTimeout(() => {
    flashMsg.style.opacity = "0";
  }, 1500);
}

function flashButton(id) {
  const btn = document.getElementById(id);
  if (!btn) return;
  
  btn.style.transition = "all 0.1s ease-in-out";
  btn.style.transform = "scale(0.85)"; // Shrink slightly to simulate a click
  btn.style.opacity = "0.7";
  
  setTimeout(() => {
    btn.style.transform = "scale(1)";
    btn.style.opacity = "1";
  }, 150); // Restore after 150ms
}

function undo(){ if(!undoStack.length) return;
  redoStack.push(clone(currentMap));
  currentMap=undoStack.pop(); render();
  flashButton('undoBtn');
  showFlashMessage("↩️ Undo successful");
}
function redo(){ if(!redoStack.length) return;
  undoStack.push(clone(currentMap));
  currentMap=redoStack.pop(); render();
  flashButton('redoBtn');
  showFlashMessage("↪️ Redo successful");
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
  const node = find(currentMap, id);  // ✅ FIX
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

  const node = find(currentMap, id);

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
  const node = find(currentMap, id);
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

  if (left < 10) {
    left = 10;
  }
  const popupHeight = popup.offsetHeight;
  if (top + popupHeight > canvasEl.scrollHeight) {
    top = canvasEl.scrollHeight - popupHeight - 10;
  }
  if (top < 10) {
    top = 10;
  }

  popup.style.left = left + "px";
  popup.style.top = top + "px";
}

function editNote(id){
  const node = find(currentMap, id); // ✅ FIX DATA SOURCE
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

  const canvasEl = document.getElementById("canvas");
  canvasEl.appendChild(editor);

  // ✅ 🔥 USE DOM POSITION (CORRECT WAY)
const rect = nodeEl.getBoundingClientRect();
const canvasRect = canvasEl.getBoundingClientRect();

let left = rect.right - canvasRect.left + canvasEl.scrollLeft + 10;
let top = rect.top - canvasRect.top + canvasEl.scrollTop;

const boxWidth = 420;
const boxHeight = 260;
let arrowClass = "arrow-left";

// 👉 RIGHT overflow → move left side
if (left + boxWidth > canvasEl.scrollWidth) {
  left = rect.left - canvasRect.left + canvasEl.scrollLeft - boxWidth - 10;
  arrowClass = "arrow-right";
}

// 👉 LEFT overflow → clamp
if (left < 10) {
  left = 10;
  arrowClass = "arrow-left"; // Fallback to point back at the node
}

// 👉 BOTTOM overflow → move up
if (top + boxHeight > canvasEl.scrollHeight) {
  top = canvasEl.scrollHeight - boxHeight - 10;
}

// 👉 TOP overflow → clamp
if (top < 10) {
  top = 10;
}

editor.classList.add(arrowClass);
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
  const node = find(currentMap, id);
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

  if (left < 10) left = 10;
  if (top < 10) top = 10;

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

function toggleQuizMode(){
  quizMode = !quizMode;

  document.getElementById("quizModeBtn")
    .classList.toggle("active", quizMode);

  document.getElementById("revealQuizBtn")
    .hidden = !quizMode;

  // 🔥 IMPORTANT FIX
  render();   // full redraw (nodes + connectors)
}

function revealQuizNode(id) {
  if (!quizMode || quizRevealed.has(id)) return;

  quizRevealed.add(id);
  render().then(() => {
    focusNode(id);
  });
}

function revealAllQuizAnswers(){
  quizMode = false;

  document.getElementById("quizModeBtn").classList.remove("active");
  document.getElementById("revealQuizBtn").hidden = true;

  render();   // 🔥 redraw again
}

function expandBranch(node) {
  node.collapsed = false;
  node.children.forEach(expandBranch);
}

function expandAllChildren(id) {
  const node = find(currentMap, id);
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

  mx = Math.max(mx, window.innerWidth);
  my = Math.max(my, window.innerHeight - 64);

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

  // 🔥 STEP 1: TEMP DRAW (for measuring)
  computeH(activeRenderTree);
  layout(activeRenderTree, 80, activeRenderTree._h / 2 + 40);
  draw(activeRenderTree, 0);

  // 🔥 STEP 2: MEASURE REAL SIZE
  measureNodes();

  // 🔥 STEP 3: CLEAR & REDRAW CORRECTLY
  document.querySelectorAll(".node, .connector-toggle").forEach(el => el.remove());
  svg.innerHTML = "";

  computeH(activeRenderTree);
  layout(activeRenderTree, 80, activeRenderTree._h / 2 + 40);
  draw(activeRenderTree, 0);
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
    quizBtn.style.display = APP_CONFIG.features.quizMode ? "" : "none";
    quizBtn.textContent = quizMode ? "🧠 Exit Quiz" : "🧠 Quiz Mode";
    quizBtn.classList.toggle("active", quizMode);
  }

  const revealBtn = document.getElementById("revealQuizBtn");
  if (revealBtn) {
    revealBtn.hidden = !quizMode || !APP_CONFIG.features.quizMode;
  }

  const searchBox = document.querySelector(".search-box");
  if (searchBox) {
    searchBox.style.display = APP_CONFIG.features.search ? "flex" : "none";
  }

  const filterBtn = document.getElementById("filterBtn");
  if (filterBtn) {
    filterBtn.style.display = APP_CONFIG.features.pyq ? "" : "none";
  }

  const exportPngBtn = document.getElementById("exportPngBtn");
  if (exportPngBtn) {
    exportPngBtn.style.display = APP_CONFIG.features.exportImage ? "" : "none";
  }

  const exportPdfBtn = document.getElementById("exportPdfBtn");
  if (exportPdfBtn) {
    exportPdfBtn.style.display = APP_CONFIG.features.exportPDF ? "" : "none";
  }

  updateSearchIndicator(); // ✅ add here
}

function renderExamBadge(node) {
if (!APP_CONFIG.features.pyq || !node.examHistory?.some(e => e.exam)) return "";
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
  <button onclick="expandAllChildren('${n.id}')">🌿 Expand branch</button>
  ${APP_CONFIG.features.importantMarker ? `<button onclick="toggleImportant('${n.id}')">${n.important ? "⭐ Remove Important" : "⭐ Mark Important"}</button>` : ""}
  ${APP_CONFIG.features.focusMode ? `<button onclick="toggleFocus('${n.id}')">${focusedNodeId === n.id ? "🎯 Exit focus" : "🎯 Focus"}</button>` : ""}
  ${APP_CONFIG.features.notes ? `<button onclick="editNote('${n.id}')">📝 Add note</button>` : ""}
${(isAdmin && APP_CONFIG.features.pyq) ? `
<button onclick="editExamHistory('${n.id}')">
📚 Add PYQ</button>
` : ""}
${APP_CONFIG.features.youtube ? (isAdmin 
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
    )) : ""}
  <button onclick="openQuizSettingsModal('${n.id}')">🤖 Generate AI Quiz</button>
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

if (APP_CONFIG.features.notes && n.note && !hiddenInQuiz) {
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
      <div class="note-viewer-actions">
        <button class="copy" title="Copy note">❏</button>
        <button class="close" title="Close">✖</button>
      </div>
    </div>
    <div class="note-viewer-body">${highlightedNote}</div>
  `;

  canvas.appendChild(viewer);

  /* ✅ CORRECT POSITION */
// ✅ include scroll offset (IMPORTANT)
let left = rect.right - canvasRect.left + canvas.scrollLeft + 12;
let top = rect.top - canvasRect.top + canvas.scrollTop;

  let arrowClass = "arrow-left";

  // smart flip (note-viewer width is 420px)
  if (left + 420 > canvas.scrollWidth){
    left = rect.left - canvasRect.left + canvas.scrollLeft - 420 - 12;
    arrowClass = "arrow-right";
  }

  if (left < 10) {
    left = 10;
    arrowClass = "arrow-left";
  }

  const boxHeight = viewer.offsetHeight;
  if (top + boxHeight > canvas.scrollHeight) {
    top = canvas.scrollHeight - boxHeight - 10;
  }

  if (top < 10) {
    top = 10;
  }

  viewer.classList.add(arrowClass);

  viewer.style.left = left + "px";
  viewer.style.top = top + "px";

  viewer.querySelector(".copy").onclick = (e) => {
    navigator.clipboard.writeText(node.note || "").then(() => {
      const btn = e.target;
      btn.textContent = "✅";
      setTimeout(() => btn.textContent = "❏", 2000);
    });
  };

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
  showFlashMessage("⬇️ Exporting JSON...");
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
    try {
      const data = JSON.parse(r.result);
      await importMindMapData(data);
    } catch (err) {
      alert(err.message || "Invalid mind map file.");
    } finally {
      e.target.value = "";
    }
  };

  r.readAsText(f);
}

async function importPreImportedMap(fileName){
  if (!fileName) return;

  try {
    const response = await fetch(`notes/${fileName}`);
    if (!response.ok) {
      throw new Error("Unable to load pre imported mind map.");
    }

    const data = await response.json();
    await importMindMapData(data);
  } catch (err) {
    alert(err.message || "Unable to import pre imported mind map.");
  } finally {
    await refreshSelector();
  }
}

async function importMindMapData(data){
  if(!data || !data.text){
    throw new Error("Invalid mind map file.");
  }

  const rootText = data.text.trim().toLowerCase();
  const maps = await listMaps();

  const exists = maps.some(m =>
    m.name && m.name.trim().toLowerCase() === rootText
  );

  if(exists){
    throw new Error("Mind map already exists.");
  }

  activeId = uid();
  currentMap = { ...data, id: activeId };
  undoStack = [];
  redoStack = [];
  allCollapsed = false;
  resetQuizState();

  await saveMap(
    activeId,
    currentMap.text || "Imported Map",
    currentMap
  );

  await refreshSelector();
  render();
  showFlashMessage("✅ Mind map imported");
}

async function importPreImportedQuiz(fileName){
  if (!fileName) return;

  try {
    const response = await fetch(`quiz/${fileName}`);
    if (!response.ok) {
      throw new Error("Unable to load pre imported quiz.");
    }

    const data = await response.json();
    await importQuizData(data, fileName);
  } catch (err) {
    alert(err.message || "Unable to import pre imported quiz.");
  } finally {
    await refreshQuizSelector();
  }
}

async function importQuizData(data, fileName = ""){
  if(!data || !data.questions){
    throw new Error("Invalid quiz file.");
  }

  let quizName = data.quizName || (data.mapName ? `${data.mapName} - Quiz` : (fileName.replace('.json', '') || "Imported Quiz"));

  showFlashMessage("✅ Quiz loaded successfully");

  // Automatically start the imported quiz
  showAIQuizModal(JSON.parse(JSON.stringify(data.questions)), true, null, data.timerSeconds !== undefined ? data.timerSeconds : 600, null, undefined, quizName);
}

async function importTestJSON(e){
  const f = e.target.files[0];
  if(!f) return;

  const r = new FileReader();
  r.onload = async () => {
    try {
      const data = JSON.parse(r.result);
      await importTestData(data, f.name);
    } catch (err) {
      alert(err.message || "Invalid test file.");
    } finally {
      e.target.value = "";
    }
  };

  r.readAsText(f);
}

async function importTestData(data, fileName = ""){
  const examJson = normalizeExamTestJSON(data, fileName);
  validateExamTestJSON(examJson);

  const baseName = formatExamTestName(examJson.exam) || fileName.replace(/\.json$/i, "") || "Imported Test";
  const tests = await listTests();
  const existingTest = tests.find(t => t.name && t.name.trim().toLowerCase() === baseName.trim().toLowerCase());

  if (existingTest) {
    const testData = await loadTest(existingTest.id);
    const existingExam = normalizeExamTestJSON(testData, existingTest.id);
    validateExamTestJSON(existingExam);
    activeExamTest = existingExam;
    activeExamTest.savedTestId = existingTest.id;
    showFlashMessage("✅ Using existing test");
    openExamTestScreen(existingExam);
    return;
  }

  const newTestId = uid();
  await saveTest(newTestId, baseName, examJson);
  await refreshTestSelector();

  activeExamTest = examJson;
  activeExamTest.savedTestId = newTestId;
  showFlashMessage("✅ Test imported successfully");
  openExamTestScreen(examJson);
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

/* ================= TEST RUNNER ================= */
let activeExamTest = null;

async function startSelectedTest(filePath) {
  const selector = document.getElementById("testSelector");
  if (!filePath) return;

  try {
    showFlashMessage("📝 Loading test...");
    const response = await fetch(`test/${filePath}`);
    if (!response.ok) {
      throw new Error("Unable to load test JSON.");
    }

    const data = await response.json();
    const examJson = normalizeExamTestJSON(data, filePath);
    validateExamTestJSON(examJson);
    activeExamTest = examJson;
    openExamTestScreen(examJson);
  } catch (err) {
    alert(err.message || "Unable to start test.");
  } finally {
    if (selector) selector.value = "";
  }
}

function openTestSettingsModal() {
  const existing = document.getElementById('testSettingsModal');
  const existingOverlay = document.getElementById('testSettingsOverlay');
  if (existing) existing.remove();
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'testSettingsOverlay';
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99998;";
  document.body.appendChild(overlay);

  const modal = document.createElement('div');
  modal.id = 'testSettingsModal';
  modal.className = "note-editor"; 
  modal.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:90%;max-width:400px;z-index:99999;padding:0;box-sizing:border-box;cursor:default;";

  modal.innerHTML = `
    <div class="note-editor-header" style="padding:20px; border-bottom:1px solid rgba(128,128,128,0.2); font-size:18px; display:flex; justify-content:space-between; align-items:center;">
      <span>⚙️ Generate AI Test</span>
      <button class="close" id="closeTestSettingsBtn" style="background:transparent;border:none;font-size:18px;cursor:pointer;color:inherit;">✖</button>
    </div>
    <div style="padding:20px;">
      <div style="margin-bottom:16px;">
        <label style="display:block; margin-bottom:6px; font-weight:600; font-size:14px;">Exam Name (e.g. SSC CGL)</label>
        <input type="text" id="tsExamName" style="width:100%; padding:8px; border-radius:6px; border:1px solid #d1d5db; font-size:14px; background:transparent; color:inherit;" placeholder="SSC CGL">
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block; margin-bottom:6px; font-weight:600; font-size:14px;">Date (e.g. 12-09-2025)</label>
        <input type="text" id="tsDate" style="width:100%; padding:8px; border-radius:6px; border:1px solid #d1d5db; font-size:14px; background:transparent; color:inherit;" placeholder="12-09-2025">
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block; margin-bottom:6px; font-weight:600; font-size:14px;">Shift (e.g. Shift 1)</label>
        <input type="text" id="tsShift" style="width:100%; padding:8px; border-radius:6px; border:1px solid #d1d5db; font-size:14px; background:transparent; color:inherit;" placeholder="Shift 1">
      </div>
      <div class="note-editor-actions" style="margin-top:0; justify-content:flex-end; display:flex;">
        <button class="save" id="startAITestBtn" style="background:#3b82f6; border-color:#2563eb; color:white; font-weight:bold; width:100%; padding:10px;">🚀 Generate & Start</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  if (document.body.classList.contains('dark-mode')) {
    modal.querySelectorAll('input').forEach(sel => {
      sel.style.backgroundColor = '#2a2a2a';
      sel.style.color = '#e0e0e0';
      sel.style.borderColor = '#444';
    });
  }

  document.getElementById('closeTestSettingsBtn').onclick = () => { modal.remove(); overlay.remove(); };
  overlay.onclick = () => { modal.remove(); overlay.remove(); };
  
  document.getElementById('startAITestBtn').onclick = () => {
    const examName = document.getElementById('tsExamName').value.trim();
    const examDate = document.getElementById('tsDate').value.trim();
    const examShift = document.getElementById('tsShift').value.trim();
    
    if(!examName || !examDate || !examShift) {
        alert("Please fill all fields");
        return;
    }

    modal.remove();
    overlay.remove();
    
    generateTestFromAI(examName, examDate, examShift);
  };
}

async function generateTestFromAI(examName, examDate, examShift) {
  const apiKey = await getApiKey();
  if (!apiKey) return;

  showFlashMessage("🤖 Generating Test from AI...");
  
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'aiTestLoadingOverlay';
  loadingOverlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;flex-direction:column;justify-content:center;align-items:center;color:white;";
  loadingOverlay.innerHTML = `
    <style>
      @keyframes aiQuizSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
    <div style="width:50px;height:50px;border:5px solid rgba(255,255,255,0.3);border-top:5px solid #ffffff;border-radius:50%;animation:aiQuizSpin 1s linear infinite;margin-bottom:16px;"></div>
    <div style="font-size:18px;font-weight:bold;">Generating Exam Test...</div>
    <div style="font-size:14px;margin-top:8px;opacity:0.8;">Please wait while AI constructs the exact exam questions.</div>
  `;
  document.body.appendChild(loadingOverlay);

  try {
    const testData = await fetchExamTestFromAI(apiKey, examName, examDate, examShift);
    const examJson = normalizeExamTestJSON(testData, `${examName}-${examDate}-${examShift}`);
    validateExamTestJSON(examJson);

    if (loadingOverlay) loadingOverlay.remove();
    
    const baseName = formatExamTestName(examJson.exam);
    let testName = baseName || `${examName} ${examDate} ${examShift}`;
    const existingTests = await listTests();
    let counter = 1;
    while (existingTests.some(t => t.name.trim().toLowerCase() === testName.trim().toLowerCase())) {
      testName = `${baseName} (${counter})`;
      counter++;
    }

    const newTestId = uid();
    examJson.exam.name = testName;
    await saveTest(newTestId, testName, examJson);
    showFlashMessage("✅ Test automatically saved!");
    
    refreshTestSelector();
    
    activeExamTest = examJson;
    activeExamTest.savedTestId = newTestId;
    openExamTestScreen(examJson);

  } catch (err) {
    if (loadingOverlay) loadingOverlay.remove();
    if (err.message.startsWith("API_AUTH_")) {
      const status = err.message.split("_")[2];
      localStorage.removeItem('googleApiKey');
      alert(`API Error (${status}): The API key is invalid, expired, or quota-limited. Please provide a new API key.`);
      return;
    }
    alert("Error generating test: " + err.message);
  }
}

async function fetchExamTestFromAI(apiKey, examName, examDate, examShift) {
  const promptText = `You are a test JSON generator for an exam practice app.

Task:
Return the exact question paper JSON for:
- Exam name: ${examName}
- Date: ${examDate}
- Shift: ${examShift}

Rules:
- Return ONLY a valid JSON object. Do not use markdown fences.
- Include the full paper, normally 100 questions for SSC CGL Tier-I, unless the real paper has a different count.
- Preserve the exact sections, section order, question order, options, answer key, and bilingual English/Hindi text as closely as possible.
- Every question must have exactly 4 options with ids A, B, C, D.
- The answer must be A, B, C, or D.
- IMPORTANT: If a question requires a visual diagram (e.g., dice positions, embedded figures), you MUST provide a special character-based image (ASCII art) representing the diagram in the "asciiArt" field. Do not just say "as shown in the figure".
- Use this schema exactly:
{
  "exam": {
    "id": "machine-readable-id",
    "name": "${examName}",
    "heldOn": "${examDate}",
    "shift": "${examShift}",
    "durationMinutes": 60,
    "negativeMark": 0.5,
    "totalQuestions": 100,
    "languages": ["en", "hi"],
    "sections": [
      {
        "id": "part_a",
        "title": {"en": "Section Name", "hi": "सेक्शन का नाम"},
        "questionStart": 1,
        "questionEnd": 25,
        "sectionTimeMinutes": 15
      }
    ],
    "questions": [
      {
        "id": 1,
        "section": "part_a",
        "questionType": "single",
        "marks": 2,
        "question": {"en": "Question text", "hi": "प्रश्न पाठ"},
        "asciiArt": "ASCII art here if needed (use \\n for newlines), else empty string",
        "options": [
          {"id": "A", "en": "Option A", "hi": "विकल्प A"},
          {"id": "B", "en": "Option B", "hi": "विकल्प B"},
          {"id": "C", "en": "Option C", "hi": "विकल्प C"},
          {"id": "D", "en": "Option D", "hi": "विकल्प D"}
        ],
        "answer": "A",
        "explanation": {"en": "Short explanation", "hi": "संक्षिप्त व्याख्या"},
        "difficulty": "medium",
        "topic": "Topic",
        "pyq": {"exam": "${examName}", "year": "${String(examDate).slice(-4)}", "shift": "${examShift}"}
      }
    ]
  }
}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    if ([401, 403, 429].includes(response.status)) {
      throw new Error("API_AUTH_" + response.status);
    }
    throw new Error("API request failed with status: " + response.status);
  }

  const data = await response.json();
  const contentStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!contentStr) {
    throw new Error("AI returned an empty response.");
  }

  return JSON.parse(contentStr.replace(/```json/g, "").replace(/```/g, "").trim());
}

function normalizeExamTestJSON(data, filePath = "") {
  const sourceExam = data.exam || data;
  if (!sourceExam || !Array.isArray(sourceExam.questions)) {
    throw new Error("Invalid test JSON. Expected exam.questions.");
  }

  const questions = sourceExam.questions.map((q, index) => normalizeExamQuestion(q, index + 1, sourceExam));
  const sections = normalizeExamSections(sourceExam.sections, questions);

  return {
    exam: {
      id: sourceExam.id || safeName(filePath || sourceExam.name || "exam").toLowerCase(),
      name: sourceExam.name || "Imported Test",
      heldOn: sourceExam.heldOn || "",
      shift: sourceExam.shift || "",
      durationMinutes: Number(sourceExam.durationMinutes) || 60,
      negativeMark: Number(sourceExam.negativeMark) || 0,
      totalQuestions: questions.length,
      languages: Array.isArray(sourceExam.languages) ? sourceExam.languages : ["en", "hi"],
      sections,
      questions
    }
  };
}

function normalizeExamQuestion(q, id, exam) {
  const optionIds = ["A", "B", "C", "D"];
  const rawOptions = Array.isArray(q.options) ? q.options : [];
  const options = optionIds.map((letter, index) => {
    const opt = rawOptions[index] || {};
    return {
      id: opt.id || letter,
      en: typeof opt === "string" ? opt : (opt.en || ""),
      hi: typeof opt === "string" ? opt : (opt.hi || opt.en || "")
    };
  });

  const answer = typeof q.answer === "number"
    ? optionIds[q.answer] || "A"
    : String(q.answer || "A").toUpperCase();

  return {
    id: Number(q.id) || id,
    section: q.section || "part_a",
    questionType: q.questionType || "single",
    marks: Number(q.marks) || 2,
    asciiArt: q.asciiArt || "",
    question: {
      en: typeof q.question === "string" ? q.question : (q.question?.en || ""),
      hi: typeof q.question === "string" ? q.question : (q.question?.hi || q.question?.en || "")
    },
    options,
    answer: optionIds.includes(answer) ? answer : "A",
    explanation: {
      en: typeof q.explanation === "string" ? q.explanation : (q.explanation?.en || ""),
      hi: typeof q.explanation === "string" ? q.explanation : (q.explanation?.hi || q.explanation?.en || "")
    },
    difficulty: q.difficulty || "easy",
    topic: q.topic || "",
    pyq: {
      exam: q.pyq?.exam || exam.name || "",
      year: q.pyq?.year || (exam.heldOn ? String(exam.heldOn).slice(0, 4) : ""),
      shift: q.pyq?.shift || exam.shift || ""
    }
  };
}

function normalizeExamSections(sections, questions) {
  const byId = new Map();

  if (Array.isArray(sections)) {
    sections.forEach(section => {
      const id = section.id || "part_a";
      byId.set(id, {
        id,
        title: {
          en: section.title?.en || section.name || id,
          hi: section.title?.hi || section.title?.en || section.name || id
        },
        questionStart: Number(section.questionStart) || 0,
        questionEnd: Number(section.questionEnd) || 0,
        sectionTimeMinutes: Number(section.sectionTimeMinutes || section.durationMinutes) || 0
      });
    });
  }

  questions.forEach(q => {
    if (!byId.has(q.section)) {
      byId.set(q.section, {
        id: q.section,
        title: { en: q.section, hi: q.section },
        questionStart: 0,
        questionEnd: 0,
        sectionTimeMinutes: 0
      });
    }
  });

  const normalized = Array.from(byId.values());
  normalized.forEach(section => {
    const sectionQuestions = questions.filter(q => q.section === section.id);
    if (!section.questionStart && sectionQuestions.length) section.questionStart = sectionQuestions[0].id;
    if (!section.questionEnd && sectionQuestions.length) section.questionEnd = sectionQuestions[sectionQuestions.length - 1].id;
    if (!section.sectionTimeMinutes) section.sectionTimeMinutes = 15;
  });

  return normalized;
}

function validateExamTestJSON(examJson) {
  const exam = examJson?.exam;
  if (!exam || !Array.isArray(exam.sections) || !Array.isArray(exam.questions)) {
    throw new Error("Invalid test JSON schema.");
  }

  exam.questions.forEach(q => {
    if (!q.question?.en || !Array.isArray(q.options) || q.options.length !== 4 || !["A", "B", "C", "D"].includes(q.answer)) {
      throw new Error(`Invalid question format at question ${q.id}.`);
    }
  });

  return true;
}

function openExamTestScreen(examJson) {
  const exam = examJson.exam;
  let questions = [];

  // Shuffle questions within each section
  exam.sections.forEach(sec => {
    let secQs = exam.questions.filter(q => q.section === sec.id);
    for (let i = secQs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [secQs[i], secQs[j]] = [secQs[j], secQs[i]];
    }
    questions.push(...secQs);
  });
  exam.questions = questions; // Save the shuffled order back

  document.getElementById("examTestOverlay")?.remove();
  document.getElementById("examTestModal")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "examTestOverlay";
  overlay.className = "test-overlay";
  document.body.appendChild(overlay);

  const modal = document.createElement("div");
  modal.id = "examTestModal";
  modal.className = "exam-test-modal";
  modal.setAttribute("data-lang", "en");

  let currentIndex = 0;
  let submitted = false;
  let currentSecIdx = 0;
  const sectionTimers = exam.sections.map(s => (s.sectionTimeMinutes || 15) * 60);
  let sectionRemainingSeconds = sectionTimers[currentSecIdx];
  let remainingSeconds = sectionTimers.reduce((a, b) => a + b, 0);

  const answers = new Map();
  const reviewFlags = new Set();
  let timerInterval = null;

  modal.innerHTML = `
    <style>
      .exam-test-modal[data-lang="en"] .lang-hi { display:none !important; }
      .exam-test-modal[data-lang="hi"] .lang-en { display:none !important; }
    </style>
    <div class="exam-test-header">
      <div>
        <h2>${escapeHtml(exam.name)}</h2>
        <div>${escapeHtml(exam.heldOn || "")}${exam.shift ? ` · Shift ${escapeHtml(exam.shift)}` : ""} · ${questions.length} Questions</div>
      </div>
      <div class="exam-test-header-actions">
        <button id="examLangBtn">🌐 Translate</button>
        <button id="examSaveBtn">💾 Save Test</button>
        <button id="examExportBtn">⬇ Export JSON</button>
        <span id="examSectionTimer" style="color:#d97706; font-weight:bold; padding:4px 8px; border:1px solid #fcd34d; border-radius:6px; background:rgba(252,211,77,0.2);">Sec: ${formatExamTimer(sectionRemainingSeconds)}</span>
        <span id="examTimer" style="padding:4px 8px; border:1px solid #cbd5e1; border-radius:6px;">Total: ${formatExamTimer(remainingSeconds)}</span>
      </div>
    </div>
    <div class="exam-section-tabs">
      ${exam.sections.map((section, index) => `
        <button class="exam-section-btn ${index === 0 ? "active" : ""}" data-section="${escapeHtml(section.id)}">
          <span class="lang-en">${escapeHtml(section.title.en)}</span>
          <span class="lang-hi">${escapeHtml(section.title.hi)}</span>
        </button>
      `).join("")}
    </div>
    <div class="exam-test-body">
      <aside class="exam-question-palette">
        ${questions.map((_, i) => `<button class="exam-question-chip ${i === 0 ? "active visited" : ""}" data-index="${i}">${i + 1}</button>`).join("")}
      </aside>
      <main class="exam-question-panel" id="examQuestionPanel"></main>
    </div>
    <div class="exam-test-footer">
      <div>
        <button id="examPrevBtn">◀ Prev</button>
        <button id="examNextBtn">Next ▶</button>
        <button id="examReviewBtn">Mark Review</button>
      </div>
      <div style="display:flex; gap:8px;">
        ${activeExamTest && activeExamTest.savedTestId ? `<button id="examDeleteBtn" class="cancel" style="background:#fee2e2; color:#ef4444; border-color:#fca5a5;">🗑️ Delete</button>` : ''}
        <button id="examCloseBtn" class="cancel">Close</button>
        <button id="examSubmitBtn" class="save">Submit Test</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  function renderQuestion() {
    const q = questions[currentIndex];
    const panel = document.getElementById("examQuestionPanel");
    const selected = answers.get(q.id);
    const section = exam.sections.find(s => s.id === q.section);

    panel.innerHTML = `
      <div class="exam-question-meta">
        <span>${escapeHtml(section?.title?.en || q.section)}</span>
        <span>${escapeHtml(q.topic || "")}</span>
        <span>${escapeHtml(q.difficulty || "")}</span>
      </div>
      
      ${(() => {
        const parts = [q.pyq?.exam, q.pyq?.year, q.pyq?.shift].filter(Boolean);
        return parts.length > 0 ? `<div style="margin-bottom:8px;"><span class="quiz-pyq-tag" style="margin-left:0;">${escapeHtml(parts.join(" "))}</span></div>` : '';
      })()}

      <h3>
        Q${currentIndex + 1}. 
        <span class="lang-en">${escapeHtml(q.question.en)}</span>
        <span class="lang-hi">${escapeHtml(q.question.hi)}</span>
      </h3>
      ${q.asciiArt ? `<pre style="font-family: monospace; background: rgba(128,128,128,0.1); padding: 12px; border-radius: 6px; overflow-x: auto; line-height: 1.2; margin-bottom: 14px; white-space: pre;">${escapeHtml(q.asciiArt)}</pre>` : ""}
      <div class="exam-options">
        ${q.options.map(opt => `
          <label class="exam-option" data-option="${opt.id}">
            <input type="radio" name="examOption" value="${opt.id}" ${selected === opt.id ? "checked" : ""} ${submitted ? "disabled" : ""}>
            <span><strong>${opt.id}.</strong> <span class="lang-en">${escapeHtml(opt.en)}</span><span class="lang-hi">${escapeHtml(opt.hi)}</span></span>
          </label>
        `).join("")}
      </div>
      <div class="exam-explanation" id="examExplanation"></div>
    `;

    panel.querySelectorAll("input[name='examOption']").forEach(input => {
      input.onchange = () => {
        if (submitted) return;
        answers.set(q.id, input.value);
        updatePalette();
      };
    });

    if (submitted) {
      panel.querySelectorAll(".exam-option").forEach(label => {
        const opt = label.dataset.option;
        if (opt === q.answer) label.classList.add("correct");
        if (answers.get(q.id) === opt && opt !== q.answer) label.classList.add("wrong");
      });

      const explanation = document.getElementById("examExplanation");
      explanation.style.display = "block";
      explanation.innerHTML = `
        <strong>Answer: ${escapeHtml(q.answer)}</strong><br>
        <span class="lang-en">${escapeHtml(q.explanation.en || "No explanation available.")}</span>
        <span class="lang-hi">${escapeHtml(q.explanation.hi || q.explanation.en || "व्याख्या उपलब्ध नहीं है।")}</span>
      `;
    }

    const isFirstInSection = currentIndex === 0 || questions[currentIndex - 1].section !== q.section;
    const isLastInSection = currentIndex === questions.length - 1 || questions[currentIndex + 1].section !== q.section;

    if (submitted) {
      document.getElementById("examPrevBtn").disabled = currentIndex === 0;
      document.getElementById("examNextBtn").disabled = currentIndex === questions.length - 1;
    } else {
      document.getElementById("examPrevBtn").disabled = isFirstInSection;
      document.getElementById("examNextBtn").disabled = isLastInSection;
    }

    document.getElementById("examReviewBtn").textContent = reviewFlags.has(q.id) ? "Unmark Review" : "Mark Review";
    document.getElementById("examReviewBtn").disabled = submitted;
    updatePalette();
  }

  function updatePalette() {
    const activeSecId = exam.sections[currentSecIdx].id;

    modal.querySelectorAll(".exam-question-chip").forEach((btn, i) => {
      const q = questions[i];
      btn.classList.toggle("active", i === currentIndex);
      
      if (!submitted && q.section !== activeSecId) {
        btn.style.opacity = "0.3";
        btn.style.pointerEvents = "none";
      } else {
        btn.style.opacity = "1";
        btn.style.pointerEvents = "auto";
      }

      if (submitted) {
        btn.classList.remove("answered", "review");
        const selected = answers.get(q.id);
        if (selected === q.answer) btn.classList.add("correct");
        else if (selected) btn.classList.add("wrong");
      } else {
        btn.classList.toggle("answered", answers.has(q.id));
        btn.classList.toggle("review", reviewFlags.has(q.id));
      }
    });

    modal.querySelectorAll(".exam-section-btn").forEach((btn, i) => {
      btn.classList.toggle("active", i === currentSecIdx || (submitted && btn.dataset.section === questions[currentIndex].section));
      if (!submitted && i !== currentSecIdx) {
          btn.style.opacity = "0.6";
      } else {
          btn.style.opacity = "1";
      }
    });
  }

  function jumpToQuestion(index) {
    currentIndex = Math.max(0, Math.min(index, questions.length - 1));
    if (!submitted) {
      modal.querySelector(`.exam-question-chip[data-index="${currentIndex}"]`)?.classList.add("visited");
    }
    renderQuestion();
  }

  function submitExamTest(auto = false) {
    if (submitted) return;
    if (!auto && !confirm("Submit test?")) return;

    submitted = true;
    if (timerInterval) clearInterval(timerInterval);

    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    questions.forEach(q => {
      const selected = answers.get(q.id);
      if (!selected) unattempted++;
      else if (selected === q.answer) correct++;
      else wrong++;
    });

    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const score = questions.reduce((sum, q) => {
      const selected = answers.get(q.id);
      if (!selected) return sum;
      return selected === q.answer ? sum + q.marks : sum - (exam.negativeMark || 0);
    }, 0);

    exam.resultAnalytics = {
      attempted: answers.size,
      correct,
      wrong,
      unattempted,
      score,
      totalMarks,
      reviewFlags: Array.from(reviewFlags),
      submittedAt: new Date().toISOString()
    };

    document.getElementById("examSubmitBtn").disabled = true;
    document.getElementById("examTimer").textContent = `Score ${score}/${totalMarks}`;
    const secTimer = document.getElementById("examSectionTimer");
    if (secTimer) secTimer.style.display = "none";
    
    jumpToQuestion(0);
    showFlashMessage(`✅ Score: ${score}/${totalMarks}`);
  }

  modal.querySelectorAll(".exam-question-chip").forEach(btn => {
    btn.onclick = () => jumpToQuestion(parseInt(btn.dataset.index, 10));
  });

  modal.querySelectorAll(".exam-section-btn").forEach((btn, i) => {
    btn.onclick = () => {
      if (submitted || i === currentSecIdx) {
        const index = questions.findIndex(q => q.section === btn.dataset.section);
        if (index >= 0) jumpToQuestion(index);
      } else {
        showFlashMessage("🔒 You must complete the current section first!");
      }
    };
  });

  document.getElementById("examLangBtn").onclick = () => {
    const lang = modal.getAttribute("data-lang");
    modal.setAttribute("data-lang", lang === "en" ? "hi" : "en");
  };

  document.getElementById("examSaveBtn").onclick = async () => {
    const savedId = await saveActiveExamTest();
    if (savedId) {
      activeExamTest.savedTestId = savedId;
      showFlashMessage("✅ Test saved");
    }
  };
  document.getElementById("examExportBtn").onclick = () => exportActiveExamTestJSON();
  document.getElementById("examPrevBtn").onclick = () => jumpToQuestion(currentIndex - 1);
  document.getElementById("examNextBtn").onclick = () => jumpToQuestion(currentIndex + 1);
  document.getElementById("examReviewBtn").onclick = () => {
    const id = questions[currentIndex].id;
    if (reviewFlags.has(id)) reviewFlags.delete(id);
    else reviewFlags.add(id);
    updatePalette();
    renderQuestion();
  };
  
  const deleteBtn = document.getElementById("examDeleteBtn");
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (confirm("Are you sure you want to delete this saved test?")) {
        await deleteTestDB(activeExamTest.savedTestId);
        if (timerInterval) clearInterval(timerInterval);
        modal.remove();
        overlay.remove();
        refreshTestSelector();
        showFlashMessage("🗑️ Test deleted successfully!");
      }
    };
  };
  document.getElementById("examCloseBtn").onclick = () => {
    if (!submitted && answers.size && !confirm("Close test without submitting?")) return;
    if (timerInterval) clearInterval(timerInterval);
    modal.remove();
    overlay.remove();
  };
  overlay.onclick = () => {
    if (!submitted && answers.size && !confirm("Close test without submitting?")) return;
    if (timerInterval) clearInterval(timerInterval);
    modal.remove();
    overlay.remove();
  };
  document.getElementById("examSubmitBtn").onclick = () => submitExamTest(false);

  if (remainingSeconds > 0) {
    timerInterval = setInterval(() => {
      if (submitted) {
          clearInterval(timerInterval);
          return;
      }
      
      remainingSeconds--;
      sectionRemainingSeconds--;
      
      document.getElementById("examTimer").textContent = `Total: ` + formatExamTimer(remainingSeconds);
      document.getElementById("examSectionTimer").textContent = `Sec: ` + formatExamTimer(sectionRemainingSeconds);
      
      if (sectionRemainingSeconds <= 0) {
        currentSecIdx++;
        if (currentSecIdx < exam.sections.length) {
          sectionRemainingSeconds = sectionTimers[currentSecIdx];
          const nextSecId = exam.sections[currentSecIdx].id;
          const nextQIdx = questions.findIndex(q => q.section === nextSecId);
          showFlashMessage(`⏱️ Time's up! Moving to ${exam.sections[currentSecIdx].title.en}`);
          jumpToQuestion(nextQIdx);
        } else {
          submitExamTest(true);
          alert("Time is up. Your test has been submitted.");
        }
      }
    }, 1000);
  }

  renderQuestion();
}

function formatExamTimer(seconds) {
  if (!seconds) return "Untimed";
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function formatExamTestName(exam) {
  const name = exam?.name || "Exam Test";
  const heldOn = exam?.heldOn || "";
  const shiftLabel = exam?.shift ? `Shift ${String(exam.shift).replace(/^shift\s*/i, "").trim()}` : "";
  const lowerName = name.toLowerCase();
  const parts = [name];

  if (heldOn && !lowerName.includes(String(heldOn).toLowerCase())) {
    parts.push(heldOn);
  }

  if (shiftLabel && !lowerName.includes(shiftLabel.toLowerCase())) {
    parts.push(shiftLabel);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function saveActiveExamTest() {
  if (!activeExamTest) {
    alert("Start a test first.");
    return null;
  }

  const examJson = normalizeExamTestJSON(activeExamTest, activeExamTest.exam?.id || "");
  validateExamTestJSON(examJson);

  if (activeExamTest.savedTestId) {
    const name = formatExamTestName(examJson.exam);
    examJson.exam.name = name;
    await saveTest(activeExamTest.savedTestId, name, examJson);
    await refreshTestSelector();
    return activeExamTest.savedTestId;
  }

  const existingTests = await listTests();
  const baseName = formatExamTestName(examJson.exam);
  let testName = prompt("Enter Test Name:", baseName);
  if (!testName) return null;

  testName = testName.trim();
  while (existingTests.some(t => t.name.trim().toLowerCase() === testName.toLowerCase())) {
    testName = prompt("A test with this name already exists. Please enter a different name:", testName);
    if (!testName) return null;
    testName = testName.trim();
  }

  const newTestId = uid();
  examJson.exam.name = testName;
  await saveTest(newTestId, testName, examJson);
  activeExamTest = examJson;
  activeExamTest.savedTestId = newTestId;
  await refreshTestSelector();
  return newTestId;
}

function exportActiveExamTestJSON() {
  if (!activeExamTest) {
    alert("Start a test first.");
    return;
  }

  const examJson = normalizeExamTestJSON(activeExamTest, activeExamTest.exam?.id || "");
  validateExamTestJSON(examJson);

  const b = new Blob([JSON.stringify(examJson, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = `${safeName(formatExamTestName(examJson.exam) || "exam")}.json`;
  a.click();
}

/* ================= AI QUIZ ================= */
function extractTextForQuiz(node, depth = 0) {
  let indent = "  ".repeat(depth);
  let content = indent + "• " + node.text;
  
  if (node.note) {
    content += "\n" + indent + "  Note: " + node.note.replace(/\n/g, "\n" + indent + "  ");
  }
  
  // Also include PYQ (Previous Year Questions) context for the AI
  if (node.examHistory && node.examHistory.length > 0) {
    const exams = node.examHistory.map(e => `${e.exam} ${e.year || ''}`.trim()).join(", ");
    content += "\n" + indent + "  PYQ: " + exams;
  }

  node.children.forEach(c => {
    content += "\n" + extractTextForQuiz(c, depth + 1);
  });
  return depth === 0 ? content.trim() : content;
}

function promptForApiKey() {
    return new Promise((resolve) => {
        // Ensure no other modals are open
        const existingModal = document.getElementById('apiKeyModal');
        if (existingModal) existingModal.remove();
        const existingOverlay = document.getElementById('apiKeyOverlay');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'apiKeyOverlay';
        overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99998;";
        document.body.appendChild(overlay);

        const modal = document.createElement('div');
        modal.id = 'apiKeyModal';
        modal.className = "note-editor"; // Reuse styles for consistency
        modal.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:90%;max-width:450px;padding:20px;z-index:99999;max-height:90vh;overflow-y:auto;box-sizing:border-box;cursor:default;";

        modal.innerHTML = `
            <div>
                <div style="text-align: center; margin-bottom: 24px;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #3b82f6; margin-bottom: 12px;">
                        <path d="M15.5 8.5L18 6c-2.003-2.003-5.196-2.003-7.198 0l-2.5 2.5c-2.003 2.003-2.003 5.196 0 7.198l2.5 2.5c2.003 2.003 5.196 2.003 7.198 0l2.5-2.5"/>
                        <path d="M12 12l-2-2"/>
                        <path d="m8.5 15.5 2.5-2.5"/>
                    </svg>
                    <!-- <h2 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 600;">AI Feature Key</h2> -->
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">A key is needed for AI quiz generation.</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <button id="getApiKeyBtn" style="background-color: #25D366; border: none; color: white; width: 100%; padding: 12px; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: background-color 0.2s;">
                        <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c-.003 1.396.366 2.76 1.056 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/></svg>
                        Join WhatsApp for Free Key
                    </button>
                </div>

                <div style="text-align: center; margin-bottom: 20px; font-weight: 600; color: #6b7280; font-size: 14px;">— OR —</div>

                <div style="margin-bottom: 24px;">
                    <label for="apiKeyInput" style="display:block; text-align: center; margin-bottom: 8px; font-weight: 500; font-size: 14px;">Already have Key:</label>
                    <input type="text" id="apiKeyInput" placeholder="Enter key here..." style="width: 100%; box-sizing: border-box; padding: 10px; font-size: 14px; border-radius: 8px; border: 1px solid #d1d5db;">
                </div>

                <div class="note-editor-actions" style="display:flex; justify-content:flex-end; gap:12px;">
                    <button id="cancelApiKeyBtn" class="cancel">Cancel</button>
                    <button id="saveApiKeyBtn" class="save">Save Key</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('getApiKeyBtn').onclick = () => {
            window.open('https://whatsapp.com/channel/0029VbBxWdc5kg77DRKNYJ0L', '_blank');
        };

        const closeModal = () => { modal.remove(); overlay.remove(); };
        document.getElementById('cancelApiKeyBtn').onclick = () => { closeModal(); resolve(null); };
        
        const saveBtn = document.getElementById('saveApiKeyBtn');
        saveBtn.onclick = () => {
            const newApiKey = document.getElementById('apiKeyInput').value.trim();
            if (newApiKey) {
                localStorage.setItem('googleApiKey', newApiKey);
                showFlashMessage("✅ API Key saved successfully!");
                closeModal();
                resolve(newApiKey);
            } else {
                alert("Please enter an API key before saving.");
            }
        };

        // Also allow submitting with Enter key
        document.getElementById('apiKeyInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });
    });
}

async function getApiKey() {
  if (!APP_CONFIG.dev || !APP_CONFIG.dev.alwaysPromptApiKey) {
    let apiKey = localStorage.getItem('googleApiKey');
    if (apiKey) return apiKey;
  }

  const newApiKey = await promptForApiKey();
  return newApiKey;
}

function openQuizSettingsModal(id) {
  const node = find(currentMap, id);
  if (!node) return;

  const content = extractTextForQuiz(node);
  if (!content || content.length < 10) {
    alert("Not enough text content in this branch to generate a quiz.");
    return;
  }

  const existing = document.getElementById('quizSettingsModal');
  const existingOverlay = document.getElementById('quizSettingsOverlay');
  if (existing) existing.remove();
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'quizSettingsOverlay';
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99998;";
  document.body.appendChild(overlay);

  const modal = document.createElement('div');
  modal.id = 'quizSettingsModal';
  modal.className = "note-editor"; 
  modal.style.cssText = "position:fixed;width:90%;max-width:400px;z-index:99999;padding:0;box-sizing:border-box;cursor:default;";

  modal.innerHTML = `
    <div class="note-editor-header" style="padding:20px; border-bottom:1px solid rgba(128,128,128,0.2); font-size:18px; display:flex; justify-content:space-between; align-items:center;">
      <span>⚙️ Quiz Settings</span>
      <button class="close" id="closeQuizSettingsBtn" style="background:transparent;border:none;font-size:18px;cursor:pointer;color:inherit;">✖</button>
    </div>
    <div style="padding:20px;">
      <div style="margin-bottom:16px;">
        <label style="display:block; margin-bottom:6px; font-weight:600; font-size:14px;">Language</label>
        <select id="qsLang" style="width:100%; padding:8px; border-radius:6px; border:1px solid #d1d5db; font-size:14px; background:transparent; color:inherit;">
          <option value="English" selected>English</option>
          <option value="Hindi">Hindi (हिंदी)</option>
        </select>
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block; margin-bottom:6px; font-weight:600; font-size:14px;">Number of Questions</label>
        <select id="qsCount" style="width:100%; padding:8px; border-radius:6px; border:1px solid #d1d5db; font-size:14px; background:transparent; color:inherit;">
          <option value="10">10 Questions</option>
          <option value="25" selected>25 Questions</option>
          <option value="50">50 Questions</option>
        </select>
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block; margin-bottom:6px; font-weight:600; font-size:14px;">Difficulty Level</label>
        <select id="qsDiff" style="width:100%; padding:8px; border-radius:6px; border:1px solid #d1d5db; font-size:14px; background:transparent; color:inherit;">
          <option value="Easy">Easy</option>
          <option value="Medium" selected>Medium</option>
          <option value="Hard">Hard</option>
        </select>
      </div>
      <div style="margin-bottom:24px;">
        <label style="display:block; margin-bottom:6px; font-weight:600; font-size:14px;">Timer Settings</label>
        <select id="qsTimer" style="width:100%; padding:8px; border-radius:6px; border:1px solid #d1d5db; font-size:14px; background:transparent; color:inherit;">
          <option value="300">5 Minutes</option>
          <option value="600" selected>10 Minutes</option>
          <option value="900">15 Minutes</option>
          <option value="0">Untimed Practice Mode</option>
        </select>
      </div>
      <div class="note-editor-actions" style="margin-top:0; justify-content:flex-end; display:flex;">
        <button class="save" id="startQuizBtn" style="background:#3b82f6; border-color:#2563eb; color:white; font-weight:bold; width:100%; padding:10px;">🚀 Generate & Start</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const nodeEl = document.querySelector(`.node[data-id="${id}"]`);
  if (nodeEl) {
    const rect = nodeEl.getBoundingClientRect();
    let left = rect.right + 12;
    let top = rect.top;
    let arrowClass = "arrow-left";

    const boxWidth = modal.offsetWidth || 400;
    const boxHeight = modal.offsetHeight || 300;

    if (left + boxWidth > window.innerWidth) {
      left = rect.left - boxWidth - 12;
      arrowClass = "arrow-right";
    }
    if (left < 10) { left = 10; arrowClass = "arrow-left"; }
    
    if (top + boxHeight > window.innerHeight) {
      top = window.innerHeight - boxHeight - 10;
    }
    if (top < 10) { top = 10; }

    modal.classList.add(arrowClass);
    modal.style.left = left + "px";
    modal.style.top = top + "px";
  } else {
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
  }

  if (document.body.classList.contains('dark-mode')) {
    modal.querySelectorAll('select').forEach(sel => {
      sel.style.backgroundColor = '#2a2a2a';
      sel.style.color = '#e0e0e0';
      sel.style.borderColor = '#444';
    });
  }

  document.getElementById('closeQuizSettingsBtn').onclick = () => { modal.remove(); overlay.remove(); };
  overlay.onclick = () => { modal.remove(); overlay.remove(); };
  
  document.getElementById('startQuizBtn').onclick = () => {
    const qsCount = parseInt(document.getElementById('qsCount').value);
    const qsDiff = document.getElementById('qsDiff').value;
    const qsTimer = parseInt(document.getElementById('qsTimer').value);
    const qsLang = document.getElementById('qsLang').value;
    
    modal.remove();
    overlay.remove();
    
    generateQuizForNode(id, content, { qsCount, qsDiff, qsTimer, qsLang });
  };
}

async function fetchQuizFromAI(content, settings = { qsCount: 25, qsDiff: "Medium", qsLang: "English" }) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return null;
  }

  if (APP_CONFIG.dev && APP_CONFIG.dev.mockAIQuizResponse) {
    return new Promise(resolve => {
      setTimeout(() => {
        const mockQuestions = [];
        for (let i = 1; i <= settings.qsCount; i++) {
          mockQuestions.push({
            question: { en: `This is mock question ${i} generated for testing.`, hi: `यह परीक्षण के लिए उत्पन्न मॉक प्रश्न ${i} है।` },
            options: { en: [`Option A for Q${i}`, `Option B for Q${i}`, `Option C for Q${i}`, `Option D for Q${i}`], hi: [`प्रश्न ${i} के लिए विकल्प ए`, `प्रश्न ${i} के लिए विकल्प बी`, `प्रश्न ${i} के लिए विकल्प सी`, `प्रश्न ${i} के लिए विकल्प डी`] },
            answer: i % 4,
            explanation: { en: `This is a mock explanation for question ${i}. Option ${String.fromCharCode(65 + (i % 4))} is the correct answer.`, hi: `यह प्रश्न ${i} का स्पष्टीकरण है। विकल्प ${String.fromCharCode(65 + (i % 4))} सही उत्तर है।` },
            pyq: i % 3 === 0 ? `SSC-202${i % 10}` : ""
          });
        }
        resolve(mockQuestions);
      }, 1500); // 1.5s delay to simulate network request
    });
  }

  const promptText = `Generate a ${settings.qsCount}-question multiple choice quiz based on the following mind map structure, detailed notes, and previous year question (PYQ) tags. Prioritize generating questions for topics that have PYQ tags.
The difficulty level should be ${settings.qsDiff}.
You must provide the quiz (questions, options, and explanations) in BOTH English and Hindi.
If a question is based on a PYQ of an Indian govt exam (or any exam mentioned in the tags), include the exam name and year in the "pyq" field.
Return ONLY a valid JSON array of objects with this exact structure:
[{"question": {"en": "...", "hi": "..."}, "options": {"en": ["...", "...", "...", "..."], "hi": ["...", "...", "...", "..."]}, "answer": 0, "explanation": {"en": "...", "hi": "..."}, "pyq": "Exam name and year if applicable, else empty string"}] // answer is the 0-based index of the correct option. Do NOT wrap in markdown code blocks.

Mind Map Content:
${content}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.7 }
      })
    });

    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) {
        throw new Error("INVALID_KEY_" + response.status);
      }
      throw new Error("API request failed with status: " + response.status);
    }
    
    const data = await response.json();
    let contentStr = data.candidates[0].content.parts[0].text;
    contentStr = contentStr.replace(/```json/g, '').replace(/```/g, '').trim(); // Prevent LLM formatting issues
    return JSON.parse(contentStr);
  } catch (err) {
    if (err.message.startsWith("INVALID_KEY_")) {
      const status = err.message.split("_")[2];
      localStorage.removeItem('googleApiKey');
      const loadingOverlay = document.getElementById('aiQuizLoadingOverlay');
      if (loadingOverlay) loadingOverlay.style.display = 'none';

      let errorMessage = `API Error (${status}): `;
      if (status === '429') {
        errorMessage += 'API quota exceeded. ';
      } else {
        errorMessage += 'The API key is invalid or expired. ';
      }
      errorMessage += 'Please provide a new API key.';
      alert(errorMessage);

      const newKey = await promptForApiKey();
      if (loadingOverlay && newKey) loadingOverlay.style.display = 'flex';
      
      if (newKey) {
        return await fetchQuizFromAI(content, settings);
      }
      return null;
    }
    alert("Error generating quiz: " + err.message);
    return null;
  }
}

async function generateQuizForNode(id, content, settings = { qsCount: 25, qsDiff: "Medium", qsTimer: 600, qsLang: "English" }) {
  if (!content) {
    const node = find(currentMap, id);
    if (!node) return;
    content = extractTextForQuiz(node);
    if (!content || content.length < 10) {
      alert("Not enough text content in this branch to generate a quiz.");
      return;
    }
  }

  showFlashMessage("🤖 Generating Quiz from AI...");
  
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'aiQuizLoadingOverlay';
  loadingOverlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;flex-direction:column;justify-content:center;align-items:center;color:white;";
  loadingOverlay.innerHTML = `
    <style>
      @keyframes aiQuizSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
    <div style="width:50px;height:50px;border:5px solid rgba(255,255,255,0.3);border-top:5px solid #ffffff;border-radius:50%;animation:aiQuizSpin 1s linear infinite;margin-bottom:16px;"></div>
    <div style="font-size:18px;font-weight:bold;">Generating Quiz...</div>
    <div style="font-size:14px;margin-top:8px;opacity:0.8;">Please wait while AI analyzes your notes.</div>
  `;
  document.body.appendChild(loadingOverlay);

  const quizData = await fetchQuizFromAI(content, settings);
  
  if (loadingOverlay) loadingOverlay.remove();
  
  if (quizData && Array.isArray(quizData)) {
    const defaultLang = settings.qsLang === "Hindi" ? "hi" : "en";
    
    // Auto-save generated quiz
    const node = find(currentMap, id);
    const baseName = `${currentMap.text} - ${node ? node.text : 'Quiz'}`;
    let quizName = baseName;
    const existingQuizzes = await listQuizzes();
    let counter = 1;
    while (existingQuizzes.some(q => q.name.trim().toLowerCase() === quizName.trim().toLowerCase())) {
      quizName = `${baseName} (${counter})`;
      counter++;
    }

    const newQuizId = uid();
    const quizExport = {
      quizName: quizName,
      mapName: currentMap.text,
      score: `0/${quizData.length}`,
      timerSeconds: settings.qsTimer,
      questions: quizData
    };
    await saveQuiz(newQuizId, quizName, quizExport);
    showFlashMessage("✅ Quiz automatically saved!");
    refreshQuizSelector();

    showAIQuizModal(quizData, false, newQuizId, settings.qsTimer, id, defaultLang, quizName);
  }
}

async function showAIQuizModal(quizData, isRetake = false, savedQuizId = null, timerSeconds = 600, nodeId = null, defaultLang = 'en', quizTitle = null) {
  const existing = document.getElementById('aiQuizModal');
  const existingOverlay = document.getElementById('aiQuizOverlay');
  if (existing) existing.remove();
  if (existingOverlay) existingOverlay.remove();

  // Shuffle for retakes
  if (isRetake) {
    showFlashMessage("🔄 Shuffling questions for a new attempt!");
    // Shuffle questions
    for (let i = quizData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [quizData[i], quizData[j]] = [quizData[j], quizData[i]];
    }
    // Shuffle options
    quizData.forEach(q => {
        if (Array.isArray(q.options)) {
            const correctAnswerText = q.options[q.answer];
            for (let i = q.options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
            }
            q.answer = q.options.findIndex(opt => opt === correctAnswerText);
        } else if (q.options && q.options.en && q.options.hi) {
            const correctAnswerText = q.options.en[q.answer];
            for (let i = q.options.en.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [q.options.en[i], q.options.en[j]] = [q.options.en[j], q.options.en[i]];
                [q.options.hi[i], q.options.hi[j]] = [q.options.hi[j], q.options.hi[i]];
            }
            q.answer = q.options.en.findIndex(opt => opt === correctAnswerText);
        }
    });
  }

  const overlay = document.createElement('div');
  overlay.id = 'aiQuizOverlay';
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99998;";
  document.body.appendChild(overlay);

  const modal = document.createElement('div');
  modal.id = 'aiQuizModal';
  modal.className = "note-editor ai-quiz-wrapper"; 
  modal.setAttribute("data-lang", defaultLang);
  modal.style.cssText = "position:fixed;width:90%;max-width:700px;z-index:99999;max-height:85vh;display:flex;flex-direction:column;padding:0;box-sizing:border-box;cursor:default;overflow:hidden;";

  let currentQuestionIndex = 0;
  let isSubmitted = false;

  const renderDualLang = (obj, field) => {
    if (typeof obj[field] === 'string' || Array.isArray(obj[field])) {
      return `<span class="lang-en">${escapeHtml(obj[field])}</span><span class="lang-hi">${escapeHtml(obj[field])}</span>`;
    }
    if (obj[field] && typeof obj[field] === 'object') {
      return `<span class="lang-en">${escapeHtml(obj[field].en || '')}</span><span class="lang-hi">${escapeHtml(obj[field].hi || '')}</span>`;
    }
    return '';
  };

  const renderDualLangOpt = (q, j) => {
    if (Array.isArray(q.options)) {
      return `<span class="lang-en">${escapeHtml(q.options[j])}</span><span class="lang-hi">${escapeHtml(q.options[j])}</span>`;
    }
    if (q.options && q.options.en && q.options.hi) {
      return `<span class="lang-en">${escapeHtml(q.options.en[j] || '')}</span><span class="lang-hi">${escapeHtml(q.options.hi[j] || '')}</span>`;
    }
    return '';
  };

  const getCorrectOptHtml = (q) => {
    if (Array.isArray(q.options)) return escapeHtml(q.options[q.answer]);
    return `<span class="lang-en">${escapeHtml(q.options.en[q.answer])}</span><span class="lang-hi">${escapeHtml(q.options.hi[q.answer])}</span>`;
  };

  let displayTitle = quizTitle || (quizData && quizData.quizName) || '';
  if (!displayTitle && savedQuizId) {
    try {
      const loaded = await loadQuiz(savedQuizId);
      if (loaded) displayTitle = loaded.quizName || loaded.mapName || `${currentMap ? currentMap.text : 'Quiz'}`;
    } catch (e) {
      displayTitle = displayTitle || `${currentMap ? currentMap.text : 'Quiz'}`;
    }
  }
  displayTitle = displayTitle || '🤖 AI Generated Quiz';

  let html = `
  <style>
    .ai-quiz-wrapper[data-lang="en"] .lang-hi { display: none !important; }
    .ai-quiz-wrapper[data-lang="hi"] .lang-en { display: none !important; }
  </style>
  <div class="note-editor-header" style="padding:20px; border-bottom:1px solid rgba(128,128,128,0.2); font-size:18px; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
    <div style="display:flex; align-items:center; gap:12px;">
      <span id="aiQuizTitle">${escapeHtml(displayTitle)}</span>
      <button id="toggleQuizLangBtn" style="background:transparent; border:1px solid #d1d5db; border-radius:4px; padding:4px 8px; font-size:12px; cursor:pointer; color:inherit;">
        🌐 Translate
      </button>
    </div>
    <span id="aiQuizTimer" style="color:#ef4444; font-weight:bold; font-size:16px;">
      ${timerSeconds > 0 ? Math.floor(timerSeconds/60).toString().padStart(2,'0') + ':' + (timerSeconds%60).toString().padStart(2,'0') : 'Untimed'}
    </span>
  </div>
  <div style="padding:12px 20px; border-bottom:1px solid rgba(128,128,128,0.15); display:flex; flex-wrap:wrap; gap:6px; max-height:120px; overflow-y:auto; flex-shrink:0;" id="quizNavGrid">
    ${quizData.map((_, i) => `<button class="quiz-nav-btn ${i === 0 ? 'active visited' : ''}" data-index="${i}">${i + 1}</button>`).join('')}
  </div>
  <div style="padding:20px; overflow-y:auto; flex:1; min-height:0;">`;

  quizData.forEach((q, i) => {
    const pyqSuffix = q.pyq ? ` <span class="quiz-pyq-tag">(${escapeHtml(q.pyq)})</span>` : '';
    const numOptions = Array.isArray(q.options) ? q.options.length : (q.options?.en?.length || 4);
    html += `<div class="quiz-question-container" id="quiz-q-container-${i}" style="display: ${i === 0 ? 'block' : 'none'}; margin-bottom:10px;">
      <p style="margin-top:0; margin-bottom:14px; font-weight:600; font-size:15px; line-height:1.5;">Q${i+1}: ${renderDualLang(q, 'question')}${pyqSuffix}</p>
      ${Array.from({ length: numOptions }).map((_, j) => `
        <label style="display:flex; align-items:flex-start; gap:8px; margin-bottom:10px; cursor:pointer; padding:6px; border-radius:6px; transition:background 0.2s;" class="quiz-opt-label">
          <input type="radio" name="q${i}" value="${j}" style="margin-top:2px;"> <span style="font-size:14px; line-height:1.4;">${renderDualLangOpt(q, j)}</span>
        </label>
      `).join('')}
      <div class="feedback" id="feedback-q${i}" style="display:none; font-size:13px; font-weight:bold; margin-top:8px;"></div>
      <div class="explanation" id="explanation-q${i}" style="display:none; font-size:13px; margin-top:8px; padding: 10px; background: #f0fdf4; border-left: 4px solid #22c55e; color: #15803d; border-radius: 4px; line-height:1.5;"></div>
    </div>`;
  });

  html += `</div>
  <div class="note-editor-actions" style="margin-top:0; padding:16px 20px; border-top:1px solid rgba(128,128,128,0.2); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; flex-shrink:0;">
    <div style="display:flex; gap:8px;">
      <button class="cancel" id="prevQuizBtn" disabled>◀ Prev</button>
      <button class="cancel" id="nextQuizBtn" ${quizData.length <= 1 ? 'disabled' : ''}>Next ▶</button>
    </div>
    <div id="quizActionButtons" style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
      ${savedQuizId ? `<button class="cancel" id="deleteAiQuizBtn" style="background:#fee2e2; color:#ef4444; border-color:#fca5a5;">🗑️ Delete</button>` : ''}
      <button class="cancel" id="exportAiQuizBtn" style="background:#10b981; border-color:#059669; color:white;">⬇️ Export</button>
      <button class="cancel" id="closeAiQuizBtn">Close</button>
      <button class="save" id="submitAiQuizBtn">Submit</button>
    </div>
  </div>
  `;

  modal.innerHTML = html;
  document.body.appendChild(modal);
  
  const toggleQuizLangBtn = document.getElementById('toggleQuizLangBtn');
  if (toggleQuizLangBtn) {
    toggleQuizLangBtn.onclick = () => {
      const current = modal.getAttribute("data-lang");
      modal.setAttribute("data-lang", current === "en" ? "hi" : "en");
    };
  }

  const nodeEl = nodeId ? document.querySelector(`.node[data-id="${nodeId}"]`) : null;
  if (nodeEl) {
    const rect = nodeEl.getBoundingClientRect();
    let left = rect.right + 12;
    let top = rect.top;
    let arrowClass = "arrow-left";

    const boxWidth = 550;
    const minRequiredHeight = 450; // Minimum desired height for the quiz to look good

    if (left + boxWidth > window.innerWidth) {
      left = rect.left - boxWidth - 12;
      arrowClass = "arrow-right";
    }
    if (left < 10) { left = 10; arrowClass = "arrow-left"; }
    
    if (top + minRequiredHeight > window.innerHeight) {
      top = window.innerHeight - minRequiredHeight - 10;
    }
    if (top < 10) { top = 10; }

    modal.classList.add(arrowClass);
    modal.style.left = left + "px";
    modal.style.top = top + "px";
    modal.style.maxHeight = `calc(100vh - ${top}px - 10px)`; // Enforces boundary
  } else {
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    modal.style.maxHeight = "85vh";
  }

  // Pagination Update Logic
  function updateQuizView() {
    modal.querySelectorAll('.quiz-question-container').forEach((el, i) => {
      el.style.display = i === currentQuestionIndex ? 'block' : 'none';
    });
    modal.querySelectorAll('.quiz-nav-btn').forEach((btn, i) => {
      if (i === currentQuestionIndex) {
        btn.classList.add('active');
        if (!isSubmitted) {
          btn.classList.add('visited');
        }
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } else {
        btn.classList.remove('active');
      }
    });
    document.getElementById('prevQuizBtn').disabled = currentQuestionIndex === 0;
    document.getElementById('nextQuizBtn').disabled = currentQuestionIndex === quizData.length - 1;
  }

  // Bind Navigation Events
  document.getElementById('prevQuizBtn').onclick = () => {
    if (currentQuestionIndex > 0) { currentQuestionIndex--; updateQuizView(); }
  };
  document.getElementById('nextQuizBtn').onclick = () => {
    if (currentQuestionIndex < quizData.length - 1) { currentQuestionIndex++; updateQuizView(); }
  };
  modal.querySelectorAll('.quiz-nav-btn').forEach(btn => {
    btn.onclick = () => {
      currentQuestionIndex = parseInt(btn.dataset.index);
      updateQuizView();
    };
  });

  // Mark as Answered on Click
  modal.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (isSubmitted) return;
      const qIndex = parseInt(e.target.name.substring(1));
      const btn = modal.querySelector(`.quiz-nav-btn[data-index="${qIndex}"]`);
      if (btn && !btn.classList.contains('answered')) btn.classList.add('answered');
    });
  });

  const bindExport = (scoreText) => {
    const exportBtn = document.getElementById('exportAiQuizBtn');
    if (exportBtn) {
      exportBtn.onclick = async () => {
        showFlashMessage("⬇️ Exporting Quiz JSON...");
        
        let exportName = currentMap.text ? safeName(currentMap.text) + "_Quiz" : "Quiz";
        let actualQuizName = currentMap.text ? `${currentMap.text} - Quiz` : "Quiz";
        
        if (savedQuizId) {
          const existingQuizzes = await listQuizzes();
          const existing = existingQuizzes.find(q => q.id === savedQuizId);
          if (existing && existing.name) {
            exportName = safeName(existing.name);
            actualQuizName = existing.name;
          }
        }

        const quizExport = {
          quizName: actualQuizName,
          mapName: currentMap.text,
          score: scoreText,
          timerSeconds: timerSeconds,
          questions: quizData
        };
        const b = new Blob([JSON.stringify(quizExport, null, 2)], {type: "application/json"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `${exportName}.json`;
        a.click();
      };
    }
  };
  bindExport("Not submitted");

  let timeLeft = timerSeconds;
  let timerInterval = null;
  let isTimeUp = false;
  
  if (timeLeft > 0) {
    timerInterval = setInterval(() => {
      timeLeft--;
      const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
      const s = (timeLeft % 60).toString().padStart(2, '0');
      const timerEl = document.getElementById('aiQuizTimer');
      if (timerEl) timerEl.textContent = `${m}:${s}`;
      
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        isTimeUp = true;
        document.getElementById('submitAiQuizBtn').click();
        alert("Time is up! Your answers have been automatically submitted.");
      }
    }, 1000);
  }

  document.getElementById('closeAiQuizBtn').onclick = () => {
    if (timerInterval) clearInterval(timerInterval);
    modal.remove();
    overlay.remove();
  };

  if (savedQuizId) {
    document.getElementById('deleteAiQuizBtn').onclick = async () => {
      if (confirm("Are you sure you want to delete this saved quiz?")) {
        await deleteQuizDB(savedQuizId);
        if (timerInterval) clearInterval(timerInterval);
        modal.remove();
        overlay.remove();
        refreshQuizSelector();
        showFlashMessage("🗑️ Quiz deleted successfully!");
      }
    };
  }
  
  document.getElementById('submitAiQuizBtn').onclick = () => {
    if (!isTimeUp && !confirm("Are you sure you want to submit your answers?")) return;
    
    if (timerInterval) clearInterval(timerInterval);
    isSubmitted = true;
    let score = 0;
    
    quizData.forEach((q, i) => {
      const selected = document.querySelector(`input[name="q${i}"]:checked`);
      const feedback = document.getElementById(`feedback-q${i}`);
      const explanationDiv = document.getElementById(`explanation-q${i}`);
      const navBtn = modal.querySelector(`.quiz-nav-btn[data-index="${i}"]`);
      
      navBtn.classList.remove('answered');
      
      q.userAnswer = selected ? parseInt(selected.value) : null;

      // Highlight the correct option in green
      const correctRadio = document.querySelector(`input[name="q${i}"][value="${q.answer}"]`);
      if (correctRadio && correctRadio.parentElement) {
        correctRadio.parentElement.style.background = '#d1fae5'; // green background
        correctRadio.parentElement.style.color = '#065f46';
        correctRadio.parentElement.style.fontWeight = 'bold';
      }

      if (!selected) {
        feedback.style.display = 'block';
        feedback.innerHTML = `⚠️ <span class="lang-en">Please select an answer.</span><span class="lang-hi">कृपया एक उत्तर चुनें।</span> (Correct: ${getCorrectOptHtml(q)})`;
        feedback.style.color = '#f59e0b'; // orange
        navBtn.classList.add('unattempted'); // counts as wrong but visualizes as unattempted
      } else if (parseInt(selected.value) === q.answer) {
        feedback.style.display = 'none';
        score++;
        navBtn.classList.add('correct');
      } else {
        feedback.style.display = 'none';
        
        // Strike through the incorrect selection in red
        selected.parentElement.style.color = '#ef4444';
        selected.parentElement.style.textDecoration = 'line-through';
        navBtn.classList.add('wrong');
      }

      // Show explanation
      if (q.explanation) {
        const explanationText = renderDualLang(q, 'explanation');
        if (explanationText) {
          explanationDiv.innerHTML = `💡 <strong><span class="lang-en">Explanation</span><span class="lang-hi">व्याख्या</span>:</strong> ${explanationText}`;
          explanationDiv.style.display = 'block';
        }
      }
      
      // Disable radios
      modal.querySelectorAll(`input[name="q${i}"]`).forEach(r => r.disabled = true);
    });
    
    const header = modal.querySelector('.note-editor-header');
    header.innerHTML = `<div style="display:flex; align-items:center; gap:12px;">
      <span>Quiz Results (Score: ${score}/${quizData.length})</span>
      <button id="toggleQuizLangBtn" style="background:transparent; border:1px solid #d1d5db; border-radius:4px; padding:4px 8px; font-size:12px; cursor:pointer; color:inherit;">
        🌐 Translate
      </button>
    </div>
    <span id="aiQuizTimer" style="color:#6b7280; font-weight:normal; font-size:16px;">Finished</span>`;
    
    document.getElementById('toggleQuizLangBtn').onclick = () => {
      const current = modal.getAttribute("data-lang");
      modal.setAttribute("data-lang", current === "en" ? "hi" : "en");
    };

    // Jump to the first incorrectly answered question or back to start
    currentQuestionIndex = 0;
    updateQuizView();

    const actionsDiv = document.getElementById('quizActionButtons');
    actionsDiv.innerHTML = `
      ${savedQuizId ? `<button class="cancel" id="deleteAiQuizBtn" style="background:#fee2e2; color:#ef4444; border-color:#fca5a5;">🗑️ Delete</button>` : ''}
      <button class="cancel" id="exportAiQuizBtn" style="background:#10b981; border-color:#059669; color:white;">⬇️ Export</button>
      <button class="cancel" id="closeAiQuizBtn">Close</button>
      <button class="save" id="retakeAiQuizBtn">🔄 Retake</button>
    `;

    bindExport(`${score}/${quizData.length}`);

    if (savedQuizId) {
      document.getElementById('deleteAiQuizBtn').onclick = async () => {
        if (confirm("Are you sure you want to delete this saved quiz?")) {
          await deleteQuizDB(savedQuizId);
          modal.remove();
          overlay.remove();
          refreshQuizSelector();
          showFlashMessage("🗑️ Quiz deleted successfully!");
        }
      };
    }

    document.getElementById('closeAiQuizBtn').onclick = () => {
      modal.remove();
      overlay.remove();
    };
    document.getElementById('retakeAiQuizBtn').onclick = async () => {
      const currentLang = modal.getAttribute("data-lang") || 'en';
      modal.remove();
      overlay.remove();
      let title = null;
      if (savedQuizId) {
        try {
          const existing = await loadQuiz(savedQuizId);
          if (existing) title = existing.quizName || existing.mapName || (currentMap ? `${currentMap.text} - Quiz` : 'Quiz');
        } catch (e) {
          // ignore
        }
      }
      showAIQuizModal(JSON.parse(JSON.stringify(quizData)), true, savedQuizId, timerSeconds, nodeId, currentLang, title);
    };

  };
}

/* ================= PREVENT ACCIDENTAL REFRESH ================= */
window.addEventListener('beforeunload', function (e) {
  if (document.getElementById('aiQuizModal')) {
    e.preventDefault();
    e.returnValue = '';
  }
});
