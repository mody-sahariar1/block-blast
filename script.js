const gridSize = 8;
const grid = document.getElementById("grid");
const tray = document.getElementById("tray");
const restartBtn = document.getElementById("restart");
const overlay = document.getElementById("game-over-overlay");
const restartOverlayBtn = document.getElementById("restart-overlay-btn");

let cells = [];
let gridState = Array(gridSize * gridSize).fill(0);
let gameOver = false;

/* ---------- SHAPES ---------- */

const SHAPES = {
  DOT: [[0,0]],
  I2: [[0,0],[1,0]],
  I3: [[0,0],[1,0],[2,0]],
  I4: [[0,0],[1,0],[2,0],[3,0]],
  O2: [[0,0],[1,0],[0,1],[1,1]],
  T: [[0,1],[1,0],[1,1],[2,1]],
  L: [[0,0],[0,1],[0,2],[1,2]],
  J: [[1,0],[1,1],[1,2],[0,2]],
  S: [[1,0],[2,0],[0,1],[1,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]],
  PLUS: [[1,0],[0,1],[1,1],[2,1],[1,2]]
};

const SHAPE_KEYS = Object.keys(SHAPES);

/* ---------- DRAG STATE ---------- */

let dragging = false;
let dragClone = null;
let activeShape = null;
let offsetX = 0;
let offsetY = 0;
let ghostCells = [];
let currentSnap = null;
let sourcePiece = null;

/* ---------- GRID ---------- */

function createGrid() {
  grid.innerHTML = "";
  cells = [];
  gridState.fill(0);

  for (let i = 0; i < gridSize * gridSize; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    grid.appendChild(cell);
    cells.push(cell);
  }
}

/* ---------- DYNAMIC CELL SIZE (MOBILE FIX) ---------- */

function getCellSize() {
  if (!cells.length) return 44;
  const rect = cells[0].getBoundingClientRect();
  return rect.width + 4; // includes grid gap
}

function getSnapTolerance() {
  return getCellSize() * 0.9;
}

/* ---------- TRAY ---------- */

function spawnTrayPieces() {
  tray.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const key = SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
    const piece = document.createElement("div");
    piece.className = "piece";
    piece.dataset.shape = key;
    tray.appendChild(piece);
    createPiece(piece);
    setupDrag(piece);
  }
}

/* ---------- PIECE RENDER ---------- */

function createPiece(piece) {
  const shape = SHAPES[piece.dataset.shape];
  piece.innerHTML = "";

  const maxX = Math.max(...shape.map(p => p[0]));
  const maxY = Math.max(...shape.map(p => p[1]));

  piece.style.width = (maxX + 1) * 40 + "px";
  piece.style.height = (maxY + 1) * 40 + "px";

  shape.forEach(([x, y]) => {
    const block = document.createElement("div");
    block.className = "block";
    block.style.left = x * 40 + "px";
    block.style.top = y * 40 + "px";
    piece.appendChild(block);
  });
}

/* ---------- PLACEMENT ---------- */

function canPlace(shape, row, col) {
  return shape.every(([dx, dy]) => {
    const r = row + dy;
    const c = col + dx;
    return r >= 0 && c >= 0 && r < gridSize && c < gridSize &&
           !gridState[r * gridSize + c];
  });
}

function placeShape(shape, row, col) {
  shape.forEach(([dx, dy]) => {
    const i = (row + dy) * gridSize + (col + dx);
    gridState[i] = 1;
    cells[i].classList.add("occupied");
  });

  clearLines();
}

/* ---------- BLASTING (ROWS + COLUMNS) ---------- */

function clearLines() {
  const toClear = new Set();

  for (let r = 0; r < gridSize; r++) {
    if ([...Array(gridSize)].every((_, c) => gridState[r*gridSize + c])) {
      for (let c = 0; c < gridSize; c++) toClear.add(r*gridSize + c);
    }
  }

  for (let c = 0; c < gridSize; c++) {
    if ([...Array(gridSize)].every((_, r) => gridState[r*gridSize + c])) {
      for (let r = 0; r < gridSize; r++) toClear.add(r*gridSize + c);
    }
  }

  toClear.forEach(i => {
    gridState[i] = 0;
    cells[i].classList.remove("occupied");
  });
}

/* ---------- GAME OVER ---------- */

function isGameOver() {
  const pieces = [...tray.children];
  if (!pieces.length) return false;

  return !pieces.some(p => {
    const shape = SHAPES[p.dataset.shape];
    for (let r = 0; r < gridSize; r++)
      for (let c = 0; c < gridSize; c++)
        if (canPlace(shape, r, c)) return true;
    return false;
  });
}

function triggerGameOver() {
  gameOver = true;
  overlay.classList.remove("hidden");
}

/* ---------- GHOST ---------- */

function clearGhost() {
  ghostCells.forEach(i => cells[i].classList.remove("ghost"));
  ghostCells = [];
}

function showGhost(shape, row, col) {
  clearGhost();
  shape.forEach(([dx, dy]) => {
    const i = (row + dy) * gridSize + (col + dx);
    cells[i].classList.add("ghost");
    ghostCells.push(i);
  });
}

/* ---------- SNAP ---------- */

function findSnapPosition(x, y, shape) {
  let best = null;
  let bestDist = Infinity;
  const cellSize = getCellSize();
  const tolerance = getSnapTolerance();

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (!canPlace(shape, r, c)) continue;
      const d = Math.hypot(c * cellSize - x, r * cellSize - y);
      if (d < tolerance && d < bestDist) {
        bestDist = d;
        best = { row: r, col: c };
      }
    }
  }
  return best;
}

/* ---------- DRAG (CLONE-BASED, STABLE) ---------- */

function setupDrag(piece) {
  piece.addEventListener("pointerdown", e => {
    if (gameOver) return;

    dragging = true;
    sourcePiece = piece;
    activeShape = SHAPES[piece.dataset.shape];

    const rect = piece.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    dragClone = piece.cloneNode(true);
    dragClone.classList.add("dragging");
    dragClone.style.left = rect.left + "px";
    dragClone.style.top = rect.top + "px";

    document.body.appendChild(dragClone);
  });
}

document.addEventListener("pointermove", e => {
  if (!dragging) return;

  dragClone.style.left = e.clientX - offsetX + "px";
  dragClone.style.top = e.clientY - offsetY + "px";

  const gridRect = grid.getBoundingClientRect();
  const x = e.clientX - gridRect.left - offsetX;
  const y = e.clientY - gridRect.top - offsetY;

  const snap = findSnapPosition(x, y, activeShape);
  if (snap) {
    currentSnap = snap;
    showGhost(activeShape, snap.row, snap.col);
  } else {
    currentSnap = null;
    clearGhost();
  }
});

document.addEventListener("pointerup", () => {
  if (!dragging) return;

  dragging = false;
  dragClone.remove();

  if (currentSnap && !gameOver) {
    placeShape(activeShape, currentSnap.row, currentSnap.col);
    sourcePiece.remove();

    if (!tray.children.length) spawnTrayPieces();
    if (isGameOver()) triggerGameOver();
  }

  clearGhost();
  currentSnap = null;
  dragClone = null;
  sourcePiece = null;
});

/* ---------- RESET ---------- */

function resetGame() {
  gameOver = false;
  overlay.classList.add("hidden");
  createGrid();
  spawnTrayPieces();
}

restartBtn.onclick = resetGame;
restartOverlayBtn.onclick = resetGame;

/* ---------- INIT ---------- */

createGrid();
spawnTrayPieces();
