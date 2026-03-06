const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highscoreEl = document.getElementById('highscore');
const speedEl = document.getElementById('speed');
const startButton = document.getElementById('startButton');

const LANES = [260, 450, 640];
const PLAYER_Z = 80;
const GRAVITY = 0.0024;
const JUMP_VELOCITY = 1.05;

let highscore = Number(localStorage.getItem('runner-rush-highscore') || 0);
highscoreEl.textContent = String(highscore);

const state = {
  running: false,
  over: false,
  score: 0,
  speed: 0.35,
  lane: 1,
  targetLane: 1,
  y: 0,
  vy: 0,
  slideMs: 0,
  distance: 0,
  lastSpawn: 0,
  obstacles: [],
  coins: [],
  lastTimestamp: 0,
};

function resetGame() {
  state.running = true;
  state.over = false;
  state.score = 0;
  state.speed = 0.35;
  state.lane = 1;
  state.targetLane = 1;
  state.y = 0;
  state.vy = 0;
  state.slideMs = 0;
  state.distance = 0;
  state.lastSpawn = 0;
  state.obstacles = [];
  state.coins = [];
  state.lastTimestamp = performance.now();
  scoreEl.textContent = '0';
  speedEl.textContent = '1.0x';
}

function spawnChunk() {
  state.lastSpawn = state.distance;
  const spawnZ = 1100 + Math.random() * 250;
  const pattern = Math.random();

  if (pattern < 0.35) {
    const safeLane = Math.floor(Math.random() * 3);
    for (let lane = 0; lane < 3; lane++) {
      if (lane !== safeLane) {
        state.obstacles.push({ lane, z: spawnZ, type: 'block', height: 80 });
      }
    }
    state.coins.push({ lane: safeLane, z: spawnZ + 80, y: 44, taken: false });
  } else if (pattern < 0.7) {
    const lane = Math.floor(Math.random() * 3);
    state.obstacles.push({ lane, z: spawnZ, type: 'low', height: 40 });
    state.coins.push({ lane, z: spawnZ + 120, y: 76, taken: false });
  } else {
    const lane = Math.floor(Math.random() * 3);
    state.obstacles.push({ lane, z: spawnZ, type: 'high', height: 120 });
    for (let i = 0; i < 3; i++) {
      state.coins.push({ lane: (lane + i + 1) % 3, z: spawnZ + 40 + i * 55, y: 42, taken: false });
    }
  }
}

function update(dtMs) {
  if (!state.running || state.over) return;

  const dt = Math.min(dtMs, 32);
  state.distance += state.speed * dt;
  state.speed = Math.min(0.9, state.speed + 0.000006 * dt);

  if (Math.abs(state.lane - state.targetLane) > 0.001) {
    const dir = Math.sign(state.targetLane - state.lane);
    state.lane += dir * 0.012 * dt;
    if ((dir > 0 && state.lane > state.targetLane) || (dir < 0 && state.lane < state.targetLane)) {
      state.lane = state.targetLane;
    }
  }

  state.vy -= GRAVITY * dt;
  state.y += state.vy * dt;
  if (state.y < 0) {
    state.y = 0;
    state.vy = 0;
  }

  if (state.slideMs > 0) {
    state.slideMs -= dt;
  }

  if (state.distance - state.lastSpawn > 220) {
    spawnChunk();
  }

  for (const obstacle of state.obstacles) {
    const localZ = obstacle.z - state.distance;
    if (localZ < -90) continue;

    const laneDiff = Math.abs(obstacle.lane - state.lane);
    if (laneDiff < 0.35 && localZ < PLAYER_Z + 40 && localZ > PLAYER_Z - 38) {
      const isSliding = state.slideMs > 0;
      const jumpClearance = state.y;

      let hit = false;
      if (obstacle.type === 'block' && jumpClearance < obstacle.height) {
        hit = true;
      } else if (obstacle.type === 'low' && !isSliding && jumpClearance < 55) {
        hit = true;
      } else if (obstacle.type === 'high' && jumpClearance < 95) {
        hit = true;
      }

      if (hit) {
        state.over = true;
        state.running = false;
        if (state.score > highscore) {
          highscore = state.score;
          localStorage.setItem('runner-rush-highscore', String(highscore));
          highscoreEl.textContent = String(highscore);
        }
      }
    }
  }

  for (const coin of state.coins) {
    const localZ = coin.z - state.distance;
    const laneDiff = Math.abs(coin.lane - state.lane);
    if (!coin.taken && laneDiff < 0.33 && Math.abs(localZ - PLAYER_Z) < 34 && Math.abs((state.y + 40) - coin.y) < 32) {
      coin.taken = true;
      state.score += 25;
    }
  }

  state.obstacles = state.obstacles.filter((o) => o.z - state.distance > -130);
  state.coins = state.coins.filter((c) => c.z - state.distance > -80 && !c.taken);

  state.score += Math.floor(dt * state.speed * 0.12);
  scoreEl.textContent = String(state.score);
  speedEl.textContent = `${(state.speed / 0.35).toFixed(1)}x`;
}

function projectPoint(x, y, z) {
  const horizon = 145;
  const depth = Math.max(70, z);
  const scale = 320 / depth;
  return {
    x: canvas.width / 2 + x * scale,
    y: horizon + y * scale,
    scale,
  };
}

function laneX(laneIndex) {
  return LANES[0] + (LANES[2] - LANES[0]) * (laneIndex / 2) - canvas.width / 2;
}

function drawTrack() {
  const horizon = 145;
  ctx.fillStyle = '#18233d';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  ctx.lineTo(canvas.width / 2 - 220, horizon);
  ctx.lineTo(canvas.width / 2 + 220, horizon);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < 28; i++) {
    const z = i * 80 + (state.distance % 80);
    const p1 = projectPoint(-245, 0, z + 100);
    const p2 = projectPoint(245, 0, z + 100);
    const alpha = 1 - i / 28;
    ctx.strokeStyle = `rgba(130,180,255,${0.1 * alpha})`;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  for (const lane of [-80, 80]) {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    const near = projectPoint(lane, 0, 120);
    const far = projectPoint(lane, 0, 2000);
    ctx.moveTo(near.x, near.y);
    ctx.lineTo(far.x, far.y);
    ctx.stroke();
  }
}

function drawObstacle(obstacle) {
  const z = obstacle.z - state.distance;
  if (z < 60) return;

  const x = laneX(obstacle.lane);
  const foot = projectPoint(x, 0, z);
  const top = projectPoint(x, obstacle.height, z);
  const w = Math.max(18, 76 * foot.scale);

  ctx.fillStyle = obstacle.type === 'low' ? '#f8b400' : obstacle.type === 'high' ? '#ff5f6d' : '#f94144';
  ctx.fillRect(foot.x - w / 2, top.y, w, foot.y - top.y);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(foot.x - w / 2, top.y, w, 5);
}

function drawCoin(coin) {
  const z = coin.z - state.distance;
  if (z < 60) return;

  const x = laneX(coin.lane);
  const p = projectPoint(x, coin.y, z);
  const r = Math.max(4, 10 * p.scale);
  ctx.fillStyle = '#ffd93d';
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.stroke();
}

function drawPlayer() {
  const x = laneX(state.lane);
  const isSliding = state.slideMs > 0 && state.y === 0;
  const bodyHeight = isSliding ? 36 : 70;
  const yBase = 44 + state.y;

  const feet = projectPoint(x, yBase - bodyHeight, PLAYER_Z);
  const base = projectPoint(x, yBase, PLAYER_Z);
  const w = Math.max(20, 66 * base.scale);

  ctx.fillStyle = '#48d1cc';
  ctx.fillRect(base.x - w / 2, feet.y, w, base.y - feet.y);

  const head = projectPoint(x, yBase + 20, PLAYER_Z);
  const hr = Math.max(6, 13 * base.scale);
  ctx.fillStyle = '#ffddc1';
  ctx.beginPath();
  ctx.arc(head.x, head.y, hr, 0, Math.PI * 2);
  ctx.fill();
}

function drawOverlay() {
  if (!state.over && state.running) return;

  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 46px system-ui';
  ctx.fillText(state.over ? 'Game Over' : 'Runner Rush', canvas.width / 2, 190);

  ctx.font = '22px system-ui';
  const info = state.over ? `Punkte: ${state.score}  |  R für Neustart` : 'Klicke Start oder drücke R';
  ctx.fillText(info, canvas.width / 2, 240);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTrack();
  state.obstacles
    .slice()
    .sort((a, b) => b.z - a.z)
    .forEach(drawObstacle);
  state.coins
    .slice()
    .sort((a, b) => b.z - a.z)
    .forEach(drawCoin);
  drawPlayer();
  drawOverlay();
}

function gameLoop(timestamp) {
  const dt = timestamp - state.lastTimestamp;
  state.lastTimestamp = timestamp;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function moveLeft() {
  state.targetLane = Math.max(0, state.targetLane - 1);
}

function moveRight() {
  state.targetLane = Math.min(2, state.targetLane + 1);
}

function jump() {
  if (state.y === 0) {
    state.vy = JUMP_VELOCITY;
  }
}

function slide() {
  if (state.y === 0) {
    state.slideMs = 520;
  }
}

function handleKey(event) {
  switch (event.key) {
    case 'ArrowLeft':
      moveLeft();
      break;
    case 'ArrowRight':
      moveRight();
      break;
    case 'ArrowUp':
      jump();
      break;
    case 'ArrowDown':
      slide();
      break;
    case 'r':
    case 'R':
      resetGame();
      break;
    default:
      break;
  }
}

let touchStartX = 0;
let touchStartY = 0;
canvas.addEventListener('touchstart', (event) => {
  const touch = event.changedTouches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
});

canvas.addEventListener('touchend', (event) => {
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 25) moveRight();
    if (dx < -25) moveLeft();
  } else {
    if (dy < -22) jump();
    if (dy > 22) slide();
  }
});

window.addEventListener('keydown', handleKey);
startButton.addEventListener('click', resetGame);

resetGame();
render();
requestAnimationFrame(gameLoop);
