// Solara Bay — cars: mesh factory, traffic AI, parked cars, police, driving.
import * as THREE from 'three';
import { WORLD, PALETTE, CAR } from './config.js';
import { makeRng, clamp, dampAngle, dist2d } from './util.js';

// Build a simple stylized car: body, cabin, wheels, lights. Returns a Group.
export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: PALETTE.glass });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x555533 });
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), headMat);
    h.position.set(hx, 0.62, 2.21);
    g.add(h);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xd21f2b, emissive: 0x330000 });
  for (const hx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), tailMat);
    t.position.set(hx, 0.62, -2.21);
    g.add(t);
  }
  if (opts.police) {
    const barMat = new THREE.MeshLambertMaterial({ color: 0x2233aa, emissive: 0x112266 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), barMat);
    bar.position.set(0, 1.5, -0.2);
    g.add(bar);
    g.userData.lightBar = bar;
  }
  g.userData.wheels = wheels;
  g.userData.bodyMat = bodyMat;
  return g;
}

export class Car {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading; // radians, 0 = facing -z (north)
    this.speed = 0;
    this.steer = 0;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  // Arcade update for a player-driven car. input: {fwd, back, left, right, handbrake}
  drive(dt, input, colliders) {
    const f = this.forward();
    if (input.fwd) this.speed += CAR.accel * dt;
    if (input.back) {
      if (this.speed > 0.5) this.speed -= CAR.brake * dt;
      else this.speed -= CAR.accel * 0.6 * dt;
    }
    if (!input.fwd && !input.back) this.speed -= Math.sign(this.speed) * 6 * dt;
    if (Math.abs(this.speed) < 0.05 && !input.fwd && !input.back) this.speed = 0;
    const max = input.handbrake ? CAR.maxSpeed * 0.75 : CAR.maxSpeed;
    this.speed = clamp(this.speed, -CAR.maxReverse, max);
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const grip = input.handbrake ? 0.35 : 1;
    const steerRate = CAR.steer * (input.handbrake ? 1.7 : 1) * clamp(Math.abs(this.speed) / 8, 0.25, 1);
    this.steer += (steerTarget * steerRate - this.steer) * Math.min(1, 8 * dt);
    this.heading += this.steer * (this.speed / 7) * grip * dt * (this.speed >= 0 ? 1 : -1);
    // Capture the pre-move position BEFORE moving: the wall-hit check below
    // compares how far the car actually travelled against how far it tried to.
    const before = { x: this.pos.x, z: this.pos.z };
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    // Collide with the city.
    const p = { x: this.pos.x, z: this.pos.z };
    this._resolve(p, colliders);
    const moved = dist2d(p.x, p.z, before.x, before.z);
    const tried = Math.abs(this.speed) * dt;
    if (tried > 0.01 && moved < tried * 0.25) this.speed *= 0.35; // hit a wall
    this.pos.x = p.x; this.pos.z = p.z;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    // Wheel spin + front steer visuals.
    const wheels = this.mesh.userData.wheels || [];
    wheels.forEach((w, i) => {
      w.rotation.x += this.speed * dt * 1.2;
      if (i < 2) w.rotation.y = this.steer * 0.4;
    });
    return { speed: this.speed, heading: this.heading };
  }

  _resolve(p, colliders) {
    // Inline circle-vs-AABB (kept here so Car stays self-contained).
    const r = CAR.radius;
    for (const b of colliders) {
      const cx = clamp(p.x, b.minX, b.maxX);
      const cz = clamp(p.z, b.minZ, b.maxZ);
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.z = cz + (dz / d) * r;
        } else {
          const pl = p.x - b.minX + r, pr = b.maxX - p.x + r;
          const pt = p.z - b.minZ + r, pb = b.maxZ - p.z + r;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) p.x = b.minX - r;
          else if (m === pr) p.x = b.maxX + r;
          else if (m === pt) p.z = b.minZ - r;
          else p.z = b.maxZ + r;
        }
      }
    }
  }
}

export class Traffic {
  constructor(scene, city, seed) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed ^ 0x5f3a);
    this.cars = [];
    this.parked = [];
    this._spawn();
  }

  _spawn() {
    const rng = this.rng;
    // Moving traffic on the roads.
    for (let k = 0; k < 10; k++) {
      const p = this.city.roadPointNear(rng, 0, 0, 200);
      // Road centers sit at -208 + i*52. If p.z is a road center, the car is on
      // an east-west road and travels along x (heading +-PI/2); else along z.
      const ri = Math.round((p.z + 208) / 52);
      const onEastWest = Math.abs(p.z - (-208 + ri * 52)) < 1;
      const heading = onEastWest
        ? (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
        : (rng.next() < 0.5 ? 0 : Math.PI);
      const mesh = makeCarMesh(rng.pick(PALETTE.car));
      this.scene.add(mesh);
      const car = new Car(mesh, p.x, p.z, heading);
      car.speed = CAR.trafficSpeed * rng.range(0.8, 1.2);
      car.isTraffic = true;
      car.nextTurn = 0;
      this.cars.push(car);
    }
    // Parked cars along roads + one red sedan for the first mission.
    const spots = [
      { x: -52, z: -98, h: Math.PI / 2, red: true },
      { x: 52, z: 104, h: -Math.PI / 2 },
      { x: -104, z: 58, h: 0 },
      { x: 104, z: -58, h: Math.PI },
      { x: 0, z: -150, h: Math.PI / 2 },
      { x: 156, z: 52, h: 0 },
    ];
    for (const s of spots) {
      const color = s.red ? 0xc23b2e : rng.pick(PALETTE.car);
      const mesh = makeCarMesh(color);
      this.scene.add(mesh);
      const car = new Car(mesh, s.x, s.z, s.h);
      car.isParked = true;
      car.isMissionCar = !!s.red;
      this.parked.push(car);
    }
  }

  // Drive traffic along the road grid; turn at intersections.
  update(dt, colliders) {
    for (const car of this.cars) {
      car.nextTurn -= dt;
      const f = car.forward();
      car.pos.x += f.x * car.speed * dt;
      car.pos.z += f.z * car.speed * dt;
      // Near an intersection? Pick a new heading.
      const nx = Math.round((car.pos.x + 208) / 52) * 52 - 208;
      const nz = Math.round((car.pos.z + 208) / 52) * 52 - 208;
      const nearX = Math.abs(car.pos.x - nx) < 1.2;
      const nearZ = Math.abs(car.pos.z - nz) < 1.2;
      if (car.nextTurn <= 0 && nearX && nearZ && Math.abs(car.pos.x) < 210 && Math.abs(car.pos.z) < 210) {
        const r = this.rng.next();
        const turn = r < 0.55 ? 0 : r < 0.78 ? Math.PI / 2 : -Math.PI / 2;
        car.heading += turn;
        car.nextTurn = 2.5;
      }
      // Keep inside the city; U-turn at the edge.
      if (Math.abs(car.pos.x) > 212 || Math.abs(car.pos.z) > 212) {
        car.heading += Math.PI;
        car.pos.x = clamp(car.pos.x, -210, 210);
        car.pos.z = clamp(car.pos.z, -210, 210);
      }
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
      const wheels = car.mesh.userData.wheels || [];
      wheels.forEach((w) => { w.rotation.x += car.speed * dt * 1.2; });
    }
  }

  nearestStealable(x, z, maxDist = 4.5) {
    let best = null;
    let bestD = maxDist;
    for (const car of [...this.parked, ...this.cars]) {
      const d = dist2d(x, z, car.pos.x, car.pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  removeParked(car) {
    const i = this.parked.indexOf(car);
    if (i >= 0) this.parked.splice(i, 1);
  }
}
