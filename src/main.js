import * as THREE from 'three';
import { SaveManager } from './state/SaveManager.js';
import { SoundManager } from './engine/SoundManager.js';
import { InputManager } from './engine/InputManager.js';
import { PhysicsWorld } from './engine/PhysicsWorld.js';
import { ParticleSystem } from './engine/ParticleSystem.js';
import { ThirdPersonCamera } from './engine/ThirdPersonCamera.js';
import { PlayerController } from './entities/PlayerController.js';
import { LevelBuilder } from './levels/LevelBuilder.js';
import { UIManager } from './ui/UIManager.js';

export class SuperBaarenGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.saveManager = new SaveManager();
    this.sound = new SoundManager(this.saveManager);
    this.input = new InputManager();
    this.input.bindCanvasLook(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      280
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.setupLights();

    this.physics = new PhysicsWorld();
    this.particles = new ParticleSystem(this.scene);
    this.player = new PlayerController(this.scene, this.sound, this.particles, this.saveManager);
    this.tpCamera = new ThirdPersonCamera(this.camera, this.saveManager);
    this.levelBuilder = new LevelBuilder(
      this.scene,
      this.physics,
      this.saveManager,
      this.sound,
      this.particles
    );

    this.currentLevelId = 'hub';
    this.currentLevelMeta = null;
    this.levelTime = 0;
    this.elapsed = 0;
    this.paused = true;
    this.started = false;
    this.portalCooldown = 0;
    this.hitStopTimer = 0;

    this.ui = new UIManager(this);
    this.switchLevel('hub');

    window.addEventListener('resize', () => this.onResize());
    this.lastFrameTime = performance.now();
    requestAnimationFrame((now) => this.loop(now));
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x6b705c, 0.9);
    hemi.position.set(0, 50, 0);
    this.scene.add(hemi);

    this.dirLight = new THREE.DirectionalLight(0xfff8e7, 1.45);
    this.dirLight.position.set(28, 48, 26);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 2;
    this.dirLight.shadow.camera.far = 150;
    const d = 58;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);
  }

  startOrResume() {
    this.started = true;
    this.paused = false;
    this.tpCamera.snapBehind(this.player.facingAngle, this.player.pos);
    this.sound.ensureContext();
    this.sound.startMusic(this.currentLevelMeta?.theme || 'hub');
  }

  switchLevel(levelId) {
    this.currentLevelId = levelId;
    this.levelTime = 0;
    this.portalCooldown = 1.6;
    this.particles.clear();
    this.currentLevelMeta = this.levelBuilder.loadLevel(levelId, this.player);
    this.player.health = this.player.maxHealth;
    this.tpCamera.snapBehind(this.player.facingAngle, this.player.pos);
    this.ui.updateHUD();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  breakCrate(dyn) {
    if (dyn.broken || dyn.kind === 'boulder' || dyn.kind === 'seesaw') return;
    dyn.broken = true;
    dyn.enabled = false;
    if (dyn.mesh) dyn.mesh.visible = false;
    if (dyn.body) this.physics.world.removeBody(dyn.body);

    this.sound.enemyDefeat();
    this.hitStopTimer = 0.055;
    this.tpCamera.shake(0.38, 0.24);
    this.particles.emitHitBurst({
      x: dyn.x,
      y: dyn.y + 0.5,
      z: dyn.z,
      color: dyn.kind === 'bomb' ? 0xff006e : 0xffbe0b,
      secondaryColor: 0xffffff,
      intensity: 1.15
    });
    // Spawn burst of coins
    const reward = dyn.coinsInside || 3;
    this.saveManager.addCoins(reward);
    this.sound.coin();
    this.ui.updateHUD();
  }

  handleGroundPoundImpact(impactPos) {
    this.tpCamera.shake(0.35, 0.25);
    for (const sw of this.levelBuilder.switches) {
      if (!sw.pressed && Math.hypot(impactPos.x - sw.x, impactPos.z - sw.z) < 2.8) {
        this.activateSwitch(sw);
      }
    }
    for (const cage of this.levelBuilder.cages) {
      if (!cage.rescued && Math.hypot(impactPos.x - cage.x, impactPos.z - cage.z) < 3.4) {
        this.tryBreakCage(cage);
      }
    }
    for (const dyn of this.physics.dynamicObjects) {
      if (!dyn.broken && Math.hypot(impactPos.x - dyn.x, impactPos.z - dyn.z) < 2.8) {
        this.breakCrate(dyn);
      }
    }
  }

  activateSwitch(sw) {
    if (sw.pressed) return;
    sw.pressed = true;
    sw.btn.position.y = 0.14;
    sw.btnMat.color.setHex(0x06d6a0);
    sw.btnMat.emissive.setHex(0x004433);
    this.sound.switchPress();
    this.particles.emitRing({
      x: sw.x,
      y: sw.y + 0.2,
      z: sw.z,
      color: 0x06d6a0,
      count: 16
    });
    if (sw.onActivate) sw.onActivate();
    this.ui.showToast(`${sw.label} Activated!`);
  }

  tryBreakCage(cage) {
    if (cage.rescued) return;
    if (cage.locked) {
      this.ui.showToast(`Cage Locked! ${cage.hint}`);
      return;
    }
    cage.rescued = true;
    cage.celebrateTimer = 3.0;
    cage.cageGroup.visible = false;
    this.sound.cageBreak();
    this.hitStopTimer = 0.085;
    this.tpCamera.shake(0.52, 0.36);

    this.particles.emitHitBurst({
      x: cage.x,
      y: cage.y + 1.2,
      z: cage.z,
      color: 0x00f5d4,
      secondaryColor: 0xffbe0b,
      intensity: 1.45
    });

    const isFirstTime = this.saveManager.rescueBear(cage.id);
    this.saveManager.recordLevelTime(this.currentLevelId, this.levelTime);
    this.ui.showRescueBanner(
      cage.name,
      isFirstTime ? '+10 Honey Coins Reward!' : 'Already Rescued (+0 Coins)'
    );
    this.ui.updateHUD();

    for (const portal of this.levelBuilder.portals) {
      const unlocked =
        this.saveManager.getTotalRescued() >= (portal.meta?.requiredBears || 0);
      portal.vortexMat.color.setHex(unlocked ? portal.color : 0x495057);
      portal.vortexMat.emissive.setHex(unlocked ? portal.color : 0x111111);
    }
  }

  updateWorldEntities(dt) {
    const p = this.player;
    let activePrompt = null;

    if (this.portalCooldown > 0) {
      this.portalCooldown -= dt;
    }

    // Dynamic Physics Crates & Bombs interaction (Grab/Throw [R], Smash [F])
    let nearestCrate = null;
    let nearestCrateDist = 2.5;
    for (const dyn of this.physics.dynamicObjects) {
      if (!dyn.enabled || dyn.broken || dyn.carried || dyn.kind === 'seesaw') continue;

      const d = Math.hypot(p.pos.x - dyn.x, p.pos.y + 0.5 - dyn.y, p.pos.z - dyn.z);
      if (d < nearestCrateDist && dyn.kind !== 'boulder') {
        nearestCrateDist = d;
        nearestCrate = dyn;
      }

      // Smash crate if attacking nearby
      if (d < 2.1 && p.isAttacking() && dyn.kind === 'crate') {
        this.breakCrate(dyn);
        continue;
      }

      // Check if a thrown crate hits an enemy or cage or boss
      const speed = dyn.body ? dyn.body.velocity.length() : 0;
      if (speed > 4.5) {
        for (const cage of this.levelBuilder.cages) {
          if (!cage.rescued && Math.hypot(dyn.x - cage.x, dyn.z - cage.z) < 2.2) {
            this.tryBreakCage(cage);
            this.breakCrate(dyn);
            break;
          }
        }
        const boss = this.levelBuilder.boss;
        if (boss && boss.hp > 0 && Math.hypot(dyn.x - boss.x, dyn.z - boss.z) < 2.8) {
          this.damageBoss(boss);
          this.breakCrate(dyn);
        }
      }
    }

    if (p.carriedObject) {
      activePrompt = 'Carrying Object — Press [F] to Throw or [R] to Drop';
      if (this.input.consumeGrab()) {
        p.dropCarriedObject(false);
        this.sound.uiClick();
      }
    } else if (nearestCrate) {
      activePrompt = `Press [R] to Pick Up ${nearestCrate.kind === 'bomb' ? 'Honey Bomb' : 'Crate'} or [F] to Smash`;
      if (this.input.consumeGrab()) {
        nearestCrate.carried = true;
        p.carriedObject = nearestCrate;
        p.triggerSquash(0.84);
        this.sound.jump(false);
      }
    }

    // Coins
    for (const coin of this.levelBuilder.coins) {
      if (coin.collected) continue;
      coin.mesh.rotation.y += 3.2 * dt;
      coin.mesh.position.y = coin.baseY + Math.sin(this.elapsed * 4 + coin.baseY) * 0.14;

      const dx = p.pos.x - coin.mesh.position.x;
      const dy = p.pos.y + 0.7 - coin.mesh.position.y;
      const dz = p.pos.z - coin.mesh.position.z;
      if (Math.hypot(dx, dy, dz) < 1.38) {
        coin.collected = true;
        coin.mesh.visible = false;
        this.saveManager.addCoins(1);
        this.sound.coin();
        this.particles.emit({
          x: coin.mesh.position.x,
          y: coin.mesh.position.y,
          z: coin.mesh.position.z,
          count: 7,
          color: 0xffc300,
          speed: 4,
          upward: 3,
          scale: 0.7
        });
        this.ui.updateHUD();
      }
    }

    // Trampolines
    for (const tramp of this.levelBuilder.trampolines) {
      if (tramp.pulse > 0) {
        tramp.pulse = Math.max(0, tramp.pulse - dt * 4);
        tramp.mesh.scale.set(
          1 + tramp.pulse * 0.25,
          1 - tramp.pulse * 0.3,
          1 + tramp.pulse * 0.25
        );
      }
      const horiz = Math.hypot(p.pos.x - tramp.x, p.pos.z - tramp.z);
      if (horiz < tramp.radius && Math.abs(p.pos.y - tramp.y) < 1.1 && p.vel.y <= 2) {
        p.vel.y = tramp.bounceForce;
        p.grounded = false;
        p.jumpsRemaining = 1;
        p.canDive = true;
        p.state = 'jump';
        p.triggerSquash(1.34);
        tramp.pulse = 1;
        this.sound.bounce();
        this.particles.emitRing({
          x: tramp.x,
          y: tramp.y,
          z: tramp.z,
          color: 0xff006e,
          count: 12,
          radiusSpeed: 5
        });
      }
    }

    // Floor Switches (can be pressed by Baaren OR by placing a Physics Crate on top!)
    for (const sw of this.levelBuilder.switches) {
      if (sw.pressed) continue;
      const playerOn =
        Math.hypot(p.pos.x - sw.x, p.pos.z - sw.z) < 1.3 && Math.abs(p.pos.y - sw.y) < 0.95;
      const crateOn = this.physics.dynamicObjects.some(
        (d) =>
          !d.broken &&
          !d.carried &&
          Math.hypot(d.x - sw.x, d.z - sw.z) < 1.35 &&
          Math.abs(d.y - sw.y) < 1.2
      );
      if (playerOn || crateOn) {
        this.activateSwitch(sw);
      }
    }

    // Checkpoints
    for (const cp of this.levelBuilder.checkpoints) {
      cp.flag.rotation.y = Math.sin(this.elapsed * 3) * 0.25;
      if (!cp.activated) {
        const d = Math.hypot(p.pos.x - cp.x, p.pos.y - cp.y, p.pos.z - cp.z);
        if (d < 2.2) {
          cp.activated = true;
          cp.flagMat.color.setHex(0x06d6a0);
          p.setSpawn(cp.x, cp.y + 0.5, cp.z, false);
          this.sound.switchPress();
          this.ui.showToast('Checkpoint Reached!');
          this.particles.emit({
            x: cp.x,
            y: cp.y + 2,
            z: cp.z,
            count: 12,
            color: 0x06d6a0,
            speed: 4
          });
        }
      }
    }

    // Captive Bear Cages
    for (const cage of this.levelBuilder.cages) {
      cage.beacon.rotation.y += 2.5 * dt;
      const t = this.elapsed * 4;
      if (cage.rescued) {
        cage.bear.bodyPivot.position.y = 0.74 + Math.abs(Math.sin(t * 2.2)) * 0.35;
        cage.bear.leftArmPivot.rotation.z = 2.4;
        cage.bear.rightArmPivot.rotation.z = -2.4;
        cage.bear.root.rotation.y += 1.8 * dt;
        continue;
      }

      cage.bear.leftArmPivot.rotation.x = -2.4 + Math.sin(t * 2) * 0.4;
      cage.bear.rightArmPivot.rotation.x = -2.4 - Math.sin(t * 2) * 0.4;

      const dist = Math.hypot(p.pos.x - cage.x, p.pos.y - cage.y, p.pos.z - cage.z);
      if (dist < 2.8) {
        if (cage.locked) {
          activePrompt = `🔒 ${cage.name}'s Cage Locked (${cage.hint})`;
        } else {
          activePrompt = `Press [F] Attack, [Shift] Dive, or [Q] Ground Pound to rescue ${cage.name}!`;
          if (p.isAttacking()) {
            this.tryBreakCage(cage);
          }
        }
      }
    }

    // Patrolling Purple Honey Bees
    for (const enemy of this.levelBuilder.enemies) {
      if (!enemy.alive) continue;
      enemy.phase += dt * 2.0;
      const offset = Math.sin(enemy.phase) * enemy.patrolDist;
      const prevX = enemy.x;
      const prevZ = enemy.z;
      if (enemy.axis === 'x') {
        enemy.x = enemy.startX + offset;
      } else {
        enemy.z = enemy.startZ + offset;
      }
      enemy.mesh.position.set(
        enemy.x,
        enemy.startY + Math.sin(this.elapsed * 8 + enemy.phase) * 0.16,
        enemy.z
      );
      if (Math.hypot(enemy.x - prevX, enemy.z - prevZ) > 0.001) {
        enemy.mesh.rotation.y = Math.atan2(enemy.x - prevX, enemy.z - prevZ);
      }

      const flap = Math.sin(this.elapsed * 32) * 0.55;
      enemy.leftWing.rotation.z = flap;
      enemy.rightWing.rotation.z = -flap;

      const horizDist = Math.hypot(p.pos.x - enemy.x, p.pos.z - enemy.z);
      const vertDiff = p.pos.y - enemy.startY;

      if (horizDist < 1.38 && Math.abs(vertDiff) < 1.48) {
        const stomping = p.vel.y < -1.5 && vertDiff > 0.45;
        if (stomping || p.isAttacking()) {
          enemy.alive = false;
          enemy.mesh.visible = false;
          if (stomping) {
            p.vel.y = 12.8;
            p.triggerSquash(1.25);
          }
          this.sound.enemyDefeat();
          this.hitStopTimer = 0.065;
          this.tpCamera.shake(0.42, 0.28);
          this.saveManager.addCoins(3);
          this.particles.emitHitBurst({
            x: enemy.x,
            y: enemy.startY + 0.8,
            z: enemy.z,
            color: 0xff006e,
            secondaryColor: 0xffbe0b,
            intensity: 1.25
          });
          this.ui.updateHUD();
        } else {
          const dirLen = Math.max(0.01, horizDist);
          const died = p.takeDamage(1, {
            x: (p.pos.x - enemy.x) / dirLen,
            z: (p.pos.z - enemy.z) / dirLen
          });
          if (died) {
            this.tpCamera.shake(0.35, 0.25);
            this.ui.updateHUD();
            if (p.health <= 0) {
              p.respawn(true);
              this.ui.updateHUD();
            }
          }
        }
      }
    }

    // Queen Beemothep Boss AI
    const boss = this.levelBuilder.boss;
    if (boss && boss.hp > 0) {
      this.updateBoss(dt, boss, p);
    }

    // NPCs
    for (const npc of this.levelBuilder.npcs) {
      npc.badge.rotation.y += 2.2 * dt;
      npc.badge.position.y = 2.35 + Math.sin(this.elapsed * 3.5) * 0.12;

      const dist = Math.hypot(p.pos.x - npc.x, p.pos.y - npc.y, p.pos.z - npc.z);
      if (dist < 3.0) {
        npc.bear.root.rotation.y = Math.atan2(p.pos.x - npc.x, p.pos.z - npc.z);
        activePrompt = npc.opensShop
          ? `Press [E] or [F] to open ${npc.name}'s Royal Wardrobe`
          : `Press [E] or [F] to talk to ${npc.name}`;

        if (this.input.consumeInteract()) {
          if (npc.opensShop) {
            this.ui.openShopModal();
          } else {
            this.ui.openDialog(npc.name, npc.dialog);
          }
        }
      }
    }

    // Portals
    for (const portal of this.levelBuilder.portals) {
      portal.vortex.rotation.z += 1.8 * dt;
      const dist = Math.hypot(p.pos.x - portal.x, p.pos.y - portal.y, p.pos.z - portal.z);
      if (dist < 2.2 && this.portalCooldown <= 0) {
        const req = portal.meta?.requiredBears || 0;
        const have = this.saveManager.getTotalRescued();
        if (have >= req) {
          this.sound.cageBreak();
          this.switchLevel(portal.targetLevelId);
          return;
        } else {
          activePrompt = `🔒 Requires ${req} Rescued Bears (You have ${have})`;
        }
      }
    }

    // Fall into abyss check
    if (p.pos.y < this.levelBuilder.killY) {
      this.sound.hurt();
      p.respawn(true);
      this.tpCamera.snapBehind(p.facingAngle, p.pos);
      this.ui.updateHUD();
    }

    this.ui.setPrompt(activePrompt);
  }

  damageBoss(boss) {
    boss.hp -= 1;
    this.sound.enemyDefeat();
    this.hitStopTimer = 0.095;
    this.tpCamera.shake(0.65, 0.42);
    this.particles.emitHitBurst({
      x: boss.x,
      y: boss.y + 1.5,
      z: boss.z,
      color: 0xffbe0b,
      secondaryColor: 0xff006e,
      intensity: 1.7
    });

    if (boss.hp <= 0) {
      boss.state = 'defeated';
      boss.mesh.visible = false;
      boss.ringMat.opacity = 0;
      if (boss.rewardCage) {
        boss.rewardCage.locked = false;
        boss.rewardCage.barMat.color.setHex(0xadb5bd);
        boss.rewardCage.beaconMat.color.setHex(0x00f5d4);
      }
      this.saveManager.addCoins(25);
      this.ui.showToast('Queen Beemothep Defeated! King Ursus Cage Unlocked!');
    } else {
      boss.state = 'hover';
      boss.timer = 0;
      boss.ringMat.opacity = 0;
    }
    this.ui.updateHUD();
  }

  updateBoss(dt, boss, p) {
    boss.timer += dt;
    const flap = Math.sin(this.elapsed * 28) * 0.5;
    boss.leftWing.rotation.z = flap;
    boss.rightWing.rotation.z = -flap;

    if (boss.state === 'hover') {
      boss.x = boss.centerX + Math.sin(this.elapsed * 1.4) * 6.5;
      boss.z = boss.centerZ + Math.cos(this.elapsed * 1.1) * 5.0;
      boss.y = boss.baseY + 2.6 + Math.sin(this.elapsed * 4) * 0.35;
      boss.bodyMat.color.setHex(0x5a189a);
      if (boss.timer > 4.2) {
        boss.state = 'slam';
        boss.timer = 0;
      }
    } else if (boss.state === 'slam') {
      boss.y = Math.max(boss.baseY - 0.8, boss.y - 18 * dt);
      if (boss.y <= boss.baseY - 0.75) {
        boss.state = 'stunned';
        boss.timer = 0;
        boss.shockRadius = 1.0;
        this.sound.groundPound();
        this.tpCamera.shake(0.45, 0.3);
      }
    } else if (boss.state === 'stunned') {
      boss.bodyMat.color.setHex(0xff006e);
      if (boss.shockRadius < 13) {
        boss.shockRadius += 14 * dt;
        boss.shockRing.position.set(boss.x, boss.baseY - 0.85, boss.z);
        boss.shockRing.scale.setScalar(boss.shockRadius);
        boss.ringMat.opacity = Math.max(0, 1 - boss.shockRadius / 13);

        const pDist = Math.hypot(p.pos.x - boss.x, p.pos.z - boss.z);
        if (Math.abs(pDist - boss.shockRadius) < 0.85 && p.pos.y < boss.baseY + 0.6) {
          p.takeDamage(1, { x: 0, z: 1 });
          if (p.health <= 0) p.respawn(true);
        }
      } else {
        boss.ringMat.opacity = 0;
      }

      if (boss.timer > 4.2) {
        boss.state = 'hover';
        boss.timer = 0;
        boss.ringMat.opacity = 0;
      }
    }

    boss.mesh.position.set(boss.x, boss.y, boss.z);
    boss.mesh.rotation.y = Math.atan2(p.pos.x - boss.x, p.pos.z - boss.z);

    const distToBoss = Math.hypot(p.pos.x - boss.x, p.pos.y - boss.y, p.pos.z - boss.z);
    if (distToBoss < 2.75) {
      const stomping = p.vel.y < -1.5 && p.pos.y > boss.y + 1.0;
      if (stomping || p.isAttacking()) {
        p.vel.y = 14.5;
        p.vel.z = 8.0;
        p.triggerSquash(1.3);
        this.damageBoss(boss);
      }
    }
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    if (this.started && this.input.consumePause()) {
      this.ui.togglePauseModal();
    }

    if (!this.paused) {
      if (this.hitStopTimer > 0) {
        this.hitStopTimer -= dt;
        this.tpCamera.update(dt, this.player, this.input, this.levelBuilder.cameraObstacles);
        this.particles.update(dt);
      } else {
        this.elapsed += dt;
        this.levelTime += dt;
        this.physics.updatePlatforms(dt, this.elapsed);
        this.levelBuilder.updateEnvironment(dt, this.elapsed);
        this.player.update(dt, this.input, this.tpCamera.yaw, this.physics, (pos) =>
          this.handleGroundPoundImpact(pos)
        );
        this.updateWorldEntities(dt);
        this.tpCamera.update(dt, this.player, this.input, this.levelBuilder.cameraObstacles);
        this.particles.update(dt);
        this.ui.updateHUD();
      }
    } else {
      this.elapsed += dt * 0.4;
      this.levelBuilder.updateEnvironment(dt, this.elapsed);
      this.player.animateRig(dt);
      if (!this.started) {
        this.tpCamera.yaw += dt * 0.35;
        this.tpCamera.update(dt, this.player, this.input, this.levelBuilder.cameraObstacles);
      }
    }

    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__SUPER_BAAREN_GAME__ = new SuperBaarenGame();
});
