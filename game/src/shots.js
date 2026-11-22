// Screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a scripted driver, so the frame is what a short game really looks like and
// the same seed always gives the same frame.
import { STEP } from './config.js';

const SAMPLE = STEP;

// Drive straight up road x=0, steering back to the centre line.
function driveDriver(state) {
  const car = state.playerCar;
  return {
    move: { x: Math.max(-1, Math.min(1, -car.x * 0.2)), y: 1, run: false },
    look: { dx: 0, dy: 0 },
    actions: 0,
    jump: false,
  };
}

// Run up the sidewalk at x=9.5, camera behind.
function chaseDriver(state) {
  const player = state.player;
  player.camYaw = Math.PI;
  return {
    move: { x: 0, y: 1, run: true },
    look: { dx: 0, dy: 0 },
    actions: 0,
    jump: false,
  };
}

// Stand at the harbor and aim at the guards; fire once at the start.
function missionDriver(state) {
  const player = state.player;
  player.camYaw = -Math.PI * 0.75;
  const first = state.time < 0.1;
  return {
    move: { x: 0, y: 0, run: false },
    look: { dx: 0, dy: 0 },
    actions: first ? 4 : 0, // ACTION_SHOOT
    jump: false,
  };
}

function simulate(world, seconds) {
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    // No paint: hundreds of software renders would take minutes; the scene is
    // painted once, after the simulation, by main.js.
    world.update(SAMPLE, 0, { dx: 0, dy: 0 }, false);
  }
}

// Put a car somewhere for the final frame (a police car closing in, traffic
// ahead). The simulation is over, so it stays where it is put.
function placeCar(car, x, z, angle) {
  if (!car) return;
  car.x = x;
  car.z = z;
  car.angle = angle;
  car.speed = 0;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = angle;
}

/**
 * Set `world` to the named scene (start, drive, chase or mission; any other
 * name is start) and return the screen it shows.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'drive') {
    world.resetRun(true);
    state.money = 1250;
    state.screen = 'play';
    state.missions.index = 0;
    state.missions.startMission();
    const sedan = state.parkedCars.find((c) => c.missionCar === 1);
    sedan.x = 0;
    sedan.z = -160;
    sedan.angle = 0;
    sedan.mesh.position.set(0, 0, -160);
    sedan.mesh.rotation.y = 0;
    state.putPlayerInCar(sedan, true);
    state.wanted.addHeat(1, '');
    state.driver = {
      step(dt, s) {
        const d = driveDriver(s);
        s.driver.move = d.move;
        s.driver.look = d.look;
        s.driver.actions = d.actions;
        s.driver.jump = d.jump;
      },
    };
    simulate(world, 4.5);
    state.driver = null;
    // Traffic ahead, in frame: two cars on the road in front of the player.
    const pc = state.playerCar;
    placeCar(state.traffic[0], 2, pc.z + 45, 0);
    placeCar(state.traffic[1], -2.5, pc.z + 80, 0);
    return { screen: 'play' };
  }
  if (name === 'chase') {
    world.resetRun(true);
    state.money = 1250;
    state.screen = 'play';
    state.player.x = 9.5;
    state.player.z = -60;
    state.player.angle = 0;
    state.player.camYaw = Math.PI;
    state.player.mesh.position.set(9.5, 0, -60);
    state.wanted.addHeat(3, '');
    state.driver = {
      step(dt, s) {
        const d = chaseDriver(s);
        s.driver.move = d.move;
        s.driver.look = d.look;
        s.driver.actions = d.actions;
        s.driver.jump = d.jump;
      },
    };
    simulate(world, 5);
    state.driver = null;
    // A police car closing in, in frame ahead of the player: the chase cars
    // spend the run behind the camera, so the frame would otherwise show no
    // police at all.
    placeCar(state.wanted.policeCars[0], 0, state.player.z + 25, Math.PI);
    return { screen: 'play' };
  }
  if (name === 'mission') {
    world.resetRun(true);
    state.money = 3200;
    state.screen = 'play';
    state.missions.index = 4;
    state.missions.jumpTo(1);
    // Inside the harbor park (open ground since the fix), off the beacon's
    // line so the armored van at 215,215 shows beside the beacon instead of
    // hiding behind it. Facing the guards at 203,203.
    state.player.x = 185;
    state.player.z = 200;
    state.player.angle = 1.405;
    state.player.camYaw = -1.737;
    state.player.mesh.position.set(185, 0, 200);
    state.wanted.addHeat(2, '');
    state.driver = {
      step(dt, s) {
        const d = missionDriver(s);
        s.driver.move = d.move;
        s.driver.look = d.look;
        s.driver.actions = d.actions;
        s.driver.jump = d.jump;
      },
    };
    simulate(world, 2.5);
    // One last shot, one step before the paint: the tracer lives 0.09 s and
    // only decays while the world updates, so it stays bright in the frame.
    state.driver = {
      step(dt, s) {
        s.driver.move = { x: 0, y: 0, run: false };
        s.driver.look = { dx: 0, dy: 0 };
        s.driver.actions = 4; // ACTION_SHOOT
        s.driver.jump = false;
      },
    };
    simulate(world, 1 / 60);
    state.driver = null;
    // A guard's return shot, frozen mid-flight: it crosses the frame toward
    // the player, unlike the player's own tracer, which runs away from the
    // camera and is invisible end-on.
    const guard = state.combat.enemies.find((e) => !e.dead);
    if (guard) {
      state.combat.spawnTracer(
        { x: guard.x, y: 1.4, z: guard.z },
        { x: state.player.x + 1.5, y: 1.2, z: state.player.z + 1 },
      );
    }
    return { screen: 'play' };
  }
  // start: the title screen over the live city.
  world.resetRun(true);
  state.screen = 'title';
  simulate(world, 6);
  return { screen: 'title' };
}
