import * as THREE from 'three';
import { createBearRig } from '../entities/BearRig.js';
import { TextureFactory } from '../engine/TextureFactory.js';
import { LEVELS } from './LevelRegistry.js';
import { AssetLoader } from '../engine/AssetLoader.js';

export class LevelBuilder {
  constructor(scene, physics, saveManager, sound, particles) {
    this.scene = scene;
    this.physics = physics;
    this.saveManager = saveManager;
    this.sound = sound;
    this.particles = particles;

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.coins = [];
    this.hearts = [];
    this.trampolines = [];
    this.switches = [];
    this.checkpoints = [];
    this.cages = [];
    this.enemies = [];
    this.npcs = [];
    this.portals = [];
    this.scenery = [];
    this.animatedProps = [];
    this.cameraObstacles = [];
    this.waterMesh = null;
    this.boss = null;
    this.killY = -16;
  }

  clear() {
    while (this.root.children.length > 0) {
      const child = this.root.children[0];
      this.root.remove(child);
    }
    this.physics.clear();
    this.coins = [];
    this.hearts = [];
    this.trampolines = [];
    this.switches = [];
    this.checkpoints = [];
    this.cages = [];
    this.enemies = [];
    this.npcs = [];
    this.portals = [];
    this.scenery = [];
    this.animatedProps = [];
    this.cameraObstacles = [];
    this.waterMesh = null;
    this.boss = null;
  }

  loadLevel(levelId, player) {
    this.clear();
    const meta = LEVELS.find((l) => l.id === levelId) || LEVELS[0];
    this.scene.background = new THREE.Color(meta.skyColor);
    this.scene.fog = new THREE.FogExp2(meta.fogColor, 0.0068);

    this.buildSkyClouds();
    this.buildSurroundingOcean(levelId);

    if (levelId === 'hub') {
      this.buildHubLevel(player);
    } else if (levelId === 'turtletown') {
      this.buildTurtletownLevel(player);
    } else if (levelId === 'snowvalley') {
      this.buildSnowValleyLevel(player);
    } else if (levelId === 'beemothep') {
      this.buildBeemothepLevel(player);
    }

    this.sound.startMusic(meta.theme);
    return meta;
  }

  buildSurroundingOcean(levelId) {
    const waterColors = {
      hub: 0x00b4d8,
      turtletown: 0x0096c7,
      snowvalley: 0x48cae4,
      beemothep: 0xf59e0b
    };
    const waterColor = waterColors[levelId] || 0x00b4d8;

    const geo = new THREE.PlaneGeometry(240, 240, 32, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: waterColor,
      roughness: 0.18,
      metalness: 0.25,
      transparent: true,
      opacity: 0.86
    });
    const water = new THREE.Mesh(geo, mat);
    water.position.y = -2.2;
    water.receiveShadow = true;
    this.root.add(water);
    this.waterMesh = water;

    // Make ocean swimmable so kids don't instantly die when splashing in water
    this.physics.addWaterZone({
      x: 0,
      y: -5.2,
      z: -20,
      w: 220,
      h: 6.0,
      d: 220,
      mesh: water
    });
  }

  // --- Shared Building Blocks ---
  addPlatform({
    x,
    y,
    z,
    w,
    h,
    d,
    topColor = 0x52b788,
    sideColor = 0x8d5524,
    surface = 'grass', // 'grass', 'cobble', 'ice', 'snow', 'honey', 'wood'
    friction = 1.0,
    mover = null,
    id = null
  }) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const topHeight = Math.min(0.48, h * 0.35);
    const baseHeight = Math.max(0.1, h - topHeight);

    const repX = Math.max(1, Math.round(w / 4));
    const repZ = Math.max(1, Math.round(d / 4));

    const dirtTex = TextureFactory.getDirtCliff(repX, Math.max(1, Math.round(h / 3)));
    const baseMat = new THREE.MeshStandardMaterial({
      color: sideColor,
      map: dirtTex,
      roughness: 0.85
    });
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(w, baseHeight, d), baseMat);
    baseMesh.position.y = -topHeight * 0.5;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    let topTex = null;
    if (surface === 'grass') topTex = TextureFactory.getGrass('meadow', repX, repZ);
    else if (surface === 'cobble') topTex = TextureFactory.getCobble(repX, repZ);
    else if (surface === 'ice') topTex = TextureFactory.getIce(repX, repZ);
    else if (surface === 'snow') topTex = TextureFactory.getSnow(repX, repZ);
    else if (surface === 'honey') topTex = TextureFactory.getHoneycomb(repX, repZ);

    const topMat = new THREE.MeshStandardMaterial({
      color: topColor,
      map: topTex,
      roughness: friction < 0.5 ? 0.12 : 0.62,
      metalness: friction < 0.5 ? 0.28 : 0.05
    });
    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, topHeight, d + 0.18), topMat);
    topMesh.position.y = h * 0.5 - topHeight * 0.5;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    group.add(topMesh);

    this.root.add(group);
    this.cameraObstacles.push(baseMesh);

    return this.physics.addBox({
      id,
      x,
      y,
      z,
      w,
      h,
      d,
      mesh: group,
      friction,
      mover
    });
  }

  addPhysicsCrate({ x, y, z, size = 1.25, kind = 'crate', coinsInside = 3 }) {
    const crateTex = TextureFactory.getWoodCrate();
    let mat;
    if (kind === 'bomb') {
      mat = new THREE.MeshStandardMaterial({
        color: 0xff006e,
        emissive: 0x440018,
        roughness: 0.35
      });
    } else if (kind === 'boulder') {
      mat = new THREE.MeshStandardMaterial({
        color: 0xadb5bd,
        map: TextureFactory.getCobble(2, 2),
        roughness: 0.6
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: 0xffd166,
        map: crateTex,
        roughness: 0.65
      });
    }

    const geo =
      kind === 'boulder'
        ? new THREE.DodecahedronGeometry(size * 0.52, 1)
        : new THREE.BoxGeometry(size, size, size);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);

    return this.physics.addDynamicCrate({
      x,
      y,
      z,
      size,
      mass: kind === 'boulder' ? 14 : 5,
      mesh,
      kind,
      coinsInside
    });
  }

  addSeesawBridge({ x, y, z, w = 8.5, d = 2.8 }) {
    // Fulcrum triangle underneath
    const fulcrumMat = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.5 });
    const fulcrum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, d, 3), fulcrumMat);
    fulcrum.rotation.x = Math.PI / 2;
    fulcrum.position.set(x, y - 0.55, z);
    this.root.add(fulcrum);

    const plankMat = new THREE.MeshStandardMaterial({
      color: 0xffbe0b,
      map: TextureFactory.getWoodCrate(),
      roughness: 0.55
    });
    const plankMesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, d), plankMat);
    plankMesh.position.set(x, y, z);
    plankMesh.castShadow = true;
    plankMesh.receiveShadow = true;
    this.root.add(plankMesh);

    const entry = this.physics.addSeesaw({ x, y, z, w, h: 0.45, d, mesh: plankMesh });
    entry.spawnX = x;
    entry.spawnY = y;
    entry.spawnZ = z;
    return entry;
  }

  addCottage(x, y, z, roofColor = 0xe63946) {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const fallback = new THREE.Group();
    g.add(fallback);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfefae0, roughness: 0.8 });
    const walls = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.0, 4.2), wallMat);
    walls.position.y = 1.5;
    walls.castShadow = true;
    walls.receiveShadow = true;
    fallback.add(walls);

    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.6 });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.2, 4), roofMat);
    roof.position.y = 4.1;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    fallback.add(roof);

    AssetLoader.loadGLB('/assets/hex/unit-mansion.glb')
      .then((glb) => {
        fallback.visible = false;
        glb.scale.setScalar(13.5);
        g.add(glb);
      })
      .catch(() => {});

    this.root.add(g);
    this.physics.addBox({ x, y: y + 1.8, z, w: 4.2, h: 3.6, d: 4.2 });
    this.physics.addBox({ x, y: y + 3.4, z, w: 3.4, h: 0.6, d: 3.4 });
  }

  addWindmill(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const fallback = new THREE.Group();
    g.add(fallback);

    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf4a261, roughness: 0.75 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.1, 6.5, 8), towerMat);
    tower.position.y = 3.25;
    tower.castShadow = true;
    fallback.add(tower);

    const rotor = new THREE.Group();
    rotor.position.set(0, 5.4, 1.6);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xfffdf5 });
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.2, 0.1), bladeMat);
      b.position.y = 1.6;
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      arm.add(b);
      rotor.add(arm);
    }
    fallback.add(rotor);

    AssetLoader.loadGLB('/assets/hex/unit-mill.glb')
      .then((glb) => {
        fallback.visible = false;
        glb.scale.setScalar(15.0);
        g.add(glb);
      })
      .catch(() => {});

    this.root.add(g);
    this.animatedProps.push((dt) => {
      rotor.rotation.z += 1.2 * dt;
    });
    this.physics.addBox({ x, y: y + 3.25, z, w: 3.4, h: 6.5, d: 3.4 });
  }

  addTree(x, y, z, scale = 1, snow = false) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(scale);

    const fallback = new THREE.Group();
    g.add(fallback);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6f4518, roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.8, 8), trunkMat);
    trunk.position.y = 0.9;
    trunk.castShadow = true;
    fallback.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({
      color: snow ? 0xd8f3dc : 0x2d6a4f,
      roughness: 0.65
    });
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.45, 2.2, 8), leafMat);
    c1.position.y = 2.4;
    c1.castShadow = true;
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 8), leafMat);
    c2.position.y = 3.5;
    c2.castShadow = true;
    fallback.add(c1, c2);

    AssetLoader.loadGLB('/assets/hex/unit-tree.glb')
      .then((glb) => {
        fallback.visible = false;
        glb.scale.setScalar(13.5);
        g.add(glb);
      })
      .catch(() => {});

    this.root.add(g);
    this.physics.addBox({ x, y: y + 1.5 * scale, z, w: 0.7 * scale, h: 3 * scale, d: 0.7 * scale });
  }

  addFlowerPatch(x, y, z, count = 6) {
    const colors = [0xff006e, 0xffbe0b, 0x3a86ff, 0xfb5607];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 0.6 + (i % 3) * 0.45;
      const fg = new THREE.Group();
      fg.position.set(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5),
        new THREE.MeshBasicMaterial({ color: 0x2d6a4f })
      );
      stem.position.y = 0.15;
      const head = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.14, 0),
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length] })
      );
      head.position.y = 0.32;
      fg.add(stem, head);
      this.root.add(fg);
    }
  }

  addCoin(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffc300,
      emissive: 0x664400,
      metalness: 0.65,
      roughness: 0.22
    });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 14), mat);
    cyl.rotation.x = Math.PI / 2;
    cyl.castShadow = true;
    group.add(cyl);
    this.root.add(group);
    this.coins.push({ mesh: group, baseY: y, collected: false });
  }

  addCoinArc(startX, startY, startZ, endX, endY, endZ, count = 5, arcHeight = 2.0) {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const x = startX + (endX - startX) * t;
      const z = startZ + (endZ - startZ) * t;
      const y = startY + (endY - startY) * t + Math.sin(t * Math.PI) * arcHeight;
      this.addCoin(x, y, z);
    }
  }

  addCoinRing(cx, cy, cz, radius = 3, count = 8) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.addCoin(cx + Math.cos(a) * radius, cy, cz + Math.sin(a) * radius);
    }
  }

  addTrampoline(x, y, z, bounceForce = 22.5) {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const stemMat = new THREE.MeshStandardMaterial({ color: 0xfefae0, roughness: 0.8 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.6, 12), stemMat);
    stem.position.y = 0.3;
    g.add(stem);

    const capMat = new THREE.MeshStandardMaterial({
      color: 0xff006e,
      emissive: 0x330018,
      roughness: 0.4
    });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.1, 0.38, 16), capMat);
    cap.position.y = 0.72;
    cap.castShadow = true;
    g.add(cap);

    const spotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 8), spotMat);
      spot.position.set(Math.cos(a) * 0.7, 0.92, Math.sin(a) * 0.7);
      g.add(spot);
    }

    this.root.add(g);
    this.trampolines.push({
      x,
      y: y + 0.9,
      z,
      radius: 1.48,
      bounceForce,
      mesh: cap,
      pulse: 0
    });
  }

  addCheckpoint(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const poleMat = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.5 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8), poleMat);
    pole.position.y = 1.4;
    g.add(pole);

    const flagMat = new THREE.MeshStandardMaterial({
      color: 0xef476f,
      emissive: 0x220008,
      side: THREE.DoubleSide
    });
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 0.08), flagMat);
    flag.position.set(0.55, 2.35, 0);
    g.add(flag);

    this.root.add(g);
    this.checkpoints.push({
      x,
      y,
      z,
      flagMat,
      flag,
      activated: false
    });
  }

  addSwitch({ x, y, z, onActivate, label = 'Floor Switch' }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x495057, roughness: 0.7 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.2, 14), baseMat);
    base.position.y = 0.1;
    g.add(base);

    const btnMat = new THREE.MeshStandardMaterial({
      color: 0xffbe0b,
      emissive: 0x553300,
      roughness: 0.35
    });
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.28, 14), btnMat);
    btn.position.y = 0.28;
    g.add(btn);

    this.root.add(g);
    this.switches.push({
      x,
      y,
      z,
      btn,
      btnMat,
      pressed: false,
      label,
      onActivate
    });
  }

  addBearCage({ id, name, hint, x, y, z, locked = false }) {
    const alreadyRescued = this.saveManager.isBearRescued(id);
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const bear = createBearRig({
      furColor: alreadyRescued ? 0xb5838d : 0xb07d4f,
      bellyColor: 0xf4a261,
      hatId: 'none',
      capeId: 'emerald',
      scale: 0.88
    });
    group.add(bear.root);

    const cageGroup = new THREE.Group();
    const barMat = new THREE.MeshStandardMaterial({
      color: locked ? 0xe63946 : 0xadb5bd,
      metalness: 0.7,
      roughness: 0.3,
      transparent: alreadyRescued,
      opacity: alreadyRescued ? 0.25 : 1.0
    });

    const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 2.1), barMat);
    frameBottom.position.y = 0.08;
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.2, 2.1), barMat);
    frameTop.position.y = 2.15;
    cageGroup.add(frameBottom, frameTop);

    const barPositions = [
      [-0.95, -0.95], [-0.32, -0.95], [0.32, -0.95], [0.95, -0.95],
      [-0.95, 0.95], [-0.32, 0.95], [0.32, 0.95], [0.95, 0.95],
      [-0.95, -0.32], [-0.95, 0.32], [0.95, -0.32], [0.95, 0.32]
    ];
    for (const [bx, bz] of barPositions) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 6), barMat);
      bar.position.set(bx, 1.1, bz);
      bar.castShadow = true;
      cageGroup.add(bar);
    }

    const beaconMat = new THREE.MeshStandardMaterial({
      color: locked ? 0xff0055 : 0x00f5d4,
      emissive: locked ? 0x660022 : 0x006655
    });
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), beaconMat);
    beacon.position.y = 2.95;
    cageGroup.add(beacon);

    if (alreadyRescued) {
      cageGroup.visible = false;
    }
    group.add(cageGroup);
    this.root.add(group);

    const cageEntry = {
      id,
      name,
      hint,
      x,
      y,
      z,
      bear,
      cageGroup,
      barMat,
      beacon,
      beaconMat,
      locked,
      rescued: alreadyRescued,
      celebrateTimer: 0
    };
    this.cages.push(cageEntry);
    return cageEntry;
  }

  addEnemy({ x, y, z, patrolDist = 4, axis = 'x', type = 'bee' }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const fallback = new THREE.Group();
    g.add(fallback);

    const purpleMat = new THREE.MeshStandardMaterial({ color: 0x7209b7, roughness: 0.4 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffbe0b, roughness: 0.35 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xe0fbfc,
      transparent: true,
      opacity: 0.75
    });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.45, 10, 14), purpleMat);
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.68;
    body.castShadow = true;
    fallback.add(body);

    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.22, 14), stripeMat);
    s1.rotation.x = Math.PI / 2;
    s1.position.set(0, 0.68, -0.14);
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.22, 14), stripeMat);
    s2.rotation.x = Math.PI / 2;
    s2.position.set(0, 0.68, 0.22);
    fallback.add(s1, s2);

    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyeMat);
    e1.position.set(-0.2, 0.78, 0.56);
    const e2 = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyeMat);
    e2.position.set(0.2, 0.78, 0.56);
    fallback.add(e1, e2);

    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.05, 0.42), wingMat);
    leftWing.position.set(-0.6, 1.08, 0);
    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.05, 0.42), wingMat);
    rightWing.position.set(0.6, 1.08, 0);
    g.add(leftWing, rightWing);

    const entry = {
      type,
      mesh: g,
      leftWing,
      rightWing,
      startX: x,
      startY: y,
      startZ: z,
      x,
      y,
      z,
      patrolDist,
      axis,
      phase: Math.random() * Math.PI * 2,
      alive: true
    };

    // Load official Kenney animal-bee.glb!
    AssetLoader.loadGLB('/assets/pets/animal-bee.glb')
      .then((glb) => {
        fallback.visible = false;
        glb.scale.setScalar(1.05);
        g.add(glb);
        const wl = glb.getObjectByName('wing-left');
        const wr = glb.getObjectByName('wing-right');
        if (wl && wr) {
          leftWing.visible = false;
          rightWing.visible = false;
          entry.leftWing = wl;
          entry.rightWing = wr;
        }
      })
      .catch(() => {});

    this.root.add(g);
    this.enemies.push(entry);
  }

  addNPC({ x, y, z, name, role, dialog, furColor = 0xb08968, hatId = 'crown', opensShop = false }) {
    const bear = createBearRig({
      furColor,
      bellyColor: 0xffe8d6,
      hatId,
      capeId: 'royal',
      scale: 0.96
    });
    bear.root.position.set(x, y, z);

    const badgeMat = new THREE.MeshStandardMaterial({
      color: opensShop ? 0xffbe0b : 0x00bbf9,
      emissive: opensShop ? 0x664400 : 0x003355
    });
    const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), badgeMat);
    badge.position.set(0, 2.35, 0);
    bear.root.add(badge);

    this.root.add(bear.root);
    this.npcs.push({
      x,
      y,
      z,
      name,
      role,
      dialog,
      opensShop,
      bear,
      badge
    });
  }

  addWanderingCritter({
    x,
    y,
    z,
    petName = 'animal-bunny',
    patrolDist = 3.5,
    axis = 'x',
    speed = 1.4
  }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    this.root.add(g);

    const state = {
      x,
      y,
      z,
      startX: x,
      startY: y,
      startZ: z,
      phase: Math.random() * Math.PI * 2,
      lf: null,
      rf: null,
      lb: null,
      rb: null
    };

    AssetLoader.loadGLB(`/assets/pets/${petName}.glb`)
      .then((glb) => {
        glb.scale.setScalar(0.92);
        g.add(glb);
        state.lf = glb.getObjectByName('leg-front-left');
        state.rf = glb.getObjectByName('leg-front-right');
        state.lb = glb.getObjectByName('leg-back-left');
        state.rb = glb.getObjectByName('leg-back-right');
      })
      .catch(() => {});

    this.animatedProps.push((dt, elapsed) => {
      state.phase += dt * speed;
      const offset = Math.sin(state.phase) * patrolDist;
      const prevX = state.x;
      const prevZ = state.z;
      if (axis === 'x') state.x = state.startX + offset;
      else state.z = state.startZ + offset;

      const hop = Math.abs(Math.sin(elapsed * 8 + state.phase)) * 0.14;
      g.position.set(state.x, state.startY + hop, state.z);
      if (Math.hypot(state.x - prevX, state.z - prevZ) > 0.0005) {
        g.rotation.y = Math.atan2(state.x - prevX, state.z - prevZ);
      }

      const swing = Math.sin(elapsed * 11 + state.phase) * 0.65;
      if (state.lf) state.lf.rotation.x = swing;
      if (state.rf) state.rf.rotation.x = -swing;
      if (state.lb) state.lb.rotation.x = -swing;
      if (state.rb) state.rb.rotation.x = swing;
    });
  }

  addPortal({ x, y, z, targetLevelId, color = 0x3a86ff }) {
    const meta = LEVELS.find((l) => l.id === targetLevelId);
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xadb5bd,
      map: TextureFactory.getCobble(1, 2),
      roughness: 0.75
    });
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.75, 3.8, 0.75), stoneMat);
    leftPillar.position.set(-1.6, 1.9, 0);
    leftPillar.castShadow = true;
    const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.75, 3.8, 0.75), stoneMat);
    rightPillar.position.set(1.6, 1.9, 0);
    rightPillar.castShadow = true;
    const topArch = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.8, 0.95), stoneMat);
    topArch.position.set(0, 3.9, 0);
    topArch.castShadow = true;
    g.add(leftPillar, rightPillar, topArch);

    const unlocked = this.saveManager.getTotalRescued() >= (meta?.requiredBears || 0);
    const vortexMat = new THREE.MeshStandardMaterial({
      color: unlocked ? color : 0x495057,
      emissive: unlocked ? color : 0x111111,
      emissiveIntensity: unlocked ? 0.55 : 0.1,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const vortex = new THREE.Mesh(new THREE.CircleGeometry(1.48, 24), vortexMat);
    vortex.position.set(0, 1.95, 0);
    g.add(vortex);

    this.root.add(g);
    this.portals.push({
      x,
      y,
      z,
      targetLevelId,
      meta,
      vortex,
      vortexMat,
      color
    });
  }

  buildSkyClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95
    });
    const positions = [
      [-32, 24, -40], [28, 28, -50], [-45, 22, 12],
      [48, 26, 18], [0, 32, -75], [-18, 29, 45]
    ];
    for (const [cx, cy, cz] of positions) {
      const cg = new THREE.Group();
      cg.position.set(cx, cy, cz);
      const b1 = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 10), cloudMat);
      b1.scale.set(1.8, 0.75, 1.1);
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 10), cloudMat);
      b2.position.set(1.8, 0.5, 0);
      const b3 = new THREE.Mesh(new THREE.SphereGeometry(1.9, 12, 10), cloudMat);
      b3.position.set(-1.9, 0.3, 0.3);
      cg.add(b1, b2, b3);
      this.root.add(cg);
      this.scenery.push(cg);
    }
  }

  // =========================================================================
  // LEVEL 1: BEAR VILLAGE HUB
  // =========================================================================
  buildHubLevel(player) {
    this.killY = -14;
    player.setSpawn(0, 1.5, 9, true);

    // Main central plaza island with lush grass texture
    this.addPlatform({
      x: 0,
      y: -1.5,
      z: 0,
      w: 44,
      h: 3,
      d: 44,
      topColor: 0x52b788,
      sideColor: 0x7f4f24,
      surface: 'grass'
    });

    // Cobblestone town square & fountain
    this.addPlatform({
      x: 0,
      y: 0.25,
      z: 0,
      w: 7.0,
      h: 0.5,
      d: 7.0,
      topColor: 0xced4da,
      sideColor: 0x6c757d,
      surface: 'cobble'
    });
    this.addPlatform({
      x: 0,
      y: 0.75,
      z: 0,
      w: 3.8,
      h: 0.5,
      d: 3.8,
      topColor: 0x48cae4,
      sideColor: 0xadb5bd,
      surface: 'ice'
    });
    this.addCoinRing(0, 1.35, 0, 4.6, 8);

    // Cozy Village Cottages & Windmill
    this.addCottage(-14, 0, 11, 0xe63946);
    this.addCottage(14, 0, 11, 0x3a86ff);
    this.addWindmill(15, 0, -5);

    // Flower patches & Trees
    this.addFlowerPatch(-6, 0, 8, 7);
    this.addFlowerPatch(6, 0, 8, 7);
    this.addTree(-17, 0, -14, 1.15);
    this.addTree(17, 0, -14, 1.2);


    // Cute Kenney Cube-Pets roaming around the Village Plaza!
    this.addWanderingCritter({ x: -8, y: 0, z: 6, petName: 'animal-bunny', patrolDist: 4, axis: 'x' });
    this.addWanderingCritter({ x: 8, y: 0, z: 5, petName: 'animal-dog', patrolDist: 3.5, axis: 'z' });
    this.addWanderingCritter({ x: -7, y: 0, z: -7, petName: 'animal-chick', patrolDist: 3, axis: 'x' });
    this.addWanderingCritter({ x: 9, y: 0, z: -8, petName: 'animal-fox', patrolDist: 4.5, axis: 'x' });
    this.addWanderingCritter({ x: 0, y: 0, z: 13, petName: 'animal-panda', patrolDist: 4, axis: 'x' });
    // Interactive Physics Sandbox Playground in the Village! (Crates + Seesaw + Boulder)
    this.addPhysicsCrate({ x: -5.5, y: 1.5, z: 2.5 });
    this.addPhysicsCrate({ x: -5.5, y: 3.0, z: 2.5 });
    this.addPhysicsCrate({ x: -4.0, y: 1.5, z: 2.5 });
    this.addPhysicsCrate({ x: 6.5, y: 1.5, z: 1.5, kind: 'boulder', size: 1.4 });
    this.addSeesawBridge({ x: 8.5, y: 0.9, z: 7.5, w: 7.0, d: 2.4 });

    // Watchtower challenge in Hub to rescue Barnaby (hub_b1)
    this.addPlatform({
      x: -13,
      y: 1.0,
      z: 1,
      w: 4.8,
      h: 2,
      d: 4.8,
      topColor: 0xe9c46a,
      sideColor: 0x8d5524,
      surface: 'cobble'
    });
    this.addPlatform({
      x: -13,
      y: 3.2,
      z: -5,
      w: 4.2,
      h: 1.2,
      d: 4.2,
      topColor: 0xe9c46a,
      sideColor: 0x8d5524,
      surface: 'cobble'
    });
    this.addTrampoline(-13, 3.8, -5, 21.5);
    this.addPlatform({
      x: -13,
      y: 8.5,
      z: -11,
      w: 6.8,
      h: 1.5,
      d: 6.8,
      topColor: 0xf4a261,
      sideColor: 0x6f4518,
      surface: 'cobble'
    });
    this.addCoinArc(-13, 2.5, 1, -13, 4.5, -5, 4, 1.4);

    this.addBearCage({
      id: 'hub_b1',
      name: 'Barnaby',
      hint: 'Atop the Village Watchtower',
      x: -13,
      y: 9.25,
      z: -11
    });

    // NPCs: Elder Grizz & Tailor Honey
    this.addNPC({
      x: -3.5,
      y: 0,
      z: 4.8,
      name: 'Elder Grizz',
      role: 'Kingdom Guardian',
      furColor: 0x7f5539,
      hatId: 'crown',
      dialog: [
        'Welcome to Bear Village, Baaren! Pick up wooden crates with [R], ride the seesaw, or splash in the ocean water below!',
        'Step into the glowing World Portals to travel to Turtletown Meadows, Snow Valley, and Beemothep Hive. Smash cages with your Paw Attack [F], Belly Dive [Shift], or Ground Pound [Q]!'
      ]
    });

    this.addNPC({
      x: 4.2,
      y: 0,
      z: 4.8,
      name: 'Tailor Honey',
      role: 'Royal Outfitter',
      furColor: 0xd4a373,
      hatId: 'fez',
      opensShop: true,
      dialog: [
        'Looking sharp, Baaren! Trade your Honey Coins here for Royal Crowns, Propeller Caps, and Velvet Capes!'
      ]
    });

    // Three World Portals on the northern ridge
    this.addPlatform({
      x: 0,
      y: 0.5,
      z: -17.5,
      w: 30,
      h: 1.0,
      d: 7.0,
      topColor: 0xadb5bd,
      sideColor: 0x6c757d,
      surface: 'cobble'
    });
    this.addPortal({ x: -9.5, y: 1.0, z: -18.5, targetLevelId: 'turtletown', color: 0x2ec4b6 });
    this.addPortal({ x: 0, y: 1.0, z: -18.5, targetLevelId: 'snowvalley', color: 0x3a86ff });
    this.addPortal({ x: 9.5, y: 1.0, z: -18.5, targetLevelId: 'beemothep', color: 0xff9f1c });
  }

  // =========================================================================
  // LEVEL 2: TURTLETOWN MEADOWS (4 Bears)
  // =========================================================================
  buildTurtletownLevel(player) {
    this.killY = -16;
    player.setSpawn(0, 1.5, 0, true);

    this.addPortal({ x: 0, y: 0, z: 6.0, targetLevelId: 'hub', color: 0x9ef01a });

    // Starting Meadow Island
    this.addPlatform({
      x: 0,
      y: -1.5,
      z: 0,
      w: 24,
      h: 3,
      d: 24,
      topColor: 0x52b788,
      sideColor: 0x7f4f24,
      surface: 'grass'
    });
    this.addCottage(-7.5, 0, 3, 0x2ec4b6);
    this.addTree(8, 0, -6, 1.1);
    this.addFlowerPatch(4, 0, 2, 6);

    this.addWanderingCritter({ x: -5, y: 0, z: -4, petName: 'animal-deer', patrolDist: 3.5, axis: 'x' });
    this.addWanderingCritter({ x: 5, y: 0, z: 4, petName: 'animal-beaver', patrolDist: 3.0, axis: 'z' });
    this.addWanderingCritter({ x: -8, y: 1.0, z: -38, petName: 'animal-koala', patrolDist: 3.5, axis: 'z' });
    this.addPhysicsCrate({ x: 3.5, y: 1.5, z: -4.5 });
    this.addPhysicsCrate({ x: 5.0, y: 1.5, z: -4.5 });
    this.addCoinArc(0, 1.2, -4, 0, 2.2, -16, 5, 1.6);

    // Stepping stones to Flower Plaza
    this.addPlatform({
      x: 0,
      y: -0.5,
      z: -15,
      w: 6.0,
      h: 1.5,
      d: 6.0,
      topColor: 0x74c69d,
      sideColor: 0x7f4f24,
      surface: 'grass'
    });
    this.addPlatform({
      x: 0,
      y: 0.2,
      z: -23,
      w: 6.0,
      h: 1.5,
      d: 6.0,
      topColor: 0x74c69d,
      sideColor: 0x7f4f24,
      surface: 'grass'
    });

    // Flower Plaza Island (Bear 1: Bramble + 2 patrolling Purple Bees)
    this.addPlatform({
      x: 0,
      y: -0.5,
      z: -37,
      w: 26,
      h: 3,
      d: 22,
      topColor: 0x40916c,
      sideColor: 0x6f4518,
      surface: 'grass'
    });
    this.addCheckpoint(-8, 1.0, -30);
    this.addFlowerPatch(-6, 1.0, -36, 6);
    this.addFlowerPatch(6, 1.0, -36, 6);
    this.addPhysicsCrate({ x: -6, y: 2.2, z: -41 });
    this.addPhysicsCrate({ x: 6, y: 2.2, z: -41 });
    this.addEnemy({ x: -4, y: 1.0, z: -35, patrolDist: 5, axis: 'x' });
    this.addEnemy({ x: 4, y: 1.0, z: -39, patrolDist: 5, axis: 'x' });
    this.addCoinRing(0, 1.8, -37, 4.5, 8);

    this.addBearCage({
      id: 'tt_b1',
      name: 'Bramble',
      hint: 'Guarded by Purple Bees in the Flower Plaza',
      x: 0,
      y: 1.0,
      z: -42
    });

    // West Wing: Physics Seesaw + Crate Switch Puzzle for Bear 2 (Clover)
    this.addSeesawBridge({ x: -18, y: 1.2, z: -37, w: 9.0, d: 3.0 });

    this.addPlatform({
      x: -30,
      y: 0.5,
      z: -37,
      w: 15,
      h: 2.5,
      d: 15,
      topColor: 0x52b788,
      sideColor: 0x7f4f24,
      surface: 'grass'
    });
    this.addPhysicsCrate({ x: -27, y: 2.8, z: -34 });
    const cloverCage = this.addBearCage({
      id: 'tt_b2',
      name: 'Clover',
      hint: 'Step on or drop a Crate onto the Meadow Switch',
      x: -33,
      y: 1.75,
      z: -37,
      locked: true
    });

    this.addSwitch({
      x: -26,
      y: 1.75,
      z: -37,
      label: 'Unlock Clover Cage',
      onActivate: () => {
        cloverCage.locked = false;
        cloverCage.barMat.color.setHex(0xadb5bd);
        cloverCage.beaconMat.color.setHex(0x00f5d4);
      }
    });

    // East Wing: Revolving Log Bridge to Bear 4 (Truffle)
    this.addPlatform({
      x: 18,
      y: 1.2,
      z: -37,
      w: 5.8,
      h: 1.2,
      d: 5.8,
      topColor: 0xe9c46a,
      sideColor: 0x7f4f24,
      surface: 'cobble',
      mover: (t) => ({ x: 18, y: 1.2 + Math.sin(t * 2.0) * 1.5, z: -37 })
    });
    this.addPlatform({
      x: 29,
      y: 2.2,
      z: -37,
      w: 13,
      h: 2.5,
      d: 13,
      topColor: 0x52b788,
      sideColor: 0x7f4f24,
      surface: 'grass'
    });
    this.addEnemy({ x: 29, y: 3.45, z: -37, patrolDist: 3.5, axis: 'z' });
    this.addBearCage({
      id: 'tt_b4',
      name: 'Truffle',
      hint: 'Across the Revolving Log Bridge',
      x: 32,
      y: 3.45,
      z: -37
    });

    // North Waterfall Pagoda Ascent to Bear 3 (Maple)
    this.addTrampoline(0, 1.0, -45, 23.5);
    this.addPlatform({
      x: 0,
      y: 7.0,
      z: -56,
      w: 17,
      h: 3,
      d: 17,
      topColor: 0x2a9d8f,
      sideColor: 0x6c757d,
      surface: 'cobble'
    });
    this.addCheckpoint(-5, 8.5, -52);
    this.addCoinRing(0, 9.2, -56, 3.8, 8);
    this.addBearCage({
      id: 'tt_b3',
      name: 'Maple',
      hint: 'High on the Waterfall Pagoda Summit',
      x: 0,
      y: 8.5,
      z: -59
    });
  }

  // =========================================================================
  // LEVEL 3: SNOW VALLEY PEAKS (3 Bears)
  // =========================================================================
  buildSnowValleyLevel(player) {
    this.killY = -16;
    player.setSpawn(0, 1.5, 0, true);

    this.addPortal({ x: 0, y: 0, z: 5.5, targetLevelId: 'hub', color: 0x3a86ff });

    // Base Camp Snow Lodge
    this.addPlatform({
      x: 0,
      y: -1.5,
      z: 0,
      w: 22,
      h: 3,
      d: 22,
      topColor: 0xf8f9fa,
      sideColor: 0x495057,
      surface: 'snow'
    });
    this.addCottage(-7, 0, 2, 0x3a86ff);
    this.addTree(7, 0, -5, 1.15, true);

    this.addWanderingCritter({ x: -5, y: 0, z: -5, petName: 'animal-penguin', patrolDist: 3.5, axis: 'x' });
    this.addWanderingCritter({ x: 5, y: 0.25, z: -18, petName: 'animal-polar', patrolDist: 4.0, axis: 'x' });
    this.addWanderingCritter({ x: -4, y: 8.5, z: -59, petName: 'animal-penguin', patrolDist: 3.0, axis: 'x' });
    this.addPhysicsCrate({ x: 4, y: 1.5, z: -3, kind: 'boulder', size: 1.35 });

    // Slippery Frosted Skating Lake (friction = 0.22)
    this.addPlatform({
      x: 0,
      y: -1.0,
      z: -24,
      w: 24,
      h: 2.5,
      d: 25,
      topColor: 0x90e0ef,
      sideColor: 0x48cae4,
      surface: 'ice',
      friction: 0.22
    });
    this.addCoinRing(0, 1.0, -24, 5.5, 10);
    this.addPhysicsCrate({ x: -5, y: 1.5, z: -24 });
    this.addPhysicsCrate({ x: 5, y: 1.5, z: -24 });
    this.addEnemy({ x: -4, y: 0.25, z: -20, patrolDist: 5, axis: 'x' });
    this.addEnemy({ x: 4, y: 0.25, z: -28, patrolDist: 5, axis: 'x' });

    // Bear 1: Yukon on the ice island
    this.addBearCage({
      id: 'sv_b1',
      name: 'Yukon',
      hint: 'Sliding across the Frosted Skating Lake',
      x: 0,
      y: 0.25,
      z: -32
    });

    // West Ice Cavern Vault (Bear 2: Aurora)
    this.addPlatform({
      x: -18,
      y: 1.0,
      z: -24,
      w: 13,
      h: 2.5,
      d: 13,
      topColor: 0xe0fbfc,
      sideColor: 0x5c677d,
      surface: 'snow'
    });
    const auroraCage = this.addBearCage({
      id: 'sv_b2',
      name: 'Aurora',
      hint: 'Inside the Ice Cavern Switch Vault',
      x: -21,
      y: 2.25,
      z: -24,
      locked: true
    });
    this.addSwitch({
      x: -14.5,
      y: 2.25,
      z: -24,
      label: 'Melt Ice Lock',
      onActivate: () => {
        auroraCage.locked = false;
        auroraCage.barMat.color.setHex(0xadb5bd);
        auroraCage.beaconMat.color.setHex(0x00f5d4);
      }
    });

    // Alpine Gondola Moving Platform to Summit (Bear 3: Kodiak)
    this.addCheckpoint(6, 0.25, -33);
    this.addPlatform({
      x: 0,
      y: 2.5,
      z: -42,
      w: 6.2,
      h: 1.2,
      d: 6.2,
      topColor: 0xe63946,
      sideColor: 0x2b2d42,
      surface: 'cobble',
      mover: (t) => ({
        x: 0,
        y: 2.5 + (Math.sin(t * 1.3) * 0.5 + 0.5) * 4.5,
        z: -42 - (Math.sin(t * 1.3) * 0.5 + 0.5) * 10
      })
    });

    this.addPlatform({
      x: 0,
      y: 7.0,
      z: -61,
      w: 17,
      h: 3,
      d: 17,
      topColor: 0xf8f9fa,
      sideColor: 0x495057,
      surface: 'snow'
    });
    this.addTree(-5, 8.5, -64, 1.0, true);
    this.addTree(5, 8.5, -64, 1.0, true);
    this.addCoinRing(0, 9.2, -61, 4.0, 8);
    this.addBearCage({
      id: 'sv_b3',
      name: 'Kodiak',
      hint: 'At the Alpine Cable Gondola Peak',
      x: 0,
      y: 8.5,
      z: -64
    });
  }

  // =========================================================================
  // LEVEL 4: BEEMOTHEP HIVE & QUEEN BOSS ARENA (2 Bears)
  // =========================================================================
  buildBeemothepLevel(player) {
    this.killY = -16;
    player.setSpawn(0, 1.5, 0, true);

    this.addPortal({ x: 0, y: 0, z: 5.5, targetLevelId: 'hub', color: 0xff9f1c });

    // Golden Courtyard Entry
    this.addPlatform({
      x: 0,
      y: -1.5,
      z: 0,
      w: 22,
      h: 3,
      d: 19,
      topColor: 0xffb703,
      sideColor: 0x99582a,
      surface: 'honey'
    });
    this.addCoinArc(0, 1.4, -5, 0, 2.5, -18, 5, 1.8);

    // Obelisk Plaza (Bear 1: Pharaoh Paws)
    this.addPlatform({
      x: 0,
      y: 0,
      z: -22,
      w: 19,
      h: 3,
      d: 19,
      topColor: 0xf4a261,
      sideColor: 0x7f4f24,
      surface: 'honey'
    });
    this.addTrampoline(-5, 1.5, -22, 21.5);
    this.addPlatform({
      x: -5,
      y: 6.5,
      z: -22,
      w: 5.8,
      h: 1.5,
      d: 5.8,
      topColor: 0xffd166,
      sideColor: 0x99582a,
      surface: 'cobble'
    });
    this.addBearCage({
      id: 'bm_b1',
      name: 'Pharaoh Paws',
      hint: 'Atop the Obelisk of Golden Nectar',
      x: -5,
      y: 7.25,
      z: -22
    });

    this.addCheckpoint(5, 1.5, -28);

    // Royal Sanctum Boss Arena with Throwable Honey Bombs!
    this.addPlatform({
      x: 0,
      y: 0,
      z: -48,
      w: 30,
      h: 3,
      d: 30,
      topColor: 0xe9c46a,
      sideColor: 0x6f4518,
      surface: 'honey'
    });
    this.addCoinRing(0, 2.2, -48, 8.5, 12);
    this.addPhysicsCrate({ x: -8, y: 2.5, z: -40, kind: 'bomb', size: 1.15 });
    this.addPhysicsCrate({ x: 8, y: 2.5, z: -40, kind: 'bomb', size: 1.15 });

    const kingCage = this.addBearCage({
      id: 'bm_b2',
      name: 'King Ursus',
      hint: 'Defeat Queen Beemothep in the Royal Sanctum',
      x: 0,
      y: 1.5,
      z: -57,
      locked: !this.saveManager.isBearRescued('bm_b2')
    });

    this.spawnBoss(0, 2.5, -46, kingCage);
  }

  spawnBoss(x, y, z, rewardCage) {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x5a189a,
      emissive: 0x10002b,
      roughness: 0.3
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffbe0b,
      metalness: 0.65,
      roughness: 0.22
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff006e });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.25, 1.2, 12, 18), bodyMat);
    body.rotation.x = Math.PI / 2;
    body.position.y = 1.45;
    body.castShadow = true;
    g.add(body);

    const stripe1 = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.5, 18), goldMat);
    stripe1.rotation.x = Math.PI / 2;
    stripe1.position.set(0, 1.45, -0.4);
    const stripe2 = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.5, 18), goldMat);
    stripe2.rotation.x = Math.PI / 2;
    stripe2.position.set(0, 1.45, 0.55);
    g.add(stripe1, stripe2);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.7, 0.65, 10), goldMat);
    crown.position.set(0, 2.85, 0.4);
    g.add(crown);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), eyeMat);
    eyeL.position.set(-0.55, 1.75, 1.65);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), eyeMat);
    eyeR.position.set(0.55, 1.75, 1.65);
    g.add(eyeL, eyeR);

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x90e0ef,
      transparent: true,
      opacity: 0.75
    });
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 1.15), wingMat);
    leftWing.position.set(-1.95, 2.35, 0);
    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 1.15), wingMat);
    rightWing.position.set(1.95, 2.35, 0);
    g.add(leftWing, rightWing);

    const ringGeo = new THREE.RingGeometry(0.8, 1.25, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff006e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0
    });
    const shockRing = new THREE.Mesh(ringGeo, ringMat);
    shockRing.position.set(x, 1.6, z);
    this.root.add(shockRing);

    this.root.add(g);
    this.boss = {
      name: 'Queen Beemothep',
      mesh: g,
      bodyMat,
      leftWing,
      rightWing,
      shockRing,
      ringMat,
      centerX: x,
      baseY: y,
      centerZ: z,
      x,
      y,
      z,
      hp: 3,
      maxHp: 3,
      state: 'hover',
      timer: 0,
      shockRadius: 0,
      rewardCage
    };
  }

  updateEnvironment(dt, elapsed) {
    for (const fn of this.animatedProps) {
      fn(dt, elapsed);
    }
    if (this.waterMesh) {
      this.waterMesh.position.y = -2.2 + Math.sin(elapsed * 2.2) * 0.14;
    }
  }
}
