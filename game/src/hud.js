// Solara Bay — HUD: cash, health, stars, speed, objective, story cards, minimap.
import { WORLD } from './config.js';

export class HUD {
  constructor() {
    this.el = {
      cash: document.getElementById('hud-cash'),
      health: document.getElementById('hud-health-fill'),
      stars: document.getElementById('hud-stars'),
      speed: document.getElementById('hud-speed'),
      speedVal: document.getElementById('hud-speed-val'),
      objective: document.getElementById('hud-objective'),
      story: document.getElementById('story-card'),
      storyTitle: document.getElementById('story-title'),
      storyText: document.getElementById('story-text'),
      crosshair: document.getElementById('crosshair'),
      damage: document.getElementById('damage-flash'),
      minimap: document.getElementById('minimap'),
    };
    this.mapCtx = this.el.minimap ? this.el.minimap.getContext('2d') : null;
    this._storyTimer = null;
    this._damageTimer = null;
  }

  showStory(title, text, ms = 5200) {
    if (!this.el.story) return;
    this.el.storyTitle.textContent = title;
    this.el.storyText.textContent = text;
    this.el.story.classList.add('show');
    clearTimeout(this._storyTimer);
    this._storyTimer = setTimeout(() => this.el.story.classList.remove('show'), ms);
  }

  flashDamage() {
    if (!this.el.damage) return;
    this.el.damage.classList.add('show');
    clearTimeout(this._damageTimer);
    this._damageTimer = setTimeout(() => this.el.damage.classList.remove('show'), 220);
  }

  update(ctx) {
    const p = ctx.player;
    if (this.el.cash) this.el.cash.textContent = '$' + p.cash.toLocaleString();
    if (this.el.health) this.el.health.style.width = Math.max(0, p.health) + '%';
    if (this.el.stars) {
      const s = ctx.wanted.stars;
      this.el.stars.textContent = '★'.repeat(s) + '☆'.repeat(5 - s);
      this.el.stars.style.color = s >= 3 ? '#ff5040' : '#ffd23c';
    }
    if (this.el.speed) {
      if (p.inCar) {
        this.el.speed.style.display = 'block';
        this.el.speedVal.textContent = Math.round(Math.abs(p.inCar.speed) * 3.6);
      } else {
        this.el.speed.style.display = 'none';
      }
    }
    if (this.el.objective) this.el.objective.textContent = ctx.missions.objective;
    if (this.el.crosshair) this.el.crosshair.style.display = p.inCar ? 'none' : 'block';
    this._drawMinimap(ctx);
  }

  _drawMinimap(ctx) {
    const c = this.mapCtx;
    if (!c) return;
    const S = 180;
    const scale = S / (WORLD.half * 2 + 60);
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    c.fillStyle = '#0e2a1a';
    c.fillRect(0, 0, S, S);
    // Ocean + sand (south edge).
    c.fillStyle = '#2b6ea6';
    c.fillRect(0, S - 14, S, 14);
    c.fillStyle = '#dcc98f';
    c.fillRect(0, S - 20, S, 6);
    // Roads.
    c.strokeStyle = '#555';
    c.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const rc = WORLD.roadCenter(i);
      const [x1, y1] = toMap(-214, rc);
      const [x2, y2] = toMap(214, rc);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      const [x3, y3] = toMap(rc, -214);
      const [x4, y4] = toMap(rc, 214);
      c.beginPath(); c.moveTo(x3, y3); c.lineTo(x4, y4); c.stroke();
    }
    // Port block.
    c.fillStyle = '#8d8d88';
    const [px, py] = toMap(162, 162);
    c.fillRect(px, py, 40 * scale, 40 * scale);
    // Beacon / mission target.
    if (ctx.missions.target && ctx.missions.phase === 'active') {
      const [bx, by] = toMap(ctx.missions.target.x, ctx.missions.target.z);
      c.fillStyle = '#ff4fa3';
      c.beginPath(); c.arc(bx, by, 5 + 2 * Math.sin(ctx.time * 5), 0, Math.PI * 2); c.fill();
    }
    // Traffic (white), police (blue), guards (red).
    const dot = (x, z, color, r = 2) => {
      const [dx, dy] = toMap(x, z);
      c.fillStyle = color;
      c.beginPath(); c.arc(dx, dy, r, 0, Math.PI * 2); c.fill();
    };
    for (const car of ctx.traffic.cars) dot(car.pos.x, car.pos.z, '#ffffff', 1.6);
    for (const car of ctx.wanted.policeCars) dot(car.pos.x, car.pos.z, '#4f8cff', 2.4);
    for (const g of ctx.missions.guards) if (g.alive) dot(g.pos.x, g.pos.z, '#ff5040', 2.2);
    // Player arrow.
    const pp = ctx.player.inCar ? ctx.player.inCar.pos : ctx.player.pos;
    const [ax, ay] = toMap(pp.x, pp.z);
    const heading = ctx.player.inCar ? ctx.player.inCar.heading : ctx.player.heading;
    c.save();
    c.translate(ax, ay);
    // Map: x right, y down (= +z). Arrow drawn pointing up; rotate it to the
    // heading's angle from north, clockwise.
    c.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)));
    c.fillStyle = '#ffd23c';
    c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath(); c.fill();
    c.restore();
  }
}
