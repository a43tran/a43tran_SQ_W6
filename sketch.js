// ============================================================
// Side Quest Week 6
// ============================================================

const WORLD_W = 1600;
const WORLD_H = 2000;

let camX = 0;
let camY = 0;
const CAM_SMOOTHING = 0.1;

const PLAYER_SPEED = 3;
const BULLET_SPEED = 10;
const SHOOT_COOLDOWN = 12;
const INVINCIBLE_FRAMES = 90;

let backgroundImg;
let characterSheet;
let enemySheet;

const SPRITE = {
  frameWidth: 75,
  frameHeight: 150,
  numFrames: 4,
  animSpeed: 20,
  scale: 0.5,
  rows: {
    down: 0,
    up: 1,
    right: 2,
    left: 3,
  },
  offsets: {
    down: { x: 0, y: 0 },
    up: { x: 0, y: 0 },
    right: { x: 0.1, y: 10 },
    left: { x: 2.2, y: 20 },
  },
};

let player = {
  x: WORLD_W / 2,
  y: WORLD_H - 200,
  r: 22,
  blobT: 0,
  direction: { x: 0, y: -1 },
  shootTimer: 0,
  health: 5,
  maxHealth: 5,
  invincible: false,
  invincibleTimer: 0,
  bounceVX: 0,
  bounceVY: 0,
  frame: 0,
  frameTimer: 0,
};

let bullets = [];
let enemies = [];
let obstacleData;
let obstacles = [];
let enemyData;
let nextWave = 0;

let boss = null;
let bossData = null;
const BOSS_ZONE_Y = 300;

let bgShapes = [];

const MAP_W = 120;
const MAP_H = 120;
const MAP_X = 16;
const MAP_Y_OFFSET = 16;

let score = 0;

const STATE_PLAY = "play";
const STATE_BOSS = "boss";
const STATE_WIN = "win";
const STATE_OVER = "over";
let gameState = STATE_PLAY;

let shootSound;
let hitSound;
let playerHitSound;
let bossHitSound;
let bossMusic;
let winSound;
let music;

function preload() {
  enemyData = loadJSON("data/enemies.json");
  obstacleData = loadJSON("data/obstacles.json");

  backgroundImg = loadImage("assets/images/bg.png");
  characterSheet = loadImage("assets/images/werewolf.png");
  enemySheet = loadImage("assets/images/villager.png");

  shootSound = loadSound("assets/sounds/shoot.mp3");
  hitSound = loadSound("assets/sounds/hit.mp3");
  playerHitSound = loadSound("assets/sounds/hit.mp3");
  bossHitSound = loadSound("assets/sounds/bosshit.mp3");
  bossMusic = loadSound("assets/sounds/bossmusic.mp3");
  winSound = loadSound("assets/sounds/win.mp3");
  music = loadSound("assets/sounds/bg.mp3");
}

function setup() {
  createCanvas(800, 450);
  bossData = enemyData.boss;

  for (let i = 0; i < obstacleData.obstacles.length; i++) {
    let o = obstacleData.obstacles[i];
    obstacles.push({ x: o.x, y: o.y, size: o.size });
  }

  for (let i = 0; i < 120; i++) {
    bgShapes.push({
      x: random(WORLD_W),
      y: random(WORLD_H),
      type: random() > 0.5 ? "circle" : "rect",
      size: random(10, 50),
      r: floor(random(190, 255)),
      g: floor(random(180, 255)),
      b: floor(random(100, 180)),
    });
  }

  camX = player.x - width / 2;
  camY = player.y - height / 2;

  music.loop();
}

function draw() {
  background(20);

  updateCamera();

  push();
  translate(-camX, -camY);

  drawBackground();
  drawBossZone();

  if (gameState === STATE_PLAY) {
    handleInput();
    applyBounce();
    updateBullets();
    updateEnemies();
    checkWaveSpawns();
    checkBossZone();
    checkBulletEnemyCollisions();
    checkEnemyPlayerCollision();
    checkObstaclePlayerCollision();
    updateInvincibility();
    drawObstacles();
    drawEnemies();
    drawBullets();
    drawPlayer();
  } else if (gameState === STATE_BOSS) {
    handleInput();
    applyBounce();
    updateBullets();
    updateBoss();
    checkBulletBossCollision();
    checkBossPlayerCollision();
    checkObstaclePlayerCollision();
    updateInvincibility();
    drawObstacles();
    drawBoss();
    drawBullets();
    drawPlayer();
  }

  pop();

  drawHUD();
  drawMinimap();

  if (gameState === STATE_BOSS) drawBossHUD();
  if (gameState === STATE_WIN) drawWinScreen();
  if (gameState === STATE_OVER) drawGameOver();
}

function updateCamera() {
  let targetX = player.x - width / 2;
  let targetY = player.y - height / 2;

  targetX = constrain(targetX, 0, WORLD_W - width);
  targetY = constrain(targetY, 0, WORLD_H - height);

  camX = lerp(camX, targetX, CAM_SMOOTHING);
  camY = lerp(camY, targetY, CAM_SMOOTHING);
}

function drawObstacles() {
  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];

    if (
      o.x + o.size < camX ||
      o.x - o.size > camX + width ||
      o.y + o.size < camY ||
      o.y - o.size > camY + height
    )
      continue;

    let x = o.x - o.size / 2;
    let y = o.y - o.size / 2;
    let s = o.size;

    let glow = map(sin(frameCount * 0.05 + i * 1.2), -1, 1, 40, 90);

    push();

    noStroke();
    fill(255, 236, 168, glow);
    rect(x - 4, y - 4, s + 8, s + 8, 8);

    fill(235, 188, 70);
    rect(x, y, s, s, 4);

    fill(255, 226, 122);
    rect(x + s * 0.1, y + s * 0.1, s * 0.4, s * 0.35, 2);
    rect(x + s * 0.55, y + s * 0.5, s * 0.35, s * 0.3, 2);
    rect(x + s * 0.2, y + s * 0.6, s * 0.25, s * 0.25, 2);

    stroke(186, 147, 7);
    strokeWeight(1.5);
    line(x + s * 0.3, y, x + s * 0.5, y + s * 0.4);
    line(x + s * 0.5, y + s * 0.4, x + s * 0.7, y + s * 0.6);
    line(x, y + s * 0.5, x + s * 0.3, y + s * 0.7);
    line(x + s * 0.3, y + s * 0.7, x + s * 0.6, y + s);

    noStroke();
    fill(201, 154, 44, 180);
    rect(x, y, s, 3, 2);
    rect(x, y, 3, s, 2);

    pop();
  }
}

function checkObstaclePlayerCollision() {
  if (player.invincible) return;

  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];

    let closestX = constrain(player.x, o.x - o.size / 2, o.x + o.size / 2);
    let closestY = constrain(player.y, o.y - o.size / 2, o.y + o.size / 2);
    let d = dist(player.x, player.y, closestX, closestY);

    if (d < player.r) {
      player.health--;
      player.invincible = true;
      player.invincibleTimer = INVINCIBLE_FRAMES;

      let dx = player.x - o.x;
      let dy = player.y - o.y;
      let len = dist(0, 0, dx, dy);
      if (len > 0) {
        player.bounceVX = (dx / len) * 8;
        player.bounceVY = (dy / len) * 8;
      }

      playerHitSound.play();

      if (player.health <= 0) {
        gameState = STATE_OVER;
        music.stop();
      }
      break;
    }
  }
}

function getPlayerAnimRow() {
  if (player.direction.y === -1) return SPRITE.rows.up;
  if (player.direction.y === 1) return SPRITE.rows.down;
  if (player.direction.x === -1) return SPRITE.rows.left;
  if (player.direction.x === 1) return SPRITE.rows.right;
  return SPRITE.rows.down;
}

function getEnemyAnimRow(enemy) {
  if (enemy.direction.y === -1) return SPRITE.rows.up;
  if (enemy.direction.y === 1) return SPRITE.rows.down;
  if (enemy.direction.x === -1) return SPRITE.rows.left;
  if (enemy.direction.x === 1) return SPRITE.rows.right;
  return SPRITE.rows.down;
}

function applyBounce() {
  if (abs(player.bounceVX) > 0.1 || abs(player.bounceVY) > 0.1) {
    player.x += player.bounceVX;
    player.y += player.bounceVY;
    player.bounceVX *= 0.75;
    player.bounceVY *= 0.75;

    player.x = constrain(player.x, player.r, WORLD_W - player.r);
    player.y = constrain(player.y, player.r, WORLD_H - player.r);
  }
}

function drawBackground() {
  push();
  image(backgroundImg, 0, 0, WORLD_W, WORLD_H);
  filter(BLUR, 2);
  pop();

  noStroke();
  for (let i = 0; i < bgShapes.length; i++) {
    let s = bgShapes[i];

    if (
      s.x < camX - s.size ||
      s.x > camX + width + s.size ||
      s.y < camY - s.size ||
      s.y > camY + height + s.size
    )
      continue;

    fill(s.r, s.g, s.b, 45);

    if (s.type === "circle") {
      ellipse(s.x, s.y, s.size);
    } else {
      rect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size, 3);
    }
  }

  noFill();
  stroke(60, 50, 80);
  strokeWeight(4);
  rect(0, 0, WORLD_W, WORLD_H);
  noStroke();
}

function drawBossZone() {
  noStroke();
  if (gameState === STATE_BOSS) {
    fill(255, 80, 80, 30);
  } else {
    fill(255, 150, 30, 20);
  }
  rect(0, 0, WORLD_W, BOSS_ZONE_Y);

  stroke(
    gameState === STATE_BOSS
      ? color(255, 80, 80, 100)
      : color(255, 150, 30, 60),
  );
  strokeWeight(2);
  drawingContext.setLineDash([10, 8]);
  line(0, BOSS_ZONE_Y, WORLD_W, BOSS_ZONE_Y);
  drawingContext.setLineDash([]);
  noStroke();
}

function handleInput() {
  if (keyIsDown(87)) {
    player.y -= PLAYER_SPEED;
    player.direction = { x: 0, y: -1 };
  }
  if (keyIsDown(83)) {
    player.y += PLAYER_SPEED;
    player.direction = { x: 0, y: 1 };
  }
  if (keyIsDown(65)) {
    player.x -= PLAYER_SPEED;
    player.direction = { x: -1, y: 0 };
  }
  if (keyIsDown(68)) {
    player.x += PLAYER_SPEED;
    player.direction = { x: 1, y: 0 };
  }

  player.x = constrain(player.x, player.r, WORLD_W - player.r);
  player.y = constrain(player.y, player.r, WORLD_H - player.r);

  if (player.shootTimer > 0) player.shootTimer--;

  if (keyIsDown(32) && player.shootTimer === 0) {
    bullets.push({
      x: player.x + player.direction.x * (player.r + 4),
      y: player.y + player.direction.y * (player.r + 4),
      vx: player.direction.x * BULLET_SPEED,
      vy: player.direction.y * BULLET_SPEED,
    });
    player.shootTimer = SHOOT_COOLDOWN;
    shootSound.play();
  }

  if (keyIsDown(87) || keyIsDown(83) || keyIsDown(65) || keyIsDown(68)) {
    player.frameTimer++;
    if (player.frameTimer >= SPRITE.animSpeed) {
      player.frame = (player.frame + 1) % SPRITE.numFrames;
      player.frameTimer = 0;
    } else {
      player.frame = 0;
    }
  }
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].x += bullets[i].vx;
    bullets[i].y += bullets[i].vy;

    if (
      bullets[i].x < 0 ||
      bullets[i].x > WORLD_W ||
      bullets[i].y < 0 ||
      bullets[i].y > WORLD_H
    ) {
      bullets.splice(i, 1);
    }
  }
}

function checkWaveSpawns() {
  if (nextWave >= enemyData.waves.length) return;

  let wave = enemyData.waves[nextWave];
  if (player.y < wave.spawnAt) {
    for (let i = 0; i < wave.enemies.length; i++) {
      let data = wave.enemies[i];
      enemies.push({
        x: random(100, WORLD_W - 100),
        y: random(BOSS_ZONE_Y + 50, BOSS_ZONE_Y + 300),
        r: 20,
        speed: data.speed,
        blobT: random(100),

        frame: 0,
        frameTimer: 0,
        direction: { x: 0, y: 1 },
      });
    }
    nextWave++;
  }
}

function checkBossZone() {
  if (boss !== null) return;
  if (player.y > BOSS_ZONE_Y) return;

  spawnBoss();
}

function spawnBoss() {
  boss = {
    x: WORLD_W / 2,
    y: bossData.retreatY,
    r: bossData.r,
    health: bossData.health,
    maxHealth: bossData.health,
    blobT: 0,
    state: "pausing",
    pauseTimer: bossData.chargePause,
    chargeSpeed: bossData.chargeSpeed,
    retreatSpeed: bossData.retreatSpeed,
    retreatY: bossData.retreatY,
    chargeVX: 0,
    chargeVY: 0,
  };

  enemies = [];
  gameState = STATE_BOSS;

  music.stop();
  bossMusic.loop();
}

function updateEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    let e = enemies[i];
    let dx = player.x - e.x;
    let dy = player.y - e.y;
    let d = dist(e.x, e.y, player.x, player.y);

    if (d > 0) {
      e.x += (dx / d) * e.speed;
      e.y += (dy / d) * e.speed;
    }

    if (abs(dx) > abs(dy)) {
      enemies[i].direction = { x: dx > 0 ? 1 : -1, y: 0 };
    } else {
      enemies[i].direction = { x: 0, y: dy > 0 ? 1 : -1 };
    }

    e.frameTimer++;
    if (e.frameTimer >= SPRITE.animSpeed) {
      e.frame = (e.frame + 1) % SPRITE.numFrames;
      e.frameTimer = 0;
    }
  }
}

function updateBoss() {
  if (!boss) return;

  if (boss.state === "pausing") {
    boss.pauseTimer--;
    if (boss.pauseTimer <= 0) {
      let dx = player.x - boss.x;
      let dy = player.y - boss.y;
      let d = dist(boss.x, boss.y, player.x, player.y);
      boss.chargeVX = (dx / d) * boss.chargeSpeed;
      boss.chargeVY = (dy / d) * boss.chargeSpeed;
      boss.state = "charging";
    }
  } else if (boss.state === "charging") {
    boss.x += boss.chargeVX;
    boss.y += boss.chargeVY;

    let pastPlayer =
      dist(boss.x, boss.y, player.x, player.y) > 200 && boss.y > player.y;
    let offWorld =
      boss.x < 0 || boss.x > WORLD_W || boss.y < 0 || boss.y > WORLD_H;

    if (pastPlayer || offWorld) {
      boss.state = "retreating";
    }
  } else if (boss.state === "retreating") {
    let targetX = WORLD_W / 2;
    let targetY = boss.retreatY;
    let dx = targetX - boss.x;
    let dy = targetY - boss.y;
    let d = dist(boss.x, boss.y, targetX, targetY);

    if (d < 8) {
      boss.x = targetX;
      boss.y = targetY;
      boss.state = "pausing";
      boss.pauseTimer = bossData.chargePause;
    } else {
      boss.x += (dx / d) * boss.retreatSpeed;
      boss.y += (dy / d) * boss.retreatSpeed;
    }
  }
}

function checkBulletBossCollision() {
  if (!boss) return;

  for (let i = bullets.length - 1; i >= 0; i--) {
    let d = dist(bullets[i].x, bullets[i].y, boss.x, boss.y);
    if (d < boss.r + 6) {
      bullets.splice(i, 1);
      boss.health--;
      bossHitSound.play();

      if (boss.health <= 0) {
        gameState = STATE_WIN;
        winSound.play();
        bossMusic.stop();
      }
      break;
    }
  }
}

function checkBossPlayerCollision() {
  if (!boss || player.invincible) return;

  let d = dist(player.x, player.y, boss.x, boss.y);
  if (d < player.r + boss.r - 10) {
    player.health--;
    player.invincible = true;
    player.invincibleTimer = INVINCIBLE_FRAMES;
    playerHitSound.play();

    if (player.health <= 0) {
      gameState = STATE_OVER;
      bossMusic.stop();
    }
  }
}

function checkEnemyPlayerCollision() {
  if (player.invincible) return;

  for (let i = 0; i < enemies.length; i++) {
    let d = dist(player.x, player.y, enemies[i].x, enemies[i].y);
    if (d < player.r + enemies[i].r - 8) {
      player.health--;
      player.invincible = true;
      player.invincibleTimer = INVINCIBLE_FRAMES;
      playerHitSound.play();

      if (player.health <= 0) {
        gameState = STATE_OVER;
        music.stop();
      }
      break;
    }
  }
}

function checkBulletEnemyCollisions() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    for (let j = enemies.length - 1; j >= 0; j--) {
      let d = dist(bullets[i].x, bullets[i].y, enemies[j].x, enemies[j].y);
      if (d < enemies[j].r + 6) {
        bullets.splice(i, 1);
        enemies.splice(j, 1);
        score++;
        hitSound.play();
        break;
      }
    }
  }
}

function updateInvincibility() {
  if (player.invincible) {
    player.invincibleTimer--;
    if (player.invincibleTimer <= 0) {
      player.invincible = false;
    }
  }
}

function drawBoss() {
  if (!boss) return;

  push();
  let isCharging = boss.state === "charging";
  fill(isCharging ? color(255, 180, 30) : color(255, 130, 20));
  noStroke();

  beginShape();
  let numPoints = 48;
  let wobble = isCharging ? 12 : 8;
  for (let i = 0; i < numPoints; i++) {
    let angle = (TWO_PI / numPoints) * i;
    let noiseVal = noise(
      cos(angle) * 0.8 + boss.blobT,
      sin(angle) * 0.8 + boss.blobT,
    );
    let r = boss.r + map(noiseVal, 0, 1, -wobble, wobble);
    vertex(boss.x + cos(angle) * r, boss.y + sin(angle) * r);
  }
  endShape(CLOSE);

  fill(10);
  ellipse(boss.x - 18, boss.y - 12, 16, 16);
  ellipse(boss.x + 18, boss.y - 12, 16, 16);

  stroke(10);
  strokeWeight(4);
  line(boss.x - 26, boss.y - 22, boss.x - 10, boss.y - 18);
  line(boss.x + 10, boss.y - 18, boss.x + 26, boss.y - 22);

  pop();
  boss.blobT += 0.02;
}

function drawEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    let e = enemies[i];

    push();
    imageMode(CENTER);

    let row = getEnemyAnimRow(e);
    let sx = e.frame * SPRITE.frameWidth;
    let sy = row * SPRITE.frameHeight;

    let off =
      SPRITE.offsets[
        Object.keys(SPRITE.rows).find((k) => SPRITE.rows[k] === row)
      ];

    image(
      enemySheet,
      e.x + off.x,
      e.y + off.y,
      SPRITE.frameWidth * SPRITE.scale,
      SPRITE.frameHeight * SPRITE.scale,
      sx,
      sy,
      SPRITE.frameWidth,
      SPRITE.frameHeight,
    );

    pop();
  }
}

function drawBullets() {
  fill(255);
  noStroke();
  for (let i = 0; i < bullets.length; i++) {
    ellipse(bullets[i].x, bullets[i].y, 10);
  }
}

function drawPlayer() {
  if (player.invincible && floor(player.invincibleTimer / 6) % 2 === 0) return;

  push();
  imageMode(CENTER);

  let row = getPlayerAnimRow();
  let sx = player.frame * SPRITE.frameWidth;
  let sy = row * SPRITE.frameHeight;

  let off =
    SPRITE.offsets[
      Object.keys(SPRITE.rows).find((k) => SPRITE.rows[k] === row)
    ];

  image(
    characterSheet,
    player.x + off.x,
    player.y + off.y,
    SPRITE.frameWidth * SPRITE.scale,
    SPRITE.frameHeight * SPRITE.scale,
    sx,
    sy,
    SPRITE.frameWidth,
    SPRITE.frameHeight,
  );

  pop();
}

function drawMinimap() {
  let mapX = MAP_X;
  let mapY = height - MAP_H - MAP_Y_OFFSET;

  fill(0, 0, 0, 180);
  stroke(80, 60, 120);
  strokeWeight(1);
  rect(mapX, mapY, MAP_W, MAP_H, 4);
  noStroke();

  let zoneH = map(BOSS_ZONE_Y, 0, WORLD_H, 0, MAP_H);
  fill(255, 150, 30, 40);
  rect(mapX, mapY, MAP_W, zoneH, 4);

  function worldToMap(wx, wy) {
    return {
      x: mapX + map(wx, 0, WORLD_W, 0, MAP_W),
      y: mapY + map(wy, 0, WORLD_H, 0, MAP_H),
    };
  }

  fill(255, 150, 30);
  for (let i = 0; i < enemies.length; i++) {
    let p = worldToMap(enemies[i].x, enemies[i].y);
    ellipse(p.x, p.y, 5);
  }

  if (boss) {
    fill(255, 60, 60);
    let p = worldToMap(boss.x, boss.y);
    ellipse(p.x, p.y, 8);
  }

  fill(0, 200, 180);
  let pp = worldToMap(player.x, player.y);
  ellipse(pp.x, pp.y, 7);

  noFill();
  stroke(255, 255, 255, 60);
  strokeWeight(1);
  let vp = worldToMap(camX, camY);
  let vpW = map(width, 0, WORLD_W, 0, MAP_W);
  let vpH = map(height, 0, WORLD_H, 0, MAP_H);
  rect(vp.x, vp.y, vpW, vpH);
  noStroke();

  fill(120);
  textSize(9);
  textAlign(LEFT);
  textFont("monospace");
  text("MAP", mapX + 4, mapY + MAP_H - 4);
}

function drawHUD() {
  noStroke();

  fill(160);
  textSize(13);
  textAlign(LEFT);
  textFont("monospace");
  text("Move: WASD   Shoot: Spacebar   B: Boss fight", 16, 24);
  fill(224, 208, 22);
  text("Don't get voted by the villagers!", 16, 40);

  fill(255);
  textSize(16);
  textAlign(RIGHT);
  text("Score: " + score, width - 16, 28);

  let barW = 160;
  let barH = 14;
  let barX = width - barW - 16;
  let barY = 40;
  let fillW = map(player.health, 0, player.maxHealth, 0, barW);

  fill(40);
  rect(barX, barY, barW, barH, 4);

  let healthColour = lerpColor(
    color(220, 60, 60),
    color(60, 220, 120),
    player.health / player.maxHealth,
  );
  fill(healthColour);
  rect(barX, barY, fillW, barH, 4);

  fill(200);
  textSize(11);
  textAlign(RIGHT);
  text("Health", width - 16, barY + barH + 12);

  if (gameState === STATE_PLAY && player.y < 600) {
    fill(255, 150, 30, map(player.y, 600, BOSS_ZONE_Y, 0, 255));
    textAlign(CENTER);
    textSize(14);
    text("Boss zone ahead — proceed carefully", width / 2, height - 20);
  }
}

function drawBossHUD() {
  if (!boss) return;

  let barW = 400;
  let barH = 18;
  let barX = (width - barW) / 2;
  let barY = 10;
  let fillW = map(boss.health, 0, boss.maxHealth, 0, barW);

  fill(40);
  rect(barX, barY, barW, barH, 4);

  let bossColour = lerpColor(
    color(220, 60, 60),
    color(255, 150, 30),
    boss.health / boss.maxHealth,
  );
  fill(bossColour);
  rect(barX, barY, fillW, barH, 4);

  fill(255);
  textSize(12);
  textAlign(CENTER);
  textFont("monospace");
  text("BOSS", width / 2, barY + barH + 14);
}

function drawWinScreen() {
  fill(0, 0, 0, 160);
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER);
  textSize(52);
  text("Boss Defeated!", width / 2, height / 2 - 30);

  fill(180);
  textSize(18);
  text("Score: " + score, width / 2, height / 2 + 20);

  fill(120);
  textSize(14);
  text("Press R to play again", width / 2, height / 2 + 60);
}

function drawGameOver() {
  fill(0, 0, 0, 160);
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER);
  textSize(52);
  text("Game Over", width / 2, height / 2 - 30);

  fill(180);
  textSize(18);
  text("Score: " + score, width / 2, height / 2 + 20);

  fill(120);
  textSize(14);
  text("Press R to play again", width / 2, height / 2 + 60);
}

function keyPressed() {
  if (key === "b" || key === "B") {
    player.y = BOSS_ZONE_Y - 10;
    if (!boss) spawnBoss();
  }

  if (
    (key === "r" || key === "R") &&
    gameState !== STATE_PLAY &&
    gameState !== STATE_BOSS
  ) {
    gameState = STATE_PLAY;
    score = 0;
    nextWave = 0;
    bullets = [];
    enemies = [];
    boss = null;

    player.x = WORLD_W / 2;
    player.y = WORLD_H - 200;
    player.direction = { x: 0, y: -1 };
    player.shootTimer = 0;
    player.health = player.maxHealth;
    player.invincible = false;
    player.invincibleTimer = 0;
    player.bounceVX = 0;
    player.bounceVY = 0;

    camX = player.x - width / 2;
    camY = player.y - height / 2;

    music.loop();
  }
}
