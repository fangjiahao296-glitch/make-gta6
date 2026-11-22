// Cars: a box-built car factory, arcade driving physics, traffic that follows
// the road grid, and police cars that chase the player when wanted.
import * as THREE from 'three';
import { CAR, CAR_COLORS, CAR_NAMES, CITY, POLICE_CHASE_SPEED } from './config.js';

// A car is a group of boxes: body, cabin, wheels, lights. Cheap, readable, fast.
export function createCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc8e8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.75, CAR.length), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.35, 0.65, CAR.length * 0.48), glassMat);
  cabin.position.set(0, 1.2, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffdf8a });
  const headlightGeo = new THREE.BoxGeometry(0.35, 0.18, 0.1);
  for (const wx of [-0.65, 0.65]) {
    const light = new THREE.Mesh(headlightGeo, lightMat);
    light.position.set(wx, 0.62, CAR.length / 2 + 0.02);
    group.add(light);
  }
  if (isPolice) {
    const barMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.5), barMat);
    bar.position.set(0, 1.62, -0.25);
    group.add(bar);
    const redMat = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff2222 });
    const blueMat = new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x2244ff });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.45), redMat);
    red.position.set(-0.28, 1.72, -0.25);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.45), blueMat);
    blue.position.set(0.28, 1.72, -0.25);
    group.add(red);
    group.add(blue);
    group.userData.flash = { red, blue, timer: 0 };
  }
  group.userData.wheels = wheels;
  return group;
}

export function makeCar(state, x, z, angle, opts = {}) {
  const color = opts.color ?? CAR_COLORS[state.rng.int(0, CAR_COLORS.length - 1)];
  const mesh = createCarMesh(color, !!opts.police);
  mesh.userData.isEnemyRoot = true;
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  state.scene.add(mesh);
  const car = {
    mesh,
    x, z,
    angle,
    speed: 0,
    steer: 0,
    name: opts.name ?? CAR_NAMES[state.rng.int(0, CAR_NAMES.length - 1)],
    police: !!opts.police,
    van: !!opts.van,
    parked: !!opts.parked,
    target: null, // traffic car: { x, z } waypoint
    routeAxis: 'x',
    routeDir: 1,
    routeLine: 0,
    flash: mesh.userData.flash || null,
    dead: false,
  };
  if (car.van) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(CAR.width - 0.2, 1.1, CAR.length * 0.55),
      new THREE.MeshLambertMaterial({ color: 0x8a8f96 }),
    );
    box.position.set(0, 1.35, -0.7);
    box.castShadow = true;
    mesh.add(box);
  }
  return car;
}

// --- Traffic: cars that cruise the road grid, turning at intersections. ---

function pickRoute(car, city, rng) {
  const lines = city.roadLines;
  const vertical = rng.chance(0.5);
  const line = rng.pick(lines);
  const dir = rng.chance(0.5) ? 1 : -1;
  const lane = CITY.lane * (vertical ? dir : -dir);
  car.routeAxis = vertical ? 'z' : 'x';
  car.routeDir = dir;
  car.routeLine = line;
  if (vertical) {
    car.z = -232 * dir;
    car.x = line + lane;
  } else {
    car.x = -232 * dir;
    car.z = line + lane;
  }
  car.angle = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  car.target = null;
  car.speed = rng.range(6, 10);
}

export function createTraffic(state, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const car = makeCar(state, 0, 0, 0, {});
    pickRoute(car, state.city, state.rng);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    cars.push(car);
  }
  return cars;
}

function trafficStep(car, dt, city, rng, others) {
  const forward = { x: Math.sin(car.angle), z: Math.cos(car.angle) };
  // Slow down for a car ahead on the same lane.
  let targetSpeed = car.speed;
  for (const other of others) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const along = dx * forward.x + dz * forward.z;
    const side = Math.abs(dx * forward.z - dz * forward.x);
    if (along > 0 && along < 9 && side < 2.2) {
      targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed - 1));
      break;
    }
  }
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
  car.x += forward.x * car.speed * dt;
  car.z += forward.z * car.speed * dt;
  // At an intersection, turn or go straight; at the city edge, pick a new route.
  const onRoadX = Math.abs(car.x - Math.round(car.x / CITY.pitch) * CITY.pitch) < 1.2;
  const onRoadZ = Math.abs(car.z - Math.round(car.z / CITY.pitch) * CITY.pitch) < 1.2;
  if (onRoadX && onRoadZ && (Math.abs(car.x) > 226 || Math.abs(car.z) > 226 || rng.next() < dt * 0.25)) {
    const vertical = car.routeAxis === 'x' ? rng.chance(0.5) : rng.chance(0.5);
    const line = Math.round((vertical ? car.z : car.x) / CITY.pitch) * CITY.pitch;
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = CITY.lane * (vertical ? dir : -dir);
    if (vertical) {
      car.routeAxis = 'z';
      car.routeDir = dir;
      car.x = line + lane;
      car.angle = dir > 0 ? 0 : Math.PI;
    } else {
      car.routeAxis = 'x';
      car.routeDir = dir;
      car.z = line + lane;
      car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    if (Math.abs(car.x) > 232 || Math.abs(car.z) > 232) pickRoute(car, city, rng);
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += car.speed * dt * 1.4;
}

// --- The player's car: arcade handling, building and car collisions. ---

function collideCircle(x, z, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.x - c.hw, Math.min(x, c.x + c.hw));
    const nz = Math.max(c.z - c.hd, Math.min(z, c.z + c.hd));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * radius;
        z = nz + (dz / d) * radius;
        return { x, z, hit: true, nx: dx / d, nz: dz / d };
      }
      x += radius;
      return { x, z, hit: true, nx: 1, nz: 0 };
    }
  }
  return { x, z, hit: false, nx: 0, nz: 0 };
}

export function drivePlayerCar(car, move, dt, state, handbrake) {
  const forward = { x: Math.sin(car.angle), z: Math.cos(car.angle) };
  const throttle = move.y;
  const steering = move.x;
  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
  car.speed = Math.max(-CAR.reverseMax, Math.min(CAR.maxSpeed, car.speed));
  const steerAmount = steering * CAR.steer * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 8);
  car.angle += steerAmount * (car.speed / CAR.maxSpeed) * dt * 2.2;
  if (handbrake && Math.abs(car.speed) > 6) car.angle += steering * dt * 1.4;
  const nx = car.x + Math.sin(car.angle) * car.speed * dt;
  const nz = car.z + Math.cos(car.angle) * car.speed * dt;
  const hit = collideCircle(nx, nz, 1.6, state.city.colliders);
  car.x = hit.x;
  car.z = hit.z;
  if (hit.hit) {
    const along = forward.x * hit.nx + forward.z * hit.nz;
    if (along < 0) car.speed *= 0.4;
    if (state.audio) state.audio.thud();
  }
  // Soft push from other cars.
  for (const other of state.traffic) {
    if (other === car || other.dead) continue;
    const dx = car.x - other.x;
    const dz = car.z - other.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) * 0.5;
      car.x += (dx / d) * push;
      car.z += (dz / d) * push;
      other.x -= (dx / d) * push * 0.4;
      other.z -= (dz / d) * push * 0.4;
      car.speed *= 0.85;
    }
  }
  // Stay inside the map (beach is drivable, water is not).
  car.x = Math.max(-280, Math.min(280, car.x));
  car.z = Math.max(-280, Math.min(246, car.z));
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  const lean = -steering * Math.min(1, Math.abs(car.speed) / 20) * 0.06;
  car.mesh.rotation.z = lean;
  for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += car.speed * dt * 1.4;
  return hit.hit;
}

// --- Police: spawn near the player, chase, ram, flash their light bars. ---

export function createPoliceCar(state, x, z) {
  const car = makeCar(state, x, z, 0, { police: true, color: 0xf2f2f2 });
  car.speed = 0;
  return car;
}

export function policeStep(car, target, dt, state) {
  const dx = target.x - car.x;
  const dz = target.z - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.01) return dist;
  const wantAngle = Math.atan2(dx, dz);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 3 * dt));
  const targetSpeed = Math.min(POLICE_CHASE_SPEED, 8 + dist * 0.35);
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  const hit = collideCircle(car.x, car.z, 1.6, state.city.colliders);
  car.x = hit.x;
  car.z = hit.z;
  if (hit.hit) car.speed *= 0.5;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  if (car.flash) {
    car.flash.timer += dt;
    const phase = Math.floor(car.flash.timer * 4) % 2 === 0;
    car.flash.red.visible = phase;
    car.flash.blue.visible = !phase;
  }
  for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += car.speed * dt * 1.4;
  return dist;
}

export { trafficStep, collideCircle };
