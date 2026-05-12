const workspace = document.querySelector("#workspace");
const canvasWrap = document.querySelector("#canvasWrap");
const canvas = document.querySelector("#canvas");
const edgesLayer = document.querySelector("#edgesLayer");
const zoomLabel = document.querySelector("#zoomLabel");
const titleInput = document.querySelector("#titleInput");
const typeInput = document.querySelector("#typeInput");
const customTypeLabel = document.querySelector("#customTypeLabel");
const customTypeInput = document.querySelector("#customTypeInput");
const colorInput = document.querySelector("#colorInput");
const stateLabel = document.querySelector("#stateLabel");
const nodeStateInput = document.querySelector("#nodeStateInput");
const scratchButton = document.querySelector("#scratchButton");
const imageLabel = document.querySelector("#imageLabel");
const imageInput = document.querySelector("#imageInput");
const clearImageButton = document.querySelector("#clearImageButton");
const noteInput = document.querySelector("#noteInput");
const fitViewButton = document.querySelector("#fitView");
const saveAtlasButton = document.querySelector("#saveAtlasButton");
const saveAsAtlasButton = document.querySelector("#saveAsAtlasButton");
const loadAtlasButton = document.querySelector("#loadAtlasButton");
const atlasLoadInput = document.querySelector("#atlasLoadInput");
const addImageButton = document.querySelector("#addImageButton");
const autoLayoutButton = document.querySelector("#autoLayoutButton");
const gridVisibleButton = document.querySelector("#gridVisibleButton");
const alignAssistButton = document.querySelector("#alignAssistButton");
const flowDirectionInput = document.querySelector("#flowDirectionInput");
const looseImageInput = document.querySelector("#looseImageInput");
const gridSizeInput = document.querySelector("#gridSizeInput");
const undoButton = document.querySelector("#undoButton");
const redoButton = document.querySelector("#redoButton");
const historyList = document.querySelector("#historyList");
const linksPreview = document.querySelector("#linksPreview");
const inspectorToggle = document.querySelector("#inspectorToggle");
const inspectorPeek = document.querySelector("#inspectorPeek");
const pageTabs = document.querySelector("#pageTabs");
const toolButtons = [...document.querySelectorAll(".tool-button")];

const nodeMin = { w: 150, h: 82 };
const groupMin = { w: 180, h: 130 };
const imageMin = { w: 80, h: 60 };
const autosaveKey = "nodal-atlas-autosave";
let lastSaveName = "nodal-atlas";

const state = {
  tool: "select",
  nodes: [
    { id: "n1", x: 130, y: 160, w: 210, h: 106, title: "Atlas Core Hub", type: "system", customType: "", color: "mint", image: "", imageH: 96, note: "Central navigation hub for world modules.", state: "pinned", scratch: false },
    { id: "n2", x: 430, y: 90, w: 210, h: 106, title: "Faction Systems", type: "feature", customType: "", color: "blue", image: "", imageH: 96, note: "Political bodies, AI governance, alliances.", state: "normal", scratch: false },
    { id: "n3", x: 430, y: 250, w: 210, h: 106, title: "Tech Dependency Mesh", type: "idea", customType: "", color: "violet", image: "", imageH: 96, note: "Dependencies between energy, ships, portals.", state: "normal", scratch: false },
    { id: "n4", x: 760, y: 160, w: 220, h: 106, title: "Timeline Branch", type: "world", customType: "", color: "amber", image: "", imageH: 96, note: "Major event milestones across eras.", state: "highlighted", scratch: false },
    { id: "n5", x: 760, y: 320, w: 220, h: 106, title: "Lore Module Container", type: "custom", customType: "Module", color: "rose", image: "", imageH: 96, note: "Container node for episodic lore packets.", state: "normal", scratch: false }
  ],
  groups: [
    { id: "g1", x: 86, y: 70, w: 590, h: 360, title: "Cognitive Systems" },
    { id: "g2", x: 710, y: 120, w: 320, h: 350, title: "Lore Timeline & Modules" }
  ],
  images: [],
  edges: [
    { id: "e1", from: "n1", to: "n2", label: "navigation", color: "blue", note: "Hub navigation stream." },
    { id: "e2", from: "n1", to: "n3", label: "dependency", color: "violet", note: "Core dependency binding." },
    { id: "e3", from: "n2", to: "n4", label: "event feed", color: "amber", note: "Factions trigger timeline shifts." },
    { id: "e4", from: "n3", to: "n5", label: "module unlock", color: "rose", note: "Tech unlocks lore modules." }
  ],
  selectedIds: new Set(["n1"]),
  selectedEdgeId: null,
  edgeSourceId: null,
  pendingLinkSourceId: null,
  dragging: null,
  resizing: null,
  panning: null,
  editingTitleId: null,
  space: false,
  gridSize: 5,
  gridVisible: true,
  alignAssist: false,
  flowDirection: "forward",
  currentPageId: "page1",
  pages: [],
  view: { x: 260, y: 130, scale: 1 },
  history: [],
  historyIndex: -1
};

state.pages = [{
  id: "page1",
  title: "Sheet 1",
  nodes: structuredClone(state.nodes),
  groups: structuredClone(state.groups),
  images: structuredClone(state.images),
  edges: structuredClone(state.edges),
  view: structuredClone(state.view)
}];

let renderQueued = false;
let lastMiniMapMode = state.view.scale < 0.15;

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    if (state.panning && !state.dragging && !state.resizing) {
      applyView();
      renderNodes();
    } else {
      fastRender();
    }
  });
}

function snapshot() {
  return {
    nodes: structuredClone(state.nodes),
    groups: structuredClone(state.groups),
    images: structuredClone(state.images),
    edges: structuredClone(state.edges),
    gridSize: state.gridSize
  };
}

function restore(model) {
  state.nodes = structuredClone(model.nodes || []);
  state.groups = structuredClone(model.groups || []);
  state.images = structuredClone(model.images || []);
  state.edges = structuredClone(model.edges || []);
  state.gridSize = Number.isFinite(model.gridSize) ? model.gridSize : state.gridSize;
  state.selectedIds = new Set([...state.selectedIds].filter((id) => itemById(id)));
  state.selectedEdgeId = state.edges.some((edge) => edge.id === state.selectedEdgeId) ? state.selectedEdgeId : null;
  state.edgeSourceId = null;
  state.editingTitleId = null;
  syncCurrentPage();
  render();
}

function pushHistory(label) {
  syncCurrentPage();
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push({ label, model: snapshot() });
  state.historyIndex = state.history.length - 1;
  renderHistory();
}

function undo() {
  if (state.historyIndex <= 0) return;
  state.historyIndex -= 1;
  restore(state.history[state.historyIndex].model);
}

function redo() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex += 1;
  restore(state.history[state.historyIndex].model);
}

function isTextEditing() {
  const tag = document.activeElement?.tagName;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(tag) || document.activeElement?.isContentEditable;
}

function setTool(tool) {
  state.tool = tool;
  state.edgeSourceId = null;
  state.pendingLinkSourceId = null;
  toolButtons.forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
  render();
}

function worldFromEvent(event) {
  const rect = canvasWrap.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - state.view.x) / state.view.scale,
    y: (event.clientY - rect.top - state.view.y) / state.view.scale
  };
}

function snapValue(value) {
  if (!state.gridSize) return value;
  return Math.round(value / state.gridSize) * state.gridSize;
}

function centerOf(item) {
  return { x: item.x + (item.w || 190) / 2, y: item.y + (item.h || 96) / 2 };
}

function intersects(a, b, gap = 18) {
  return !(
    a.x + a.w + gap < b.x ||
    b.x + b.w + gap < a.x ||
    a.y + a.h + gap < b.y ||
    b.y + b.h + gap < a.y
  );
}

function findFreeNodePosition(x, y, w, h, ignoredIds = new Set()) {
  const occupied = [...state.nodes, ...state.images]
    .filter((item) => !ignoredIds.has(item.id))
    .map((item) => ({ x: item.x, y: item.y, w: item.w || 190, h: item.h || 96 }));
  const stepX = Math.max(w + 50, 240);
  const stepY = Math.max(h + 34, 130);
  for (let ring = 0; ring < 12; ring += 1) {
    const candidates = [];
    for (let dx = 0; dx <= ring; dx += 1) {
      const dy = ring - dx;
      candidates.push([dx, dy], [dx, -dy], [-dx, dy], [-dx, -dy]);
    }
    for (const [dx, dy] of candidates) {
      const rect = { x: snapValue(x + dx * stepX), y: snapValue(y + dy * stepY), w, h };
      if (!occupied.some((other) => intersects(rect, other))) return { x: rect.x, y: rect.y };
    }
  }
  return { x: snapValue(x), y: snapValue(y + stepY * 12) };
}

function alignItemToNearest(item, movingIds) {
  if (!state.alignAssist || !item) return;
  const moving = new Set(movingIds);
  const others = [...state.nodes, ...state.groups, ...state.images].filter((candidate) => candidate.id !== item.id && !moving.has(candidate.id));
  let nearest = null;
  let nearestDistance = Infinity;
  const itemCenter = centerOf(item);
  others.forEach((candidate) => {
    const candidateCenter = centerOf(candidate);
    const distance = Math.hypot(candidateCenter.x - itemCenter.x, candidateCenter.y - itemCenter.y);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  });
  if (!nearest || nearestDistance > 160) return;
  const target = centerOf(nearest);
  const dx = Math.abs(target.x - itemCenter.x);
  const dy = Math.abs(target.y - itemCenter.y);
  if (dx < 12) item.x = snapValue(target.x - (item.w || 190) / 2);
  if (dy < 12) item.y = snapValue(target.y - (item.h || 96) / 2);
}

function nodeById(id) {
  return state.nodes.find((node) => node.id === id);
}

function groupById(id) {
  return state.groups.find((group) => group.id === id);
}

function imageById(id) {
  return state.images.find((image) => image.id === id);
}

function itemById(id) {
  return nodeById(id) || groupById(id) || imageById(id);
}

function selectedItems() {
  return [...state.selectedIds].map(itemById).filter(Boolean);
}

function selectedItem() {
  const items = selectedItems();
  return items.length === 1 ? items[0] : null;
}

function selectOnly(id) {
  state.selectedIds = new Set(id ? [id] : []);
  state.selectedEdgeId = null;
}

function toggleSelected(id) {
  state.selectedEdgeId = null;
  state.selectedIds.has(id) ? state.selectedIds.delete(id) : state.selectedIds.add(id);
}

function edgeById(id) {
  return state.edges.find((edge) => edge.id === id);
}

function selectedEdge() {
  return state.selectedEdgeId ? edgeById(state.selectedEdgeId) : null;
}

function selectEdge(id) {
  state.selectedIds.clear();
  state.selectedEdgeId = id;
  state.edgeSourceId = null;
}

function currentPage() {
  return state.pages.find((page) => page.id === state.currentPageId);
}

function syncCurrentPage() {
  const page = currentPage();
  if (!page) return;
  page.nodes = structuredClone(state.nodes);
  page.groups = structuredClone(state.groups);
  page.images = structuredClone(state.images);
  page.edges = structuredClone(state.edges);
  page.view = structuredClone(state.view);
}

function loadPage(pageId) {
  const page = state.pages.find((item) => item.id === pageId);
  if (!page || page.id === state.currentPageId) return;
  syncCurrentPage();
  state.currentPageId = page.id;
  state.nodes = structuredClone(page.nodes || []);
  state.groups = structuredClone(page.groups || []);
  state.images = structuredClone(page.images || []);
  state.edges = structuredClone(page.edges || []);
  state.view = structuredClone(page.view || { x: 260, y: 130, scale: 1 });
  state.selectedIds.clear();
  state.selectedEdgeId = null;
  state.edgeSourceId = null;
  state.history = [];
  state.historyIndex = -1;
  pushHistory(`Page ${page.title}`);
  render();
}

function addPage() {
  syncCurrentPage();
  const index = state.pages.length + 1;
  const page = {
    id: `page${Date.now()}`,
    title: `Sheet ${index}`,
    nodes: [],
    groups: [],
    images: [],
    edges: [],
    view: { x: 260, y: 130, scale: 1 }
  };
  state.pages.push(page);
  state.currentPageId = page.id;
  state.nodes = [];
  state.groups = [];
  state.images = [];
  state.edges = [];
  state.view = structuredClone(page.view);
  state.selectedIds.clear();
  state.selectedEdgeId = null;
  state.history = [];
  state.historyIndex = -1;
  pushHistory("Page created");
  render();
}

function renderPageTabs() {
  pageTabs.innerHTML = "";
  state.pages.forEach((page) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = page.title;
    button.classList.toggle("active", page.id === state.currentPageId);
    button.addEventListener("click", () => loadPage(page.id));
    button.addEventListener("dblclick", () => {
      const title = window.prompt("Page name", page.title);
      if (title) {
        page.title = title.trim() || page.title;
        renderPageTabs();
      }
    });
    pageTabs.append(button);
  });
  const add = document.createElement("button");
  add.type = "button";
  add.textContent = "+";
  add.className = "add-page";
  add.addEventListener("click", addPage);
  pageTabs.append(add);
}

function createNode(x, y) {
  const id = `n${Date.now()}`;
  state.nodes.push({
    id,
    x: snapValue(x - 95),
    y: snapValue(y - 48),
    w: 190,
    h: 96,
    title: "New Node",
    type: "idea",
    customType: "",
    color: "mint",
    image: "",
    imageH: 96,
    note: "A free thought that can be connected to the system.",
    state: "normal",
    scratch: false
  });
  selectOnly(id);
  setTool("select");
  pushHistory("Node created");
}

function createPageNode(x, y) {
  createNode(x, y);
  const node = selectedItem();
  if (node?.id?.startsWith("n")) {
    node.title = "Quick";
    node.type = "custom";
    node.customType = "quick";
    node.color = "steel";
    node.note = "";
    node.quickMode = true;
    node.state = "pinned";
    pushHistory("Quick node created");
    render();
  }
}

function commitQuickNode(templateId) {
  const template = nodeById(templateId);
  if (!template?.quickMode) return false;
  const text = (template.note || "").trim();
  if (!text) return false;
  const id = `n${Date.now()}`;
  const created = {
    id,
    x: snapValue(template.x + (template.w || 190) + 70),
    y: snapValue(template.y),
    w: template.w || 190,
    h: template.h || 96,
    title: template.title || "Quick",
    type: template.type || "idea",
    customType: template.customType || "",
    color: template.color || "steel",
    image: "",
    imageH: 96,
    note: text,
    state: "normal",
    scratch: false
  };
  const startX = template.x + (template.w || 190) + 70;
  const startY = template.y;
  const position = findFreeNodePosition(startX, startY, created.w, created.h, new Set([template.id]));
  created.x = position.x;
  created.y = position.y;
  state.nodes.push(created);
  addEdge(template.id, created.id);
  template.note = "";
  selectOnly(template.id);
  pushHistory("Quick thought committed");
  render();
  requestAnimationFrame(() => {
    const el = canvas.querySelector(`.node[data-id="${template.id}"]`);
    const note = el?.querySelector(".node-note");
    if (note) startNodeFieldEdit(template.id, "note", note);
  });
  return true;
}

function duplicateNode(id) {
  const node = nodeById(id);
  if (!node) return;
  const next = structuredClone(node);
  next.id = `n${Date.now()}`;
  next.x = snapValue(node.x + 40);
  next.y = snapValue(node.y + 40);
  next.title = `${node.title} copy`;
  state.nodes.push(next);
  selectOnly(next.id);
  pushHistory("Node duplicated");
  render();
}

function createChildNode(parentId) {
  const parent = nodeById(parentId);
  if (!parent) return;
  const id = `n${Date.now()}`;
  const child = {
    id,
    x: snapValue(parent.x + (parent.w || 190) + 90),
    y: snapValue(parent.y + 60),
    w: 190,
    h: 96,
    title: "Child",
    type: "idea",
    customType: "",
    color: parent.color || "mint",
    image: "",
    imageH: 96,
    note: "Created as a child node.",
    state: "temporary",
    scratch: false
  };
  state.nodes.push(child);
  addEdge(parentId, id);
  selectOnly(id);
  pushHistory("Child created");
  render();
}

function createGroup(x, y) {
  const id = `g${Date.now()}`;
  state.groups.push({ id, x: snapValue(x - 150), y: snapValue(y - 90), w: 320, h: 210, title: "Group" });
  selectOnly(id);
  setTool("select");
  pushHistory("Group created");
}

function createLooseImage(src, x, y) {
  const id = `i${Date.now()}`;
  state.images.push({
    id,
    x: snapValue(x - 120),
    y: snapValue(y - 80),
    w: 240,
    h: 160,
    title: "Image",
    src
  });
  selectOnly(id);
  pushHistory("Image object created");
  render();
}

function deleteItem(id) {
  state.nodes = state.nodes.filter((node) => node.id !== id);
  state.groups = state.groups.filter((group) => group.id !== id);
  state.images = state.images.filter((image) => image.id !== id);
  state.edges = state.edges.filter((edge) => edge.from !== id && edge.to !== id);
  state.selectedIds.delete(id);
}

function deleteSelected() {
  if (state.selectedEdgeId) {
    state.edges = state.edges.filter((edge) => edge.id !== state.selectedEdgeId);
    state.selectedEdgeId = null;
    pushHistory("Edge deleted");
    render();
    return;
  }
  if (!state.selectedIds.size) return;
  [...state.selectedIds].forEach(deleteItem);
  pushHistory("Deleted");
  render();
}

function addEdge(fromId, toId) {
  if (!fromId || !toId || fromId === toId || !itemById(fromId) || !itemById(toId)) return false;
  if (state.edges.some((edge) => edge.from === fromId && edge.to === toId)) return false;
  state.edges.push({ id: `e${Date.now()}${state.edges.length}`, from: fromId, to: toId, label: "", color: "blue", note: "" });
  return true;
}

function connectSelectedTo(targetId) {
  let changed = false;
  for (const sourceId of state.selectedIds) {
    if (sourceId !== targetId) changed = addEdge(sourceId, targetId) || changed;
  }
  if (changed) pushHistory("Edge created");
}

function rectOf(node) {
  const w = node.w || 190;
  const h = node.h || 96;
  return { left: node.x, right: node.x + w, top: node.y, bottom: node.y + h, cx: node.x + w / 2, cy: node.y + h / 2 };
}

function nearestPort(fromNode, toNode) {
  const from = rectOf(fromNode);
  const to = rectOf(toNode);
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? { x: from.right, y: from.cy, side: "right" } : { x: from.left, y: from.cy, side: "left" };
  }
  return dy > 0 ? { x: from.cx, y: from.bottom, side: "bottom" } : { x: from.cx, y: from.top, side: "top" };
}

function tangent(port, curve) {
  if (port.side === "left") return { x: -curve, y: 0 };
  if (port.side === "right") return { x: curve, y: 0 };
  if (port.side === "top") return { x: 0, y: -curve };
  return { x: 0, y: curve };
}

function edgePath(fromNode, toNode) {
  const start = nearestPort(fromNode, toNode);
  const end = nearestPort(toNode, fromNode);
  const curve = Math.max(58, Math.min(180, Math.hypot(end.x - start.x, end.y - start.y) * 0.34));
  const a = tangent(start, curve);
  const b = tangent(end, curve);
  return `M ${start.x} ${start.y} C ${start.x + a.x} ${start.y + a.y}, ${end.x + b.x} ${end.y + b.y}, ${end.x} ${end.y}`;
}

function edgeMidpoint(fromNode, toNode) {
  const start = nearestPort(fromNode, toNode);
  const end = nearestPort(toNode, fromNode);
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

function paletteColor(color) {
  return {
    mint: "84, 214, 165",
    blue: "122, 162, 255",
    violet: "192, 140, 255",
    amber: "244, 189, 80",
    rose: "255, 125, 155",
    steel: "168, 179, 199"
  }[color] || "122, 162, 255";
}

function displayType(node) {
  return node.type === "custom" ? node.customType || "Custom" : node.type;
}

function applyView() {
  const transform = `translate(${state.view.x}px, ${state.view.y}px) scale(${state.view.scale})`;
  canvas.style.transform = transform;
  edgesLayer.style.transform = transform;
  zoomLabel.textContent = `${Math.round(state.view.scale * 100)}%`;
  canvasWrap.style.setProperty("--grid-step", `${state.gridSize || 20}px`);
  canvasWrap.style.backgroundImage = state.gridVisible && state.gridSize
    ? ""
    : "none";
  gridSizeInput.value = String(state.gridSize);
  gridVisibleButton.classList.toggle("active", state.gridVisible);
  alignAssistButton.classList.toggle("active", state.alignAssist);
  const lowPowerMode = state.panning || state.view.scale < 0.2 || state.edges.length > 120;
  canvasWrap.classList.toggle("perf-low", Boolean(lowPowerMode));
  flowDirectionInput.value = state.flowDirection;
<<<<<<< codex/find-content-in-atlas-3.0-repo-910w9v
  const miniMapMode = state.view.scale < 0.15;
  if (miniMapMode !== lastMiniMapMode) {
    lastMiniMapMode = miniMapMode;
    renderNodes();
  }
=======
>>>>>>> main
}

function linkedCountByNodeId() {
  const map = new Map();
  for (const edge of state.edges) {
    map.set(edge.from, (map.get(edge.from) || 0) + 1);
    map.set(edge.to, (map.get(edge.to) || 0) + 1);
  }
  return map;
}

function updateInspector() {
  const item = selectedItem();
  const edge = selectedEdge();
  const isNode = item?.id?.startsWith("n");
  const isGroup = item?.id?.startsWith("g");
  const multi = selectedItems().length > 1;
  titleInput.disabled = (!item && !edge) || multi;
  typeInput.disabled = !isNode || multi;
  customTypeInput.disabled = !isNode || multi;
  colorInput.disabled = (!isNode && !edge) || multi;
  nodeStateInput.disabled = !isNode || multi;
  imageInput.disabled = !isNode || multi;
  clearImageButton.disabled = !isNode || multi || !item?.image;
  noteInput.disabled = (!isNode && !edge) || multi;
  stateLabel.classList.toggle("hidden", !isNode || multi);
  scratchButton.classList.toggle("hidden", !isNode || multi);
  imageLabel.classList.toggle("hidden", !isNode || multi);
  clearImageButton.classList.toggle("hidden", !isNode || multi);
  titleInput.value = edge ? edge.label || "" : item?.title || (multi ? `${selectedItems().length} selected` : "");
  typeInput.value = isNode ? item.type : "system";
  customTypeInput.value = isNode ? item.customType || "" : "";
  colorInput.value = edge ? edge.color || "blue" : isNode ? item.color || "mint" : "mint";
  nodeStateInput.value = isNode ? item.state || "normal" : "normal";
  scratchButton.textContent = isNode && item.scratch ? "Commit from scratch" : "Send to scratch";
  noteInput.value = edge ? edge.note || "" : isNode ? item.note : "";
  customTypeLabel.classList.toggle("hidden", !isNode || item.type !== "custom");
  if (isGroup) typeInput.value = "system";
}

function renderHistory() {
  undoButton.disabled = state.historyIndex <= 0;
  redoButton.disabled = state.historyIndex >= state.history.length - 1;
  historyList.innerHTML = "";
  state.history.forEach((entry, index) => {
    const li = document.createElement("li");
    li.textContent = entry.label;
    li.classList.toggle("current", index === state.historyIndex);
    li.addEventListener("click", () => {
      state.historyIndex = index;
      restore(state.history[index].model);
    });
    historyList.append(li);
  });
}

function renderLinksPreview() {
  const node = selectedItem();
  linksPreview.innerHTML = "";
  if (!node?.id?.startsWith("n")) return;
  const incoming = state.edges.filter((edge) => edge.to === node.id).map((edge) => itemById(edge.from)).filter(Boolean);
  const outgoing = state.edges.filter((edge) => edge.from === node.id).map((edge) => itemById(edge.to)).filter(Boolean);
  const section = (title, nodes) => {
    const wrap = document.createElement("div");
    wrap.className = "links-section";
    wrap.innerHTML = `<strong>${title}</strong>`;
    nodes.forEach((linked) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${linked.title || "Image"} · ${linked.id.startsWith("i") ? "image" : displayType(linked)}`;
      button.title = linked.note || "";
      button.addEventListener("click", () => {
        selectOnly(linked.id);
        state.view.x = canvasWrap.clientWidth / 2 - (linked.x + (linked.w || 190) / 2) * state.view.scale;
        state.view.y = canvasWrap.clientHeight / 2 - (linked.y + (linked.h || 96) / 2) * state.view.scale;
        render();
      });
      wrap.append(button);
    });
    linksPreview.append(wrap);
  };
  section("Backlinks", incoming);
  section("Outgoing", outgoing);
}

function renderEdges() {
  edgesLayer.innerHTML = "";
  for (const edge of state.edges) {
    const from = itemById(edge.from);
    const to = itemById(edge.to);
    if (!from || !to) continue;
    const rgb = paletteColor(edge.color);
    const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitPath.setAttribute("class", "edge-hit");
    hitPath.dataset.id = edge.id;
    hitPath.setAttribute("d", edgePath(from, to));
    hitPath.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      selectEdge(edge.id);
      render();
    });
    edgesLayer.append(hitPath);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `edge-path${state.selectedEdgeId === edge.id ? " selected" : ""}`);
    path.dataset.id = edge.id;
    path.setAttribute("d", edgePath(from, to));
    path.style.setProperty("--edge-rgb", rgb);
    path.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      selectEdge(edge.id);
      render();
    });
    edgesLayer.append(path);
    if (edge.label) {
      const midpoint = edgeMidpoint(from, to);
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("class", `edge-label${state.selectedEdgeId === edge.id ? " selected" : ""}`);
      text.setAttribute("x", midpoint.x);
      text.setAttribute("y", midpoint.y - 8);
      text.style.setProperty("--edge-rgb", rgb);
      text.textContent = edge.label;
      text.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        selectEdge(edge.id);
        render();
      });
      edgesLayer.append(text);
    }
  }
}

function removeStale(selector, ids) {
  canvas.querySelectorAll(selector).forEach((element) => {
    if (!ids.has(element.dataset.id)) element.remove();
  });
}

function bindResizeHandle(el, id) {
  const handle = el.querySelector(".resize-handle");
  handle.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    event.preventDefault();
    const item = itemById(id);
    const point = worldFromEvent(event);
    state.resizing = { id, startX: point.x, startY: point.y, w: item.w || 190, h: item.h || 96, moved: false, pointerId: event.pointerId };
    handle.setPointerCapture(event.pointerId);
  });
}

function bindNodeImageResizeHandle(el, id) {
  const handle = el.querySelector(".image-resize-handle");
  handle.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    event.preventDefault();
    const node = nodeById(id);
    if (!node?.image) return;
    const point = worldFromEvent(event);
    state.resizing = {
      id,
      mode: "node-image",
      startY: point.y,
      imageH: node.imageH || 96,
      moved: false,
      pointerId: event.pointerId
    };
    handle.setPointerCapture(event.pointerId);
  });
}

function renderGroups() {
  removeStale(".group", new Set(state.groups.map((group) => group.id)));
  for (const group of state.groups) {
    let el = canvas.querySelector(`[data-id="${group.id}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "group";
      el.dataset.id = group.id;
      el.innerHTML = '<div class="group-title"></div><div class="resize-handle"></div>';
      el.addEventListener("pointerdown", onItemPointerDown);
      el.addEventListener("dblclick", onGroupDoubleClick);
      bindResizeHandle(el, group.id);
      canvas.prepend(el);
    }
    el.style.left = `${group.x}px`;
    el.style.top = `${group.y}px`;
    el.style.width = `${group.w}px`;
    el.style.height = `${group.h}px`;
    el.classList.toggle("selected", state.selectedIds.has(group.id));
    const title = el.querySelector(".group-title");
    if (state.editingTitleId !== group.id) title.textContent = group.title;
    title.onpointerdown = (event) => {
      if (title.isContentEditable) event.stopPropagation();
    };
    title.ondblclick = (event) => {
      event.stopPropagation();
    };
    title.ondblclick = (event) => {
      event.stopPropagation();
      startGroupTitleEdit(group.id, title);
    };
  }
}

function renderImages() {
  removeStale(".canvas-image", new Set(state.images.map((image) => image.id)));
  for (const image of state.images) {
    let el = canvas.querySelector(`[data-id="${image.id}"]`);
    if (!el) {
      el = document.createElement("figure");
      el.className = "canvas-image";
      el.dataset.id = image.id;
      el.innerHTML = '<img alt=""><div class="resize-handle"></div>';
      el.addEventListener("pointerdown", onItemPointerDown);
      bindResizeHandle(el, image.id);
      canvas.append(el);
    }
    el.style.left = `${image.x}px`;
    el.style.top = `${image.y}px`;
    el.style.width = `${image.w}px`;
    el.style.height = `${image.h}px`;
    el.classList.toggle("selected", state.selectedIds.has(image.id));
    const img = el.querySelector("img");
    img.src = image.src;
    img.alt = image.title || "Image";
  }
}

function renderGhostNode() {
  let ghost = canvas.querySelector(".ghost-node");
  if (!state.edgeSourceId) {
    ghost?.remove();
    return;
  }
  const source = itemById(state.edgeSourceId);
  if (!source) {
    ghost?.remove();
    return;
  }
  if (!ghost) {
    ghost = document.createElement("div");
    ghost.className = "ghost-node";
    ghost.textContent = "click empty space";
    canvas.append(ghost);
  }
  ghost.style.left = `${source.x + (source.w || 190) + 70}px`;
  ghost.style.top = `${source.y + 20}px`;
}

function renderNodes() {
  const miniMapMode = state.view.scale < 0.15;
  const linkCountByNode = miniMapMode ? linkedCountByNodeId() : null;
  removeStale(".node", new Set(state.nodes.map((node) => node.id)));
  for (const node of state.nodes) {
    let el = canvas.querySelector(`[data-id="${node.id}"]`);
    if (!el) {
      el = document.createElement("article");
      el.className = "node";
      el.dataset.id = node.id;
      el.innerHTML = `
        <div class="node-header">
          <div class="node-title"></div>
          <button class="node-edit-title" type="button" title="Edit title" aria-label="Edit title">✎</button>
          <div class="node-type"></div>
        </div>
        <div class="node-mini-toolbar">
          <button type="button" data-action="child">Child</button>
          <button type="button" data-action="link">Link</button>
          <button type="button" data-action="duplicate">Dup</button>
          <button type="button" data-action="unlink">Unlink</button>
          <button type="button" data-action="state">State</button>
        </div>
        <div class="node-image-wrap">
          <img class="node-image" alt="">
          <div class="image-resize-handle"></div>
        </div>
        <div class="node-note"></div>
        <div class="resize-handle"></div>
      `;
      el.addEventListener("pointerdown", onItemPointerDown);
      el.addEventListener("dblclick", onNodeDoubleClick);
      bindResizeHandle(el, node.id);
      bindNodeImageResizeHandle(el, node.id);
      canvas.append(el);
    }
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.w || 190}px`;
    el.style.minHeight = `${node.h || 96}px`;
    el.dataset.color = node.color || "mint";
    el.dataset.state = node.state || "normal";
    el.classList.toggle("quick-mode", Boolean(node.quickMode));
    el.classList.toggle("scratch", Boolean(node.scratch));
    el.classList.toggle("selected", state.selectedIds.has(node.id));
    el.classList.toggle("edge-source", state.edgeSourceId === node.id);
    const links = linkCountByNode?.get(node.id) || 0;
    el.classList.toggle("zoom-hidden", miniMapMode && links < 3);
    el.classList.toggle("zoom-label-only", miniMapMode && links >= 3);
    const title = el.querySelector(".node-title");
    if (state.editingTitleId !== node.id) title.textContent = node.title;
    title.onpointerdown = (event) => {
      if (title.isContentEditable) event.stopPropagation();
    };
    el.querySelector(".node-edit-title").onclick = (event) => {
      event.stopPropagation();
      startNodeFieldEdit(node.id, "title", title);
    };
    el.querySelector(".node-edit-title").onpointerdown = (event) => {
      event.stopPropagation();
    };
    el.querySelectorAll(".node-mini-toolbar button").forEach((button) => {
      button.onpointerdown = (event) => event.stopPropagation();
      button.onclick = (event) => {
        event.stopPropagation();
        const action = button.dataset.action;
        if (action === "child") createChildNode(node.id);
        if (action === "link") {
          setTool("edge");
          state.edgeSourceId = node.id;
          state.pendingLinkSourceId = node.id;
          render();
        }
        if (action === "duplicate") duplicateNode(node.id);
        if (action === "unlink") {
          const before = state.edges.length;
          state.edges = state.edges.filter((edge) => edge.from !== node.id && edge.to !== node.id);
          if (before !== state.edges.length) {
            pushHistory("Node unlinked");
            render();
          }
        }
        if (action === "state") {
          const states = ["normal", "pinned", "highlighted", "locked", "temporary", "collapsed"];
          node.state = states[(states.indexOf(node.state || "normal") + 1) % states.length];
          pushHistory("Node state changed");
          render();
        }
      };
    });
    el.querySelector(".node-type").textContent = displayType(node);
    const image = el.querySelector(".node-image");
    image.src = node.image || "";
    image.style.height = `${node.imageH || 96}px`;
    image.style.display = node.image ? "block" : "none";
    el.querySelector(".node-image-wrap").style.display = node.image ? "block" : "none";
    const note = el.querySelector(".node-note");
    if (state.editingTitleId !== `${node.id}:note`) note.textContent = node.note;
    note.onpointerdown = (event) => {
      if (note.isContentEditable) event.stopPropagation();
    };
    note.ondblclick = (event) => {
      event.stopPropagation();
      startNodeFieldEdit(node.id, "note", note);
    };
  }
}

function render() {
  applyView();
  renderGroups();
  renderImages();
  renderGhostNode();
  renderEdges();
  renderNodes();
  if (!state.dragging && !state.resizing && !state.panning) {
    updateInspector();
    renderHistory();
    renderLinksPreview();
    renderPageTabs();
  }
}

function fastRender() {
  applyView();
  for (const group of state.groups) {
    const el = canvas.querySelector(`.group[data-id="${group.id}"]`);
    if (!el) continue;
    el.style.left = `${group.x}px`;
    el.style.top = `${group.y}px`;
    el.style.width = `${group.w}px`;
    el.style.height = `${group.h}px`;
  }
  for (const image of state.images) {
    const el = canvas.querySelector(`.canvas-image[data-id="${image.id}"]`);
    if (!el) continue;
    el.style.left = `${image.x}px`;
    el.style.top = `${image.y}px`;
    el.style.width = `${image.w}px`;
    el.style.height = `${image.h}px`;
  }
  for (const node of state.nodes) {
    const el = canvas.querySelector(`.node[data-id="${node.id}"]`);
    if (!el) continue;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.w || 190}px`;
    el.style.minHeight = `${node.h || 96}px`;
    const nodeImage = el.querySelector(".node-image");
    if (nodeImage) nodeImage.style.height = `${node.imageH || 96}px`;
  }
  renderGhostNode();
  renderEdges();
}

function startDrag(event, id) {
  const point = worldFromEvent(event);
  const draggedIds = state.selectedIds.has(id) ? [...state.selectedIds] : [id];
  state.dragging = {
    startX: point.x,
    startY: point.y,
    origins: draggedIds.map((draggedId) => ({ id: draggedId, x: itemById(draggedId).x, y: itemById(draggedId).y })),
    moved: false,
    pointerId: event.pointerId
  };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function onItemPointerDown(event) {
  const id = event.currentTarget.dataset.id;
  event.stopPropagation();
  const item = itemById(id);

  if (event.button === 1) {
    event.preventDefault();
    startPan(event);
    return;
  }
  if (event.button === 2 && event.ctrlKey) {
    deleteItem(id);
    pushHistory("Item deleted");
    render();
    return;
  }
  if (event.button === 2 && event.shiftKey) {
    toggleSelected(id);
    render();
    return;
  }
  if (event.button !== 0) return;
  if (item?.state === "locked") {
    selectOnly(id);
    render();
    return;
  }
  if (event.shiftKey && (id.startsWith("n") || id.startsWith("i"))) {
    connectSelectedTo(id);
    render();
    return;
  }
  if (state.tool === "edge" && (id.startsWith("n") || id.startsWith("i"))) {
    if (!state.edgeSourceId) {
      state.edgeSourceId = id;
    } else if (state.edgeSourceId !== id) {
      if (addEdge(state.edgeSourceId, id)) pushHistory("Edge created");
      state.edgeSourceId = null;
      setTool("select");
    }
    selectOnly(id);
    render();
    return;
  }
  if (!state.selectedIds.has(id)) selectOnly(id);
  startDrag(event, id);
  render();
}

function onNodeDoubleClick(event) {
  event.stopPropagation();
  const id = event.currentTarget.dataset.id;
  if (event.target.closest(".node-edit-title") || event.target.closest(".resize-handle") || event.target.closest(".image-resize-handle")) return;
  const editable = event.currentTarget.querySelector(".node-note");
  startNodeFieldEdit(id, "note", editable);
}

function startNodeFieldEdit(id, field, editable) {
  const node = nodeById(id);
  if (!node || !editable) return;
  selectOnly(id);
  editText({
    element: editable,
    id: field === "note" ? `${id}:note` : id,
    value: node[field],
    emptyValue: field === "note" ? "" : "Untitled",
    historyLabel: field === "note" ? "Node text changed" : "Node renamed",
    save: (value) => {
      node[field] = value;
    },
    onEnter: field === "note" && node.quickMode
      ? (value) => {
          node.note = value;
          return commitQuickNode(node.id);
        }
      : null
  });
}

function onGroupDoubleClick(event) {
  event.stopPropagation();
  const id = event.currentTarget.dataset.id;
  const title = event.currentTarget.querySelector(".group-title");
  startGroupTitleEdit(id, title);
}

function startGroupTitleEdit(id, title) {
  const group = groupById(id);
  if (!group || !title) return;
  selectOnly(id);
  editText({
    element: title,
    id,
    value: group.title,
    emptyValue: "Group",
    historyLabel: "Group renamed",
    save: (value) => {
      group.title = value;
    }
  });
}

function editText({ element, id, value, emptyValue, historyLabel, save, onEnter }) {
  state.editingTitleId = id;
  element.textContent = value;
  element.contentEditable = "true";
  element.focus();
  document.getSelection().selectAllChildren(element);

  const saveText = save;
  const finish = (shouldSave) => {
    element.removeEventListener("blur", onBlur);
    element.removeEventListener("keydown", onKey);
    element.contentEditable = "false";
    state.editingTitleId = null;
    if (shouldSave) {
      const nextValue = element.textContent.trim() || emptyValue;
      if (nextValue !== value) {
        saveText(nextValue);
        pushHistory(historyLabel);
      }
    }
    render();
  };
  const onBlur = () => finish(true);
  const onKey = (keyEvent) => {
    if (keyEvent.key === "Enter") {
      keyEvent.preventDefault();
      if (onEnter?.(element.textContent.trim())) {
        element.removeEventListener("blur", onBlur);
        element.removeEventListener("keydown", onKey);
        element.contentEditable = "false";
        state.editingTitleId = null;
        return;
      }
      finish(true);
    }
    if (keyEvent.key === "Escape") {
      keyEvent.preventDefault();
      finish(false);
    }
  };
  element.addEventListener("blur", onBlur);
  element.addEventListener("keydown", onKey);
}

function startPan(event) {
  state.panning = { x: event.clientX, y: event.clientY, viewX: state.view.x, viewY: state.view.y, pointerId: event.pointerId };
  canvasWrap.classList.add("panning");
  canvasWrap.setPointerCapture(event.pointerId);
}

canvasWrap.addEventListener("contextmenu", (event) => event.preventDefault());
canvasWrap.addEventListener("auxclick", (event) => {
  if (event.button === 1) event.preventDefault();
});

canvasWrap.addEventListener("pointerdown", (event) => {
  const point = worldFromEvent(event);
  if (event.button === 1) {
    event.preventDefault();
    startPan(event);
    return;
  }
  if (event.button !== 0) return;
  if (event.ctrlKey) {
    createNode(point.x, point.y);
    return;
  }
  if (state.tool === "edge" && state.edgeSourceId && (event.target === canvasWrap || event.target === edgesLayer || event.target === canvas)) {
    const id = `n${Date.now()}`;
    state.nodes.push({
      id,
      x: snapValue(point.x - 95),
      y: snapValue(point.y - 48),
      w: 190,
      h: 96,
      title: "Ghost child",
      type: "idea",
      customType: "",
      color: "mint",
      image: "",
      imageH: 96,
      note: "Created from a ghost link.",
      state: "temporary",
      scratch: false
    });
    addEdge(state.edgeSourceId, id);
    state.edgeSourceId = null;
    state.pendingLinkSourceId = null;
    setTool("select");
    selectOnly(id);
    pushHistory("Ghost node committed");
    render();
    return;
  }
  if (state.tool === "node") {
    createNode(point.x, point.y);
    return;
  }
  if (state.tool === "page") {
    createPageNode(point.x, point.y);
    return;
  }
  if (state.tool === "group") {
    createGroup(point.x, point.y);
    return;
  }
  if (state.space || event.target === canvasWrap || event.target === edgesLayer) startPan(event);
  if (event.target === canvasWrap || event.target === edgesLayer || event.target === canvas) {
    state.selectedIds.clear();
    state.selectedEdgeId = null;
    state.edgeSourceId = null;
    render();
  }
});

canvasWrap.addEventListener("dblclick", (event) => {
  if (event.target !== canvasWrap && event.target !== canvas && event.target !== edgesLayer) return;
  const point = worldFromEvent(event);
  createNode(point.x, point.y);
});

window.addEventListener("pointermove", (event) => {
  if (state.dragging) {
    const point = worldFromEvent(event);
    const movingIds = state.dragging.origins.map((origin) => origin.id);
    for (const origin of state.dragging.origins) {
      const item = itemById(origin.id);
      if (!item) continue;
      item.x = snapValue(origin.x + point.x - state.dragging.startX);
      item.y = snapValue(origin.y + point.y - state.dragging.startY);
      alignItemToNearest(item, movingIds);
    }
    state.dragging.moved = true;
    scheduleRender();
  }
  if (state.resizing) {
    const point = worldFromEvent(event);
    const item = itemById(state.resizing.id);
    if (item) {
      if (state.resizing.mode === "node-image") {
        item.imageH = snapValue(Math.max(48, state.resizing.imageH + point.y - state.resizing.startY));
        item.h = Math.max(item.h || 96, item.imageH + 92);
      } else {
        const min = item.id.startsWith("g") ? groupMin : item.id.startsWith("i") ? imageMin : nodeMin;
        item.w = snapValue(Math.max(min.w, state.resizing.w + point.x - state.resizing.startX));
        item.h = snapValue(Math.max(min.h, state.resizing.h + point.y - state.resizing.startY));
        if (item.id.startsWith("n") && item.image) item.imageH = Math.max(48, item.h - 92);
      }
      state.resizing.moved = true;
      scheduleRender();
    }
  }
  if (state.panning) {
    state.view.x = state.panning.viewX + event.clientX - state.panning.x;
    state.view.y = state.panning.viewY + event.clientY - state.panning.y;
    scheduleRender();
  }
});

window.addEventListener("pointerup", (event) => {
  if (state.dragging?.pointerId === event.pointerId) {
    const moved = state.dragging.moved;
    state.dragging = null;
    if (moved) {
      pushHistory("Moved");
      render();
    }
  }
  if (state.resizing?.pointerId === event.pointerId) {
    const moved = state.resizing.moved;
    state.resizing = null;
    if (moved) {
      pushHistory("Resized");
      render();
    }
  }
  if (state.panning?.pointerId === event.pointerId) {
    state.panning = null;
    canvasWrap.classList.remove("panning");
    render();
  }
});

canvasWrap.addEventListener("wheel", (event) => {
  event.preventDefault();
  const rect = canvasWrap.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
  const before = worldFromEvent(event);
  state.view.scale = Math.min(3.5, Math.max(0.08, state.view.scale * (event.deltaY > 0 ? 0.9 : 1.1)));
  state.view.x = mouseX - before.x * state.view.scale;
  state.view.y = mouseY - before.y * state.view.scale;
  scheduleRender();
}, { passive: false });

window.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.shiftKey && event.code === "KeyZ" && !isTextEditing()) {
    event.preventDefault();
    redo();
    return;
  }
  if (event.ctrlKey && event.code === "KeyZ" && !isTextEditing()) {
    event.preventDefault();
    undo();
    return;
  }
  if (event.ctrlKey && event.code === "KeyY" && !isTextEditing()) {
    event.preventDefault();
    redo();
    return;
  }
  if (isTextEditing()) return;
  if (event.code === "Space") {
    state.space = true;
    canvasWrap.classList.add("panning");
  }
  if (event.key.toLowerCase() === "v") setTool("select");
  if (event.key.toLowerCase() === "n") setTool("node");
  if (event.key.toLowerCase() === "e") setTool("edge");
  if (event.key.toLowerCase() === "g") setTool("group");
  if (event.key.toLowerCase() === "p") setTool("page");
  if (event.key === "Delete" || event.key === "Backspace") deleteSelected();
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    state.space = false;
    if (!state.panning) canvasWrap.classList.remove("panning");
  }
});

function commitProperty(label, apply) {
  const before = JSON.stringify(snapshot());
  apply();
  if (JSON.stringify(snapshot()) !== before) pushHistory(label);
  render();
}

function atlasPayload() {
  syncCurrentPage();
  return {
    version: 1,
    pages: state.pages,
    currentPageId: state.currentPageId,
    nodes: state.nodes,
    groups: state.groups,
    images: state.images,
    edges: state.edges,
    gridSize: state.gridSize,
    gridVisible: state.gridVisible,
    alignAssist: state.alignAssist,
    view: state.view
  };
}

function downloadAtlas(name = lastSaveName) {
  const atlas = atlasPayload();
  const blob = new Blob([JSON.stringify(atlas, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = String(name || "nodal-atlas").trim().replace(/[\\/:*?"<>|]+/g, "-") || "nodal-atlas";
  lastSaveName = safeName;
  link.download = `${safeName}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportAtlas() {
  downloadAtlas(lastSaveName);
}

function exportAtlasAs() {
  const name = window.prompt("Atlas file name", lastSaveName);
  if (name) downloadAtlas(name);
}

function autosaveAtlas() {
  try {
    localStorage.setItem(autosaveKey, JSON.stringify({ savedAt: new Date().toISOString(), atlas: atlasPayload() }));
  } catch (error) {
    console.warn("Autosave failed", error);
  }
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeAtlas(raw) {
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const groups = Array.isArray(raw.groups) ? raw.groups : [];
  const images = Array.isArray(raw.images) ? raw.images : [];
  const normalizedNodes = nodes.map((node, index) => ({
    id: String(node.id || `n${Date.now()}${index}`),
    x: numberOr(node.x, 120 + index * 30),
    y: numberOr(node.y, 120 + index * 30),
    w: Math.max(nodeMin.w, numberOr(node.w, 190)),
    h: Math.max(nodeMin.h, numberOr(node.h, 96)),
    title: String(node.title || "Node"),
    type: String(node.type || "idea"),
    customType: String(node.customType || ""),
    color: String(node.color || "mint"),
    image: String(node.image || ""),
    imageH: Math.max(48, numberOr(node.imageH, 96)),
    note: String(node.note || ""),
    state: String(node.state || "normal"),
    scratch: Boolean(node.scratch),
    quickMode: Boolean(node.quickMode)
  }));
  const normalizedImages = images.map((image, index) => ({
    id: String(image.id || `i${Date.now()}${index}`),
    x: numberOr(image.x, 160 + index * 30),
    y: numberOr(image.y, 160 + index * 30),
    w: Math.max(imageMin.w, numberOr(image.w, 240)),
    h: Math.max(imageMin.h, numberOr(image.h, 160)),
    title: String(image.title || "Image"),
    src: String(image.src || "")
  })).filter((image) => image.src);
  const linkableIds = new Set([...normalizedNodes.map((node) => node.id), ...normalizedImages.map((image) => image.id)]);
  return {
    nodes: normalizedNodes,
    groups: groups.map((group, index) => ({
      id: String(group.id || `g${Date.now()}${index}`),
      x: numberOr(group.x, 80 + index * 30),
      y: numberOr(group.y, 80 + index * 30),
      w: Math.max(groupMin.w, numberOr(group.w, 320)),
      h: Math.max(groupMin.h, numberOr(group.h, 210)),
      title: String(group.title || "Group")
    })),
    images: normalizedImages,
    edges: (Array.isArray(raw.edges) ? raw.edges : [])
      .filter((edge) => linkableIds.has(edge.from) && linkableIds.has(edge.to))
      .map((edge, index) => ({
        id: String(edge.id || `e${Date.now()}${index}`),
        from: String(edge.from),
        to: String(edge.to),
        label: String(edge.label || ""),
        color: String(edge.color || "blue"),
        note: String(edge.note || "")
      })),
    gridSize: [0, 5, 10, 20, 40].includes(Number(raw.gridSize)) ? Number(raw.gridSize) : 5,
    view: raw.view && Number.isFinite(Number(raw.view.scale))
      ? { x: numberOr(raw.view.x, 260), y: numberOr(raw.view.y, 130), scale: Math.min(3.5, Math.max(0.08, Number(raw.view.scale))) }
      : { x: 260, y: 130, scale: 1 }
  };
}

function loadAtlasFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const raw = JSON.parse(reader.result);
      if (Array.isArray(raw.pages) && raw.pages.length) {
        state.pages = raw.pages.map((page, index) => {
          const normalized = normalizeAtlas(page);
          return {
            id: String(page.id || `page${Date.now()}${index}`),
            title: String(page.title || `Sheet ${index + 1}`),
            nodes: normalized.nodes,
            groups: normalized.groups,
            images: normalized.images,
            edges: normalized.edges,
            view: normalized.view
          };
        });
        const page = state.pages.find((item) => item.id === raw.currentPageId) || state.pages[0];
        state.currentPageId = page.id;
        state.nodes = structuredClone(page.nodes);
        state.groups = structuredClone(page.groups);
        state.images = structuredClone(page.images);
        state.edges = structuredClone(page.edges);
        state.view = structuredClone(page.view);
        state.gridSize = [0, 5, 10, 20, 40].includes(Number(raw.gridSize)) ? Number(raw.gridSize) : 5;
        state.gridVisible = raw.gridVisible !== false;
        state.alignAssist = Boolean(raw.alignAssist);
      } else {
        const atlas = normalizeAtlas(raw);
        state.pages = [{
          id: "page1",
          title: "Sheet 1",
          nodes: atlas.nodes,
          groups: atlas.groups,
          images: atlas.images,
          edges: atlas.edges,
          view: atlas.view
        }];
        state.currentPageId = "page1";
        state.nodes = atlas.nodes;
        state.groups = atlas.groups;
        state.images = atlas.images;
        state.edges = atlas.edges;
        state.gridSize = atlas.gridSize;
        state.view = atlas.view;
      }
      state.selectedIds.clear();
      state.selectedEdgeId = null;
      state.history = [];
      state.historyIndex = -1;
      pushHistory("Atlas loaded");
      render();
    } catch (error) {
      window.alert("Could not load atlas JSON.");
    }
  });
  reader.readAsText(file);
}

function autoLayout() {
  const roots = state.nodes.filter((node) => !state.edges.some((edge) => edge.to === node.id));
  const seen = new Set();
  const place = (node, depth, rowRef) => {
    if (!node || seen.has(node.id) || node.state === "locked") return;
    seen.add(node.id);
    node.x = snapValue(120 + depth * 280);
    node.y = snapValue(100 + rowRef.value * 130);
    rowRef.value += 1;
    state.edges
      .filter((edge) => edge.from === node.id)
      .map((edge) => nodeById(edge.to))
      .forEach((child) => place(child, depth + 1, rowRef));
  };
  const rowRef = { value: 0 };
  roots.forEach((root) => place(root, 0, rowRef));
  state.nodes.filter((node) => !seen.has(node.id)).forEach((node) => place(node, 0, rowRef));
  pushHistory("Auto layout");
  render();
}

toolButtons.forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
saveAtlasButton.addEventListener("click", exportAtlas);
saveAsAtlasButton.addEventListener("click", exportAtlasAs);
autoLayoutButton.addEventListener("click", autoLayout);
gridVisibleButton.addEventListener("click", () => {
  state.gridVisible = !state.gridVisible;
  render();
});
alignAssistButton.addEventListener("click", () => {
  state.alignAssist = !state.alignAssist;
  render();
});
flowDirectionInput.addEventListener("change", () => {
  state.flowDirection = flowDirectionInput.value;
  if (state.flowDirection === "paused") {
    canvasWrap.style.setProperty("--edge-flow-speed", "0s");
    canvasWrap.style.setProperty("--edge-flow-direction", "normal");
  } else {
    canvasWrap.style.setProperty("--edge-flow-speed", "3.2s");
    canvasWrap.style.setProperty("--edge-flow-direction", state.flowDirection === "reverse" ? "reverse" : "normal");
  }
  pushHistory("Flow direction changed");
  render();
});
loadAtlasButton.addEventListener("click", () => {
  atlasLoadInput.value = "";
  atlasLoadInput.click();
});
atlasLoadInput.addEventListener("change", () => loadAtlasFile(atlasLoadInput.files?.[0]));
addImageButton.addEventListener("click", () => {
  looseImageInput.value = "";
  looseImageInput.click();
});
looseImageInput.addEventListener("change", () => {
  const file = looseImageInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const rect = canvasWrap.getBoundingClientRect();
    const x = (rect.width / 2 - state.view.x) / state.view.scale;
    const y = (rect.height / 2 - state.view.y) / state.view.scale;
    createLooseImage(reader.result, x, y);
  });
  reader.readAsDataURL(file);
});
gridSizeInput.addEventListener("change", () => {
  state.gridSize = Number(gridSizeInput.value);
  pushHistory("Grid changed");
  render();
});
titleInput.addEventListener("change", () => commitProperty("Title changed", () => {
  const edge = selectedEdge();
  const item = selectedItem();
  if (edge) edge.label = titleInput.value;
  else if (item) item.title = titleInput.value;
}));
typeInput.addEventListener("change", () => commitProperty("Type changed", () => { const item = selectedItem(); if (item?.id?.startsWith("n")) { item.type = typeInput.value; if (item.type !== "custom") item.customType = ""; } }));
customTypeInput.addEventListener("change", () => commitProperty("Type changed", () => { const item = selectedItem(); if (item?.id?.startsWith("n")) item.customType = customTypeInput.value.trim(); }));
colorInput.addEventListener("change", () => commitProperty("Color changed", () => {
  const edge = selectedEdge();
  const item = selectedItem();
  if (edge) edge.color = colorInput.value;
  else if (item?.id?.startsWith("n")) item.color = colorInput.value;
}));
nodeStateInput.addEventListener("change", () => commitProperty("Node state changed", () => {
  const item = selectedItem();
  if (item?.id?.startsWith("n")) item.state = nodeStateInput.value;
}));
scratchButton.addEventListener("click", () => commitProperty("Scratch changed", () => {
  const item = selectedItem();
  if (item?.id?.startsWith("n")) {
    item.scratch = !item.scratch;
    item.state = item.scratch ? "temporary" : "normal";
  }
}));
noteInput.addEventListener("change", () => commitProperty("Note changed", () => {
  const edge = selectedEdge();
  const item = selectedItem();
  if (edge) edge.note = noteInput.value;
  else if (item?.id?.startsWith("n")) item.note = noteInput.value;
}));

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  const item = selectedItem();
  if (!file || !item?.id?.startsWith("n")) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    item.image = reader.result;
    item.imageH = Math.max(item.imageH || 96, 120);
    item.h = Math.max(item.h || 96, 210);
    pushHistory("Image added");
    imageInput.value = "";
    render();
  });
  reader.readAsDataURL(file);
});

clearImageButton.addEventListener("click", () => commitProperty("Image removed", () => {
  const item = selectedItem();
  if (item?.id?.startsWith("n")) {
    item.image = "";
    item.imageH = 96;
  }
}));

fitViewButton.addEventListener("click", () => {
  state.view = { x: 260, y: 130, scale: 1 };
  render();
});
undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);
inspectorToggle.addEventListener("click", () => workspace.classList.remove("inspector-open"));
inspectorPeek.addEventListener("click", () => workspace.classList.add("inspector-open"));
window.addEventListener("beforeunload", autosaveAtlas);

pushHistory("Start");
setInterval(autosaveAtlas, 5 * 60 * 1000);
render();
