// Solara Bay — deterministic screenshot scenes (?shot=start|drive|chase|mission).
// Each scene places the player, cars, police and guards at fixed spots so a
// screenshot taken a moment later is reproducible.
import * as THREE from 'three';
import { Shooter } from './combat.js';
import { makeCarMesh, Car } from './vehicles.js';

export class ShotStager {
  constructor(ctx) {
    this.ctx = ctx;
  }

  stage(name) {
    const ctx = this.ctx;
    const p = ctx.player;
    if (name === 'start') {
      // Title screen over the live city; player hidden, camera orbits.
      p.mesh.visible = false;
      ctx.state = 'title';
      ctx.camera.position.set(90, 42, 150);
      ctx.camera.lookAt(0, 8, 0);
      return;
    }
    ctx.state = 'playing';
    ctx.hud.showStory('Solara Bay', 'A sun-soaked coastal city. Steal cars, outrun the cops, pay off the debt.', 30000);

    if (name === 'drive') {
      // Player driving the red sedan down the main road, 1 star, story card up.
      const car = ctx.traffic.parked.find((c) => c.isMissionCar) || ctx.traffic.parked[0];
      ctx.traffic.removeParked(car);
      car.pos.set(-52, 0, -60);
      car.heading = 0; // facing north (+z? heading 0 = +z)
      car.speed = 16;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
      p.inCar = car;
      p.mesh.visible = false;
      p.pos.copy(car.pos);
      ctx.wanted.addHeat(12);
      ctx.missions.phase = 'active';
      ctx.missions.index = 0;
      ctx.missions.objective = 'Steal the red sedan — First Wheels.';
      ctx.missions.target = { x: -52, z: -60, label: 'First Wheels' };
      ctx.missions._placeBeacon();
      // Camera further back so the car stays in frame as it pulls away.
      ctx.camera.position.set(-52, 9, -95);
      ctx.camera.lookAt(-52, 1, -30);
    } else if (name === 'chase') {
      // On foot, 3 stars, a police car closing in from behind as the player
      // runs up the road away from the camera.
      p.pos.set(0, 0, 20);
      p.heading = Math.PI; // mesh faces -z, up the road
      p.camYaw = 0;        // W runs the player -z, away from the camera
      p.mesh.visible = true;
      p.mesh.position.copy(p.pos);
      ctx.wanted.addHeat(58);
      ctx.peds.scare(0, 20, 40);
      const mesh = makeCarMesh(0x1a1a1a, { police: true });
      ctx.scene.add(mesh);
      const pc = new Car(mesh, 2, 32, Math.PI);
      pc.isPolice = true;
      pc.speed = 14;
      ctx.wanted.policeCars.push(pc);
      ctx.missions.objective = 'Lose the cops — 3 stars and climbing.';
      ctx.camera.position.set(-8, 5, 38);
      ctx.camera.lookAt(2, 1.5, 0);
    } else if (name === 'mission') {
      // Harbor shootout: four guards, the armored van, beacon, player firing.
      p.pos.set(160, 0, 150);
      p.heading = Math.atan2(182 - 160, 182 - 150);
      p.camYaw = p.heading;
      p.mesh.visible = true;
      p.mesh.position.copy(p.pos);
      ctx.missions.phase = 'active';
      ctx.missions.index = 4;
      ctx.missions._spawnGuards();
      ctx.missions._spawnVan();
      ctx.missions.target = { x: 182, z: 182, label: 'Harbor heist' };
      ctx.missions.objective = 'Harbor Heist — clear the guards, take the van.';
      ctx.missions._placeBeacon();
      // A live tracer for the photo: the player fires at the nearest guard.
      const g = ctx.missions.guards[0];
      if (g) {
        const from = new THREE.Vector3(p.pos.x, 1.5, p.pos.z);
        const to = new THREE.Vector3(g.pos.x, 1.2, g.pos.z);
        ctx.combat._tracer(from, to);
      }
      ctx.camera.position.set(154, 6, 144);
      ctx.camera.lookAt(182, 2, 182);
    }
  }
}
