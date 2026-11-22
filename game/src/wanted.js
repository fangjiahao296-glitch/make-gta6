// The wanted system: 0 to 5 stars. Crime adds heat; police cars roll in and
// chase; lay low out of sight and the heat cools off. Getting busted or
// wasted ends the run at the hospital, poorer.
import { WANTED_MAX } from './config.js';
import { createPoliceCar, policeStep } from './vehicles.js';

export function createWanted(state) {
  const wanted = {
    stars: 0,
    coolTimer: 0,
    policeCars: [],
    footCops: [],
    bustTimer: 0,
  };

  function addHeat(n, reason) {
    if (wanted.stars >= WANTED_MAX) return;
    wanted.stars = Math.min(WANTED_MAX, wanted.stars + n);
    wanted.coolTimer = 0;
    if (reason) state.toast(`${reason} —通缉 ${wanted.stars} 星`);
    state.audio.siren(wanted.stars > 0);
  }

  function clear(reason) {
    wanted.stars = 0;
    wanted.coolTimer = 0;
    wanted.bustTimer = 0;
    for (const car of wanted.policeCars) {
      state.scene.remove(car.mesh);
      car.dead = true;
    }
    wanted.policeCars.length = 0;
    for (const cop of wanted.footCops) {
      state.scene.remove(cop.mesh);
      cop.dead = true;
    }
    wanted.footCops.length = 0;
    state.audio.siren(false);
    if (reason) state.toast(reason);
  }

  function spawnPoliceNear(player) {
    const at = state.city.randomRoadPoint();
    const dx = at.x - player.x;
    const dz = at.z - player.z;
    const d = Math.hypot(dx, dz);
    const x = d < 30 ? player.x + (dx / (d || 1)) * 60 : at.x;
    const z = d < 30 ? player.z + (dz / (d || 1)) * 60 : at.z;
    const car = createPoliceCar(state, x, z);
    wanted.policeCars.push(car);
    return car;
  }

  function update(dt, player, playerCar) {
    const target = playerCar || player;
    const want = Math.min(wanted.stars, 3);
    while (wanted.policeCars.length < want) spawnPoliceNear(target);
    while (wanted.policeCars.length > want) {
      const car = wanted.policeCars.pop();
      state.scene.remove(car.mesh);
      car.dead = true;
    }
    let nearest = Infinity;
    for (const car of wanted.policeCars) {
      const d = policeStep(car, target, dt, state);
      nearest = Math.min(nearest, d);
      // A police car ramming the player's car slows it and shakes the camera.
      if (playerCar && d < 3.6) {
        playerCar.speed *= 0.92;
        state.shake = Math.max(state.shake, 0.35);
      }
    }
    // On foot, a police car sitting on the player busts them.
    if (!playerCar && wanted.stars > 0 && nearest < 4) {
      wanted.bustTimer += dt;
      if (wanted.bustTimer > 1.6) state.busted();
    } else {
      wanted.bustTimer = Math.max(0, wanted.bustTimer - dt * 2);
    }
    // Foot cops join the chase at 3 stars and up.
    if (wanted.stars >= 3 && wanted.footCops.length < 2) {
      const cop = state.combat.spawnEnemy(
        target.x + state.rng.range(-14, 14), target.z + state.rng.range(-14, 14),
        { cop: true, shirt: 0x2e4a6b, accuracy: 0.3, drop: 80 },
      );
      wanted.footCops.push(cop);
    }
    // Cooling off: no police car close for a while drops a star.
    if (wanted.stars > 0) {
      if (nearest > 70) {
        wanted.coolTimer += dt;
        if (wanted.coolTimer > 8) {
          wanted.stars -= 1;
          wanted.coolTimer = 0;
          state.toast(`风头过去了一点 — 通缉 ${wanted.stars} 星`);
          state.audio.siren(wanted.stars > 0);
        }
      } else {
        wanted.coolTimer = 0;
      }
    }
  }

  // Return the state object itself, not a spread copy: the HUD reads
  // wanted.stars, and a copy would freeze it at 0 while the closures kept
  // counting heat on the original.
  return Object.assign(wanted, { addHeat, clear, update });
}
