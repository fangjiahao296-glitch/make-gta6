// Combat: a hitscan pistol for the player, armed enemies (foot cops and
// mission guards) who shoot back, tracers, muzzle flashes and cash drops.
import * as THREE from 'three';
import { createPersonMesh } from './pedestrians.js';

const RAYCASTER = new THREE.Raycaster();
const SCREEN_CENTER = new THREE.Vector2(0, 0);

export function createCombat(state) {
  const enemies = [];
  const tracers = [];
  const tracerGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 5);
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const flashLight = new THREE.PointLight(0xffc860, 0, 18);
  state.scene.add(flashLight);

  function spawnTracer(from, to) {
    const mesh = new THREE.Mesh(tracerGeo, tracerMat.clone());
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    mesh.scale.set(1, len, 1);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.userData.life = 0.09;
    state.scene.add(mesh);
    tracers.push(mesh);
  }

  function muzzleFlash(at) {
    flashLight.position.copy(at);
    flashLight.intensity = 60;
  }

  // An armed enemy: a person with a gun who stands, aims and shoots at the player.
  function spawnEnemy(x, z, opts = {}) {
    const mesh = createPersonMesh(opts.shirt ?? 0x1a2028, 0x2c3440, 1.05);
    mesh.position.set(x, 0, z);
    mesh.userData.isEnemyRoot = true;
    state.scene.add(mesh);
    const enemy = {
      mesh,
      x, z,
      health: opts.health ?? 100,
      fireTimer: opts.delay ?? 1.2,
      accuracy: opts.accuracy ?? 0.35,
      cop: !!opts.cop,
      dead: false,
      drop: opts.drop ?? 120,
    };
    enemies.push(enemy);
    return enemy;
  }

  function removeEnemy(enemy) {
    enemy.dead = true;
    enemy.mesh.rotation.x = Math.PI / 2 - 0.1;
    enemy.mesh.position.y = 0.25;
    state.audio.thud();
    state.addCash(enemy.drop, enemy.x, enemy.z);
    window.setTimeout(() => {
      state.scene.remove(enemy.mesh);
      const i = enemies.indexOf(enemy);
      if (i >= 0) enemies.splice(i, 1);
    }, 4000);
  }

  // Player shoots toward the screen centre. Returns the enemy hit, if any.
  function playerShoot(camera) {
    RAYCASTER.setFromCamera(SCREEN_CENTER, camera);
    const targets = [];
    for (const enemy of enemies) {
      if (!enemy.dead) targets.push(enemy.mesh);
    }
    for (const car of state.policeCars) {
      if (!car.dead) targets.push(car.mesh);
    }
    const hits = RAYCASTER.intersectObjects(targets, true);
    const from = new THREE.Vector3();
    camera.getWorldPosition(from);
    let end = new THREE.Vector3();
    RAYCASTER.ray.at(120, end);
    if (hits.length > 0) {
      const hit = hits[0];
      end = hit.point.clone();
      let node = hit.object;
      while (node && !node.userData.isEnemyRoot) node = node.parent;
      const enemy = enemies.find((e) => e.mesh === node);
      if (enemy) {
        enemy.health -= 34;
        state.audio.hit();
        if (enemy.health <= 0) {
          removeEnemy(enemy);
          return { killed: enemy, end };
        }
        return { hit: enemy, end };
      }
      const car = state.policeCars.find((c) => c.mesh === node);
      if (car) {
        car.speed *= 0.7;
        state.audio.hit();
        return { hitCar: car, end };
      }
    }
    return { end };
  }

  function enemiesStep(dt, player) {
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const dx = player.x - enemy.x;
      const dz = player.z - enemy.z;
      const dist = Math.hypot(dx, dz);
      enemy.mesh.rotation.y = Math.atan2(dx, dz);
      enemy.mesh.userData.armR.rotation.x = -Math.PI / 2;
      enemy.fireTimer -= dt;
      if (dist < 55 && enemy.fireTimer <= 0) {
        enemy.fireTimer = 1.1 + state.rng.range(0, 0.7);
        const from = new THREE.Vector3(enemy.x, 1.4, enemy.z);
        const hitChance = enemy.accuracy * Math.max(0.25, 1 - dist / 70);
        state.audio.enemyShot();
        if (state.rng.next() < hitChance) {
          const to = new THREE.Vector3(player.x, 1.2, player.z);
          spawnTracer(from, to);
          state.damagePlayer(9 + state.rng.range(0, 6), 'shot');
        } else {
          const to = new THREE.Vector3(
            player.x + state.rng.range(-3, 3), 1.2, player.z + state.rng.range(-3, 3),
          );
          spawnTracer(from, to);
        }
        muzzleFlash(from);
      }
    }
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      const t = tracers[i];
      t.userData.life -= dt;
      t.material.opacity = Math.max(0, t.userData.life / 0.09) * 0.9;
      if (t.userData.life <= 0) {
        state.scene.remove(t);
        tracers.splice(i, 1);
      }
    }
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 600);
  }

  return {
    enemies,
    spawnEnemy,
    playerShoot,
    enemiesStep,
    spawnTracer,
    muzzleFlash,
    clear() {
      for (const enemy of [...enemies]) state.scene.remove(enemy.mesh);
      enemies.length = 0;
      for (const t of tracers) state.scene.remove(t);
      tracers.length = 0;
    },
  };
}
