const gridSize = 8;
const grid = document.getElementById("grid");
const tray = document.getElementById("tray");
const restartBtn = document.getElementById("restart");
const overlay = document.getElementById("game-over-overlay");
const restartOverlayBtn = document.getElementById("restart-overlay-btn");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const comboEl = document.getElementById("combo");

const CELL_SIZE = 44;
const SNAP_TOLERANCE = CELL_SIZE * 0.8;

let cells = [];
let gridState = Array(gridSize * gridSize).fill(0);
let gameOver = false;

/* ================= SCORE ================= */

let score = 0;

function addScore(linesCleared) {
  if (linesCleared === 0) return;
  score += linesCleared * 100;
}

/* ================= OBSERVERS ================= */

let combo = 0;
let bestScore = Math.floor(Number(localStorage.getItem("bestScore")) || 0);

function observeComboAndBest(linesCleared) {
  let bonus = 0;

  if (linesCleared > 0) {
    combo++;
    if (combo >= 2) {
      bonus = (combo - 1) * 50 * Math.min(linesCleared, 2);
      score += bonus;
    }
  } else {
    combo = 0;
  }

  score = Math.round(score);

  requestAnimationFrame(() => {
    scoreEl.textContent = `SCORE: ${score}`;

    if (combo >= 2) {
      comboEl.textContent = `🔥 COMBO x${combo} 🔥`;
      comboEl.style.visibility = "visible";
    } else {
      comboEl.style.visibility = "hidden";
    }

    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem("bestScore", bestScore);
      bestScoreEl.textContent = `BEST: ${bestScore}`;
    }
  });
}

/* ================= SHAPES ================= */

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

/* ================= GRID ================= */

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

/* ================= TRAY ================= */

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

/* ================= PIECE RENDER ================= */

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

/* ================= PLACEMENT ================= */

function canPlace(shape, row, col) {
  return shape.every(([dx, dy]) => {
    const r = row + dy;
    const c = col + dx;
    return (
      r >= 0 &&
      c >= 0 &&
      r < gridSize &&
      c < gridSize &&
      !gridState[r * gridSize + c]
    );
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

/* ================= BLAST ================= */

function clearLines() {
  const toClear = new Set();

  for (let r = 0; r < gridSize; r++) {
    if ([...Array(gridSize)].every((_, c) => gridState[r * gridSize + c])) {
      for (let c = 0; c < gridSize; c++) toClear.add(r * gridSize + c);
    }
  }

  for (let c = 0; c < gridSize; c++) {
    if ([...Array(gridSize)].every((_, r) => gridState[r * gridSize + c])) {
      for (let r = 0; r < gridSize; r++) toClear.add(r * gridSize + c);
    }
  }

  toClear.forEach(i => {
    gridState[i] = 0;
    cells[i].classList.remove("occupied");
  });

  const linesCleared = Math.floor(toClear.size / gridSize);

  addScore(linesCleared);
  observeComboAndBest(linesCleared);
}

/* ================= GAME OVER ================= */

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

/* ================= GHOST ================= */

let ghostCells = [];

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

/* ================= SNAP ================= */

function findSnapPosition(x, y, shape) {
  let best = null;
  let bestDist = Infinity;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (!canPlace(shape, r, c)) continue;
      const d = Math.hypot(c * CELL_SIZE - x, r * CELL_SIZE - y);
      if (d < SNAP_TOLERANCE && d < bestDist) {
        bestDist = d;
        best = { row: r, col: c };
      }
    }
  }
  return best;
}

/* ================= DRAG (DESKTOP UNCHANGED, MOBILE FIXED) ================= */

let dragging = false;
let dragClone = null;
let activeShape = null;
let offsetX = 0;
let offsetY = 0;
let currentSnap = null;
let sourcePiece = null;
let gridRect = null;
let visualScale = 1;

function setupDrag(piece) {
  piece.addEventListener("pointerdown", e => {
    if (gameOver) return;

    dragging = true;
    sourcePiece = piece;
    activeShape = SHAPES[piece.dataset.shape];

    const rect = piece.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    gridRect = grid.getBoundingClientRect();

    // 🔒 MOBILE-ONLY SCALE NORMALIZATION
    if (e.pointerType === "touch") {
      const gameRect = document.getElementById("game").getBoundingClientRect();
      visualScale = gameRect.width / document.getElementById("game").offsetWidth;
    } else {
      visualScale = 1; // DESKTOP: unchanged
    }

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

  // 🔒 Normalize input ONLY on mobile
  const x = (e.clientX - gridRect.left - offsetX) / visualScale;
  const y = (e.clientY - gridRect.top - offsetY) / visualScale;

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

  if (currentSnap && !gameOver) {
    placeShape(activeShape, currentSnap.row, currentSnap.col);
    sourcePiece.remove();

    if (!tray.children.length) spawnTrayPieces();
    if (isGameOver()) triggerGameOver();
  }

  dragging = false;
  if (dragClone) dragClone.remove();
  clearGhost();
  currentSnap = null;
  dragClone = null;
  sourcePiece = null;
});

document.addEventListener("pointercancel", () => {
  dragging = false;
  if (dragClone) dragClone.remove();
  clearGhost();
  currentSnap = null;
});

/* ================= RESET ================= */

function resetGame() {
  gameOver = false;
  score = 0;
  combo = 0;

  scoreEl.textContent = "SCORE: 0";
  comboEl.style.visibility = "hidden";

  overlay.classList.add("hidden");
  createGrid();
  spawnTrayPieces();
}

/* ================= INIT ================= */

restartBtn.onclick = resetGame;
restartOverlayBtn.onclick = resetGame;

createGrid();
spawnTrayPieces();
