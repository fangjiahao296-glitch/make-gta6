// Solara Bay — localStorage autosave.
import { SAVE_KEY } from './config.js';

export class SaveGame {
  constructor(ctx) {
    this.ctx = ctx;
  }

  save() {
    try {
      const p = this.ctx.player;
      const data = {
        version: 1,
        cash: p.cash,
        missionIndex: this.ctx.missions.index,
        missionsDone: this.ctx.missions.done,
        health: p.health,
        pos: { x: p.pos.x, z: p.pos.z },
        savedAt: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data.cash !== 'number') return null;
      if (data.version !== 1) return null; // saves from another build do not load
      return data;
    } catch (e) {
      return null;
    }
  }

  hasSave() {
    return this.load() !== null;
  }

  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  apply(data) {
    const p = this.ctx.player;
    p.cash = data.cash || 0;
    p.health = data.health || 100;
    if (data.pos) p.pos.set(data.pos.x, 0, data.pos.z);
    p.mesh.position.copy(p.pos);
    this.ctx.missions.index = data.missionIndex || 0;
    this.ctx.missions.done = data.missionsDone || 0;
    if (this.ctx.missions.index < 5) {
      this.ctx.missions.phase = 'active';
      this.ctx.missions._setup(this.ctx.missions.index);
    } else {
      this.ctx.missions.phase = 'done-all';
      this.ctx.missions.objective = 'Debt paid off. Solara Bay is yours — free roam.';
    }
  }
}
