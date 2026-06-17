// ============================================================
// Week 6 Example 2 — Free Roam Top-Down with Boss Battle
// ============================================================
// The player moves freely around a world larger than the canvas.
// A smooth-follow camera keeps the player centred.
// Enemy waves are loaded from JSON and chase the player.
// A minimap in the bottom-right corner shows the player and
// enemy positions at all times.
// A giant orange blob boss spawns when the player enters the
// boss zone at the top of the world. Defeat it to win.
// Press B to skip straight to the boss for testing.
//
// Files:
//   sketch.js           — all game logic
//   data/enemies.json   — wave trigger positions, enemy data, boss data
//   data/obstacles.json — obstacle positions in world coordinates
// ============================================================

// ------------------------------------------------------------
// WORLD
// The world is larger than the canvas. The camera follows
// the player so only part of the world is visible at once.
// ------------------------------------------------------------
const WORLD_W = 1600; // total world width in pixels
const WORLD_H = 2000; // total world height in pixels

// ------------------------------------------------------------
// CAMERA
// camX and camY are the world coordinates at the top-left
// of the canvas. translate(-camX, -camY) shifts everything
// so the player appears centred on screen.
// ------------------------------------------------------------
let camX = 0;
let camY = 0;
const CAM_SMOOTHING = 0.1;

// ------------------------------------------------------------
// PLAYER CONFIGURATION
// ------------------------------------------------------------
const PLAYER_SPEED = 3;
const BULLET_SPEED = 10;
const SHOOT_COOLDOWN = 12;
const INVINCIBLE_FRAMES = 90;

// ------------------------------------------------------------
// PLAYER
// Position is in world coordinates.
// Starts near the bottom centre of the world.
// ------------------------------------------------------------
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
};

// ------------------------------------------------------------
// BULLETS and ENEMIES
// Positions are in world coordinates.
// ------------------------------------------------------------
let bullets = [];
let enemies = [];

// ------------------------------------------------------------
// OBSTACLES
// Loaded from data/obstacles.json in preload().
// Positioned in world coordinates — drawn and collided in
// world space. Player takes damage and bounces on contact.
// ------------------------------------------------------------
let obstacleData;
let obstacles = [];

// ------------------------------------------------------------
// WAVE SYSTEM
// Each wave has a triggerY — spawns when player.y < triggerY.
// nextWave tracks which wave to check next.
// ------------------------------------------------------------
let enemyData;
let nextWave = 0;

// ------------------------------------------------------------
// BOSS
// Spawns when player enters the boss zone (player.y < bossZoneY).
// ------------------------------------------------------------
let boss = null;
let bossData = null;
const BOSS_ZONE_Y = 300; // world Y — enter this zone to trigger boss

// ------------------------------------------------------------
// BACKGROUND SHAPES
// Scattered across the world — drawn in world coordinates.
// ------------------------------------------------------------
let bgShapes = [];

// ------------------------------------------------------------
// MINIMAP
// Drawn in screen coordinates after pop().
// Shows a scaled-down version of the world with dots for
// the player (teal) and enemies (orange).
// ------------------------------------------------------------
const MAP_W = 120; // minimap width in pixels
const MAP_H = 120; // minimap height in pixels
const MAP_X = 16;  // screen position — bottom left
const MAP_Y_OFFSET = 16; // offset from bottom of screen

// ------------------------------------------------------------
// GAME STATE
// ------------------------------------------------------------
let score = 0;

const STATE_PLAY = "play";
const STATE_BOSS = "boss";
const STATE_WIN = "win";
const STATE_OVER = "over";
let gameState = STATE_PLAY;

// ------------------------------------------------------------
// SOUNDS — uncomment and fill in paths to add audio
// ------------------------------------------------------------
// let shootSound;
// let hitSound;
// let playerHitSound;
// let bossHitSound;
// let bossMusic;
// let winSound;
// let music;

// ============================================================
// preload()
// ============================================================
function preload() {
  enemyData    = loadJSON("data/enemies.json");
  obstacleData = loadJSON("data/obstacles.json");

  // Uncomment to load sounds:
  // shootSound     = loadSound("assets/sounds/shoot.wav");
  // hitSound       = loadSound("assets/sounds/hit.wav");
  // playerHitSound = loadSound("assets/sounds/playerhit.wav");
  // bossHitSound   = loadSound("assets/sounds/bosshit.wav");
  // bossMusic      = loadSound("assets/sounds/bossmusic.mp3");
  // winSound       = loadSound("assets/sounds/win.wav");
  // music          = loadSound("assets/sounds/music.mp3");
}

// ============================================================
// setup()
// ============================================================
function setup() {
  createCanvas(800, 450);
  bossData = enemyData.boss;

  // Build obstacle objects from JSON
  for (let i = 0; i < obstacleData.obstacles.length; i++) {
    let o = obstacleData.obstacles[i];
    obstacles.push({ x: o.x, y: o.y, size: o.size });
  }

  // Generate background shapes across the world
  for (let i = 0; i < 120; i++) {
    bgShapes.push({
      x: random(WORLD_W),
      y: random(WORLD_H),
      type: random() > 0.5 ? "circle" : "rect",
      size: random(10, 50),
      r: floor(random(30, 70)),
      g: floor(random(30, 70)),
      b: floor(random(50, 100)),
    });
  }

  // Start camera so player is visible
  camX = player.x - width / 2;
  camY = player.y - height / 2;

  // Uncomment to start music:
  // music.loop();
}

// ============================================================
// draw()
// ============================================================
function draw() {
  background(20);

  updateCamera();

  // Everything inside push/pop is drawn in world coordinates
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

  pop(); // restore screen coordinates

  // HUD and minimap are drawn in screen coordinates
  drawHUD();
  drawMinimap();

  if (gameState === STATE_BOSS) drawBossHUD();
  if (gameState === STATE_WIN)  drawWinScreen();
  if (gameState === STATE_OVER) drawGameOver();
}

// ------------------------------------------------------------
// updateCamera()
// Smoothly moves the camera toward the player each frame.
// Clamps so the camera never shows outside the world.
// ------------------------------------------------------------
function updateCamera() {
  let targetX = player.x - width / 2;
  let targetY = player.y - height / 2;

  targetX = constrain(targetX, 0, WORLD_W - width);
  targetY = constrain(targetY, 0, WORLD_H - height);

  camX = lerp(camX, targetX, CAM_SMOOTHING);
  camY = lerp(camY, targetY, CAM_SMOOTHING);
}

// ------------------------------------------------------------
// drawObstacles()
// Drawn in world coordinates inside push/pop.
// Only draws obstacles near the camera for performance.
// ------------------------------------------------------------
function drawObstacles() {
  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];

    // Skip if off screen
    if (
      o.x + o.size < camX || o.x - o.size > camX + width ||
      o.y + o.size < camY || o.y - o.size > camY + height
    ) continue;

    let x = o.x - o.size / 2;
    let y = o.y - o.size / 2;
    let s = o.size;

    // Animated glow — pulses using sin(frameCount)
    let glow = map(sin(frameCount * 0.05 + i * 1.2), -1, 1, 40, 90);

    push();

    // Outer glow
    noStroke();
    fill(255, 100, 0, glow);
    rect(x - 4, y - 4, s + 8, s + 8, 8);

    // Lava base
    fill(180, 40, 0);
    rect(x, y, s, s, 4);

    // Lava surface patches
    fill(220, 80, 10);
    rect(x + s * 0.1, y + s * 0.1, s * 0.4, s * 0.35, 2);
    rect(x + s * 0.55, y + s * 0.5, s * 0.35, s * 0.3, 2);
    rect(x + s * 0.2, y + s * 0.6, s * 0.25, s * 0.25, 2);

    // Crack lines
    stroke(100, 20, 0);
    strokeWeight(1.5);
    line(x + s * 0.3, y, x + s * 0.5, y + s * 0.4);
    line(x + s * 0.5, y + s * 0.4, x + s * 0.7, y + s * 0.6);
    line(x, y + s * 0.5, x + s * 0.3, y + s * 0.7);
    line(x + s * 0.3, y + s * 0.7, x + s * 0.6, y + s);

    // Hot edge highlight
    noStroke();
    fill(255, 140, 0, 180);
    rect(x, y, s, 3, 2);
    rect(x, y, 3, s, 2);

    pop();
  }
}

// ------------------------------------------------------------
// checkObstaclePlayerCollision()
// Circle-rectangle overlap test — same as Example 1.
// Player bounces away and loses health on contact.
// ------------------------------------------------------------
function checkObstaclePlayerCollision() {
  if (player.invincible) return;

  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];

    let closestX = constrain(player.x, o.x - o.size / 2, o.x + o.size / 2);
    let closestY = constrain(player.y, o.y - o.size / 2, o.y + o.size / 2);
    let d = dist(player.x, player.y, closestX, closestY);

    if (d < player.r) {
      player.health--;
      player.invincible      = true;
      player.invincibleTimer = INVINCIBLE_FRAMES;

      // Bounce direction — away from obstacle centre
      let dx  = player.x - o.x;
      let dy  = player.y - o.y;
      let len = dist(0, 0, dx, dy);
      if (len > 0) {
        player.bounceVX = (dx / len) * 8;
        player.bounceVY = (dy / len) * 8;
      }

      // playerHitSound.play();

      if (player.health <= 0) {
        gameState = STATE_OVER;
        // music.stop();
      }
      break;
    }
  }
}

// ------------------------------------------------------------
// applyBounce()
// Applies and decays bounce velocity each frame.
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// drawBackground()
// Draws background shapes in world coordinates.
// Only shapes near the camera are drawn for performance.
// ------------------------------------------------------------
function drawBackground() {
  noStroke();
  for (let i = 0; i < bgShapes.length; i++) {
    let s = bgShapes[i];

    // Skip shapes far from the camera view
    if (
      s.x < camX - s.size || s.x > camX + width + s.size ||
      s.y < camY - s.size || s.y > camY + height + s.size
    ) continue;

    fill(s.r, s.g, s.b, 160);

    if (s.type === "circle") {
      ellipse(s.x, s.y, s.size);
    } else {
      rect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size, 3);
    }
  }

  // World boundary outline
  noFill();
  stroke(60, 50, 80);
  strokeWeight(4);
  rect(0, 0, WORLD_W, WORLD_H);
  noStroke();
}

// ------------------------------------------------------------
// drawBossZone()
// Shows a glowing zone at the top of the world where the
// boss will appear. Changes colour once the boss is active.
// ------------------------------------------------------------
function drawBossZone() {
  noStroke();
  if (gameState === STATE_BOSS) {
    fill(255, 80, 80, 30); // red when boss is active
  } else {
    fill(255, 150, 30, 20); // orange hint before boss
  }
  rect(0, 0, WORLD_W, BOSS_ZONE_Y);

  // Dashed boundary line
  stroke(gameState === STATE_BOSS ? color(255, 80, 80, 100) : color(255, 150, 30, 60));
  strokeWeight(2);
  drawingContext.setLineDash([10, 8]);
  line(0, BOSS_ZONE_Y, WORLD_W, BOSS_ZONE_Y);
  drawingContext.setLineDash([]);
  noStroke();
}

// ------------------------------------------------------------
// handleInput()
// WASD moves the player in world coordinates.
// Constrained to world boundaries.
// Spacebar fires in the current facing direction.
// ------------------------------------------------------------
function handleInput() {
  if (keyIsDown(87)) { player.y -= PLAYER_SPEED; player.direction = { x: 0,  y: -1 }; }
  if (keyIsDown(83)) { player.y += PLAYER_SPEED; player.direction = { x: 0,  y:  1 }; }
  if (keyIsDown(65)) { player.x -= PLAYER_SPEED; player.direction = { x: -1, y:  0 }; }
  if (keyIsDown(68)) { player.x += PLAYER_SPEED; player.direction = { x:  1, y:  0 }; }

  // Keep player inside world bounds
  player.x = constrain(player.x, player.r, WORLD_W - player.r);
  player.y = constrain(player.y, player.r, WORLD_H - player.r);

  if (player.shootTimer > 0) player.shootTimer--;

  if (keyIsDown(32) && player.shootTimer === 0) {
    bullets.push({
      x:  player.x + player.direction.x * (player.r + 4),
      y:  player.y + player.direction.y * (player.r + 4),
      vx: player.direction.x * BULLET_SPEED,
      vy: player.direction.y * BULLET_SPEED,
    });
    player.shootTimer = SHOOT_COOLDOWN;
    // shootSound.play();
  }
}

// ------------------------------------------------------------
// updateBullets()
// Bullets travel in world coordinates.
// Removed when they leave the world bounds.
// ------------------------------------------------------------
function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].x += bullets[i].vx;
    bullets[i].y += bullets[i].vy;

    if (
      bullets[i].x < 0 || bullets[i].x > WORLD_W ||
      bullets[i].y < 0 || bullets[i].y > WORLD_H
    ) {
      bullets.splice(i, 1);
    }
  }
}

// ------------------------------------------------------------
// checkWaveSpawns()
// Each wave has a triggerY — spawns when player.y passes it.
// Enemies spawn at random positions near the top of the world.
// ------------------------------------------------------------
function checkWaveSpawns() {
  if (nextWave >= enemyData.waves.length) return;

  let wave = enemyData.waves[nextWave];
  if (player.y < wave.spawnAt) {
    for (let i = 0; i < wave.enemies.length; i++) {
      let data = wave.enemies[i];
      enemies.push({
        x:     random(100, WORLD_W - 100),
        y:     random(BOSS_ZONE_Y + 50, BOSS_ZONE_Y + 300),
        r:     20,
        speed: data.speed,
        blobT: random(100),
      });
    }
    nextWave++;
  }
}

// ------------------------------------------------------------
// checkBossZone()
// Triggers the boss when the player enters the boss zone.
// ------------------------------------------------------------
function checkBossZone() {
  if (boss !== null) return;
  if (player.y > BOSS_ZONE_Y) return;

  spawnBoss();
}

// ------------------------------------------------------------
// spawnBoss()
// Builds the boss object from JSON data.
// Called when the player enters the boss zone or presses B.
// ------------------------------------------------------------
function spawnBoss() {
  boss = {
    x:           WORLD_W / 2,
    y:           bossData.retreatY,
    r:           bossData.r,
    health:      bossData.health,
    maxHealth:   bossData.health,
    blobT:       0,
    state:       "pausing",
    pauseTimer:  bossData.chargePause,
    chargeSpeed: bossData.chargeSpeed,
    retreatSpeed: bossData.retreatSpeed,
    retreatY:    bossData.retreatY,
    chargeVX:    0,
    chargeVY:    0,
  };

  enemies = [];
  gameState = STATE_BOSS;

  // music.stop();
  // bossMusic.loop();
}

// ------------------------------------------------------------
// updateEnemies()
// Enemies move toward the player in world coordinates.
// ------------------------------------------------------------
function updateEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    let e  = enemies[i];
    let dx = player.x - e.x;
    let dy = player.y - e.y;
    let d  = dist(e.x, e.y, player.x, player.y);

    if (d > 0) {
      e.x += (dx / d) * e.speed;
      e.y += (dy / d) * e.speed;
    }
  }
}

// ------------------------------------------------------------
// updateBoss()
// Same charge/retreat/pause cycle as before.
// All positions are in world coordinates.
// ------------------------------------------------------------
function updateBoss() {
  if (!boss) return;

  if (boss.state === "pausing") {
    boss.pauseTimer--;
    if (boss.pauseTimer <= 0) {
      let dx = player.x - boss.x;
      let dy = player.y - boss.y;
      let d  = dist(boss.x, boss.y, player.x, player.y);
      boss.chargeVX = (dx / d) * boss.chargeSpeed;
      boss.chargeVY = (dy / d) * boss.chargeSpeed;
      boss.state    = "charging";
    }

  } else if (boss.state === "charging") {
    boss.x += boss.chargeVX;
    boss.y += boss.chargeVY;

    let pastPlayer = dist(boss.x, boss.y, player.x, player.y) > 200 &&
                     boss.y > player.y;
    let offWorld   = boss.x < 0 || boss.x > WORLD_W ||
                     boss.y < 0 || boss.y > WORLD_H;

    if (pastPlayer || offWorld) {
      boss.state = "retreating";
    }

  } else if (boss.state === "retreating") {
    let targetX = WORLD_W / 2;
    let targetY = boss.retreatY;
    let dx      = targetX - boss.x;
    let dy      = targetY - boss.y;
    let d       = dist(boss.x, boss.y, targetX, targetY);

    if (d < 8) {
      boss.x          = targetX;
      boss.y          = targetY;
      boss.state      = "pausing";
      boss.pauseTimer = bossData.chargePause;
    } else {
      boss.x += (dx / d) * boss.retreatSpeed;
      boss.y += (dy / d) * boss.retreatSpeed;
    }
  }
}

// ------------------------------------------------------------
// checkBulletBossCollision()
// ------------------------------------------------------------
function checkBulletBossCollision() {
  if (!boss) return;

  for (let i = bullets.length - 1; i >= 0; i--) {
    let d = dist(bullets[i].x, bullets[i].y, boss.x, boss.y);
    if (d < boss.r + 6) {
      bullets.splice(i, 1);
      boss.health--;
      // bossHitSound.play();

      if (boss.health <= 0) {
        gameState = STATE_WIN;
        // winSound.play();
        // bossMusic.stop();
      }
      break;
    }
  }
}

// ------------------------------------------------------------
// checkBossPlayerCollision()
// ------------------------------------------------------------
function checkBossPlayerCollision() {
  if (!boss || player.invincible) return;

  let d = dist(player.x, player.y, boss.x, boss.y);
  if (d < player.r + boss.r - 10) {
    player.health--;
    player.invincible      = true;
    player.invincibleTimer = INVINCIBLE_FRAMES;
    // playerHitSound.play();

    if (player.health <= 0) {
      gameState = STATE_OVER;
      // bossMusic.stop();
    }
  }
}

// ------------------------------------------------------------
// checkEnemyPlayerCollision()
// ------------------------------------------------------------
function checkEnemyPlayerCollision() {
  if (player.invincible) return;

  for (let i = 0; i < enemies.length; i++) {
    let d = dist(player.x, player.y, enemies[i].x, enemies[i].y);
    if (d < player.r + enemies[i].r - 8) {
      player.health--;
      player.invincible      = true;
      player.invincibleTimer = INVINCIBLE_FRAMES;
      // playerHitSound.play();

      if (player.health <= 0) {
        gameState = STATE_OVER;
        // music.stop();
      }
      break;
    }
  }
}

// ------------------------------------------------------------
// checkBulletEnemyCollisions()
// ------------------------------------------------------------
function checkBulletEnemyCollisions() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    for (let j = enemies.length - 1; j >= 0; j--) {
      let d = dist(bullets[i].x, bullets[i].y, enemies[j].x, enemies[j].y);
      if (d < enemies[j].r + 6) {
        bullets.splice(i, 1);
        enemies.splice(j, 1);
        score++;
        // hitSound.play();
        break;
      }
    }
  }
}

// ------------------------------------------------------------
// updateInvincibility()
// ------------------------------------------------------------
function updateInvincibility() {
  if (player.invincible) {
    player.invincibleTimer--;
    if (player.invincibleTimer <= 0) {
      player.invincible = false;
    }
  }
}

// ------------------------------------------------------------
// drawBoss()
// Drawn in world coordinates inside push/pop.
// ------------------------------------------------------------
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
    let angle    = (TWO_PI / numPoints) * i;
    let noiseVal = noise(cos(angle) * 0.8 + boss.blobT, sin(angle) * 0.8 + boss.blobT);
    let r        = boss.r + map(noiseVal, 0, 1, -wobble, wobble);
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

// ------------------------------------------------------------
// drawEnemies()
// Drawn in world coordinates.
// ------------------------------------------------------------
function drawEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    let e = enemies[i];
    push();
    fill(255, 150, 30);
    noStroke();

    beginShape();
    let numPoints = 48;
    for (let j = 0; j < numPoints; j++) {
      let angle    = (TWO_PI / numPoints) * j;
      let noiseVal = noise(cos(angle) * 0.8 + e.blobT, sin(angle) * 0.8 + e.blobT);
      let r        = e.r + map(noiseVal, 0, 1, -5, 5);
      vertex(e.x + cos(angle) * r, e.y + sin(angle) * r);
    }
    endShape(CLOSE);

    fill(10);
    ellipse(e.x - 6, e.y - 4, 6, 6);
    ellipse(e.x + 6, e.y - 4, 6, 6);
    pop();

    e.blobT += 0.015;
  }
}

// ------------------------------------------------------------
// drawBullets()
// Drawn in world coordinates.
// ------------------------------------------------------------
function drawBullets() {
  fill(255);
  noStroke();
  for (let i = 0; i < bullets.length; i++) {
    ellipse(bullets[i].x, bullets[i].y, 10);
  }
}

// ------------------------------------------------------------
// drawPlayer()
// Drawn in world coordinates. Flickers while invincible.
// ------------------------------------------------------------
function drawPlayer() {
  if (player.invincible && floor(player.invincibleTimer / 6) % 2 === 0) return;

  push();
  fill(0, 200, 180);
  noStroke();

  beginShape();
  let numPoints = 48;
  for (let i = 0; i < numPoints; i++) {
    let angle    = (TWO_PI / numPoints) * i;
    let noiseVal = noise(cos(angle) * 0.8 + player.blobT, sin(angle) * 0.8 + player.blobT);
    let r        = player.r + map(noiseVal, 0, 1, -6, 6);
    vertex(player.x + cos(angle) * r, player.y + sin(angle) * r);
  }
  endShape(CLOSE);

  fill(10);
  ellipse(player.x - 7, player.y - 5, 7, 7);
  ellipse(player.x + 7, player.y - 5, 7, 7);

  fill(255);
  ellipse(
    player.x + player.direction.x * (player.r - 4),
    player.y + player.direction.y * (player.r - 4),
    8
  );

  pop();
  player.blobT += 0.015;
}

// ------------------------------------------------------------
// drawMinimap()
// Drawn in screen coordinates after pop().
// Shows a scaled-down view of the world with:
//   Teal dot  — player position
//   Orange dots — enemy positions
//   Red dot   — boss position (when active)
//   Orange zone — boss zone indicator at top of minimap
// ------------------------------------------------------------
function drawMinimap() {
  let mapX = MAP_X;
  let mapY = height - MAP_H - MAP_Y_OFFSET;

  // Background
  fill(0, 0, 0, 180);
  stroke(80, 60, 120);
  strokeWeight(1);
  rect(mapX, mapY, MAP_W, MAP_H, 4);
  noStroke();

  // Boss zone indicator
  let zoneH = map(BOSS_ZONE_Y, 0, WORLD_H, 0, MAP_H);
  fill(255, 150, 30, 40);
  rect(mapX, mapY, MAP_W, zoneH, 4);

  // Helper — converts world position to minimap screen position
  function worldToMap(wx, wy) {
    return {
      x: mapX + map(wx, 0, WORLD_W, 0, MAP_W),
      y: mapY + map(wy, 0, WORLD_H, 0, MAP_H),
    };
  }

  // Enemy dots
  fill(255, 150, 30);
  for (let i = 0; i < enemies.length; i++) {
    let p = worldToMap(enemies[i].x, enemies[i].y);
    ellipse(p.x, p.y, 5);
  }

  // Boss dot
  if (boss) {
    fill(255, 60, 60);
    let p = worldToMap(boss.x, boss.y);
    ellipse(p.x, p.y, 8);
  }

  // Player dot — drawn last so it's always on top
  fill(0, 200, 180);
  let pp = worldToMap(player.x, player.y);
  ellipse(pp.x, pp.y, 7);

  // Camera viewport rectangle — shows what's currently visible
  noFill();
  stroke(255, 255, 255, 60);
  strokeWeight(1);
  let vp = worldToMap(camX, camY);
  let vpW = map(width,  0, WORLD_W, 0, MAP_W);
  let vpH = map(height, 0, WORLD_H, 0, MAP_H);
  rect(vp.x, vp.y, vpW, vpH);
  noStroke();

  // Label
  fill(120);
  textSize(9);
  textAlign(LEFT);
  textFont("monospace");
  text("MAP", mapX + 4, mapY + MAP_H - 4);
}

// ------------------------------------------------------------
// drawHUD()
// Drawn in screen coordinates.
// ------------------------------------------------------------
function drawHUD() {
  noStroke();

  fill(160);
  textSize(13);
  textAlign(LEFT);
  textFont("monospace");
  text("Move: WASD   Shoot: Spacebar   B: Boss fight", 16, 24);

  fill(255);
  textSize(16);
  textAlign(RIGHT);
  text("Score: " + score, width - 16, 28);

  let barW  = 160;
  let barH  = 14;
  let barX  = width - barW - 16;
  let barY  = 40;
  let fillW = map(player.health, 0, player.maxHealth, 0, barW);

  fill(40);
  rect(barX, barY, barW, barH, 4);

  let healthColour = lerpColor(
    color(220, 60,  60),
    color(60,  220, 120),
    player.health / player.maxHealth
  );
  fill(healthColour);
  rect(barX, barY, fillW, barH, 4);

  fill(200);
  textSize(11);
  textAlign(RIGHT);
  text("Health", width - 16, barY + barH + 12);

  // Boss zone hint — appears when player gets close
  if (gameState === STATE_PLAY && player.y < 600) {
    fill(255, 150, 30, map(player.y, 600, BOSS_ZONE_Y, 0, 255));
    textAlign(CENTER);
    textSize(14);
    text("Boss zone ahead — proceed carefully", width / 2, height - 20);
  }
}

// ------------------------------------------------------------
// drawBossHUD()
// Boss health bar at top centre — drawn in screen coordinates.
// ------------------------------------------------------------
function drawBossHUD() {
  if (!boss) return;

  let barW  = 400;
  let barH  = 18;
  let barX  = (width - barW) / 2;
  let barY  = 10;
  let fillW = map(boss.health, 0, boss.maxHealth, 0, barW);

  fill(40);
  rect(barX, barY, barW, barH, 4);

  let bossColour = lerpColor(
    color(220, 60,  60),
    color(255, 150, 30),
    boss.health / boss.maxHealth
  );
  fill(bossColour);
  rect(barX, barY, fillW, barH, 4);

  fill(255);
  textSize(12);
  textAlign(CENTER);
  textFont("monospace");
  text("BOSS", width / 2, barY + barH + 14);
}

// ------------------------------------------------------------
// drawWinScreen()
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// drawGameOver()
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// keyPressed()
// R restarts. B skips to boss fight.
// ------------------------------------------------------------
function keyPressed() {
  // B — skip to boss fight for testing
  if (key === "b" || key === "B") {
    player.y = BOSS_ZONE_Y - 10;
    if (!boss) spawnBoss();
  }

  // R — restart
  if ((key === "r" || key === "R") && gameState !== STATE_PLAY && gameState !== STATE_BOSS) {
    gameState = STATE_PLAY;
    score     = 0;
    nextWave  = 0;
    bullets   = [];
    enemies   = [];
    boss      = null;

    player.x             = WORLD_W / 2;
    player.y             = WORLD_H - 200;
    player.direction     = { x: 0, y: -1 };
    player.shootTimer    = 0;
    player.health        = player.maxHealth;
    player.invincible    = false;
    player.invincibleTimer = 0;
    player.bounceVX      = 0;
    player.bounceVY      = 0;

    camX = player.x - width / 2;
    camY = player.y - height / 2;

    // music.loop();
  }
}
