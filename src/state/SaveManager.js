const STORAGE_KEY = 'super_baaren_save_v1';

export const HATS = [
  { id: 'none', name: 'Natural Ears', cost: 0, desc: 'Classic Baaren fluff.' },
  { id: 'crown', name: 'Golden Crown', cost: 25, desc: 'Royal Bear Kingdom heirloom.' },
  { id: 'propeller', name: 'Propeller Cap', cost: 40, desc: 'Spins fast when you jump!' },
  { id: 'viking', name: 'Frost Helmet', cost: 65, desc: 'Forged in Snow Valley.' },
  { id: 'fez', name: 'Desert Fez', cost: 90, desc: 'Treasure hunter attire.' },
  { id: 'astronaut', name: 'Star Visor', cost: 130, desc: 'For cosmic leaps.' }
];

export const CAPES = [
  { id: 'none', name: 'Red Bandana', cost: 0, color: 0xe63946 },
  { id: 'royal', name: 'Royal Velvet Cape', cost: 35, color: 0xd90429 },
  { id: 'emerald', name: 'Meadow Cloak', cost: 55, color: 0x2a9d8f },
  { id: 'gold', name: 'Sunburst Cape', cost: 100, color: 0xffb703 }
];

export const DEFAULT_SAVE = {
  coins: 0,
  rescuedBears: {},
  bestTimes: {},
  unlockedHats: ['none'],
  unlockedCapes: ['none'],
  equippedHat: 'none',
  equippedCape: 'none',
  soundEnabled: true,
  musicEnabled: true,
  cameraSensitivity: 1.0
};

export class SaveManager {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_SAVE),
        ...parsed,
        rescuedBears: { ...(parsed.rescuedBears || {}) },
        bestTimes: { ...(parsed.bestTimes || {}) }
      };
    } catch {
      return structuredClone(DEFAULT_SAVE);
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage quota errors in restricted environments
    }
  }

  reset() {
    this.data = structuredClone(DEFAULT_SAVE);
    this.save();
    return this.data;
  }

  addCoins(amount = 1) {
    this.data.coins = Math.max(0, (this.data.coins || 0) + amount);
    this.save();
    return this.data.coins;
  }

  rescueBear(bearId) {
    const isNew = !this.data.rescuedBears[bearId];
    this.data.rescuedBears[bearId] = true;
    if (isNew) {
      this.data.coins += 10;
    }
    this.save();
    return isNew;
  }

  isBearRescued(bearId) {
    return Boolean(this.data.rescuedBears[bearId]);
  }

  getTotalRescued() {
    return Object.keys(this.data.rescuedBears).filter((k) => this.data.rescuedBears[k]).length;
  }

  getLevelRescuedCount(levelId, bearIds) {
    return bearIds.filter((id) => this.isBearRescued(id)).length;
  }

  recordLevelTime(levelId, seconds) {
    const prev = this.data.bestTimes[levelId];
    if (typeof prev !== 'number' || seconds < prev) {
      this.data.bestTimes[levelId] = Number(seconds.toFixed(2));
      this.save();
      return true;
    }
    return false;
  }

  buyOrEquipHat(hatId) {
    const hat = HATS.find((h) => h.id === hatId);
    if (!hat) return { ok: false, reason: 'Unknown hat' };
    if (this.data.unlockedHats.includes(hatId)) {
      this.data.equippedHat = hatId;
      this.save();
      return { ok: true, action: 'equipped' };
    }
    if (this.data.coins < hat.cost) {
      return { ok: false, reason: 'Not enough Honey Coins' };
    }
    this.data.coins -= hat.cost;
    this.data.unlockedHats.push(hatId);
    this.data.equippedHat = hatId;
    this.save();
    return { ok: true, action: 'purchased' };
  }

  buyOrEquipCape(capeId) {
    const cape = CAPES.find((c) => c.id === capeId);
    if (!cape) return { ok: false, reason: 'Unknown cape' };
    if (this.data.unlockedCapes.includes(capeId)) {
      this.data.equippedCape = capeId;
      this.save();
      return { ok: true, action: 'equipped' };
    }
    if (this.data.coins < cape.cost) {
      return { ok: false, reason: 'Not enough Honey Coins' };
    }
    this.data.coins -= cape.cost;
    this.data.unlockedCapes.push(capeId);
    this.data.equippedCape = capeId;
    this.save();
    return { ok: true, action: 'purchased' };
  }
}
