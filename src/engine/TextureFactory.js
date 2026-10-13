import * as THREE from 'three';

function makeCanvasTexture(drawFn, size = 256, repeatX = 4, repeatY = 4) {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class TextureFactory {
  static cache = new Map();

  static getGrass(variant = 'meadow', repeatX = 4, repeatY = 4) {
    const key = `grass_${variant}_${repeatX}_${repeatY}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const palette = {
      meadow: ['#40b56a', '#349e5a', '#52cc7d', '#2b864b'],
      hub: ['#48bf72', '#39a55f', '#60d68a', '#2e8b4e']
    }[variant] || ['#40b56a', '#349e5a', '#52cc7d', '#2b864b'];

    const tex = makeCanvasTexture((ctx, s) => {
      ctx.fillStyle = palette[0];
      ctx.fillRect(0, 0, s, s);

      // Soft checkerboard undertone (classic 3D platformer style)
      ctx.fillStyle = palette[1];
      ctx.fillRect(0, 0, s / 2, s / 2);
      ctx.fillRect(s / 2, s / 2, s / 2, s / 2);

      // Grass blades & clover tufts
      for (let i = 0; i < 240; i++) {
        const x = (i * 73) % s;
        const y = (i * 139) % s;
        ctx.fillStyle = i % 3 === 0 ? palette[2] : palette[3];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 3, y - 9);
        ctx.lineTo(x + 6, y);
        ctx.fill();
      }
    }, 256, repeatX, repeatY);

    this.cache.set(key, tex);
    return tex;
  }

  static getDirtCliff(repeatX = 4, repeatY = 2) {
    const key = `dirt_${repeatX}_${repeatY}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const tex = makeCanvasTexture((ctx, s) => {
      ctx.fillStyle = '#8b5328';
      ctx.fillRect(0, 0, s, s);

      // Horizontal strata bands
      ctx.fillStyle = '#75421c';
      for (let y = 0; y < s; y += 32) {
        ctx.fillRect(0, y, s, 14);
      }

      // Embedded pebbles
      for (let i = 0; i < 90; i++) {
        const x = (i * 97) % s;
        const y = (i * 53) % s;
        ctx.fillStyle = i % 2 === 0 ? '#a46738' : '#5e3313';
        ctx.beginPath();
        ctx.arc(x, y, 5 + (i % 5), 0, Math.PI * 2);
        ctx.fill();
      }
    }, 256, repeatX, repeatY);

    this.cache.set(key, tex);
    return tex;
  }

  static getCobble(repeatX = 4, repeatY = 4) {
    const key = `cobble_${repeatX}_${repeatY}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const tex = makeCanvasTexture((ctx, s) => {
      ctx.fillStyle = '#8d99ae';
      ctx.fillRect(0, 0, s, s);
      const rows = 4;
      const cols = 4;
      const bw = s / cols;
      const bh = s / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const offset = (r % 2) * (bw * 0.5);
          const x = (c * bw + offset) % s;
          const y = r * bh;
          ctx.fillStyle = (r + c) % 2 === 0 ? '#adb5bd' : '#9aa6b8';
          ctx.strokeStyle = '#5c677d';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.roundRect(x + 4, y + 4, bw - 8, bh - 8, 10);
          ctx.fill();
          ctx.stroke();
        }
      }
    }, 256, repeatX, repeatY);

    this.cache.set(key, tex);
    return tex;
  }

  static getWoodCrate() {
    const key = 'wood_crate';
    if (this.cache.has(key)) return this.cache.get(key);

    const tex = makeCanvasTexture((ctx, s) => {
      ctx.fillStyle = '#d48c46';
      ctx.fillRect(0, 0, s, s);

      // Planks
      ctx.strokeStyle = '#7f4512';
      ctx.lineWidth = 6;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (s / 4) * i);
        ctx.lineTo(s, (s / 4) * i);
        ctx.stroke();
      }

      // Outer frame + diagonal brace
      ctx.strokeStyle = '#9c5619';
      ctx.lineWidth = 22;
      ctx.strokeRect(11, 11, s - 22, s - 22);
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.lineTo(s - 16, s - 16);
      ctx.stroke();

      // Corner rivets
      ctx.fillStyle = '#4a2c11';
      [[24, 24], [s - 24, 24], [24, s - 24], [s - 24, s - 24]].forEach(([rx, ry]) => {
        ctx.beginPath();
        ctx.arc(rx, ry, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }, 256, 1, 1);

    this.cache.set(key, tex);
    return tex;
  }

  static getIce(repeatX = 3, repeatY = 3) {
    const key = `ice_${repeatX}_${repeatY}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const tex = makeCanvasTexture((ctx, s) => {
      const grad = ctx.createLinearGradient(0, 0, s, s);
      grad.addColorStop(0, '#90e0ef');
      grad.addColorStop(0.5, '#caf0f8');
      grad.addColorStop(1, '#48cae4');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s, s);

      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo((i * 45) % s, 0);
        ctx.lineTo(s, (i * 65) % s);
        ctx.stroke();
      }
    }, 256, repeatX, repeatY);

    this.cache.set(key, tex);
    return tex;
  }

  static getSnow(repeatX = 4, repeatY = 4) {
    const key = `snow_${repeatX}_${repeatY}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const tex = makeCanvasTexture((ctx, s) => {
      ctx.fillStyle = '#f1f8ff';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#dbeafe';
        ctx.beginPath();
        ctx.arc((i * 83) % s, (i * 113) % s, 4 + (i % 5), 0, Math.PI * 2);
        ctx.fill();
      }
    }, 256, repeatX, repeatY);

    this.cache.set(key, tex);
    return tex;
  }

  static getHoneycomb(repeatX = 4, repeatY = 4) {
    const key = `honey_${repeatX}_${repeatY}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const tex = makeCanvasTexture((ctx, s) => {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 5;
      const r = 28;
      for (let y = 0; y < s + r; y += r * 1.5) {
        for (let x = 0; x < s + r; x += r * 1.732) {
          const ox = (Math.round(y / (r * 1.5)) % 2) * (r * 0.866);
          ctx.beginPath();
          for (let side = 0; side < 6; side++) {
            const a = (side * Math.PI) / 3 + Math.PI / 6;
            const px = x + ox + Math.cos(a) * (r - 3);
            const py = y + Math.sin(a) * (r - 3);
            if (side === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
    }, 256, repeatX, repeatY);

    this.cache.set(key, tex);
    return tex;
  }
}
