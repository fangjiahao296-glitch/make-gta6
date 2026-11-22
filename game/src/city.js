// Solara Bay — procedural city: roads, blocks, buildings, parks, port, beach.
import * as THREE from 'three';
import { WORLD, PALETTE } from './config.js';
import { makeRng, canvasTexture, clamp } from './util.js';

export class City {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.colliders = []; // {minX, maxX, minZ, maxZ}
    this.solids = [];    // meshes bullets stop at (buildings, containers)
    this.hospitalPos = { x: -26, z: -104 }; // respawn on the road by the hospital
    this.portPos = { x: 182, z: 182 };
    this.hideoutPos = { x: -182, z: -182 };
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);
    this._materials();
    this._ground();
    this._roads();
    this._blocks();
    this._beach();
    this._lamps();
    this._billboards();
  }

  _materials() {
    const rng = this.rng;
    // Window textures shared across buildings.
    this.windowTex = [0, 1].map((k) =>
      canvasTexture(THREE, 128, 256, (g, w, h) => {
        g.fillStyle = k === 0 ? '#5d6b7d' : '#6b5d4a';
        g.fillRect(0, 0, w, h);
        for (let y = 10; y < h - 12; y += 22) {
          for (let x = 10; x < w - 12; x += 20) {
            const lit = rng.next() < 0.55;
            g.fillStyle = lit ? '#ffe9a8' : '#2c3846';
            g.fillRect(x, y, 12, 13);
          }
        }
      }),
    );
    this.matRoad = new THREE.MeshLambertMaterial({ color: PALETTE.road });
    this.matSidewalk = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
    this.matSand = new THREE.MeshLambertMaterial({ color: PALETTE.sand });
    this.matOcean = new THREE.MeshLambertMaterial({ color: PALETTE.ocean });
    this.matGrass = new THREE.MeshLambertMaterial({ color: PALETTE.ground });
    this.matConcrete = new THREE.MeshLambertMaterial({ color: PALETTE.concrete });
    this.matTrunk = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    this.matLeaf = new THREE.MeshLambertMaterial({ color: 0x2f7a3a });
    this.matPalm = new THREE.MeshLambertMaterial({ color: 0x3a8a3a });
    this.unitBox = new THREE.BoxGeometry(1, 1, 1);
    this.unitCyl = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.unitSphere = new THREE.SphereGeometry(1, 10, 8);
  }

  _box(w, h, d, mat, x, y, z, parent = this.group) {
    const m = new THREE.Mesh(this.unitBox, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  _addCollider(x, z, hw, hd) {
    this.colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });
  }

  _ground() {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.half * 2 + 40, WORLD.half * 2 + 40),
      this.matGrass,
    );
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, -0.05, 0);
    this.group.add(g);
  }

  _roads() {
    // Road strips along x and along z.
    for (let i = 0; i < 9; i++) {
      const c = WORLD.roadCenter(i);
      const rx = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.half * 2, WORLD.road), this.matRoad);
      rx.rotation.x = -Math.PI / 2;
      rx.position.set(0, 0, c);
      this.group.add(rx);
      const rz = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.road, WORLD.half * 2), this.matRoad);
      rz.rotation.x = -Math.PI / 2;
      rz.position.set(c, 0.01, 0);
      this.group.add(rz);
    }
    // Zebra crossings around the central intersection.
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e0 });
    for (const [sx, sz] of [[-8, 0], [8, 0], [0, -8], [0, 8]]) {
      for (let k = -2; k <= 2; k++) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4.5), stripeMat);
        s.rotation.x = -Math.PI / 2;
        if (sz === 0) s.position.set(sx + k * 2.2, 0.02, sz);
        else { s.rotation.z = Math.PI / 2; s.position.set(sx, 0.02, sz + k * 2.2); }
        this.group.add(s);
      }
    }
  }

  _building(x, z, w, d, h, texIdx, colorIdx) {
    const side = new THREE.MeshLambertMaterial({
      map: this.windowTex[texIdx % 2],
      color: PALETTE.building[colorIdx % PALETTE.building.length],
    });
    const top = new THREE.MeshLambertMaterial({ color: 0x4a4a48 });
    const mesh = new THREE.Mesh(this.unitBox, [side, side, top, top, side, side]);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, h / 2, z);
    this.group.add(mesh);
    this.solids.push(mesh);
    // Rooftop box (AC unit).
    this._box(w * 0.25, 1.2, d * 0.25, top, x + w * 0.2, h + 0.6, z - d * 0.2);
    this._addCollider(x, z, w / 2, d / 2);
    return mesh;
  }

  _tree(x, z, s = 1) {
    const trunk = new THREE.Mesh(this.unitCyl, this.matTrunk);
    trunk.scale.set(0.35 * s, 2.4 * s, 0.35 * s);
    trunk.position.set(x, 1.2 * s, z);
    this.group.add(trunk);
    const top = new THREE.Mesh(this.unitSphere, this.matLeaf);
    top.scale.set(2.2 * s, 2.6 * s, 2.2 * s);
    top.position.set(x, 3.4 * s, z);
    this.group.add(top);
    this._addCollider(x, z, 0.5, 0.5);
  }

  _blocks() {
    const rng = this.rng;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const cx = WORLD.blockCenter(i);
        const cz = WORLD.blockCenter(j);
        // Sidewalk slab under every block.
        const slab = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.block + 2, WORLD.block + 2), this.matSidewalk);
        slab.rotation.x = -Math.PI / 2;
        slab.position.set(cx, 0.005, cz);
        this.group.add(slab);
        if (i === 7 && j === 7) { this._port(cx, cz); continue; }
        if ((i === 1 && j === 5) || (i === 5 && j === 1)) { this._park(cx, cz, rng); continue; }
        if (i === 3 && j === 1) { this._hospital(cx, cz); continue; }
        // 2x2 lots, each may hold a building.
        for (const [ox, oz] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) {
          if (rng.next() < 0.18) continue; // empty lot / plaza
          const w = rng.range(11, 17);
          const d = rng.range(11, 17);
          const h = rng.range(9, 40);
          this._building(cx + ox, cz + oz, w, d, h, rng.int(0, 1), rng.int(0, 6));
        }
      }
    }
  }

  _hospital(cx, cz) {
    // White building with a red cross on the roof.
    const side = new THREE.MeshLambertMaterial({ color: 0xf0f0ea });
    const top = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const mesh = new THREE.Mesh(this.unitBox, [side, side, top, top, side, side]);
    mesh.scale.set(26, 14, 20);
    mesh.position.set(cx, 7, cz);
    this.group.add(mesh);
    this.solids.push(mesh);
    const red = new THREE.MeshLambertMaterial({ color: 0xd21f2b });
    this._box(8, 1, 2.4, red, cx, 14.6, cz);
    this._box(2.4, 1, 8, red, cx, 14.6, cz);
    this._addCollider(cx, cz, 13, 10);
  }

  _park(cx, cz, rng) {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.block, WORLD.block), this.matGrass);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(cx, 0.01, cz);
    this.group.add(lawn);
    // Small pond.
    const pond = new THREE.Mesh(new THREE.CircleGeometry(6, 20), this.matOcean);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(cx + 8, 0.02, cz + 6);
    this.group.add(pond);
    for (let k = 0; k < 9; k++) {
      this._tree(cx + rng.range(-16, 16), cz + rng.range(-16, 16), rng.range(0.8, 1.3));
    }
  }

  _port(cx, cz) {
    // Concrete yard, stacked containers, two cranes, open space for the van.
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.block + 2, WORLD.block + 2), this.matConcrete);
    yard.rotation.x = -Math.PI / 2;
    yard.position.set(cx, 0.01, cz);
    this.group.add(yard);
    const rng = this.rng;
    const contColors = [0xb0402e, 0x2e6fb0, 0xc2a23a, 0x3a8a4a, 0x7a4a9a];
    for (let k = 0; k < 7; k++) {
      const w = 12, h = 2.6, d = 2.6;
      const x = cx + rng.range(-14, 14);
      const z = cz + rng.range(-16, 4);
      const mat = new THREE.MeshLambertMaterial({ color: contColors[k % contColors.length] });
      const stack = k % 3 === 0 ? 2 : 1;
      for (let s = 0; s < stack; s++) {
        const box = this._box(w, h, d, mat, x, h / 2 + s * h, z);
        this.solids.push(box);
      }
      this._addCollider(x, z, w / 2, d / 2);
    }
    // Two crane towers with arms.
    const craneMat = new THREE.MeshLambertMaterial({ color: 0xd8a020 });
    for (const [ox, oz] of [[-14, 14], [10, 16]]) {
      this._box(3, 22, 3, craneMat, cx + ox, 11, cz + oz);
      this._box(18, 2, 2, craneMat, cx + ox + 4, 21, cz + oz);
      this._addCollider(cx + ox, cz + oz, 1.8, 1.8);
    }
  }

  _beach() {
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.half * 2 + 60, 26), this.matSand);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, WORLD.beachZ + 12);
    this.group.add(sand);
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.half * 2 + 400, 380), this.matOcean);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -0.1, WORLD.oceanZ + 190);
    this.group.add(ocean);
    // Palms along the sand.
    const rng = this.rng;
    for (let k = 0; k < 14; k++) {
      const x = -200 + k * 30 + rng.range(-6, 6);
      const z = WORLD.beachZ + rng.range(3, 18);
      const trunk = new THREE.Mesh(this.unitCyl, this.matTrunk);
      trunk.scale.set(0.3, 5, 0.3);
      trunk.position.set(x, 2.5, z);
      trunk.rotation.z = rng.range(-0.12, 0.12);
      this.group.add(trunk);
      const top = new THREE.Mesh(this.unitSphere, this.matPalm);
      top.scale.set(3.2, 1.6, 3.2);
      top.position.set(x, 5.4, z);
      this.group.add(top);
      this._addCollider(x, z, 0.4, 0.4);
    }
  }

  _billboards() {
    // Bright ad boards on a few rooftops around the center.
    const ads = [
      { x: -26, z: -26, color: 0xff4fa3, text: 'SOLARA' },
      { x: 78, z: -26, color: 0x2e6fc2, text: 'BAY' },
      { x: -26, z: 78, color: 0xffd23c, text: 'MARTA' },
    ];
    for (const ad of ads) {
      const tex = canvasTexture(THREE, 256, 96, (g, w, h) => {
        g.fillStyle = '#' + ad.color.toString(16).padStart(6, '0');
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#ffffff';
        g.font = 'bold 52px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(ad.text, w / 2, h / 2);
      });
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 6),
        new THREE.MeshBasicMaterial({ map: tex }),
      );
      board.position.set(ad.x, 26, ad.z);
      board.rotation.y = Math.PI / 4;
      this.group.add(board);
      const post = new THREE.Mesh(this.unitBox, new THREE.MeshLambertMaterial({ color: 0x333333 }));
      post.scale.set(0.6, 8, 0.6);
      post.position.set(ad.x, 19, ad.z);
      this.group.add(post);
    }
  }

  _lamps() {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554400 });
    for (let i = 0; i < 9; i += 2) {
      const c = WORLD.roadCenter(i);
      for (const x of [-156, -52, 52, 156]) {
        const pole = new THREE.Mesh(this.unitCyl, poleMat);
        pole.scale.set(0.18, 6, 0.18);
        pole.position.set(x, 3, c + 6.5);
        this.group.add(pole);
        const head = new THREE.Mesh(this.unitBox, headMat);
        head.scale.set(1.2, 0.3, 0.5);
        head.position.set(x, 6.1, c + 6.5);
        this.group.add(head);
        this._addCollider(x, c + 6.5, 0.3, 0.3);
      }
    }
  }

  // A random point on a road near (x, z), for police spawns.
  roadPointNear(rng, x, z, radius = 90) {
    const roadIdx = [];
    for (let i = 0; i < 9; i++) roadIdx.push(WORLD.roadCenter(i));
    const along = rng.pick(roadIdx);
    const cross = rng.pick(roadIdx);
    if (rng.next() < 0.5) {
      return { x: clamp(along + rng.range(-radius, radius), -208, 208), z: cross };
    }
    return { x: cross, z: clamp(along + rng.range(-radius, radius), -208, 208) };
  }

  // Snap a point to the nearest road center line.
  nearestRoad(x, z) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < 9; i++) {
      const c = WORLD.roadCenter(i);
      const d1 = Math.abs(z - c);
      const d2 = Math.abs(x - c);
      if (d1 < bestD) { bestD = d1; best = { x, z: c }; }
      if (d2 < bestD) { bestD = d2; best = { x: c, z }; }
    }
    return best;
  }
}
