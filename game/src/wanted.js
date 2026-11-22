// Solara Bay — wanted level: heat, stars, police pursuit, busts.
import * as THREE from 'three';
import { WANTED } from './config.js';
import { makeCarMesh, Car } from './vehicles.js';
import { Shooter } from './combat.js';
import { makeRng, clamp, dist2d, resolveCircle } from './util.js';

export class Wanted {
  constructor(scene, city, seed) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed ^ 0x2b1c);
    this.heat = 0;
    this.stars = 0;
    this.policeCars = [];
    this.footCops = [];
    this.bustTimer = 0;
    this.sirenOn = false;
  }

  get level() { return this.stars; }

  addHeat(amount) {
    this.heat = clamp(this.heat + amount, 0, 100);
    this._recalc();
  }

  _recalc() {
    let s = 0;
    for (const t of WANTED.thresholds) if (this.heat >= t) s++;
    this.stars = s;
  }

  clear() {
    this.heat = 0;
    this.stars = 0;
    this.bustTimer = 0;
    this._despawnAll();
  }

  _despawnAll() {
    for (const c of this.policeCars) this.scene.remove(c.mesh);
    for (const c of this.footCops) this.scene.remove(c.mesh);
    this.policeCars = [];
    this.footCops = [];
  }

  // Spawn / despawn police to match the star count.
  _matchForce(playerPos) {
    const wantCars = Math.min(this.stars, 4);
    while (this.policeCars.length < wantCars) {
      const p = this.city.roadPointNear(this.rng, playerPos.x, playerPos.z, 70);
      const mesh = makeCarMesh(0x1a1a1a, { police: true });
      this.scene.add(mesh);
      const car = new Car(mesh, p.x, p.z, 0);
      car.isPolice = true;
      car.speed = 12;
      this.policeCars.push(car);
    }
    while (this.policeCars.length > wantCars) {
      const c = this.policeCars.pop();
      this.scene.remove(c.mesh);
    }
    const wantCops = this.stars >= 3 ? this.stars - 2 : 0;
    while (this.footCops.length < wantCops) {
      const p = this.city.roadPointNear(this.rng, playerPos.x, playerPos.z, 40);
      this.footCops.push(new Shooter(this.scene, p.x, p.z, 'cop'));
    }
    while (this.footCops.length > wantCops) {
      const c = this.footCops.pop();
      this.scene.remove(c.mesh);
    }
  }

  // Returns events for the world to handle: {rammed, shotPlayer, busted}.
  update(dt, ctx) {
    const player = ctx.player;
    const p = player.inCar ? player.inCar.pos : player.pos;
    // Heat decays when no police can see the player.
    const anyNear = this.policeCars.some((c) => dist2d(c.pos.x, c.pos.z, p.x, p.z) < 45)
      || this.footCops.some((c) => c.alive && dist2d(c.pos.x, c.pos.z, p.x, p.z) < 35);
    if (!anyNear && this.stars > 0) {
      this.heat = Math.max(0, this.heat - WANTED.decayPerSec * dt);
      this._recalc();
    }
    this._matchForce(p);
    this.sirenOn = this.stars > 0;
    const events = { rammed: false, shotPlayer: false, busted: false };

    // Police cars chase and ram.
    for (const car of this.policeCars) {
      const dx = p.x - car.pos.x;
      const dz = p.z - car.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let dh = ((wantHeading - car.heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      car.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
      const targetSpeed = d < 3.0 ? 0 : d > 60 ? 30 : 24;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      // Police cars must not drive through buildings either.
      const cp = { x: car.pos.x, z: car.pos.z };
      resolveCircle(cp, 2.3, ctx.city.colliders);
      car.pos.x = cp.x; car.pos.z = cp.z;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
      // Ram: close contact hurts the player / car.
      if (d < 4.2) {
        events.rammed = true;
        // Shove the player's car / player away a little (not in shot mode:
        // the staged chase photo must not shove the player out of frame).
        if (!ctx.shot) {
          const push = 3.5;
          if (player.inCar) {
            player.inCar.pos.x += (dx / d) * push * dt * 3;
            player.inCar.pos.z += (dz / d) * push * dt * 3;
          } else {
            player.pos.x += (dx / d) * push * dt * 2;
            player.pos.z += (dz / d) * push * dt * 2;
          }
        }
      }
    }

    // Foot cops chase and shoot.
    for (const cop of this.footCops) {
      if (!cop.alive) continue;
      const fired = cop.update(dt, p, ctx);
      if (fired) {
        const hit = ctx.combat.fireEnemy(cop.pos, p, 0.45);
        if (hit) events.shotPlayer = true;
      }
    }

    // Bust: a police car sits on a slow on-foot player for a while.
    if (!player.inCar && this.stars > 0) {
      const near = this.policeCars.some((c) => dist2d(c.pos.x, c.pos.z, p.x, p.z) < WANTED.bustDist);
      if (near) {
        this.bustTimer += dt;
        if (this.bustTimer >= WANTED.bustTime) {
          this.bustTimer = 0;
          events.busted = true;
        }
      } else {
        this.bustTimer = 0;
      }
    } else {
      this.bustTimer = 0;
    }
    return events;
  }
}
