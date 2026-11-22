// Leo Marin on foot: WASD movement relative to the camera, Shift to run,
// Space to jump, mouse to look. The camera trails behind in third person.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { createPersonMesh } from './pedestrians.js';
import { collideCircle } from './vehicles.js';

export function createPlayer(state, x, z) {
  const mesh = createPersonMesh(0x2e6fc2, 0x2c3440, 1.05);
  mesh.position.set(x, 0, z);
  state.scene.add(mesh);
  return {
    mesh,
    x, z,
    y: 0,
    vy: 0,
    angle: 0,
    camYaw: 0,
    camPitch: 0.32,
    health: PLAYER.health,
    walkPhase: 0,
    moving: false,
    grounded: true,
  };
}

export function updatePlayerOnFoot(player, move, look, jump, dt, state) {
  player.camYaw -= look.dx * 0.0032;
  player.camPitch = Math.max(0.05, Math.min(1.1, player.camPitch + look.dy * 0.0022));

  const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(player.camYaw);
  const cos = Math.cos(player.camYaw);
  // Forward is where the camera looks; right is 90 degrees clockwise from it.
  const fx = -sin;
  const fz = -cos;
  const rx = cos;
  const rz = -sin;
  let mx = fx * move.y + rx * move.x;
  let mz = fz * move.y + rz * move.x;
  const len = Math.hypot(mx, mz);
  player.moving = len > 0.01;
  if (player.moving) {
    mx /= len;
    mz /= len;
    player.angle = Math.atan2(mx, mz);
    const nx = player.x + mx * speed * dt;
    const nz = player.z + mz * speed * dt;
    const hit = collideCircle(nx, nz, PLAYER.radius, state.city.colliders);
    player.x = hit.x;
    player.z = hit.z;
    player.walkPhase += dt * speed * 1.6;
  }
  if (player.grounded && jump) {
    player.vy = PLAYER.jumpSpeed;
    player.grounded = false;
  }
  if (!player.grounded) {
    player.vy -= PLAYER.gravity * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
    }
  }
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.55 : 0;
  player.mesh.userData.legL.rotation.x = swing;
  player.mesh.userData.legR.rotation.x = -swing;
  player.mesh.userData.armL.rotation.x = -swing * 0.7;
  player.mesh.userData.armR.rotation.x = swing * 0.7;
  player.mesh.position.set(player.x, player.y, player.z);
  player.mesh.rotation.y = player.angle;
  player.x = Math.max(-280, Math.min(280, player.x));
  player.z = Math.max(-280, Math.min(246, player.z));
}

// Third-person camera: behind the player on foot, higher and further in a car.
export function updateCamera(camera, player, car, dt, look) {
  const target = car || player;
  // yaw is the azimuth from the target to the camera; the camera looks back at it.
  const yaw = car ? car.angle + Math.PI : player.camYaw;
  const pitch = car ? 0.32 : player.camPitch;
  const dist = car ? 11 : 7.5;
  const height = car ? 4.2 : 3.2;
  const cx = target.x + Math.sin(yaw) * Math.cos(pitch) * dist;
  const cz = target.z + Math.cos(yaw) * Math.cos(pitch) * dist;
  const cy = height + Math.sin(pitch) * dist * 0.6;
  const k = 1 - Math.pow(0.0001, dt);
  camera.position.x += (cx - camera.position.x) * k;
  camera.position.y += (Math.max(1.2, cy) - camera.position.y) * k;
  camera.position.z += (cz - camera.position.z) * k;
  camera.lookAt(target.x, (car ? 1.2 : 1.5), target.z);
}
