// Missions and the story: five jobs for Marta's crew, each a chain of steps
// (steal, drive to, grab, survive, checkpoints, shootout). A pulsing beacon
// marks the target in the world, on the HUD and on the minimap.
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { makeCar } from './vehicles.js';

export function createMissions(state) {
  const missions = {
    index: state.save?.missionIndex ?? 0,
    stepIndex: 0,
    active: false,
    timer: 0,
    surviveTimer: 0,
    checkpointIndex: 0,
    guardsLeft: 0,
    beacon: null,
    stepTarget: null,
    done: state.save ? [...state.save.completed] : [],
  };

  function makeBeacon() {
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff5a7a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 15;
    state.scene.add(mesh);
    return mesh;
  }

  function moveBeacon(x, z) {
    if (!missions.beacon) missions.beacon = makeBeacon();
    missions.beacon.visible = true;
    missions.beacon.position.set(x, 15, z);
    missions.stepTarget = { x, z };
  }

  function hideBeacon() {
    if (missions.beacon) missions.beacon.visible = false;
    missions.stepTarget = null;
  }

  function current() {
    return MISSIONS[missions.index] || null;
  }

  function currentStep() {
    const m = current();
    return m ? m.steps[missions.stepIndex] : null;
  }

  function objectiveText() {
    const m = current();
    if (!m) return 'All jobs done — Solara Bay is yours. Free roam!';
    if (!missions.active) return `Next job: ${m.name} — walk to the pink beacon to start`;
    const step = currentStep();
    if (!step) return m.name;
    if (step.type === 'checkpoints') {
      return `${step.text} (${missions.checkpointIndex}/4) — ${Math.ceil(missions.timer)}s left`;
    }
    if (step.type === 'survive') {
      return `${step.text} — unseen ${Math.floor(missions.surviveTimer)}s / ${step.seconds}s`;
    }
    if (step.type === 'shootout') {
      return `${step.text} — guards left: ${missions.guardsLeft}`;
    }
    return step.text;
  }

  function startMission() {
    const m = current();
    if (!m) return;
    missions.active = true;
    missions.stepIndex = 0;
    missions.timer = 0;
    missions.surviveTimer = 0;
    missions.checkpointIndex = 0;
    missions.guardsLeft = 0;
    state.hud.showStory(m.name, m.intro);
    state.audio.missionOk();
    enterStep();
  }

  function enterStep() {
    const step = currentStep();
    if (!step) {
      completeMission();
      return;
    }
    if (step.type === 'steal' || step.type === 'goto' || step.type === 'grab') {
      moveBeacon(step.at[0], step.at[1]);
    } else if (step.type === 'survive') {
      moveBeacon(step.at[0], step.at[1]);
      state.wanted.addHeat(3, '有人告密了');
      missions.surviveTimer = 0;
    } else if (step.type === 'checkpoints') {
      missions.timer = step.seconds;
      missions.checkpointIndex = 0;
      moveBeacon(step.points[0][0], step.points[0][1]);
    } else if (step.type === 'shootout') {
      moveBeacon(step.at[0], step.at[1]);
      missions.guardsLeft = 4;
      for (let i = 0; i < 4; i += 1) {
        state.combat.spawnEnemy(
          step.at[0] + state.rng.range(-14, 14),
          step.at[1] + state.rng.range(-14, 14),
          { shirt: 0x3a3f4a, accuracy: 0.32, drop: 150 },
        );
      }
    }
  }

  function nextStep() {
    missions.stepIndex += 1;
    state.audio.pickup();
    enterStep();
  }

  function completeMission() {
    const m = current();
    missions.active = false;
    hideBeacon();
    state.money += m.payout;
    missions.done.push(m.id);
    state.toast(`任务完成：${m.name} — 赚了 $${m.payout}`);
    state.audio.missionOk();
    state.hud.showBanner(`JOB DONE — ${m.name}`, `+$${m.payout}`);
    missions.index += 1;
    if (missions.index >= MISSIONS.length) {
      state.hud.showStory('DEBT PAID', 'All five jobs done. Marta tears up the note. Solara Bay is yours now — go enjoy it.');
    }
    state.saveNow();
  }

  function failMission(reason) {
    const m = current();
    if (!m || !missions.active) return;
    missions.active = false;
    hideBeacon();
    state.wanted.clear();
    state.combat.clear();
    state.toast(`任务失败：${reason} — 回到起点再来`);
    state.audio.missionFail();
    state.hud.showBanner('JOB FAILED', reason);
  }

  function near(x, z, radius) {
    const p = state.playerCar || state.player;
    return Math.hypot(p.x - x, p.z - z) < radius;
  }

  function update(dt) {
    if (missions.beacon && missions.beacon.visible) {
      missions.beacon.rotation.y += dt * 0.8;
      missions.beacon.material.opacity = 0.28 + Math.sin(state.time * 4) * 0.12;
    }
    const m = current();
    if (!m) return;
    // Not started yet: walk or drive into the beacon to begin.
    if (!missions.active) {
      const start = m.steps[0];
      moveBeacon(start.at[0], start.at[1]);
      if (near(start.at[0], start.at[1], start.radius + 2)) startMission();
      return;
    }
    const step = currentStep();
    if (!step) return;
    if (step.type === 'steal') {
      const car = state.lastStolenCar;
      if (car && car.missionCar === m.id && state.time - state.lastStolenAt < 5) nextStep();
    } else if (step.type === 'goto' || step.type === 'grab') {
      if (near(step.at[0], step.at[1], step.radius)) {
        if (step.type === 'grab' && state.playerCar) {
          state.toast('下车去拿包裹');
          return;
        }
        nextStep();
      }
    } else if (step.type === 'survive') {
      if (near(step.at[0], step.at[1], step.radius)) {
        completeMission();
        return;
      }
      if (state.wanted.stars === 0) {
        missions.surviveTimer += dt;
        if (missions.surviveTimer >= step.seconds) completeMission();
      } else {
        missions.surviveTimer = 0;
      }
    } else if (step.type === 'checkpoints') {
      missions.timer -= dt;
      if (missions.timer <= 0) {
        failMission('时间到了');
        return;
      }
      const point = step.points[missions.checkpointIndex];
      if (point && near(point[0], point[1], 9)) {
        missions.checkpointIndex += 1;
        state.audio.cash();
        if (missions.checkpointIndex >= step.points.length) {
          completeMission();
          return;
        }
        const next = step.points[missions.checkpointIndex];
        moveBeacon(next[0], next[1]);
      }
    } else if (step.type === 'shootout') {
      const alive = state.combat.enemies.filter((e) => !e.dead).length;
      missions.guardsLeft = alive;
      if (alive === 0) nextStep();
    }
  }

  // Mission 1 and 5 need a marked car waiting in the world.
  function spawnMissionCar(step, x, z, angle, opts) {
    const car = makeCar(state, x, z, angle, opts);
    car.parked = true;
    return car;
  }

  // Jump straight to a step of the current mission (used by the screenshot scenes).
  function jumpTo(stepIndex) {
    missions.stepIndex = stepIndex;
    missions.active = true;
    missions.timer = 0;
    missions.surviveTimer = 0;
    missions.checkpointIndex = 0;
    missions.guardsLeft = 0;
    enterStep();
  }

  // Return the state object itself, not a spread copy: outside code writes
  // missions.index / stepIndex / active (screenshots jump to a job, resetRun
  // restores a save), and a copy would silently swallow those writes while
  // the closures kept reading the original.
  return Object.assign(missions, {
    current,
    currentStep,
    objectiveText,
    startMission,
    completeMission,
    failMission,
    jumpTo,
    update,
    spawnMissionCar,
  });
}
