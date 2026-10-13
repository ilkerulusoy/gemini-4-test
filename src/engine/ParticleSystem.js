import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.shockRings = [];
    this.sharedGeo = new THREE.DodecahedronGeometry(0.18, 0);
    this.starGeo = new THREE.OctahedronGeometry(0.24, 0);
    this.streakGeo = new THREE.BoxGeometry(0.08, 0.08, 0.65);
    this.ringGeo = new THREE.RingGeometry(0.45, 0.85, 28);
    this.ringGeo.rotateX(-Math.PI / 2);
  }

  emit({
    x,
    y,
    z,
    count = 10,
    color = 0xffffff,
    speed = 5,
    upward = 3,
    scale = 1,
    life = 0.65,
    gravity = 12
  }) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(this.sharedGeo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(scale * (0.65 + Math.random() * 0.7));
      this.scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const mag = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * mag,
        vy: upward * (0.5 + Math.random() * 0.9),
        vz: Math.sin(angle) * mag,
        gravity,
        age: 0,
        maxLife: life * (0.75 + Math.random() * 0.4),
        initialScale: mesh.scale.x
      });
    }
  }

  emitHitBurst({ x, y, z, color = 0xffbe0b, secondaryColor = 0xff006e, intensity = 1.0 }) {
    // 1. Expanding ground/air shockwave ring
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92
    });
    const ringMesh = new THREE.Mesh(this.ringGeo, ringMat);
    ringMesh.position.set(x, y, z);
    ringMesh.scale.setScalar(0.35);
    this.scene.add(ringMesh);
    this.shockRings.push({
      mesh: ringMesh,
      age: 0,
      maxLife: 0.32,
      expandSpeed: 12 * intensity
    });

    // 2. High-velocity radial spark streaks
    const streakCount = Math.round(12 * intensity);
    for (let i = 0; i < streakCount; i++) {
      const a = (i / streakCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const elev = (Math.random() - 0.2) * 0.8;
      const spd = (8 + Math.random() * 7) * intensity;
      const vx = Math.cos(a) * Math.cos(elev) * spd;
      const vy = Math.sin(elev) * spd + 2.5;
      const vz = Math.sin(a) * Math.cos(elev) * spd;

      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? color : secondaryColor,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(this.streakGeo, mat);
      mesh.position.set(x, y, z);
      mesh.lookAt(x + vx, y + vy, z + vz);
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vx,
        vy,
        vz,
        gravity: 8,
        age: 0,
        maxLife: 0.28 + Math.random() * 0.14,
        initialScale: 1.15 * intensity,
        isStreak: true
      });
    }

    // 3. Glowing star chunks
    const starCount = Math.round(8 * intensity);
    for (let i = 0; i < starCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (4 + Math.random() * 5) * intensity;
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: color,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(this.starGeo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(1.1 * intensity);
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vx: Math.cos(a) * spd,
        vy: (4 + Math.random() * 5) * intensity,
        vz: Math.sin(a) * spd,
        gravity: 16,
        age: 0,
        maxLife: 0.45,
        initialScale: 1.1 * intensity
      });
    }
  }

  emitRing({ x, y, z, count = 16, color = 0xffd166, radiusSpeed = 7.5, life = 0.45 }) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(this.sharedGeo, mat);
      mesh.position.set(x, y + 0.15, z);
      mesh.scale.setScalar(1.1);
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vx: Math.cos(angle) * radiusSpeed,
        vy: 0.8,
        vz: Math.sin(angle) * radiusSpeed,
        gravity: 2,
        age: 0,
        maxLife: life,
        initialScale: 1.1
      });
    }
  }

  update(dt) {
    for (let i = this.shockRings.length - 1; i >= 0; i--) {
      const r = this.shockRings[i];
      r.age += dt;
      if (r.age >= r.maxLife) {
        this.scene.remove(r.mesh);
        r.mesh.material.dispose();
        this.shockRings.splice(i, 1);
        continue;
      }
      const s = r.mesh.scale.x + r.expandSpeed * dt;
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = Math.max(0, 1 - r.age / r.maxLife);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (!p.isStreak) {
        p.mesh.rotation.x += 7 * dt;
        p.mesh.rotation.y += 9 * dt;
      }

      const t = 1 - p.age / p.maxLife;
      p.mesh.scale.setScalar(Math.max(0.01, p.initialScale * t));
      p.mesh.material.opacity = t;
    }
  }

  clear() {
    for (const r of this.shockRings) {
      this.scene.remove(r.mesh);
      r.mesh.material.dispose();
    }
    this.shockRings = [];

    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.material.dispose();
    }
    this.particles = [];
  }
}
