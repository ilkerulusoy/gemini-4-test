import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -30, 0)
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.solver.iterations = 10;

    // Contact Materials
    this.matPlayer = new CANNON.Material('player');
    this.matGround = new CANNON.Material('ground');
    this.matIce = new CANNON.Material('ice');
    this.matDynamic = new CANNON.Material('dynamic');

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.matPlayer, this.matGround, {
        friction: 0.0,
        restitution: 0.0
      })
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.matPlayer, this.matIce, {
        friction: 0.0,
        restitution: 0.0
      })
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.matDynamic, this.matGround, {
        friction: 0.45,
        restitution: 0.18
      })
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.matDynamic, this.matDynamic, {
        friction: 0.4,
        restitution: 0.25
      })
    );

    this.colliders = [];
    this.dynamicObjects = [];
    this.constraints = [];
    this.waterZones = [];
    this.accumulator = 0;
  }

  clear() {
    for (const c of this.constraints) {
      this.world.removeConstraint(c);
    }
    this.constraints = [];

    for (const col of this.colliders) {
      if (col.body) this.world.removeBody(col.body);
    }
    this.colliders = [];

    for (const dyn of this.dynamicObjects) {
      if (dyn.body) this.world.removeBody(dyn.body);
    }
    this.dynamicObjects = [];
    this.waterZones = [];
    this.accumulator = 0;
  }

  addWaterZone({ x, y, z, w, h, d, mesh = null }) {
    const zone = {
      x,
      y,
      z,
      w,
      h,
      d,
      surfaceY: y + h * 0.5,
      mesh
    };
    this.waterZones.push(zone);
    return zone;
  }

  getWaterSurfaceAt(pos) {
    for (const wz of this.waterZones) {
      if (
        pos.x >= wz.x - wz.w * 0.5 &&
        pos.x <= wz.x + wz.w * 0.5 &&
        pos.z >= wz.z - wz.d * 0.5 &&
        pos.z <= wz.z + wz.d * 0.5 &&
        pos.y <= wz.surfaceY + 0.4 &&
        pos.y >= wz.y - wz.h * 0.5
      ) {
        return wz.surfaceY;
      }
    }
    return null;
  }

  addBox({
    id,
    x,
    y,
    z,
    w,
    h,
    d,
    mesh = null,
    type = 'solid',
    friction = 1.0,
    bounce = 0,
    mover = null,
    rotX = 0,
    rotY = 0,
    rotZ = 0,
    data = {}
  }) {
    const shape = new CANNON.Box(new CANNON.Vec3(w * 0.5, h * 0.5, d * 0.5));
    const body = new CANNON.Body({
      mass: 0,
      type: mover ? CANNON.Body.KINEMATIC : CANNON.Body.STATIC,
      material: friction < 0.4 ? this.matIce : this.matGround,
      position: new CANNON.Vec3(x, y, z)
    });
    if (rotX || rotY || rotZ) {
      body.quaternion.setFromEuler(rotX, rotY, rotZ);
    }
    body.addShape(shape);
    if (type !== 'trigger') {
      this.world.addBody(body);
    }

    const collider = {
      id: id || `col_${this.colliders.length}`,
      x,
      y,
      z,
      w,
      h,
      d,
      prevX: x,
      prevY: y,
      prevZ: z,
      dx: 0,
      dy: 0,
      dz: 0,
      mesh,
      body,
      type,
      friction,
      bounce,
      mover,
      data,
      enabled: true
    };
    this.colliders.push(collider);
    return collider;
  }

  addDynamicCrate({
    id,
    x,
    y,
    z,
    size = 1.25,
    mass = 5,
    mesh,
    kind = 'crate', // 'crate', 'honey_crate', 'bomb', 'boulder'
    coinsInside = 3
  }) {
    const shape =
      kind === 'boulder'
        ? new CANNON.Sphere(size * 0.5)
        : new CANNON.Box(new CANNON.Vec3(size * 0.5, size * 0.5, size * 0.5));

    const body = new CANNON.Body({
      mass,
      material: this.matDynamic,
      position: new CANNON.Vec3(x, y, z),
      linearDamping: kind === 'boulder' ? 0.15 : 0.35,
      angularDamping: kind === 'boulder' ? 0.15 : 0.45
    });
    body.addShape(shape);
    this.world.addBody(body);

    const entry = {
      id: id || `dyn_${this.dynamicObjects.length}`,
      kind,
      size,
      w: size,
      h: size,
      d: size,
      x,
      y,
      z,
      prevX: x,
      prevY: y,
      prevZ: z,
      dx: 0,
      dy: 0,
      dz: 0,
      spawnX: x,
      spawnY: y,
      spawnZ: z,
      body,
      mesh,
      coinsInside,
      carried: false,
      broken: false,
      enabled: true,
      fuseTimer: 0
    };
    this.dynamicObjects.push(entry);
    return entry;
  }

  addSeesaw({ x, y, z, w = 8, h = 0.45, d = 2.6, mesh }) {
    const plankShape = new CANNON.Box(new CANNON.Vec3(w * 0.5, h * 0.5, d * 0.5));
    const plankBody = new CANNON.Body({
      mass: 18,
      material: this.matGround,
      position: new CANNON.Vec3(x, y, z),
      angularDamping: 0.65
    });
    plankBody.addShape(plankShape);
    this.world.addBody(plankBody);

    const anchorBody = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(x, y, z)
    });
    this.world.addBody(anchorBody);

    const hinge = new CANNON.HingeConstraint(anchorBody, plankBody, {
      pivotA: new CANNON.Vec3(0, 0, 0),
      axisA: new CANNON.Vec3(0, 0, 1),
      pivotB: new CANNON.Vec3(0, 0, 0),
      axisB: new CANNON.Vec3(0, 0, 1)
    });
    this.world.addConstraint(hinge);
    this.constraints.push(hinge);

    const entry = {
      id: `seesaw_${this.dynamicObjects.length}`,
      kind: 'seesaw',
      w,
      h,
      d,
      x,
      y,
      z,
      prevX: x,
      prevY: y,
      prevZ: z,
      dx: 0,
      dy: 0,
      dz: 0,
      body: plankBody,
      mesh,
      enabled: true
    };
    this.dynamicObjects.push(entry);
    return entry;
  }

  updatePlatforms(dt, elapsed) {
    // 1. Update kinematic moving platforms
    for (const col of this.colliders) {
      if (!col.enabled || !col.mover) continue;
      col.prevX = col.x;
      col.prevY = col.y;
      col.prevZ = col.z;

      const next = col.mover(elapsed, col);
      col.x = next.x ?? col.x;
      col.y = next.y ?? col.y;
      col.z = next.z ?? col.z;

      col.dx = col.x - col.prevX;
      col.dy = col.y - col.prevY;
      col.dz = col.z - col.prevZ;

      if (col.body) {
        col.body.position.set(col.x, col.y, col.z);
        if (dt > 0.0001) {
          col.body.velocity.set(col.dx / dt, col.dy / dt, col.dz / dt);
        }
      }
      if (col.mesh) {
        col.mesh.position.set(col.x, col.y, col.z);
      }
    }

    // 2. Step Cannon-es rigid-body simulation
    this.world.step(1 / 60, dt, 3);

    // 3. Sync dynamic rigid bodies (crates, boulders, seesaws) to Three.js meshes
    for (const dyn of this.dynamicObjects) {
      if (!dyn.enabled || dyn.broken || dyn.carried) continue;
      dyn.prevX = dyn.x;
      dyn.prevY = dyn.y;
      dyn.prevZ = dyn.z;

      // Buoyancy in water zones
      const waterY = this.getWaterSurfaceAt(dyn.body.position);
      if (waterY !== null && dyn.kind !== 'boulder') {
        const depth = waterY - dyn.body.position.y;
        if (depth > 0) {
          dyn.body.applyForce(
            new CANNON.Vec3(0, depth * dyn.body.mass * 55, 0),
            dyn.body.position
          );
          dyn.body.velocity.scale(0.94, dyn.body.velocity);
        }
      }

      // Clamp seesaw tilt angle so it stays playable
      if (dyn.kind === 'seesaw') {
        dyn.body.position.x = dyn.spawnX ?? dyn.x;
        dyn.body.position.y = dyn.spawnY ?? dyn.y;
        dyn.body.position.z = dyn.spawnZ ?? dyn.z;
        // Spring restoring torque on seesaw
        dyn.body.torque.z -= dyn.body.quaternion.z * 260;
      }

      // Respawn dynamic crate if it falls into the void
      if (dyn.body.position.y < -15 && dyn.spawnY !== undefined) {
        dyn.body.position.set(dyn.spawnX, dyn.spawnY, dyn.spawnZ);
        dyn.body.velocity.set(0, 0, 0);
        dyn.body.angularVelocity.set(0, 0, 0);
      }

      dyn.x = dyn.body.position.x;
      dyn.y = dyn.body.position.y;
      dyn.z = dyn.body.position.z;
      dyn.dx = dyn.x - dyn.prevX;
      dyn.dy = dyn.y - dyn.prevY;
      dyn.dz = dyn.z - dyn.prevZ;

      if (dyn.mesh) {
        dyn.mesh.position.set(dyn.x, dyn.y, dyn.z);
        dyn.mesh.quaternion.set(
          dyn.body.quaternion.x,
          dyn.body.quaternion.y,
          dyn.body.quaternion.z,
          dyn.body.quaternion.w
        );
      }
    }
  }

  resolvePlayer(player, dt) {
    const r = player.radius;
    const h = player.height;
    const prevGroundCol = player.grounded ? player.groundCollider : null;

    // 1. Carry player on moving platform, seesaw, or dynamic crate BEFORE resolving collisions
    if (prevGroundCol && prevGroundCol.enabled && !prevGroundCol.broken && !prevGroundCol.carried) {
      player.pos.x += prevGroundCol.dx || 0;
      player.pos.y += prevGroundCol.dy || 0;
      player.pos.z += prevGroundCol.dz || 0;

      // Apply downward weight torque if standing on a seesaw
      if (prevGroundCol.kind === 'seesaw' && prevGroundCol.body) {
        const relX = player.pos.x - prevGroundCol.x;
        prevGroundCol.body.applyImpulse(
          new CANNON.Vec3(0, -16 * dt, 0),
          new CANNON.Vec3(relX, 0, 0)
        );
      }
    }

    const activeSolids = [
      ...this.colliders.filter((c) => c.enabled && c.type !== 'trigger'),
      ...this.dynamicObjects.filter((d) => d.enabled && !d.broken && !d.carried)
    ];

    // Helper to ignore side-wall ejection against the platform we are currently standing on
    const isStandingSurface = (col) => {
      const topY = col.y + col.h * 0.5;
      return col === prevGroundCol || player.pos.y >= topY - 0.35;
    };

    // 2. Horizontal X movement & resolution (+ pushing dynamic bodies)
    player.pos.x += player.vel.x * dt;
    for (const col of activeSolids) {
      if (isStandingSurface(col)) continue;
      if (this.overlaps(player.pos, r, h, col)) {
        if (col.body && col.body.mass > 0 && col.kind !== 'seesaw') {
          col.body.wakeUp();
          col.body.velocity.x = player.vel.x * 0.85;
        }
        const minX = col.x - col.w * 0.5 - r;
        const maxX = col.x + col.w * 0.5 + r;
        if (player.vel.x > 0) {
          player.pos.x = minX;
        } else if (player.vel.x < 0) {
          player.pos.x = maxX;
        } else {
          player.pos.x = Math.abs(player.pos.x - minX) < Math.abs(player.pos.x - maxX) ? minX : maxX;
        }
        player.vel.x = 0;
      }
    }

    // 3. Horizontal Z movement & resolution (+ pushing dynamic bodies)
    player.pos.z += player.vel.z * dt;
    for (const col of activeSolids) {
      if (isStandingSurface(col)) continue;
      if (this.overlaps(player.pos, r, h, col)) {
        if (col.body && col.body.mass > 0 && col.kind !== 'seesaw') {
          col.body.wakeUp();
          col.body.velocity.z = player.vel.z * 0.85;
        }
        const minZ = col.z - col.d * 0.5 - r;
        const maxZ = col.z + col.d * 0.5 + r;
        if (player.vel.z > 0) {
          player.pos.z = minZ;
        } else if (player.vel.z < 0) {
          player.pos.z = maxZ;
        } else {
          player.pos.z = Math.abs(player.pos.z - minZ) < Math.abs(player.pos.z - maxZ) ? minZ : maxZ;
        }
        player.vel.z = 0;
      }
    }

    // 4. Vertical Y movement & resolution
    player.grounded = false;
    player.groundCollider = null;
    const prevY = player.pos.y;
    player.pos.y += player.vel.y * dt;

    for (const col of activeSolids) {
      let topY = col.y + col.h * 0.5;
      if (col.kind === 'seesaw' && col.body) {
        const relX = player.pos.x - col.x;
        const sinZ = 2 * (col.body.quaternion.w * col.body.quaternion.z);
        topY = col.y + relX * sinZ + col.h * 0.5;
      }
      const bottomY = col.y - col.h * 0.5 - h;

      if (this.overlaps(player.pos, r, h, col)) {
        if (player.vel.y <= 0 && prevY >= topY - 1.05) {
          player.pos.y = topY;
          player.vel.y = 0;
          player.grounded = true;
          player.groundCollider = col;
        } else if (player.vel.y > 0 && prevY <= bottomY + 0.7) {
          player.pos.y = bottomY;
          player.vel.y = 0;
        }
      }
    }

    // 5. Moving platform downward snap-lock: if player was standing on a platform and hasn't jumped,
    // keep them locked to its top surface even when the platform accelerates downward!
    if (!player.grounded && prevGroundCol && prevGroundCol.enabled && player.vel.y <= 0) {
      const withinX =
        player.pos.x + r > prevGroundCol.x - prevGroundCol.w * 0.5 &&
        player.pos.x - r < prevGroundCol.x + prevGroundCol.w * 0.5;
      const withinZ =
        player.pos.z + r > prevGroundCol.z - prevGroundCol.d * 0.5 &&
        player.pos.z - r < prevGroundCol.z + prevGroundCol.d * 0.5;

      if (withinX && withinZ) {
        let topY = prevGroundCol.y + prevGroundCol.h * 0.5;
        if (prevGroundCol.kind === 'seesaw' && prevGroundCol.body) {
          const relX = player.pos.x - prevGroundCol.x;
          const sinZ = 2 * (prevGroundCol.body.quaternion.w * prevGroundCol.body.quaternion.z);
          topY = prevGroundCol.y + relX * sinZ + prevGroundCol.h * 0.5;
        }
        if (Math.abs(player.pos.y - topY) <= 0.75) {
          player.pos.y = topY;
          player.vel.y = 0;
          player.grounded = true;
          player.groundCollider = prevGroundCol;
        }
      }
    }
  }

  findLedgeCandidate(player) {
    if (player.grounded || player.vel.y > 7.5) return null;
    const forwardX = Math.sin(player.facingAngle);
    const forwardZ = Math.cos(player.facingAngle);

    // Check several forward reach distances so the bear reliably grabs overhead rock/platform ledges
    const reachProbes = [player.radius + 0.25, player.radius + 0.55, player.radius + 0.85];

    for (const col of this.colliders) {
      if (!col.enabled || col.type === 'trigger') continue;
      const topY = col.y + col.h * 0.5;
      // Only grab ledges that are at least 0.5m above the ground/feet
      if (topY - player.pos.y < 0.35 || topY - player.pos.y > player.height + 0.65) continue;

      for (const dist of reachProbes) {
        const probeX = player.pos.x + forwardX * dist;
        const probeZ = player.pos.z + forwardZ * dist;
        const inX = probeX >= col.x - col.w * 0.5 && probeX <= col.x + col.w * 0.5;
        const inZ = probeZ >= col.z - col.d * 0.5 && probeZ <= col.z + col.d * 0.5;
        if (!inX || !inZ) continue;

        // Check that the space above the ledge is clear
        return {
          col,
          topY,
          climbX: player.pos.x + forwardX * (dist + 0.28),
          climbZ: player.pos.z + forwardZ * (dist + 0.28)
        };
      }
    }
    return null;
  }

  overlaps(pos, radius, height, col) {
    const pMinX = pos.x - radius;
    const pMaxX = pos.x + radius;
    const pMinY = pos.y;
    const pMaxY = pos.y + height;
    const pMinZ = pos.z - radius;
    const pMaxZ = pos.z + radius;

    const cMinX = col.x - col.w * 0.5;
    const cMaxX = col.x + col.w * 0.5;
    const cMinY = col.y - col.h * 0.5;
    const cMaxY = col.y + col.h * 0.5;
    const cMinZ = col.z - col.d * 0.5;
    const cMaxZ = col.z + col.d * 0.5;

    return (
      pMaxX > cMinX &&
      pMinX < cMaxX &&
      pMaxY > cMinY &&
      pMinY < cMaxY &&
      pMaxZ > cMinZ &&
      pMinZ < cMaxZ
    );
  }
}
