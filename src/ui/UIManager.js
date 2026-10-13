import { LEVELS } from '../levels/LevelRegistry.js';
import { HATS, CAPES } from '../state/SaveManager.js';

const I18N = {
  en: {
    badge: 'N64 SANDBOX 3D PHYSICS PLATFORMER',
    desc: 'Explore vibrant 3D islands, master double-jumps, belly-dives, carry & throw crates, ride seesaws, swim in oceans, and rescue all 10 captive bears!',
    startBtn: '▶ START ADVENTURE',
    worldsBtn: '🗺️ WORLD SELECT',
    outfitterBtn: '👑 Outfitter',
    worldsTitle: '🗺️ Select Kingdom World',
    shopTitle: "👑 Tailor Honey's Royal Outfitter",
    hatsHeader: 'Hats & Helmets',
    capesHeader: 'Capes & Cloaks',
    travelBtn: 'Travel to World',
    equipped: 'Equipped ✓',
    equip: 'Equip',
    buy: 'Buy',
    rescuedSuffix: 'Rescued!'
  }
};

export class UIManager {
  constructor(game) {
    this.game = game;
    this.lang = 'en';
    this.dialogQueue = [];
    this.onDialogComplete = null;
    this.cacheDOM();
    this.bindUIEvents();
    this.applyLanguage();
  }

  t(key) {
    return I18N.en[key] || key;
  }
  cacheDOM() {
    this.titleScreen = document.getElementById('title-screen');
    this.hud = document.getElementById('hud');
    this.healthContainer = document.getElementById('hud-hearts');
    this.coinCountEl = document.getElementById('hud-coins');
    this.bearCountEl = document.getElementById('hud-bears');
    this.levelNameEl = document.getElementById('hud-level-name');
    this.levelSubEl = document.getElementById('hud-level-sub');
    this.timerEl = document.getElementById('hud-timer');
    this.promptEl = document.getElementById('interact-prompt');
    this.bossBar = document.getElementById('boss-hud');
    this.bossFill = document.getElementById('boss-hp-fill');
    this.bossStatus = document.getElementById('boss-status-label');
    this.radarCanvas = document.getElementById('radar-canvas');
    this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;

    // Modals
    this.worldModal = document.getElementById('world-modal');
    this.worldGrid = document.getElementById('world-grid');
    this.shopModal = document.getElementById('shop-modal');
    this.hatsGrid = document.getElementById('shop-hats-grid');
    this.capesGrid = document.getElementById('shop-capes-grid');
    this.pauseModal = document.getElementById('pause-modal');
    this.dialogBox = document.getElementById('dialog-box');
    this.dialogSpeaker = document.getElementById('dialog-speaker');
    this.dialogText = document.getElementById('dialog-text');
    this.rescueBanner = document.getElementById('rescue-banner');
    this.rescueNameEl = document.getElementById('rescue-bear-name');
    this.rescueSubEl = document.getElementById('rescue-bear-sub');
    this.toastEl = document.getElementById('toast-msg');
  }

  applyLanguage() {
    const badgeEl = document.querySelector('.badge-tag');
    const descEl = document.querySelector('.title-desc');
    const playBtn = document.getElementById('btn-play-game');
    const lvlBtn = document.getElementById('btn-title-levels');

    if (badgeEl) badgeEl.textContent = this.t('badge');
    if (descEl) descEl.textContent = this.t('desc');
    if (playBtn) playBtn.textContent = this.t('startBtn');
    if (lvlBtn) lvlBtn.textContent = this.t('worldsBtn');
  }
  bindUIEvents() {
    document.getElementById('btn-play-game')?.addEventListener('click', () => {
      this.game.sound.uiClick();
      this.hideTitleScreen();
      this.game.startOrResume();
    });

    document.getElementById('btn-title-levels')?.addEventListener('click', () => {
      this.game.sound.uiClick();
      this.hideTitleScreen();
      this.game.startOrResume();
      this.openWorldSelect();
    });


    document.getElementById('btn-hud-worlds')?.addEventListener('click', () => {
      this.game.sound.uiClick();
      this.openWorldSelect();
    });

    document.getElementById('btn-hud-wardrobe')?.addEventListener('click', () => {
      this.game.sound.uiClick();
      this.openShopModal();
    });

    document.getElementById('btn-hud-pause')?.addEventListener('click', () => {
      this.game.sound.uiClick();
      this.togglePauseModal();
    });

    document.getElementById('btn-close-worlds')?.addEventListener('click', () => {
      this.game.sound.uiClick();
      this.closeAllModals();
    });

    document.getElementById('btn-close-shop')?.addEventListener('click', () => {
      this.game.sound.uiClick();
      this.closeAllModals();
    });

    document.getElementById('btn-resume')?.addEventListener('click', () => {
      this.game.sound.uiClick();
      this.closeAllModals();
    });

    document.getElementById('btn-respawn')?.addEventListener('click', () => {
      this.game.sound.uiClick();
      this.closeAllModals();
      this.game.player.respawn(true);
    });

    document.getElementById('btn-return-hub')?.addEventListener('click', () => {
      this.game.sound.uiClick();
      this.closeAllModals();
      this.game.switchLevel('hub');
    });

    document.getElementById('btn-toggle-sfx')?.addEventListener('click', (e) => {
      const s = this.game.saveManager;
      s.data.soundEnabled = !s.data.soundEnabled;
      s.save();
      e.currentTarget.textContent = `Sound Effects: ${s.data.soundEnabled ? 'ON' : 'OFF'}`;
    });

    document.getElementById('btn-toggle-music')?.addEventListener('click', (e) => {
      const s = this.game.saveManager;
      s.data.musicEnabled = !s.data.musicEnabled;
      s.save();
      e.currentTarget.textContent = `Music: ${s.data.musicEnabled ? 'ON' : 'OFF'}`;
      if (s.data.musicEnabled) {
        this.game.sound.startMusic(this.game.currentLevelMeta?.theme || 'hub');
      } else {
        this.game.sound.stopMusic();
      }
    });

    document.getElementById('btn-reset-save')?.addEventListener('click', () => {
      this.game.saveManager.reset();
      this.game.player.refreshCosmetics();
      this.game.switchLevel('hub');
      this.closeAllModals();
      this.showToast('Save data reset to fresh adventure!');
    });

    document.getElementById('btn-dialog-next')?.addEventListener('click', () => {
      this.game.sound.uiClick();
      this.advanceDialog();
    });

    this.setupTouchControls();
  }

  setupTouchControls() {
    const stickZone = document.getElementById('touch-joystick-zone');
    const stickKnob = document.getElementById('touch-joystick-knob');
    if (stickZone && stickKnob) {
      let active = false;
      let originX = 0;
      let originY = 0;
      const maxR = 46;

      const updateDialPosition = (clientX, clientY) => {
        let dx = clientX - originX;
        let dy = clientY - originY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxR) {
          dx = (dx / dist) * maxR;
          dy = (dy / dist) * maxR;
        }
        stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.game.input.virtualMove.x = dx / maxR;
        this.game.input.virtualMove.y = dy / maxR;
      };

      stickZone.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        active = true;
        const rect = stickZone.getBoundingClientRect();
        originX = rect.left + rect.width * 0.5;
        originY = rect.top + rect.height * 0.5;
        stickZone.setPointerCapture(e.pointerId);
        updateDialPosition(e.clientX, e.clientY);
      });

      stickZone.addEventListener('pointermove', (e) => {
        if (!active) return;
        updateDialPosition(e.clientX, e.clientY);
      });

      const resetStick = () => {
        active = false;
        stickKnob.style.transform = 'translate(0px, 0px)';
        this.game.input.virtualMove.x = 0;
        this.game.input.virtualMove.y = 0;
      };
      stickZone.addEventListener('pointerup', resetStick);
      stickZone.addEventListener('pointercancel', resetStick);
    }

    // A Button: Jump / Double Jump (replaces Spacebar; holding A gives full jump arc)
    const btnA = document.getElementById('touch-btn-jump');
    if (btnA) {
      btnA.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.game.input.justPressed.add('Space');
        this.game.input.keys.add('Space');
      });
      const releaseA = () => {
        this.game.input.keys.delete('Space');
      };
      btnA.addEventListener('pointerup', releaseA);
      btnA.addEventListener('pointercancel', releaseA);
      btnA.addEventListener('pointerleave', releaseA);
    }

    // B Button: Paw Hit / Attack / Interact (replaces F key; rapid tap strikes repeatedly)
    document.getElementById('touch-btn-attack')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.game.input.triggerAction('KeyF', 120);
    });

    document.getElementById('touch-btn-dive')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.game.input.triggerAction('ShiftLeft', 140);
    });

    document.getElementById('touch-btn-pound')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.game.input.triggerAction('KeyR', 140);
    });
  }

  hideTitleScreen() {
    this.titleScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  updateHUD() {
    const { player, saveManager, currentLevelMeta, levelTime, levelBuilder } = this.game;

    let heartsHtml = '';
    for (let i = 0; i < player.maxHealth; i++) {
      const full = i < player.health;
      heartsHtml += `<span class="heart-pill ${full ? 'full' : 'empty'}">${full ? '♥' : '♡'}</span>`;
    }
    if (this.healthContainer.innerHTML !== heartsHtml) {
      this.healthContainer.innerHTML = heartsHtml;
    }

    this.coinCountEl.textContent = String(saveManager.data.coins);

    const totalBears = LEVELS.reduce((acc, l) => acc + l.bears.length, 0);
    const rescuedTotal = saveManager.getTotalRescued();
    const levelBearsIds = currentLevelMeta ? currentLevelMeta.bears.map((b) => b.id) : [];
    const levelRescued = currentLevelMeta
      ? saveManager.getLevelRescuedCount(currentLevelMeta.id, levelBearsIds)
      : 0;

    this.bearCountEl.textContent = `${levelRescued}/${levelBearsIds.length} (★ ${rescuedTotal}/${totalBears})`;

    if (currentLevelMeta) {
      this.levelNameEl.textContent = currentLevelMeta.name;
      this.levelSubEl.textContent = currentLevelMeta.subtitle;
    }

    const mins = Math.floor(levelTime / 60);
    const secs = (levelTime % 60).toFixed(1).padStart(4, '0');
    this.timerEl.textContent = `${mins}:${secs}`;

    const boss = levelBuilder.boss;
    if (boss && boss.hp > 0) {
      this.bossBar.classList.remove('hidden');
      const pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
      this.bossFill.style.width = `${pct}%`;
      this.bossStatus.textContent =
        boss.state === 'stunned'
          ? 'STUNNED! Throw Honey Bomb [R/F] or Attack Now!'
          : 'Dodge Shockwave & Strike When She Lands!';
    } else {
      this.bossBar.classList.add('hidden');
    }

    this.renderRadar();
  }

  renderRadar() {
    if (!this.radarCtx || !this.radarCanvas) return;
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = 1.9;

    ctx.clearRect(0, 0, w, h);

    // Radar background circle
    ctx.fillStyle = 'rgba(20, 33, 61, 0.78)';
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffb703';
    ctx.stroke();

    const p = this.game.player.pos;
    const lb = this.game.levelBuilder;

    const toRadar = (wx, wz) => {
      const dx = (wx - p.x) * scale;
      const dz = (wz - p.z) * scale;
      const dist = Math.hypot(dx, dz);
      const maxR = cx - 10;
      if (dist > maxR) {
        return { x: cx + (dx / dist) * maxR, y: cy + (dz / dist) * maxR };
      }
      return { x: cx + dx, y: cy + dz };
    };

    // Draw Portals (blue dots)
    for (const portal of lb.portals) {
      const pt = toRadar(portal.x, portal.z);
      ctx.fillStyle = '#00bbf9';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Enemies (purple dots)
    for (const en of lb.enemies) {
      if (!en.alive) continue;
      const pt = toRadar(en.x, en.z);
      ctx.fillStyle = '#ff006e';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Cages (bright gold/green stars)
    for (const cage of lb.cages) {
      const pt = toRadar(cage.x, cage.z);
      ctx.fillStyle = cage.rescued ? '#06d6a0' : '#ffbe0b';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Player center arrow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-this.game.player.facingAngle + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  setPrompt(text) {
    if (!text) {
      this.promptEl.classList.add('hidden');
      return;
    }
    this.promptEl.textContent = text;
    this.promptEl.classList.remove('hidden');
  }

  showRescueBanner(bearName, subtitle) {
    this.rescueNameEl.textContent = `${bearName} ${this.t('rescuedSuffix')}`;
    this.rescueSubEl.textContent = subtitle;
    this.rescueBanner.classList.remove('hidden');
    clearTimeout(this._rescueTimeout);
    this._rescueTimeout = setTimeout(() => {
      this.rescueBanner.classList.add('hidden');
    }, 3400);
  }

  showToast(message) {
    this.toastEl.textContent = message;
    this.toastEl.classList.remove('hidden');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      this.toastEl.classList.add('hidden');
    }, 2600);
  }

  openDialog(speaker, pages, onComplete = null) {
    this.dialogSpeaker.textContent = speaker;
    this.dialogQueue = [...pages];
    this.onDialogComplete = onComplete;
    this.dialogBox.classList.remove('hidden');
    this.game.paused = true;
    this.advanceDialog();
  }

  advanceDialog() {
    if (this.dialogQueue.length === 0) {
      this.dialogBox.classList.add('hidden');
      this.game.paused = false;
      if (this.onDialogComplete) {
        const cb = this.onDialogComplete;
        this.onDialogComplete = null;
        cb();
      }
      return;
    }
    this.dialogText.textContent = this.dialogQueue.shift();
  }

  openWorldSelect() {
    this.closeAllModals();
    this.game.paused = true;
    const totalRescued = this.game.saveManager.getTotalRescued();

    this.worldGrid.innerHTML = '';
    for (const lvl of LEVELS) {
      const unlocked = totalRescued >= lvl.requiredBears;
      const bearBadges = lvl.bears
        .map((b) => {
          const saved = this.game.saveManager.isBearRescued(b.id);
          return `<span class="bear-chip ${saved ? 'saved' : ''}" title="${b.hint}">🐻 ${b.name} ${saved ? '✓' : ''}</span>`;
        })
        .join('');

      const card = document.createElement('div');
      card.className = `world-card ${unlocked ? 'unlocked' : 'locked'}`;
      card.innerHTML = `
        <div class="world-card-header">
          <div>
            <h3>${lvl.name}</h3>
            <p class="world-sub">${lvl.subtitle}</p>
          </div>
          <span class="req-pill">${unlocked ? 'UNLOCKED' : `Needs ${lvl.requiredBears} 🐻`}</span>
        </div>
        <div class="bear-chips-wrap">${bearBadges}</div>
        <button class="tactile-btn ${unlocked ? 'primary' : 'disabled'}" ${unlocked ? '' : 'disabled'}>
          ${unlocked ? this.t('travelBtn') : `Rescue ${lvl.requiredBears - totalRescued} More Bear(s)`}
        </button>
      `;

      if (unlocked) {
        card.querySelector('button').addEventListener('click', () => {
          this.game.sound.uiClick();
          this.closeAllModals();
          this.game.switchLevel(lvl.id);
        });
      }
      this.worldGrid.appendChild(card);
    }

    this.worldModal.classList.remove('hidden');
  }

  openShopModal() {
    this.closeAllModals();
    this.game.paused = true;
    this.renderShopItems();
    this.shopModal.classList.remove('hidden');
  }

  renderShopItems() {
    const s = this.game.saveManager;
    this.hatsGrid.innerHTML = '';
    for (const hat of HATS) {
      const owned = s.data.unlockedHats.includes(hat.id);
      const equipped = s.data.equippedHat === hat.id;
      const item = document.createElement('div');
      item.className = `shop-card ${equipped ? 'equipped' : ''}`;
      item.innerHTML = `
        <h4>${hat.name}</h4>
        <p>${hat.desc}</p>
        <button class="tactile-btn ${equipped ? 'gold' : owned ? 'secondary' : 'primary'}">
          ${equipped ? this.t('equipped') : owned ? this.t('equip') : `${this.t('buy')} (${hat.cost} 🪙)`}
        </button>
      `;
      item.querySelector('button').addEventListener('click', () => {
        const res = s.buyOrEquipHat(hat.id);
        if (!res.ok) {
          this.showToast(res.reason);
        } else {
          this.game.sound.coin();
          this.game.player.refreshCosmetics();
          this.updateHUD();
          this.renderShopItems();
        }
      });
      this.hatsGrid.appendChild(item);
    }

    this.capesGrid.innerHTML = '';
    for (const cape of CAPES) {
      const owned = s.data.unlockedCapes.includes(cape.id);
      const equipped = s.data.equippedCape === cape.id;
      const item = document.createElement('div');
      item.className = `shop-card ${equipped ? 'equipped' : ''}`;
      item.innerHTML = `
        <h4>${cape.name}</h4>
        <p>Royal woven fabric.</p>
        <button class="tactile-btn ${equipped ? 'gold' : owned ? 'secondary' : 'primary'}">
          ${equipped ? this.t('equipped') : owned ? this.t('equip') : `${this.t('buy')} (${cape.cost} 🪙)`}
        </button>
      `;
      item.querySelector('button').addEventListener('click', () => {
        const res = s.buyOrEquipCape(cape.id);
        if (!res.ok) {
          this.showToast(res.reason);
        } else {
          this.game.sound.coin();
          this.game.player.refreshCosmetics();
          this.updateHUD();
          this.renderShopItems();
        }
      });
      this.capesGrid.appendChild(item);
    }
  }

  togglePauseModal() {
    if (!this.pauseModal.classList.contains('hidden')) {
      this.closeAllModals();
      return;
    }
    this.closeAllModals();
    this.game.paused = true;
    this.pauseModal.classList.remove('hidden');
  }

  closeAllModals() {
    this.worldModal.classList.add('hidden');
    this.shopModal.classList.add('hidden');
    this.pauseModal.classList.add('hidden');
    this.dialogBox.classList.add('hidden');
    this.game.paused = false;
  }
}
