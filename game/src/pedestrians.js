// Pedestrians: simple low-poly people who stroll the sidewalks, turn at
// intersections, and fall over (then get up elsewhere) when hit by a car.
import * as THREE from 'three';
import { CITY, PED_COLORS } from './config.js';

export function createPersonMesh(shirtColor, pantsColor, scale) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.24);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.16, 0.35, 0);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.16, 0.35, 0);
  group.add(legL);
  group.add(legR);
  const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.18);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.4, 1.05, 0);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.4, 1.05, 0);
  group.add(armL);
  group.add(armR);
  group.scale.setScalar(scale || 1);
  group.userData = { legL, legR, armL, armR };
  return group;
}

function sidewalkPoint(rng) {
  // A point just off a road, on a sidewalk edge.
  const vertical = rng.chance(0.5);
  const line = rng.pick([-232, -174, -116, -58, 0, 58, 116, 174, 232]);
  const along = rng.range(-220, 220);
  const off = (rng.chance(0.5) ? 1 : -1) * (CITY.roadHalf + 2.5);
  return vertical ? { x: line + off, z: along } : { x: along, z: line + off };
}

export function createPedestrians(state, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = createPersonMesh(
      PED_COLORS[state.rng.int(0, PED_COLORS.length - 1)],
      0x2c3440,
      state.rng.range(0.92, 1.08),
    );
    const at = sidewalkPoint(state.rng);
    mesh.position.set(at.x, 0, at.z);
    state.scene.add(mesh);
    peds.push({
      mesh,
      x: at.x,
      z: at.z,
      angle: state.rng.range(0, Math.PI * 2),
      speed: state.rng.range(1.0, 1.8),
      target: sidewalkPoint(state.rng),
      walkPhase: state.rng.range(0, Math.PI * 2),
      down: 0, // seconds spent knocked down; 0 = walking
      respawn: 0,
    });
  }
  return peds;
}

export function pedestriansStep(peds, dt, state) {
  for (const ped of peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      ped.mesh.rotation.x = Math.max(0, ped.mesh.rotation.x - dt * 2);
      if (ped.down <= 0) {
        const at = sidewalkPoint(state.rng);
        ped.x = at.x;
        ped.z = at.z;
        ped.target = sidewalkPoint(state.rng);
        ped.mesh.rotation.x = 0;
        ped.mesh.visible = true;
      }
      continue;
    }
    const dx = ped.target.x - ped.x;
    const dz = ped.target.z - ped.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      ped.target = sidewalkPoint(state.rng);
      continue;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - ped.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff * 4 * dt));
    ped.x += Math.sin(ped.angle) * ped.speed * dt;
    ped.z += Math.cos(ped.angle) * ped.speed * dt;
    ped.walkPhase += dt * ped.speed * 4;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
    ped.mesh.userData.armL.rotation.x = -swing * 0.7;
    ped.mesh.userData.armR.rotation.x = swing * 0.7;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.angle;
  }
}

// Knock a pedestrian down: they lie flat, then get up somewhere else.
export function knockPedDown(ped) {
  if (ped.down > 0) return false;
  ped.down = 4;
  ped.mesh.rotation.x = Math.PI / 2 - 0.15;
  ped.mesh.position.y = 0.25;
  return true;
}
