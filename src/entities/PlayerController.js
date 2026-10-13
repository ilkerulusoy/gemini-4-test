import * as THREE from 'three';
import { createBearRig } from './BearRig.js';

export class PlayerController {
  constructor(scene, sound, particles, saveManager) {
    this.scene = scene;
    this.sound = sound;
    this.particles = particles;
    this.saveManager = saveManager;

    this.pos = new THREE.Vector3(0, 2, 0);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.spawnPoint = new THREE.Vector3(0, 2, 0);

    this.radius = 0.52;
    this.height = 1.65;
    this.grounded = false;
    this.groundCollider = null;

    this.facingAngle = 0;
    this.state = 'idle'; // idle, run, jump, doubleJump, dive, groundPound, swim, ledgeClimb, hurt
    this.jumpsRemaining = 2;
    this.canDive = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.diveTimer = 0;
    this.groundPoundFreeze = 0;
    this.ledgeTimer = 0;
    this.ledgeTarget = null;
    this.attackTimer = 0;
    this.invincibleTimer = 0;
    this.animTime = 0;
    this.stepParticleTimer = 0;
    this.blinkTimer = 2.5;

    // Squash & stretch elastic spring state
    this.squashY = 1.0;
    this.squashVel = 0.0;

    // Carried dynamic crate / honey bomb
    this.carriedObject = null;

    this.maxHealth = 4;
    this.health = 4;

    this.rig = createBearRig({
      hatId: saveManager.data.equippedHat,
      capeId: saveManager.data.equippedCape
    });
    this.scene.add(this.rig.root);

    // Blob shadow directly underneath player for depth perception
    const shadowGeo = new THREE.CircleGeometry(0.64, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.36,
      depthWrite: false
    });
    this.blobShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.scene.add(this.blobShadow);

    // Dual-layer Claw Slash visual arc (outer golden wave + inner white razor core)
    this.swipeGroup = new THREE.Group();
    this.swipeGroup.position.set(0, 0.88, 0.55);
    this.rig.root.add(this.swipeGroup);

    const outerSwipeGeo = new THREE.TorusGeometry(1.12, 0.13, 10, 26, Math.PI * 1.25);
    outerSwipeGeo.rotateX(Math.PI / 2);
    this.outerSwipeMat = new THREE.MeshBasicMaterial({
      color: 0xffbe0b,
      transparent: true,
      opacity: 0
    });
    this.outerSwipeMesh = new THREE.Mesh(outerSwipeGeo, this.outerSwipeMat);

    const innerSwipeGeo = new THREE.TorusGeometry(0.92, 0.07, 8, 22, Math.PI * 1.15);
    innerSwipeGeo.rotateX(Math.PI / 2);
    this.innerSwipeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0
    });
    this.innerSwipeMesh = new THREE.Mesh(innerSwipeGeo, this.innerSwipeMat);
    this.swipeGroup.add(this.outerSwipeMesh, this.innerSwipeMesh);
  }

  refreshCosmetics() {
    this.rig.setCosmetics(
      this.saveManager.data.equippedHat,
      this.saveManager.data.equippedCape
    );
  }

  triggerSquash(targetScaleY = 0.72) {
    this.squashY = targetScaleY;
    this.squashVel = 0;
  }

  dropCarriedObject(throwForward = false) {
    if (!this.carriedObject) return null;
    const obj = this.carriedObject;
    this.carriedObject = null;
    obj.carried = false;

    const fx = Math.sin(this.facingAngle);
    const fz = Math.cos(this.facingAngle);
    const dropX = this.pos.x + fx * 1.35;
    const dropY = this.pos.y + 1.15;
    const dropZ = this.pos.z + fz * 1.35;

    if (obj.body) {
      obj.body.position.set(dropX, dropY, dropZ);
      obj.body.wakeUp();
      if (throwForward) {
        obj.body.velocity.set(fx * 15 + this.vel.x * 0.4, 6.5, fz * 15 + this.vel.z * 0.4);
        obj.body.angularVelocity.set(fx * 4, 2, fz * 4);
      } else {
        obj.body.velocity.set(fx * 3, 2, fz * 3);
      }
    }
    obj.x = dropX;
    obj.y = dropY;
    obj.z = dropZ;
    return obj;
  }

  respawn(fullHeal = true) {
    this.dropCarriedObject(false);
    this.pos.copy(this.spawnPoint);
    this.vel.set(0, 0, 0);
    this.state = 'idle';
    this.grounded = false;
    this.groundCollider = null;
    if (fullHeal) {
      this.health = this.maxHealth;
    }
    this.invincibleTimer = 1.2;
    this.triggerSquash(1.25);
    this.particles.emitRing({
      x: this.pos.x,
      y: this.pos.y,
      z: this.pos.z,
      color: 0x90e0ef,
      count: 14
    });
  }

  setSpawn(x, y, z, teleport = false) {
    this.spawnPoint.set(x, y, z);
    if (teleport) {
      this.dropCarriedObject(false);
      this.pos.set(x, y, z);
      this.vel.set(0, 0, 0);
      this.grounded = false;
    }
  }

  takeDamage(amount = 1, knockbackDir = null) {
    if (this.invincibleTimer > 0) return false;
    this.dropCarriedObject(false);
    this.health = Math.max(0, this.health - amount);
    this.invincibleTimer = 1.4;
    this.state = 'hurt';
    this.triggerSquash(0.68);
    this.sound.hurt();

    this.vel.y = 9.5;
    if (knockbackDir) {
      this.vel.x = knockbackDir.x * 10;
      this.vel.z = knockbackDir.z * 10;
    }

    this.particles.emit({
      x: this.pos.x,
      y: this.pos.y + 0.9,
      z: this.pos.z,
      color: 0xe63946,
      count: 12,
      speed: 6
    });

    return true;
  }

  update(dt, input, cameraYaw, physics, onGroundPoundImpact) {
    this.animTime += dt;
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
    if (this.attackTimer > 0) this.attackTimer -= dt;

    // Elastic Hooke's Law spring recovery for squash & stretch
    const springForce = (1.0 - this.squashY) * 140;
    this.squashVel += springForce * dt;
    this.squashVel *= Math.pow(0.06, dt);
    this.squashY += this.squashVel * dt;

    // Ledge climb animation state
    if (this.state === 'ledgeClimb' && this.ledgeTarget) {
      this.ledgeTimer -= dt;
      const p = 1 - Math.max(0, this.ledgeTimer / 0.24);
      this.pos.x += (this.ledgeTarget.climbX - this.pos.x) * Math.min(1, dt * 14);
      this.pos.z += (this.ledgeTarget.climbZ - this.pos.z) * Math.min(1, dt * 14);
      this.pos.y = this.ledgeTarget.topY - 0.6 * (1 - p);
      this.vel.set(0, 0, 0);
      if (this.ledgeTimer <= 0) {
        this.pos.y = this.ledgeTarget.topY;
        this.grounded = true;
        this.state = 'idle';
        this.ledgeTarget = null;
        this.triggerSquash(0.82);
      }
      this.syncCarriedObject();
      this.updateBlobShadow(physics);
      this.animateRig(dt);
      return;
    }

    // Check water buoyancy / swimming state
    const waterSurfaceY = physics.getWaterSurfaceAt(this.pos);
    const inWater = waterSurfaceY !== null && this.pos.y < waterSurfaceY - 0.35;

    const wasGrounded = this.grounded;
    if (this.grounded || inWater) {
      this.coyoteTimer = 0.15;
      this.jumpsRemaining = 2;
      this.canDive = true;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (input.consumeJump()) {
      this.jumpBufferTimer = 0.15;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    // Ground pound freeze in air before slamming down
    if (this.state === 'groundPound') {
      if (this.groundPoundFreeze > 0) {
        this.groundPoundFreeze -= dt;
        this.vel.set(0, 0, 0);
      } else {
        this.vel.x = 0;
        this.vel.z = 0;
        this.vel.y = -31;
      }
    } else {
      const move = input.getMoveVector();
      const inputLen = Math.hypot(move.x, move.z);

      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      const worldDirX = move.x * cos + move.z * sin;
      const worldDirZ = -move.x * sin + move.z * cos;

      const surfaceFriction = this.groundCollider?.friction ?? 1.0;
      const maxSpeed = inWater ? 7.4 : this.state === 'dive' ? 14.8 : 10.8;
      const accel = this.grounded ? 48 * surfaceFriction : inWater ? 28 : 25;
      const drag = this.grounded ? 12 * surfaceFriction : inWater ? 6.5 : 3.5;

      if (this.state === 'dive') {
        this.diveTimer -= dt;
        if (this.grounded && this.diveTimer <= 0.15) {
          this.state = inputLen > 0.1 ? 'run' : 'idle';
        }
      } else if (inputLen > 0.05) {
        const targetVx = worldDirX * maxSpeed;
        const targetVz = worldDirZ * maxSpeed;
        this.vel.x += (targetVx - this.vel.x) * Math.min(1, accel * dt);
        this.vel.z += (targetVz - this.vel.z) * Math.min(1, accel * dt);

        const targetAngle = Math.atan2(worldDirX, worldDirZ);
        let diff = targetAngle - this.facingAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.facingAngle += diff * Math.min(1, 14 * dt);

        if (inWater) {
          this.state = 'swim';
        } else if (this.grounded) {
          this.state = 'run';
          this.stepParticleTimer -= dt;
          if (this.stepParticleTimer <= 0) {
            this.stepParticleTimer = 0.21;
            this.particles.emit({
              x: this.pos.x,
              y: this.pos.y + 0.08,
              z: this.pos.z,
              count: 2,
              color: surfaceFriction < 0.4 ? 0xcaf0f8 : 0xf1faee,
              speed: 1.8,
              upward: 1.4,
              scale: 0.6,
              life: 0.32
            });
          }
        }
      } else {
        this.vel.x -= this.vel.x * Math.min(1, drag * dt);
        this.vel.z -= this.vel.z * Math.min(1, drag * dt);
        if (inWater) {
          this.state = 'swim';
        } else if (this.grounded && Math.hypot(this.vel.x, this.vel.z) < 0.8) {
          this.state = 'idle';
        }
      }

      // Execute Jump / Double Jump / Water Leap
      if (this.jumpBufferTimer > 0) {
        if (inWater) {
          this.jumpBufferTimer = 0;
          this.vel.y = 14.5;
          this.state = 'jump';
          this.triggerSquash(1.28);
          this.sound.jump(false);
          this.particles.emitRing({
            x: this.pos.x,
            y: waterSurfaceY,
            z: this.pos.z,
            count: 14,
            color: 0x90e0ef,
            radiusSpeed: 4.5
          });
        } else if (this.grounded || this.coyoteTimer > 0) {
          this.jumpBufferTimer = 0;
          // Inherit upward momentum if jumping from an ascending moving platform
          const platVy =
            this.groundCollider && this.groundCollider.dy > 0
              ? Math.min(4.5, this.groundCollider.dy / Math.max(0.008, dt))
              : 0;
          this.vel.y = 14.8 + platVy * 0.45;
          this.grounded = false;
          this.coyoteTimer = 0;
          this.jumpsRemaining = 1;
          this.state = 'jump';
          this.triggerSquash(1.3);
          this.sound.jump(false);
          this.particles.emit({
            x: this.pos.x,
            y: this.pos.y + 0.1,
            z: this.pos.z,
            count: 7,
            color: 0xffffff,
            speed: 3.2,
            upward: 2.0,
            scale: 0.8
          });
        } else if (this.jumpsRemaining > 0) {
          this.jumpBufferTimer = 0;
          this.vel.y = 14.0;
          this.jumpsRemaining = 0;
          this.state = 'doubleJump';
          this.triggerSquash(1.26);
          this.sound.jump(true);
          this.particles.emitRing({
            x: this.pos.x,
            y: this.pos.y,
            z: this.pos.z,
            count: 12,
            color: 0xffd166,
            radiusSpeed: 4.5,
            life: 0.35
          });
        }
      }

      // Variable jump height only when Space is released early on desktop keyboard
      if (
        !this.grounded &&
        this.vel.y > 6.5 &&
        !input.isJumpHeld() &&
        this.state === 'jump'
      ) {
        this.vel.y -= 18 * dt;
      }
      // Belly Dive
      if (input.consumeDive() && this.canDive && !this.carriedObject) {
        this.canDive = false;
        this.state = 'dive';
        this.diveTimer = 0.56;
        this.triggerSquash(0.75);
        const forwardX = Math.sin(this.facingAngle);
        const forwardZ = Math.cos(this.facingAngle);
        this.vel.x = forwardX * 15.5;
        this.vel.z = forwardZ * 15.5;
        this.vel.y = this.grounded ? 7.0 : Math.max(this.vel.y, 6.0);
        this.grounded = false;
        this.sound.dive();
        this.particles.emit({
          x: this.pos.x,
          y: this.pos.y + 0.6,
          z: this.pos.z,
          count: 10,
          color: 0xffbe0b,
          speed: 5,
          upward: 2.5
        });
      }

      // Ground Pound in mid-air
      if (!this.grounded && !inWater && input.consumeGroundPound()) {
        this.dropCarriedObject(false);
        this.state = 'groundPound';
        this.groundPoundFreeze = 0.15;
        this.vel.set(0, 0, 0);
      }

      // Paw Swipe or Throw Carried Crate
      if (input.consumeAttack() && this.attackTimer <= 0.14) {
        if (this.carriedObject) {
          this.dropCarriedObject(true);
          this.sound.attack();
          this.triggerSquash(0.82);
        } else {
          this.attackTimer = 0.28;
          this.triggerSquash(1.18);
          // Forward attack lunge impulse for punchy combat feel
          const fx = Math.sin(this.facingAngle);
          const fz = Math.cos(this.facingAngle);
          this.vel.x += fx * 5.5;
          this.vel.z += fz * 5.5;
          this.sound.attack();
          this.particles.emit({
            x: this.pos.x + fx * 1.1,
            y: this.pos.y + 0.9,
            z: this.pos.z + fz * 1.1,
            count: 6,
            color: 0xfff3b0,
            speed: 4.5,
            upward: 1.5,
            scale: 0.75,
            life: 0.25
          });
        }
      }

      // Water buoyancy vs Apex-hang & Crisp Fall Gravity
      if (inWater) {
        const targetFloatY = waterSurfaceY - 0.85;
        const depthDiff = targetFloatY - this.pos.y;
        this.vel.y += depthDiff * 28 * dt;
        this.vel.y *= Math.pow(0.18, dt);
      } else {
        // Lighter gravity near jump apex so platforming & ledge grabbing feel responsive
        const gravity = Math.abs(this.vel.y) < 3.2 ? 22.0 : this.vel.y > 0 ? 28.5 : 33.5;
        this.vel.y = Math.max(-34, this.vel.y - gravity * dt);
      }
    }

    const wasGroundPounding = this.state === 'groundPound';
    physics.resolvePlayer(this, dt);

    // Check Ledge Grab & Mantle when falling near a platform lip
    if (!this.grounded && !inWater && this.state !== 'groundPound') {
      const ledge = physics.findLedgeCandidate(this);
      if (ledge) {
        this.state = 'ledgeClimb';
        this.ledgeTimer = 0.24;
        this.ledgeTarget = ledge;
        this.vel.set(0, 0, 0);
        this.sound.jump(false);
      }
    }

    // Landed impact
    if (!wasGrounded && this.grounded) {
      if (wasGroundPounding) {
        this.triggerSquash(0.62);
        this.sound.groundPound();
        this.particles.emitRing({
          x: this.pos.x,
          y: this.pos.y,
          z: this.pos.z,
          count: 18,
          color: 0xffb703,
          radiusSpeed: 8.5,
          life: 0.45
        });
        if (onGroundPoundImpact) {
          onGroundPoundImpact(this.pos);
        }
      } else {
        this.triggerSquash(0.78);
      }
      this.state = Math.hypot(this.vel.x, this.vel.z) > 1.2 ? 'run' : 'idle';
    }

    this.syncCarriedObject();
    this.updateBlobShadow(physics);
    this.animateRig(dt);
  }

  syncCarriedObject() {
    if (!this.carriedObject) return;
    const obj = this.carriedObject;
    const holdX = this.pos.x;
    const holdY = this.pos.y + 2.15;
    const holdZ = this.pos.z;
    obj.x = holdX;
    obj.y = holdY;
    obj.z = holdZ;
    if (obj.body) {
      obj.body.position.set(holdX, holdY, holdZ);
      obj.body.velocity.set(0, 0, 0);
    }
    if (obj.mesh) {
      obj.mesh.position.set(holdX, holdY, holdZ);
      obj.mesh.rotation.set(0, this.facingAngle, 0);
    }
  }

  updateBlobShadow(physics) {
    let highestY = -999;
    const allSolids = [...physics.colliders, ...physics.dynamicObjects];
    for (const col of allSolids) {
      if (!col.enabled || col.type === 'trigger' || col.broken || col.carried) continue;
      if (
        this.pos.x >= col.x - col.w * 0.5 &&
        this.pos.x <= col.x + col.w * 0.5 &&
        this.pos.z >= col.z - col.d * 0.5 &&
        this.pos.z <= col.z + col.d * 0.5
      ) {
        const top = col.y + col.h * 0.5;
        if (top <= this.pos.y + 0.25 && top > highestY) {
          highestY = top;
        }
      }
    }
    if (highestY > -900) {
      this.blobShadow.visible = true;
      this.blobShadow.position.set(this.pos.x, highestY + 0.03, this.pos.z);
      const dist = Math.max(0, this.pos.y - highestY);
      const s = Math.max(0.35, 1 - dist * 0.06);
      this.blobShadow.scale.setScalar(s);
    } else {
      this.blobShadow.visible = false;
    }
  }

  animateRig(dt) {
    const {
      root,
      squashGroup,
      bodyPivot,
      headPivot,
      leftArmPivot,
      rightArmPivot,
      leftLegPivot,
      rightLegPivot,
      leftEye,
      rightEye,
      capePivot,
      tail,
      hatAnchor
    } = this.rig;

    root.position.copy(this.pos);
    root.rotation.y = this.facingAngle;

    // Apply volume-preserving squash & stretch
    const sy = Math.max(0.55, Math.min(1.45, this.squashY));
    const sxz = 1 / Math.sqrt(sy);
    squashGroup.scale.set(sxz, sy, sxz);

    // Eye blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.6 + Math.random() * 2.2;
    }
    const isBlinking = this.blinkTimer < 0.11;
    leftEye.scale.y = isBlinking ? 0.12 : 1.0;
    rightEye.scale.y = isBlinking ? 0.12 : 1.0;

    // Blink invincibility
    if (this.invincibleTimer > 0) {
      root.visible = Math.floor(this.invincibleTimer * 16) % 2 === 0;
    } else {
      root.visible = true;
    }

    // Spin propeller hat if equipped
    const blade = hatAnchor.getObjectByName('propellerBlade');
    if (blade) {
      blade.rotation.y += (this.grounded ? 6 : 24) * dt;
    }

    // Dual-layer Swipe effect visibility & scale burst
    if (this.attackTimer > 0) {
      const p = this.attackTimer / 0.34;
      this.outerSwipeMat.opacity = p * 0.92;
      this.innerSwipeMat.opacity = p;
      this.swipeGroup.rotation.y = (1 - p) * 2.6 - 0.8;
      this.swipeGroup.scale.setScalar(0.85 + (1 - p) * 0.45);
    } else {
      this.outerSwipeMat.opacity = 0;
      this.innerSwipeMat.opacity = 0;
    }

    const speed = Math.hypot(this.vel.x, this.vel.z);
    const t = this.animTime;

    bodyPivot.position.y = 0.74;
    bodyPivot.rotation.set(0, 0, 0);
    headPivot.rotation.set(0, 0, 0);

    if (this.state === 'dive') {
      bodyPivot.position.y = 0.52;
      bodyPivot.rotation.x = Math.PI * 0.44;
      headPivot.rotation.x = -0.55;
      leftArmPivot.rotation.x = -2.5;
      rightArmPivot.rotation.x = -2.5;
      leftLegPivot.rotation.x = 0.45;
      rightLegPivot.rotation.x = 0.45;
    } else if (this.state === 'swim') {
      const paddle = Math.sin(t * 10);
      bodyPivot.position.y = 0.58;
      bodyPivot.rotation.x = 0.35;
      leftArmPivot.rotation.x = -1.2 + paddle * 0.75;
      rightArmPivot.rotation.x = -1.2 - paddle * 0.75;
      leftLegPivot.rotation.x = -paddle * 0.65;
      rightLegPivot.rotation.x = paddle * 0.65;
    } else if (this.state === 'groundPound') {
      if (this.groundPoundFreeze > 0) {
        bodyPivot.rotation.x = (1 - this.groundPoundFreeze / 0.15) * Math.PI * 2;
      } else {
        bodyPivot.position.y = 0.62;
        leftArmPivot.rotation.x = -2.7;
        rightArmPivot.rotation.x = -2.7;
        leftLegPivot.rotation.x = -0.9;
        rightLegPivot.rotation.x = -0.9;
      }
    } else if (!this.grounded) {
      if (this.state === 'doubleJump') {
        bodyPivot.rotation.x = t * 14;
      } else {
        bodyPivot.rotation.x = -this.vel.y * 0.02;
      }
      leftArmPivot.rotation.x = -2.1;
      rightArmPivot.rotation.x = -2.1;
      leftLegPivot.rotation.x = 0.5;
      rightLegPivot.rotation.x = -0.35;
    } else if (speed > 0.9) {
      const freq = 13.5;
      const swing = Math.sin(t * freq);
      bodyPivot.position.y = 0.74 + Math.abs(Math.cos(t * freq)) * 0.13;
      bodyPivot.rotation.z = swing * 0.09;
      bodyPivot.rotation.x = 0.14;
      leftLegPivot.rotation.x = swing * 0.95;
      rightLegPivot.rotation.x = -swing * 0.95;
      leftArmPivot.rotation.x = -swing * 0.85;
      rightArmPivot.rotation.x = swing * 0.85;
      tail.rotation.y = swing * 0.45;
    } else {
      const breath = Math.sin(t * 3.2);
      bodyPivot.position.y = 0.74 + breath * 0.03;
      headPivot.rotation.z = Math.sin(t * 1.6) * 0.04;
      leftArmPivot.rotation.x = breath * 0.08;
      rightArmPivot.rotation.x = -breath * 0.08;
      leftLegPivot.rotation.x = 0;
      rightLegPivot.rotation.x = 0;
    }

    // Raise arms overhead if carrying a crate or bomb
    if (this.carriedObject) {
      leftArmPivot.rotation.x = -2.85;
      rightArmPivot.rotation.x = -2.85;
    } else if (this.attackTimer > 0) {
      rightArmPivot.rotation.x = -1.6 + Math.sin((1 - this.attackTimer / 0.32) * Math.PI) * 1.4;
      rightArmPivot.rotation.z = -0.5;
    } else {
      rightArmPivot.rotation.z = 0;
    }

    capePivot.rotation.x = 0.18 + Math.min(0.95, speed * 0.075) + Math.sin(t * 10) * 0.06;
  }

  isAttacking() {
    return (
      this.attackTimer > 0 ||
      this.state === 'dive' ||
      this.state === 'groundPound'
    );
  }
}
