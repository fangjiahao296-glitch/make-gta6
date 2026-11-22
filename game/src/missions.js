// Solara Bay — five story missions for Marta's crew, in order.
import * as THREE from 'three';
import { MISSIONS, WORLD } from './config.js';
import { makeCarMesh, Car } from './vehicles.js';
import { Shooter } from './combat.js';
import { dist2d } from './util.js';

function makeBeacon(scene) {
  const geo = new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff4fa3, transparent: true, opacity: 0.35,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 30;
  mesh.visible = false;
  scene.add(mesh);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xff4fa3, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  ring.visible = false;
  scene.add(ring);
  return { mesh, ring, mat };
}

export class Missions {
  constructor(scene, ctx) {
    this.scene = scene;
    this.ctx = ctx;
    this.index = 0;          // current mission
    this.done = 0;           // completed count
    this.phase = 'idle';     // idle | active | waiting | done-all
    this.beacon = makeBeacon(scene);
    this.target = null;      // {x, z, label}
    this.holdTimer = 0;
    this.missionTimer = 0;
    this._warned30 = false;
    this.checkpoints = [];
    this.checkIndex = 0;
    this.guards = [];
    this.van = null;
    this.vanTaken = false;
    this._warned30 = false;
    this.objective = 'Free roam — open the start menu to begin the story.';
  }

  get current() { return MISSIONS[this.index]; }
  get finished() { return this.index >= MISSIONS.length; }

  startStory() {
    if (this.finished) return;
    this.phase = 'active';
    this._setup(this.index);
  }

  _setup(i) {
    const ctx = this.ctx;
    this.holdTimer = 0;
    this.missionTimer = 0;
    this._warned30 = false;
    this.checkpoints = [];
    this.checkIndex = 0;
    const m = MISSIONS[i];
    if (i === 0) {
      // Steal the red sedan on Coral Row.
      const car = ctx.traffic.parked.find((c) => c.isMissionCar) || ctx.traffic.parked[0];
      this.target = { x: car.pos.x, z: car.pos.z, label: 'Steal the red sedan', car };
      this.objective = 'Steal the red sedan parked on Coral Row (press E next to it).';
    } else if (i === 1) {
      this.target = { x: 182, z: 170, label: 'Port pickup' };
      this.objective = 'Drive to the port beacon and hold position for the handoff.';
    } else if (i === 2) {
      this.checkpoints = [
        { x: -156, z: -156 }, { x: 156, z: -104 }, { x: 104, z: 156 },
      ];
      this.target = { ...this.checkpoints[0], label: 'Checkpoint 1/3' };
      this.objective = 'Burn through checkpoint 1 of 3 — the cops are already on you.';
      ctx.wanted.addHeat(34);
    } else if (i === 3) {
      this.target = { x: -182, z: -182, label: 'Hideout' };
      this.missionTimer = 90;
      this.objective = 'Reach the north-west hideout within 90 seconds. Lose the heat if you can.';
      ctx.wanted.addHeat(20);
    } else if (i === 4) {
      this.target = { x: 182, z: 182, label: 'Harbor heist' };
      this.objective = 'Clear the four guards at the port, then take the armored van.';
      this._spawnGuards();
      this._spawnVan();
    }
    this._placeBeacon();
    ctx.hud.showStory(m.title, m.brief);
    ctx.audio.missionDone();
  }

  _spawnGuards() {
    const spots = [[168, 168], [196, 172], [172, 196], [192, 192]];
    for (const [x, z] of spots) {
      const g = new Shooter(this.scene, x, z, 'guard');
      this.guards.push(g);
      this.ctx.combat.registerTarget(g.mesh, g);
    }
  }

  _spawnVan() {
    const mesh = makeCarMesh(0x3a3a3a);
    // Armored look: a box on top.
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.9, 3.6),
      new THREE.MeshLambertMaterial({ color: 0x4a4a4a }),
    );
    box.position.y = 1.35;
    mesh.add(box);
    this.scene.add(mesh);
    // Parked on the port's south edge, clear of the container field, facing
    // the player approaching from the city.
    this.van = new Car(mesh, 182, 164, Math.PI);
    this.van.isVan = true;
  }

  _placeBeacon() {
    if (!this.target) return;
    this.beacon.mesh.position.set(this.target.x, 30, this.target.z);
    this.beacon.ring.position.set(this.target.x, 0.15, this.target.z);
    this.beacon.mesh.visible = true;
    this.beacon.ring.visible = true;
  }

  _hideBeacon() {
    this.beacon.mesh.visible = false;
    this.beacon.ring.visible = false;
  }

  _complete() {
    const ctx = this.ctx;
    const m = this.current;
    ctx.player.cash += m.payout;
    this.done++;
    this.index++;
    this._hideBeacon();
    ctx.hud.showStory('Job done', `${m.title} complete — $${m.payout.toLocaleString()} paid. Cash: $${ctx.player.cash.toLocaleString()}.`);
    ctx.audio.missionDone();
    ctx.save.save();
    if (this.finished) {
      this.phase = 'done-all';
      this.objective = "Debt paid off. Solara Bay is yours — free roam.";
      ctx.hud.showStory('Debt paid off', 'All five jobs done. Leo Marin is free, and the Bay is yours.');
    } else {
      this.phase = 'active';
      this._setup(this.index);
    }
  }

  update(dt, ctx) {
    // Pulse the beacon.
    if (this.beacon.mesh.visible) {
      const t = ctx.time * 2.4;
      this.beacon.mat.opacity = 0.22 + 0.16 * Math.sin(t);
      const s = 1 + 0.12 * Math.sin(t);
      this.beacon.ring.scale.set(s, s, 1);
    }
    if (this.phase !== 'active' || this.finished) return;
    const p = ctx.player.inCar ? ctx.player.inCar.pos : ctx.player.pos;

    if (this.index === 0) {
      // Complete when the player is driving the mission car.
      if (ctx.player.inCar && ctx.player.inCar.isMissionCar) this._complete();
    } else if (this.index === 1) {
      if (dist2d(p.x, p.z, this.target.x, this.target.z) < 7) {
        this.holdTimer += dt;
        const left = Math.max(0, 3 - this.holdTimer);
        this.objective = `Handoff in progress… hold position (${left.toFixed(1)}s).`;
        if (this.holdTimer >= 3) this._complete();
      } else {
        this.holdTimer = 0;
        this.objective = 'Drive to the port beacon and hold position for the handoff.';
      }
    } else if (this.index === 2) {
      const cp = this.checkpoints[this.checkIndex];
      if (cp && dist2d(p.x, p.z, cp.x, cp.z) < 8) {
        this.checkIndex++;
        ctx.audio.pickup();
        if (this.checkIndex >= this.checkpoints.length) {
          this._complete();
        } else {
          const next = this.checkpoints[this.checkIndex];
          this.target = { ...next, label: `Checkpoint ${this.checkIndex + 1}/3` };
          this.objective = `Burn through checkpoint ${this.checkIndex + 1} of 3.`;
          this._placeBeacon();
        }
      }
    } else if (this.index === 3) {
      this.missionTimer -= dt;
      const left = Math.max(0, this.missionTimer);
      this.objective = `Reach the hideout — ${left.toFixed(0)}s left.`;
      if (left <= 30 && !this._warned30) {
        this._warned30 = true;
        ctx.hud.showStory('Hurry', '30 seconds left — the hideout is on the north-west corner.');
      }
      if (dist2d(p.x, p.z, this.target.x, this.target.z) < 8) {
        this._complete();
      } else if (this.missionTimer <= 0) {
        // Failed the timer: restart this mission, keep the story going.
        ctx.hud.showStory('Too slow', 'The window closed. Marta gives you another shot — head to the hideout.');
        this._setup(3);
      }
    } else if (this.index === 4) {
      const alive = this.guards.filter((g) => g.alive).length;
      if (!this.vanTaken) {
        this.objective = `Clear the guards at the port (${4 - alive}/4 down), then take the van.`;
        if (alive === 0) {
          this.vanTaken = true;
          this.target = { x: -182, z: -182, label: 'Drop point' };
          this.objective = 'Guards down. Take the armored van to the drop point.';
          this._placeBeacon();
        }
      } else if (ctx.player.inCar && ctx.player.inCar.isVan) {
        if (dist2d(p.x, p.z, this.target.x, this.target.z) < 9) this._complete();
      } else {
        this.objective = 'Take the armored van to the drop point.';
      }
    }
  }
}
