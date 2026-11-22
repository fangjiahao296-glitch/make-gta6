// The HUD: cash, health, wanted stars, speed, mission objective, toasts, the
// story card, and a live top-down minimap drawn on a 2D canvas.
import { CITY, WANTED_MAX } from './config.js';

export function createHud(state) {
  const $ = (id) => document.getElementById(id);
  const el = {
    cash: $('cash'),
    health: $('health-fill'),
    healthText: $('health-text'),
    stars: $('stars'),
    speed: $('speed'),
    objective: $('objective'),
    minimap: $('minimap'),
    toasts: $('toasts'),
    banner: $('banner'),
    bannerTitle: $('banner-title'),
    bannerSub: $('banner-sub'),
    story: $('story'),
    storyTitle: $('story-title'),
    storyText: $('story-text'),
    crosshair: $('crosshair'),
    damage: $('damage'),
    hint: $('hint'),
  };
  const mapCtx = el.minimap.getContext('2d');
  let bannerTimer = null;
  let storyTimer = null;
  let toastCount = 0;

  function toast(message) {
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = message;
    el.toasts.appendChild(div);
    toastCount += 1;
    while (toastCount > 4) {
      el.toasts.firstChild?.remove();
      toastCount -= 1;
    }
    window.setTimeout(() => {
      div.classList.add('fade');
      window.setTimeout(() => div.remove(), 600);
      toastCount -= 1;
    }, 3600);
  }

  function showBanner(title, sub) {
    el.bannerTitle.textContent = title;
    el.bannerSub.textContent = sub || '';
    el.banner.classList.add('show');
    if (bannerTimer) window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => el.banner.classList.remove('show'), 3200);
  }

  function showStory(title, text) {
    el.storyTitle.textContent = title;
    el.storyText.textContent = text;
    el.story.classList.add('show');
    if (storyTimer) window.clearTimeout(storyTimer);
    storyTimer = window.setTimeout(() => el.story.classList.remove('show'), 6000);
  }

  function hideStory() {
    el.story.classList.remove('show');
  }

  function flashDamage() {
    el.damage.classList.remove('hit');
    void el.damage.offsetWidth;
    el.damage.classList.add('hit');
  }

  // Top-down map: roads, blocks, beach, player, cars, police, cash and the beacon.
  function drawMinimap() {
    const size = 190;
    const scale = size / (CITY.ground + 60);
    const toMap = (v) => (v + (CITY.ground + 60) / 2) * scale;
    mapCtx.clearRect(0, 0, size, size);
    mapCtx.fillStyle = 'rgba(20, 26, 34, 0.85)';
    mapCtx.fillRect(0, 0, size, size);
    mapCtx.fillStyle = '#e3c98f';
    mapCtx.fillRect(0, toMap(250), size, size - toMap(250));
    mapCtx.fillStyle = '#1e7fa8';
    mapCtx.fillRect(0, toMap(288), size, size - toMap(288));
    mapCtx.fillStyle = '#4a5058';
    for (let k = -4; k <= 4; k += 1) {
      const c = toMap(k * CITY.pitch);
      mapCtx.fillRect(0, c - 2, size, 4);
      mapCtx.fillRect(c - 2, 0, 4, size);
    }
    mapCtx.fillStyle = '#3aa655';
    for (const spot of state.cashPickups) {
      if (!spot.taken) mapCtx.fillRect(toMap(spot.x) - 2, toMap(spot.z) - 2, 4, 4);
    }
    const target = state.missions.stepTarget;
    if (target) {
      const pulse = 5 + Math.sin(state.time * 5) * 2;
      mapCtx.fillStyle = '#ff5a7a';
      mapCtx.beginPath();
      mapCtx.arc(toMap(target.x), toMap(target.z), pulse, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#ffffff';
      mapCtx.lineWidth = 1.5;
      mapCtx.stroke();
    }
    mapCtx.fillStyle = '#e8b93a';
    for (const car of state.traffic) {
      if (!car.dead) mapCtx.fillRect(toMap(car.x) - 1.5, toMap(car.z) - 1.5, 3, 3);
    }
    for (const car of state.wanted.policeCars) {
      mapCtx.fillStyle = Math.floor(state.time * 4) % 2 === 0 ? '#ff3333' : '#3388ff';
      mapCtx.beginPath();
      mapCtx.arc(toMap(car.x), toMap(car.z), 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    const p = state.playerCar || state.player;
    const angle = state.playerCar ? state.playerCar.angle : state.player.camYaw + Math.PI;
    mapCtx.save();
    mapCtx.translate(toMap(p.x), toMap(p.z));
    mapCtx.rotate(angle);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
    mapCtx.strokeStyle = 'rgba(255,255,255,0.5)';
    mapCtx.lineWidth = 2;
    mapCtx.strokeRect(1, 1, size - 2, size - 2);
  }

  function update() {
    el.cash.textContent = `$${state.money.toLocaleString('en-US')}`;
    const hp = Math.max(0, Math.round(state.player.health));
    el.health.style.width = `${hp}%`;
    el.healthText.textContent = `${hp}`;
    el.health.style.background = hp > 50 ? '#3aa655' : hp > 25 ? '#e8b93a' : '#c23b2e';
    let stars = '';
    for (let i = 0; i < WANTED_MAX; i += 1) stars += i < state.wanted.stars ? '★' : '☆';
    el.stars.textContent = stars;
    el.stars.style.color = state.wanted.stars > 0 ? '#ffcf3a' : 'rgba(255,255,255,0.4)';
    const car = state.playerCar;
    el.speed.textContent = car ? `${Math.round(Math.abs(car.speed) * 3.6)} km/h` : '';
    el.objective.textContent = state.missions.objectiveText();
    el.crosshair.style.display = !car && state.screen === 'play' ? 'block' : 'none';
    el.hint.textContent = car
      ? 'WASD 开车 · Space 手刹 · E 下车 · H 喇叭 · P 暂停'
      : 'WASD 走路 · Shift 跑 · Space 跳 · E 上车/偷车 · 左键开枪 · P 暂停';
    drawMinimap();
  }

  return { toast, showBanner, showStory, hideStory, flashDamage, update };
}
