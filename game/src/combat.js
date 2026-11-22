// Solara Bay — hitscan pistol combat: player shots, enemy shooters, tracers.
import * as THREE from 'three';
import { COMBAT } from './config.js';
import { makeRng } from './util.js';

// A hostile shooter (guard or foot cop). Simple capsule figure with a gun.
export function makeShooterMesh(uniformColor) {
  const g = new THREE.Group();
  const uniform = new THREE.MeshLambertMaterial({ color: uniformColor });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.8, 0.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  legs.position.y = 0.4;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.32), uniform);
  torso.position.y = 1.1;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.62;
  g.add(head);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.4, 0.36), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  vest.position.y = 1.12;
  g.add(vest);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.55), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.2, 1.25, 0.35);
  g.add(gun);
  g.userData.gun = gun;
  return g;
}

export class Shooter {
  constructor(scene, x, z, kind) {
    this.kind = kind; // 'guard' | 'cop'
    this.mesh = makeShooterMesh(kind === 'cop' ? 0x2233aa : 0x4a4a3a);
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(x, 0, z);
    this.health = kind === 'cop' ? COMBAT.copHealth : COMBAT.guardHealth;
    this.alive = true;
    this.shootTimer = 1 + Math.random();
    this.mesh.position.copy(this.pos);
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.alive = false;
      this.mesh.visible = false;
      return true;
    }
    return false;
  }

  // Shuffle toward the player and fire with inaccuracy.
  update(dt, playerPos, ctx) {
    if (!this.alive) return false; // did not shoot
    const dx = playerPos.x - this.pos.x;
    const dz = playerPos.z - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    this.mesh.rotation.y = Math.atan2(dx, dz);
    // Close distance until in range, then hold and strafe a little.
    if (d > 16) {
      this.pos.x += (dx / d) * 3.4 * dt;
      this.pos.z += (dz / d) * 3.4 * dt;
      this.mesh.position.copy(this.pos);
    }
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && d < 42) {
      this.shootTimer = COMBAT.enemyInterval * (0.8 + Math.random() * 0.5);
      return true; // fired; caller resolves the hit
    }
    return false;
  }
}

export class Combat {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.cooldown = 0;
    this.tracers = [];
    this.muzzle = new THREE.PointLight(0xffc860, 0, 14);
    this.scene.add(this.muzzle);
    this.targets = []; // shootable meshes: {mesh, ref}
    this.shootables = []; // THREE objects for raycast
  }

  registerTarget(mesh, ref) {
    this.targets.push({ mesh, ref });
    this.shootables.push(mesh);
  }

  unregisterTarget(ref) {
    this.targets = this.targets.filter((t) => t.ref !== ref);
    this.shootables = this.targets.map((t) => t.mesh);
  }

  tick(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    // Fade tracers (slower, so a shot stays visible for the photo).
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt * 2.5;
      t.line.material.opacity = Math.max(0, t.life);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 30);
  }

  // Player fires from the camera center. Returns the hit ref (or null).
  firePlayer(origin, obstacles) {
    if (this.cooldown > 0) return null;
    this.cooldown = COMBAT.pistolCooldown;
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    this.raycaster.far = COMBAT.pistolRange;
    const hits = this.raycaster.intersectObjects([...this.shootables, ...obstacles], false);
    let end = null;
    let hitRef = null;
    if (hits.length > 0) {
      const h = hits[0];
      end = h.point.clone();
      const entry = this.targets.find((t) => t.mesh === h.object);
      if (entry) hitRef = entry.ref;
    } else {
      end = this.raycaster.ray.at(COMBAT.pistolRange, new THREE.Vector3());
    }
    this._tracer(origin.clone(), end);
    this.muzzle.position.copy(origin);
    this.muzzle.intensity = 3.2;
    return hitRef;
  }

  // An enemy fires at the player; accuracy decides the hit.
  fireEnemy(from, playerPos, hitChance) {
    const start = from.clone();
    start.y = 1.35;
    const dir = playerPos.clone().sub(start);
    const d = dir.length();
    dir.normalize();
    // Miss: offset the end point.
    const end = playerPos.clone();
    end.y = 1.2;
    if (Math.random() > hitChance) {
      end.x += (Math.random() - 0.5) * 3;
      end.z += (Math.random() - 0.5) * 3;
      end.y += (Math.random() - 0.5) * 1.5;
    }
    this._tracer(start, end, 0xff6a5a);
    this.muzzle.position.copy(start);
    this.muzzle.intensity = 2.2;
    return Math.random() <= hitChance;
  }

  _tracer(a, b, color = 0xffe9a8) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 1 });
  }
}
