// Save and load: money, missions, position and health in localStorage.
// Everything is guarded so a blocked or full store never breaks the game.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      money: Number.isFinite(data.money) ? data.money : 0,
      missionIndex: Number.isInteger(data.missionIndex) ? data.missionIndex : 0,
      completed: Array.isArray(data.completed) ? data.completed : [],
      x: Number.isFinite(data.x) ? data.x : 0,
      z: Number.isFinite(data.z) ? data.z : -20,
      health: Number.isFinite(data.health) ? data.health : 100,
      best: Number.isFinite(data.best) ? data.best : 0,
    };
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money,
      missionIndex: state.missions.index,
      completed: state.missions.done,
      x: state.player.x,
      z: state.player.z,
      health: state.player.health,
      best: state.best,
    }));
  } catch {
    // Storage can be off (private windows): the run then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do when storage is unavailable.
  }
}
