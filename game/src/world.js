// The world: everything wired together. Builds the city, the player, traffic,
// pedestrians, police, missions and the HUD, and advances one fixed step at a
// time. main.js owns the screens; this owns the simulation.
import * as THREE from 'three';
import { CAR, CASH_SPOTS, CITY, HOSPITAL, MISSIONS, SAFEHOUSE, STEP } from './config.js';
import { createRandom } from './random.js';
import { createRenderer } from './render.js';
import { buildCity } from './city.js';
import { createPlayer, updateCamera, updatePlayerOnFoot } from './player.js';
import { createTraffic, drivePlayerCar, makeCar, trafficStep, collideCircle } from './vehicles.js';
import { createPedestrians, knockPedDown, pedestriansStep } from './pedestrians.js';
import { createCombat } from './combat.js';
import { createWanted } from './wanted.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { loadSave, saveGame } from './save.js';
import {
  ACTION_ENTER, ACTION_HORN, ACTION_JUMP, ACTION_MUTE, ACTION_PAUSE, ACTION_SHOOT,
} from './input.js';

export function createWorld(canvas, input, audio, seed, saved) {
  const rng = createRandom(seed);
  const render = createRenderer(canvas);
  const scene = render.scene;
  const camera = render.camera;

  const state = {
    scene,
    camera,
    rng,
    input,
    audio,
    time: 0,
    screen: 'title',
    money: saved?.money ?? 0,
    best: saved?.best ?? 0,
    save: saved,
    playerCar: null,
    player: null,
    traffic: [],
    peds: [],
    parkedCars: [],
    cashPickups: [],
    shake: 0,
    lastStolenAt: -10,
    lastStolenCar: null,
    lastDamageAt: -10,
    fireTimer: 0,
    regenTimer: 0,
    titleAngle: 0,
  };

  const city = buildCity(scene, rng);
  state.city = city;
  state.player = createPlayer(state, SAFEHOUSE.x, SAFEHOUSE.z);
  if (saved) {
    state.player.x = saved.x;
    state.player.z = saved.z;
    state.player.health = saved.health;
    state.player.mesh.position.set(saved.x, 0, saved.z);
  }
  state.combat = createCombat(state);
  state.wanted = createWanted(state);
  state.policeCars = state.wanted.policeCars;
  state.missions = createMissions(state);
  state.hud = createHud(state);

  function toast(message) {
    state.hud.toast(message);
  }
  state.toast = toast;

  function saveNow() {
    state.best = Math.max(state.best, state.money);
    saveGame(state);
  }
  state.saveNow = saveNow;

  function addCash(amount, x, z) {
    const mesh = makeCashMesh();
    mesh.position.set(x, 0.9, z);
    scene.add(mesh);
    state.cashPickups.push({ x, z, amount, taken: false, mesh, respawn: 0, temp: true });
  }
  state.addCash = addCash;

  function makeCashMesh() {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55),
      new THREE.MeshLambertMaterial({ color: 0xf2c94c, emissive: 0xa8821a }),
    );
    mesh.castShadow = true;
    return mesh;
  }

  function spawnCashPickups() {
    for (const pickup of state.cashPickups) scene.remove(pickup.mesh);
    state.cashPickups = [];
    for (const [x, z] of CASH_SPOTS) {
      const mesh = makeCashMesh();
      mesh.position.set(x, 0.9, z);
      scene.add(mesh);
      state.cashPickups.push({ x, z, amount: 50, taken: false, mesh, respawn: 0, temp: false });
    }
  }

  function spawnParkedCars() {
    for (const car of state.parkedCars) scene.remove(car.mesh);
    state.parkedCars = [];
    // The mission sedan for job 1, parked by the plaza.
    const sedan = makeCar(state, 40, 30, 0.6, { color: 0xc23b2e, name: 'Brisa' });
    sedan.parked = true;
    sedan.noHeat = true;
    sedan.missionCar = 1;
    state.parkedCars.push(sedan);
    // The armored van for job 5, waiting at the harbor.
    const van = makeCar(state, 215, 215, -0.8, { color: 0x8a8f96, name: 'Tortuga', van: true });
    van.parked = true;
    van.noHeat = true;
    van.missionCar = 5;
    state.parkedCars.push(van);
    // Ordinary parked cars along the roads.
    const spots = [[-58, 90], [90, -116], [-116, -30], [58, 174], [-174, -116], [174, 90], [30, -174], [-30, 116]];
    for (const [x, z] of spots) {
      const car = makeCar(state, x, z, rng.range(0, Math.PI * 2), {});
      car.parked = true;
      state.parkedCars.push(car);
    }
  }

  function spawnDynamics() {
    for (const car of state.traffic) scene.remove(car.mesh);
    for (const ped of state.peds) scene.remove(ped.mesh);
    state.traffic = createTraffic(state, 14);
    state.peds = createPedestrians(state, 22);
    spawnParkedCars();
    spawnCashPickups();
  }

  function damagePlayer(amount) {
    if (state.screen !== 'play') return;
    if (state.time - state.lastDamageAt < 0.25) return;
    state.lastDamageAt = state.time;
    state.regenTimer = 0;
    state.player.health -= amount;
    state.hud.flashDamage();
    state.shake = Math.max(state.shake, 0.45);
    if (state.player.health <= 0) {
      state.player.health = 0;
      wasted();
    }
  }
  state.damagePlayer = damagePlayer;

  function endRun(kind) {
    if (state.screen !== 'play') return;
    state.screen = kind;
    state.wanted.clear();
    state.combat.clear();
    audio.engine(0);
    audio.siren(false);
    audio.skid(false);
    if (state.playerCar) {
      state.playerCar.speed = 0;
      state.parkedCars.push(state.playerCar);
      state.playerCar.parked = true;
      state.playerCar = null;
    }
    const fine = Math.min(state.money, 200);
    state.money -= fine;
    state.player.mesh.visible = true;
    input.releasePointer();
    saveNow();
  }

  function busted() {
    endRun('busted');
    toast('被捕了 — 罚款 $200，在医院醒来');
  }
  state.busted = busted;

  function wasted() {
    endRun('wasted');
    toast('你倒下了 — 在医院醒来，丢了 $200');
  }
  state.wasted = wasted;

  function respawn() {
    state.player.x = HOSPITAL.x;
    state.player.z = HOSPITAL.z;
    state.player.y = 0;
    state.player.vy = 0;
    state.player.health = 100;
    state.player.mesh.position.set(HOSPITAL.x, 0, HOSPITAL.z);
    state.player.mesh.visible = true;
    state.screen = 'play';
    saveNow();
  }
  state.respawn = respawn;

  function tryEnterCar() {
    if (state.playerCar) {
      exitCar();
      return;
    }
    let best = null;
    let bestD = 3.8;
    for (const car of [...state.parkedCars, ...state.traffic]) {
      if (car.dead || car.police) continue;
      const d = Math.hypot(car.x - state.player.x, car.z - state.player.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (!best) {
      toast('附近没有车');
      return;
    }
    const ti = state.traffic.indexOf(best);
    if (ti >= 0) state.traffic.splice(ti, 1);
    const pi = state.parkedCars.indexOf(best);
    if (pi >= 0) state.parkedCars.splice(pi, 1);
    state.playerCar = best;
    state.player.mesh.visible = false;
    state.lastStolenAt = state.time;
    state.lastStolenCar = best;
    if (!best.owned && !best.noHeat) {
      state.wanted.addHeat(1, '偷车被看见了');
    }
    best.owned = true;
    best.parked = false;
    audio.steal();
    toast(`上了${best.name} — 小心开`);
  }

  function exitCar() {
    const car = state.playerCar;
    if (!car) return;
    car.speed = 0;
    const sideX = Math.cos(car.angle);
    const sideZ = -Math.sin(car.angle);
    const hit = collideCircle(car.x + sideX * 2.4, car.z + sideZ * 2.4, 0.6, city.colliders);
    state.player.x = hit.x;
    state.player.z = hit.z;
    state.player.y = 0;
    state.player.mesh.visible = true;
    state.player.mesh.position.set(state.player.x, 0, state.player.z);
    state.player.camYaw = car.angle + Math.PI;
    state.parkedCars.push(car);
    car.parked = true;
    state.playerCar = null;
    audio.engine(0);
    audio.skid(false);
  }

  // Put the player in a car directly (used by the screenshot scenes).
  function putPlayerInCar(car, silent) {
    const ti = state.traffic.indexOf(car);
    if (ti >= 0) state.traffic.splice(ti, 1);
    const pi = state.parkedCars.indexOf(car);
    if (pi >= 0) state.parkedCars.splice(pi, 1);
    state.playerCar = car;
    state.player.mesh.visible = false;
    state.lastStolenAt = state.time;
    state.lastStolenCar = car;
    car.owned = true;
    car.parked = false;
  }
  state.putPlayerInCar = putPlayerInCar;

  function renderOnce() {
    render.followSun(state.player.x, state.player.z);
    render.render();
  }

  function collectCash() {
    const p = state.playerCar || state.player;
    const radius = state.playerCar ? 3.2 : 2.4;
    for (const spot of state.cashPickups) {
      if (spot.taken) continue;
      if (Math.hypot(p.x - spot.x, p.z - spot.z) < radius) {
        spot.taken = true;
        spot.mesh.visible = false;
        state.money += spot.amount;
        audio.cash();
        toast(`+$${spot.amount}`);
      }
    }
  }

  function resetRun(fresh) {
    state.combat.clear();
    state.wanted.clear();
    spawnDynamics();
    // Re-read the save fresh: a run that ended earlier this session may have
    // written a newer save than the one the world was created with.
    const current = loadSave();
    state.money = fresh ? 0 : (current?.money ?? 0);
    state.missions.index = fresh ? 0 : (current?.missionIndex ?? 0);
    state.missions.done = fresh ? [] : [...(current?.completed ?? [])];
    state.missions.active = false;
    state.missions.stepIndex = 0;
    state.player.x = fresh ? SAFEHOUSE.x : (current?.x ?? SAFEHOUSE.x);
    state.player.z = fresh ? SAFEHOUSE.z : (current?.z ?? SAFEHOUSE.z);
    state.player.y = 0;
    state.player.health = fresh ? 100 : (current?.health ?? 100);
    state.player.mesh.visible = true;
    state.player.mesh.position.set(state.player.x, 0, state.player.z);
    state.player.camYaw = 0;
    state.playerCar = null;
    state.time = 0;
    state.lastStolenAt = -10;
    state.lastStolenCar = null;
    state.shake = 0;
    saveNow();
  }
  state.resetRun = resetRun;

  function updateTitle(dt) {
    for (const car of state.traffic) trafficStep(car, dt, city, rng, state.traffic);
    pedestriansStep(state.peds, dt, state);
    city.update(dt);
    state.titleAngle += dt * 0.045;
    const r = 175;
    camera.position.set(
      Math.sin(state.titleAngle) * r,
      62,
      Math.cos(state.titleAngle) * r,
    );
    camera.lookAt(0, 8, 40);
    render.followSun(0, 0);
  }

  // Advance the world one fixed step. `paint` renders the frame; screenshot
  // scenes pass false so they can simulate hundreds of steps without paying
  // for a software render on each one, then paint once at the end.
  function update(dt, actionsIn, lookIn, paint = true) {
    state.time += dt;
    if (state.driver && state.driver.step) state.driver.step(dt, state);
    const actions = state.driver ? (state.driver.actions || 0) : actionsIn;
    const look = state.driver ? (state.driver.look || { dx: 0, dy: 0 }) : lookIn;
    const move = state.driver ? (state.driver.move || { x: 0, y: 0, run: false }) : input.move();
    if (state.screen === 'title') {
      updateTitle(dt);
      if (paint) render.render();
      return;
    }
    if (state.screen !== 'play') {
      city.update(dt);
      if (paint) render.render();
      return;
    }
    const jump = state.driver ? !!state.driver.jump : !!(actions & ACTION_JUMP);
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (actions & ACTION_HORN) audio.horn();
    if (actions & ACTION_ENTER) tryEnterCar();

    // Shooting: hold the mouse to keep firing, on foot only.
    state.fireTimer -= dt;
    if (!state.playerCar && (actions & ACTION_SHOOT || input.isMouseDown()) && state.fireTimer <= 0) {
      state.fireTimer = 0.14;
      audio.shot();
      const result = state.combat.playerShoot(camera);
      const from = new THREE.Vector3(state.player.x, 1.45, state.player.z);
      state.combat.spawnTracer(from, result.end);
      state.combat.muzzleFlash(from);
      if (result.killed) {
        if (result.killed.cop) state.wanted.addHeat(1, '袭警');
        state.toast(`干掉了 — 掉了 $${result.killed.drop}`);
      }
    }

    if (state.playerCar) {
      const handbrake = input.isJumpHeld();
      const hitBuilding = drivePlayerCar(state.playerCar, move, dt, state, handbrake);
      if (hitBuilding) state.shake = Math.max(state.shake, 0.3);
      audio.engine(Math.abs(state.playerCar.speed) / CAR.maxSpeed);
      audio.skid(handbrake && Math.abs(state.playerCar.speed) > 6);
      // Running over a pedestrian is a crime.
      for (const ped of state.peds) {
        if (ped.down > 0) continue;
        if (Math.hypot(ped.x - state.playerCar.x, ped.z - state.playerCar.z) < 2.3) {
          if (knockPedDown(ped)) {
            state.wanted.addHeat(1, '撞到行人了');
            audio.thud();
            state.shake = Math.max(state.shake, 0.5);
          }
        }
      }
    } else {
      updatePlayerOnFoot(state.player, move, look, jump, dt, state);
      audio.engine(0);
      audio.skid(false);
      // A traffic car can hit the player on foot.
      for (const car of state.traffic) {
        if (Math.hypot(car.x - state.player.x, car.z - state.player.z) < 1.9) {
          damagePlayer(10);
          state.player.x += (state.player.x - car.x) * 0.4;
          state.player.z += (state.player.z - car.z) * 0.4;
        }
      }
    }

    for (const car of state.traffic) trafficStep(car, dt, city, rng, state.traffic);
    pedestriansStep(state.peds, dt, state);
    state.wanted.update(dt, state.player, state.playerCar);
    state.missions.update(dt);
    state.combat.enemiesStep(dt, state.player);
    city.update(dt);

    // Cash pickups spin, bob and respawn.
    for (const spot of state.cashPickups) {
      if (spot.taken) {
        spot.respawn += dt;
        if (spot.respawn > 60 && !spot.temp) {
          spot.taken = false;
          spot.respawn = 0;
          spot.mesh.visible = true;
        }
        continue;
      }
      spot.mesh.rotation.y += dt * 2;
      spot.mesh.position.y = 0.9 + Math.sin(state.time * 3 + spot.x) * 0.15;
    }
    collectCash();

    // Slow health regen out of trouble.
    state.regenTimer += dt;
    if (state.regenTimer > 5 && state.player.health < 100 && state.wanted.stars === 0) {
      state.player.health = Math.min(100, state.player.health + 3 * dt);
    }

    state.shake = Math.max(0, state.shake - dt * 1.4);
    updateCamera(camera, state.player, state.playerCar, dt, look);
    if (state.shake > 0) {
      camera.position.x += (rng.next() - 0.5) * state.shake * 0.7;
      camera.position.y += (rng.next() - 0.5) * state.shake * 0.5;
      camera.position.z += (rng.next() - 0.5) * state.shake * 0.7;
    }
    state.hud.update();
    render.followSun(state.player.x, state.player.z);
    if (paint) render.render();
  }

  spawnDynamics();
  return { state, update, resetRun, renderOnce };
}

export { loadSave };
