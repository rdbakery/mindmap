
/* ================= UTIL ================= */
let focusedNodeId = null;
let searchQuery = "";


const uid = () => Math.random().toString(36).slice(2);
const clone = o => JSON.parse(JSON.stringify(o));
const safeName = n => (n||"mindmap").replace(/[<>:"/\\|?*]+/g,"").replace(/\s+/g,"_");

/* ===== Node Color by Level ===== */
function nodeColor(depth) {
  const palette = [
  "#afacd6", // soft blue-violet
  "#8bb3d9", // pastel blue
  "#6fa1ac", // blue-teal
  "#72b9b3", // pastel teal
  "#8fbea6", // pastel green

  "#a8e2d6", // mint-teal
  "#b3e2a2",  // leaf green
  "#b8e4cb", // airy mint
  
  
  "#b3e1f2", // airy sky-blue
  "#8aeac1", // fresh light green

  
  
  "#b7d6c6", // soft sage
  "#ccd9b7", // sage pastel

];



  return palette[Math.min(depth, palette.length - 1)];
}

function searchNodes(q){
  searchQuery = q.toLowerCase();
  render();
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
  const maps=await listMaps();
  if(!maps.length){
    activeId=uid();
    currentMap={
  id: activeId,
  text: "Untitled Map",
  collapsed: false,
  important: false,
  note: "", 
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

function editNote(id){
  const node = find(currentMap, id);
  const note = prompt("Node note / description:", node.note || "");
  if (note !== null) {
    pushHistory();
    node.note = note.trim();
    render();
  }
}



mapSelector.onchange = async e => {
  activeId = e.target.value;
  currentMap = await loadMap(activeId);
  undoStack = [];
  redoStack = [];
  allCollapsed = false; // ✅ reset icon state
  render();
};


async function createMap(){
  const n=prompt("Map name"); if(!n) return;
  activeId=uid();
  currentMap={id:activeId,text:n,collapsed:false,children:[]};
  undoStack=[]; redoStack=[];
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


let dragNodeId = null;




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
  const node = find(currentMap, id);
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
  children: []
});

  render();
}
function editNode(id){
  const nodeEl = document.querySelector(`[data-id="${id}"]`);
  if(!nodeEl) return;

  const span = nodeEl.querySelector(".node-text");
  const oldText = span.textContent;

  pushHistory();

  span.contentEditable = "true";
  span.focus();

  const range = document.createRange();
  range.selectNodeContents(span);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function finish(save){
    span.contentEditable = "false";
    span.removeEventListener("keydown", onKey);
    span.removeEventListener("blur", onBlur);

    if(save){
      const n = find(currentMap,id);
      n.text = span.textContent.trim() || oldText;
    } else {
      span.textContent = oldText;
    }
    render();
  }

  function onKey(e){
    if(e.key === "Enter"){
      e.preventDefault();
      finish(true);
    }
    if(e.key === "Escape"){
      finish(false);
    }
  }

  function onBlur(){
    finish(true);
  }

  span.addEventListener("keydown", onKey);
  span.addEventListener("blur", onBlur);
}

function toggleNode(id){
  pushHistory();
  find(currentMap, id).collapsed ^= true;
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
async function render(){
  document.querySelectorAll(".node, .connector-toggle").forEach(el => el.remove());
  svg.innerHTML="";

  computeH(currentMap);
  layout(currentMap,80,currentMap._h/2+40);
  draw(currentMap,0);

  measureNodes();

  document.querySelectorAll(".node, .connector-toggle").forEach(el => el.remove());
  svg.innerHTML="";

  computeH(currentMap);
  layout(currentMap,80,currentMap._h/2+40);
  resize(currentMap);
  draw(currentMap,0);

  await saveMap(activeId,currentMap.text,currentMap);

    const btn = document.getElementById("toggleAllBtn");
  if (btn) {
    btn.classList.toggle("expand", allCollapsed);
  }
}


function draw(n, depth){
const el = document.createElement("div");




el.className =
  "node" +
  (n.important ? " important" : "") +
  (n.note ? " has-note" : "") +
  (searchQuery && n.text.toLowerCase().includes(searchQuery)
    ? " search-hit"
    : "");

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
    <span class="node-text">${n.text}</span>
  </div>
  <button class="menu-btn">⋮</button>
`;

  const m = document.createElement("div");
  m.className = "menu";
  m.innerHTML = `
    <button onclick="addChild('${n.id}')">➕ Add</button>
    <button onclick="editNode('${n.id}')">✏️ Edit</button>
    <button onclick="toggleImportant('${n.id}')">${n.important ? "⭐ Remove Important" : "⭐ Mark Important"}</button>
    <button onclick="toggleFocus('${n.id}')">${focusedNodeId === n.id ? "Exit focus" : "Focus"}</button>
    <button onclick="editNote('${n.id}')">Add note</button>
    <button onclick="deleteNode('${n.id}')">🗑 Delete</button>
  `;

  h.querySelector("button").onclick = e => {
    e.stopPropagation();
    closeMenus();
    m.style.display = "block";
  };

  el.onclick = e => {
    e.stopPropagation();
    closeMenus();
  };

  el.append(h, m);

if (n.note) {
  const noteIcon = document.createElement("div");
  noteIcon.className = "note-icon";
  noteIcon.textContent = "📝";

  const noteEl = document.createElement("div");
  noteEl.className = "node-note";
  noteEl.textContent = n.note;

  noteIcon.appendChild(noteEl);
  el.appendChild(noteIcon);
}


  canvas.appendChild(el);

  /* ===== Toggle ===== */
  if (n.children.length && n._realW) {
    const toggle = document.createElement("div");
    toggle.className = "connector-toggle";
    toggle.textContent = n.collapsed ? ">" : "<";

    toggle.style.left = (n._x + n._realW + 8) + "px";
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
    const node = find(currentMap, id);
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
