const { Engine, Render, World, Bodies, Runner, Composite, Constraint } = Matter;

var windowWidth = window.innerWidth;
var windowHeight = window.innerHeight;
let canvas, engine, world, runner;
let levels;
let currentLevel = 0;
let chainedBoxes = [];
let unchainedBoxes = [];
let ground;
let trailCoords = [];
let a = 0;
let winner = null;

const Players = Object.freeze({
  RED: 0,
  BLUE: 1,
});

let player = Players.RED;
let turn = player;
let ai = Players.BLUE;

function preload() {
  levels = loadJSON("levels.json");
}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight - 5);
  engine = Engine.create();
  world = engine.world;
  runner = Runner.create();
  Runner.run(runner, engine);

  ground = Bodies.rectangle(width / 2, height, width, 20, { isStatic: true });
  World.add(world, [ground]);

  loadLevel(levels[currentLevel]);
}

function keyPressed() {
  if (key === "ArrowRight") {
    if (!levels[currentLevel + 1]) return;
    currentLevel++;
    chainedBoxes = [];
    unchainedBoxes = [];
    winner = null;
    loadLevel(levels[currentLevel]);
    turn = player;
  }
  if (key === "ArrowLeft") {
    if (!levels[currentLevel - 1]) return;
    currentLevel--;
    chainedBoxes = [];
    unchainedBoxes = [];
    winner = null;
    loadLevel(levels[currentLevel]);
    turn = player;
  }
  if (keyCode === 82) {
    // 'r' key
    chainedBoxes = [];
    unchainedBoxes = [];
    winner = null;
    loadLevel(levels[currentLevel]);
    turn = player;
  }
  if (keyCode === 70) {
    // 'f' key
    fullscreen(!fullscreen());
  }
}

function windowResized() {
  resizeCanvas(windowWidth - 8, windowHeight - 20);
}

function draw() {
  background("#e4e3de");
  textSize(32);
  noStroke();
  cursor(CROSS);
  trailCoords.push([mouseX, mouseY]);

  if (winner !== null) {
    fill("black");
    text(`Game over, ${winner === Players.RED ? "Red" : "Blue"} won`, 10, 40);
  } else if (turn === Players.RED) {
    fill("#943827");
    text("Red's turn", 10, 40);
  } else {
    fill("#4a84a1");
    text("Blue's turn", 10, 40);
  }

  fill("black");
  text(`Level ${currentLevel + 1}`, 10, 80);
  textSize(16);
  text("Press 'r' to restart, arrow keys - to cycle through levels", 10, 120);

  for (let i = 0; i < chainedBoxes.length; i++) {
    chainedBoxes[i].show();
  }

  for (let i = 0; i < unchainedBoxes.length; i++) {
    unchainedBoxes[i].show();
  }

  for (let i = 0; i < trailCoords.length; i++) {
    strokeWeight(10);
    stroke(turn === Players.RED ? "#e0543b" : "#528fae");
    ellipse(trailCoords[i][0], trailCoords[i][1], 5);
    if (a > 20) {
      trailCoords.shift();
      a = 0;
    }
    a += 4;
  }
  noStroke();
  rectMode(CENTER);
  rect(width / 2, height, width, 20);
}

function loadLevel(level) {
  for (let i = 0; i < level.boxes.length; i++) {
    createBox(level.boxes[i], null, (i % 2 === 0 ? 1 : -1) * (i + 1) * 50);
  }

  function createBox(boxData, parent, offset = null) {
    const coords = parent
      ? [
          parent.endCoords[0] +
            Math.sin((boxData.angleDeg * Math.PI) / 180) * 50,
          parent.endCoords[1] -
            Math.cos((boxData.angleDeg * Math.PI) / 180) * 50,
        ]
      : [width / 2 + offset, height - 50];

    const newBox = new Box(coords[0], coords[1], boxData);
    newBox.parent = parent || null;
    chainedBoxes.push(newBox);

    if (parent) {
      parent.children.push(newBox);
    }

    if (boxData.boxes && boxData.boxes.length > 0) {
      for (let i = 0; i < boxData.boxes.length; i++) {
        createBox(boxData.boxes[i], newBox);
      }
    }
    return newBox;
  }
}

function mousePressed() {
  if (turn !== player) return;
  for (let i = 0; i < chainedBoxes.length; i++) {
    const b = chainedBoxes[i];
    if (
      b.isUnderMouse(mouseX, mouseY) &&
      b.color === (turn === Players.RED ? "red" : "blue")
    ) {
      applyMoveRealWorld(i);

      let logicState = buildLogicState(chainedBoxes);
      let bestMoveIndex = findBestMove(logicState, ai);

      if (bestMoveIndex === null) {
        winner = player;
        return;
      }
      setTimeout(() => {
        applyMoveRealWorld(bestMoveIndex);
      }, 1000);

      break;
    }
  }
}

function applyMoveRealWorld(index) {
  const removed = chainedBoxes.splice(index, 1)[0];
  unchainedBoxes.push(removed);
  removed.body.isSleeping = false;

  if (removed.parent) {
    let idx = removed.parent.children.indexOf(removed);
    if (idx >= 0) {
      removed.parent.children.splice(idx, 1);
    }
  }

  removeFloatingBoxesRealWorld();
  turn = turn === Players.RED ? Players.BLUE : Players.RED;
  if (chainedBoxes.length === 0) {
    winner = turn === Players.RED ? Players.BLUE : Players.RED;
  }
}

function removeFloatingBoxesRealWorld() {
  const visited = new Set();
  for (let b of chainedBoxes) {
    if (!b.parent && b.isRoot) {
      dfsMark(b, visited);
    }
  }
  for (let i = chainedBoxes.length - 1; i >= 0; i--) {
    const b = chainedBoxes[i];
    if (!visited.has(b)) {
      const removed = chainedBoxes.splice(i, 1)[0];
      unchainedBoxes.push(removed);
      removed.body.isSleeping = false;
    }
  }
}

function dfsMark(box, visited) {
  if (visited.has(box)) return;
  visited.add(box);
  if (box.children) {
    for (let child of box.children) {
      dfsMark(child, visited);
    }
  }
}

function buildLogicState(realBoxes) {
  const logic = [];

  for (let i = 0; i < realBoxes.length; i++) {
    let rb = realBoxes[i];
    logic.push({
      color: rb.color,
      isRoot: rb.isRoot,
      parent: null,
      children: [],
    });
  }

  function findIndexOfBoxInArray(box) {
    return realBoxes.indexOf(box);
  }

  for (let i = 0; i < realBoxes.length; i++) {
    let rb = realBoxes[i];
    let li = logic[i];
    if (rb.parent) {
      let parentIndex = findIndexOfBoxInArray(rb.parent);
      li.parent = parentIndex;
      logic[parentIndex].children.push(i);
    }
  }

  return logic;
}

function cloneLogicState(logicState) {
  return JSON.parse(JSON.stringify(logicState));
}

function getPossibleMoves(logicState, currentPlayer) {
  const colorStr = currentPlayer === Players.RED ? "red" : "blue";
  const moves = [];
  for (let i = 0; i < logicState.length; i++) {
    if (logicState[i] && logicState[i].color === colorStr) {
      moves.push(i);
    }
  }
  return moves;
}

function applyMoveLogic(state, boxIndex) {
  const box = state[boxIndex];
  state[boxIndex] = null;

  if (box.parent !== null && state[box.parent]) {
    let arr = state[box.parent].children;
    let i = arr.indexOf(boxIndex);
    if (i >= 0) arr.splice(i, 1);
  }

  removeFloatingBoxesLogic(state);
}

function removeFloatingBoxesLogic(state) {
  const visited = new Set();

  for (let i = 0; i < state.length; i++) {
    let box = state[i];
    if (box && box.parent === null && box.isRoot) {
      dfsMarkLogic(state, i, visited);
    }
  }

  for (let i = 0; i < state.length; i++) {
    if (state[i] && !visited.has(i)) {
      state[i] = null;
    }
  }
}

function dfsMarkLogic(state, i, visited) {
  if (visited.has(i)) return;
  visited.add(i);
  let box = state[i];
  for (let c of box.children) {
    if (state[c]) {
      dfsMarkLogic(state, c, visited);
    }
  }
}

function minimax(state, currentPlayer) {
  const moves = getPossibleMoves(state, currentPlayer);

  if (moves.length === 0) {
    return -1;
  }

  let bestVal = -Infinity;
  for (let moveIndex of moves) {
    let cloned = cloneLogicState(state);
    applyMoveLogic(cloned, moveIndex);
    const nextPlayer =
      currentPlayer === Players.RED ? Players.BLUE : Players.RED;

    let value = -minimax(cloned, nextPlayer);
    if (value > bestVal) {
      bestVal = value;
    }
  }
  return bestVal;
}

function findBestMove(logicState, currentPlayer) {
  const moves = getPossibleMoves(logicState, currentPlayer);
  if (moves.length === 0) return null;

  let bestVal = -Infinity;
  let bestMove = null;

  for (let moveIndex of moves) {
    let cloned = cloneLogicState(logicState);
    applyMoveLogic(cloned, moveIndex);
    const nextPlayer =
      currentPlayer === Players.RED ? Players.BLUE : Players.RED;

    let value = -minimax(cloned, nextPlayer);

    if (value > bestVal) {
      bestVal = value;
      bestMove = moveIndex;
    }
  }
  return bestMove;
}
