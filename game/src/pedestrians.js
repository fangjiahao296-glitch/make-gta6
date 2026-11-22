// Solara Bay — pedestrians strolling the sidewalks, fleeing from gunfire.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { makeRng, clamp, dist2d, resolveCircle } from './util.js';

function makePersonMesh(shirtColor) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e3a4a });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.3), pants);
  legs.position.y = 0.4;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.32), shirt);
  torso.position.y = 1.1;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.62;
  g.add(head);
  const armGeo = new THREE.BoxGeometry(0.12, 0.55, 0.12);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.34, 1.1, 0);
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.34, 1.1, 0);
  g.add(armR);
  g.userData.arms = [armL, armR];
  return g;
}

export class Pedestrians {
  constructor(scene, city, seed) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed ^ 0x77aa);
    this.people = [];
    this._spawn();
  }

  _spawn() {
    const rng = this.rng;
    const shirts = [0xc23b2e, 0x2e6fc2, 0xe0b93c, 0x3aa655, 0x7a4a9a, 0xd97a2b, 0xeeeeee];
    for (let k = 0; k < 16; k++) {
      const mesh = makePersonMesh(rng.pick(shirts));
      this.scene.add(mesh);
      // Start on a sidewalk next to a road.
      const road = WORLD.roadCenter(rng.int(0, 8));
      const along = rng.range(-200, 200);
      const side = rng.next() < 0.5 ? 7.5 : -7.5;
      const p = rng.next() < 0.5
        ? { x: along, z: road + side }
        : { x: road + side, z: along };
      const person = {
        mesh,
        pos: new THREE.Vector3(p.x, 0, p.z),
        heading: rng.range(0, Math.PI * 2),
        speed: rng.range(1.0, 1.8),
        walkPhase: rng.range(0, Math.PI * 2),
        flee: 0,
      };
      mesh.position.copy(person.pos);
      mesh.rotation.y = person.heading;
      this.people.push(person);
    }
  }

  // Flee from a gunshot / scare at (x, z).
  scare(x, z, radius = 26) {
    for (const p of this.people) {
      if (dist2d(p.pos.x, p.pos.z, x, z) < radius) {
        p.flee = 3 + Math.random() * 2;
        p.heading = Math.atan2(p.pos.x - x, p.pos.z - z);
      }
    }
  }

  update(dt, colliders) {
    for (const p of this.people) {
      if (p.flee > 0) p.flee -= dt;
      const speed = p.flee > 0 ? p.speed * 3.2 : p.speed;
      p.pos.x += Math.sin(p.heading) * speed * dt;
      p.pos.z += Math.cos(p.heading) * speed * dt;
      // Wander: occasionally turn; stay inside the city.
      if (Math.random() < dt * 0.12) p.heading += (Math.random() - 0.5) * 1.6;
      if (Math.abs(p.pos.x) > 208 || Math.abs(p.pos.z) > 208) {
        p.heading += Math.PI;
        p.pos.x = clamp(p.pos.x, -206, 206);
        p.pos.z = clamp(p.pos.z, -206, 206);
      }
      // Stay out of buildings and props.
      const pp = { x: p.pos.x, z: p.pos.z };
      resolveCircle(pp, 0.5, colliders);
      p.pos.x = pp.x; p.pos.z = pp.z;
      p.walkPhase += dt * speed * 4;
      const swing = Math.sin(p.walkPhase) * 0.5;
      const arms = p.mesh.userData.arms || [];
      if (arms[0]) arms[0].rotation.x = swing;
      if (arms[1]) arms[1].rotation.x = -swing;
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y = p.heading;
    }
  }

  // Is anyone close enough to witness a crime at (x, z)?
  witnessed(x, z, radius = 30) {
    for (const p of this.people) {
      if (dist2d(p.pos.x, p.pos.z, x, z) < radius) return true;
    }
    return false;
  }
}
