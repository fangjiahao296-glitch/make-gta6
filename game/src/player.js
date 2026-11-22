// Solara Bay — the player on foot: walk, run, jump, camera, enter/exit cars.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { clamp, dampAngle, resolveCircle } from './util.js';

function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6fc2 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2e3a4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.85, 0.32), jeans);
  legs.position.y = 0.43;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.66, 0.34), jacket);
  torso.position.y = 1.18;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), skin);
  head.position.y = 1.72;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), new THREE.MeshLambertMaterial({ color: 0xc23b2e }));
  cap.position.y = 1.9;
  g.add(cap);
  const armGeo = new THREE.BoxGeometry(0.13, 0.6, 0.13);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.37, 1.18, 0);
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.37, 1.18, 0);
  g.add(armR);
  g.userData.arms = [armL, armR];
  g.userData.legs = legs;
  return g;
}

export class Player {
  constructor(scene, x, z) {
    this.scene = scene;
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = Math.PI; // face south down the road at spawn
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.velY = 0;
    this.onGround = true;
    this.health = PLAYER.health;
    this.cash = 0;
    this.inCar = null; // Car instance when driving
    this.walkPhase = 0;
    this.lastDamageAt = -99;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }

  // Mouse look: dx/dy in pixels. On foot it orbits the player; in a car it
  // shifts the chase camera around the car's rear.
  look(dx, dy) {
    if (this.inCar) {
      this.driveYawOffset = clamp((this.driveYawOffset || 0) - dx * 0.0032, -1.2, 1.2);
      this.camPitch = clamp(this.camPitch + dy * 0.0028, -0.15, 1.1);
    } else {
      this.camYaw -= dx * 0.0032;
      this.camPitch = clamp(this.camPitch + dy * 0.0028, -0.15, 1.1);
    }
  }

  update(dt, input, colliders, time) {
    if (this.inCar) return; // driving is handled by the car
    const run = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    // Move relative to camera yaw.
    let mx = 0, mz = 0;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) mz -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) mz += 1;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) mx -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      // Forward vector (where the camera points, on the ground):
      const fx = -sin, fz = -cos;
      // Right vector:
      const rx = -fz, rz = fx;
      const vx = fx * -mz + rx * mx;
      const vz = fz * -mz + rz * mx;
      this.pos.x += vx * speed * dt;
      this.pos.z += vz * speed * dt;
      this.heading = dampAngle(this.heading, Math.atan2(vx, vz), 12, dt);
      this.walkPhase += dt * speed * 1.6;
    }
    // Jump + gravity.
    if ((input.keys.has('Space')) && this.onGround) {
      this.velY = PLAYER.jumpSpeed;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.velY -= 22 * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.velY = 0; this.onGround = true; }
    }
    // Collide with the city.
    const p = { x: this.pos.x, z: this.pos.z };
    resolveCircle(p, PLAYER.radius, colliders);
    this.pos.x = p.x; this.pos.z = p.z;
    // Health regen after a quiet spell.
    if (time - this.lastDamageAt > 5 && this.health < PLAYER.health) {
      this.health = Math.min(PLAYER.health, this.health + 9 * dt);
    }
    // Walk swing.
    const swing = len > 0 ? Math.sin(this.walkPhase) * 0.55 : 0;
    const arms = this.mesh.userData.arms || [];
    if (arms[0]) arms[0].rotation.x = swing;
    if (arms[1]) arms[1].rotation.x = -swing;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }

  damage(amount, time) {
    this.health -= amount;
    this.lastDamageAt = time;
    return this.health <= 0;
  }

  // Third-person camera. Returns nothing; moves the camera directly.
  updateCamera(camera, dt) {
    const target = this.inCar ? this.inCar.pos : this.pos;
    // When driving, the camera chases behind the car plus the mouse offset.
    const camYaw = this.inCar
      ? this.inCar.heading + Math.PI + (this.driveYawOffset || 0)
      : this.camYaw;
    const dist = PLAYER.cameraDist + (this.inCar ? 2.5 : 0);
    const height = PLAYER.cameraHeight + (this.inCar ? 1.2 : 0);
    const cx = target.x + Math.sin(camYaw) * dist * Math.cos(this.camPitch);
    const cz = target.z + Math.cos(camYaw) * dist * Math.cos(this.camPitch);
    const cy = target.y + height + Math.sin(this.camPitch) * dist * 0.5;
    camera.position.set(cx, Math.max(1.2, cy), cz);
    camera.lookAt(target.x, target.y + 1.6, target.z);
  }

  speed() {
    return this.inCar ? Math.abs(this.inCar.speed) : 0;
  }

  respawn(x, z) {
    this.pos.set(x, 0, z);
    this.heading = Math.PI;
    this.camYaw = Math.PI;
    this.health = PLAYER.health;
    this.inCar = null;
    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
  }
}
