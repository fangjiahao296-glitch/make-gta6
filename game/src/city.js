// Builds Solara Bay: a ground plane painted with roads, sidewalks and crosswalks,
// procedural buildings with lit windows, palms, lamps, billboards and the ocean.
// Everything is generated at runtime from canvas textures: no image files.
import * as THREE from 'three';
import { CITY } from './config.js';

const BUILDING_COLORS = [0xe8dcc8, 0xd9a05b, 0xc96f4a, 0x7fb3a3, 0xe6b8a2, 0xf2e8d5, 0x9db8c4, 0xd97b6c, 0xc4b49a, 0x8fb8a8];
const BILLBOARDS = ['SOLARA', 'CAFE MAR', 'HOTEL BRISA', 'TACOS EL FARO', 'CINE SOL', 'SURF SHOP'];

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

// The ground: sidewalk grey, asphalt road grid, lane dashes, crosswalks, sand beach.
function makeGroundTexture() {
  const size = 1024;
  const scale = size / CITY.ground; // px per metre
  const toPx = (v) => (v + CITY.ground / 2) * scale;
  return canvasTexture(size, size, (g) => {
    g.fillStyle = '#8f9598';
    g.fillRect(0, 0, size, size);
    // Beach strip at the south edge.
    g.fillStyle = '#e3c98f';
    g.fillRect(0, toPx(CITY.beachZ), size, size - toPx(CITY.beachZ));
    // Asphalt roads.
    g.fillStyle = '#33373c';
    const half = (CITY.roadWidth / 2) * scale;
    for (let k = -4; k <= 4; k += 1) {
      const c = toPx(k * CITY.pitch);
      g.fillRect(0, c - half, size, half * 2);
      g.fillRect(c - half, 0, half * 2, size);
    }
    // Lane dashes and crosswalks.
    g.fillStyle = '#e8c33a';
    for (let k = -4; k <= 4; k += 1) {
      const c = toPx(k * CITY.pitch);
      for (let d = -CITY.ground / 2 + 8; d < CITY.ground / 2 - 8; d += 16) {
        g.fillRect(toPx(d), c - 1, 8 * scale, 2);
        g.fillRect(c - 1, toPx(d), 2, 8 * scale);
      }
    }
    g.fillStyle = '#e8e8e8';
    for (let i = -4; i <= 4; i += 1) {
      for (let j = -4; j <= 4; j += 1) {
        const cx = toPx(i * CITY.pitch);
        const cz = toPx(j * CITY.pitch);
        for (let s = -3; s <= 3; s += 1) {
          g.fillRect(cx + s * 2.2 * scale - 1.5, cz - half + 1, 3, half * 2 - 2);
          g.fillRect(cx - half + 1, cz + s * 2.2 * scale - 1.5, half * 2 - 2, 3);
        }
      }
    }
    // Block tint variation so the grid reads from above.
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = -4; i < 4; i += 1) {
      for (let j = -4; j < 4; j += 1) {
        if ((i + j) % 2 === 0) {
          g.fillRect(toPx(i * CITY.pitch + CITY.roadHalf), toPx(j * CITY.pitch + CITY.roadHalf),
            (CITY.pitch - CITY.roadWidth) * scale, (CITY.pitch - CITY.roadWidth) * scale);
        }
      }
    }
  });
}

// A lit-window facade, drawn once and shared by many buildings.
function makeFacadeTexture(base, litRatio) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 12;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const lit = Math.random() < litRatio;
        g.fillStyle = lit ? '#ffd98a' : '#2c3a4a';
        g.fillRect(8 + c * 20, 10 + r * 20, 12, 13);
      }
    }
  });
}

function makeOceanTexture() {
  const texture = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#1e7fa8';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 3;
    for (let i = 0; i < 24; i += 1) {
      const y = 8 + i * 11;
      g.beginPath();
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.1 + i) * 3);
      g.stroke();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  return texture;
}

function makeBillboardTexture(word) {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#20242c';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ff5a7a';
    g.lineWidth = 6;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#ffd98a';
    g.font = 'bold 34px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(word, w / 2, h / 2);
  });
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.ground, CITY.ground),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Ocean to the south, animated by scrolling its texture.
  const oceanTexture = makeOceanTexture();
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.ground + 200, 460),
    new THREE.MeshLambertMaterial({ map: oceanTexture }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.15, CITY.waterZ + 230);
  group.add(ocean);

  // Facade materials (shared).
  const facades = [
    makeFacadeTexture('#e8dcc8', 0.25),
    makeFacadeTexture('#d9a05b', 0.2),
    makeFacadeTexture('#7fb3a3', 0.3),
    makeFacadeTexture('#c96f4a', 0.2),
  ].map((map) => new THREE.MeshLambertMaterial({ map }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4440 });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 5, 6);
  const leafGeo = new THREE.ConeGeometry(1.6, 2.6, 5);
  const lampPoleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.5, 6);
  const lampHeadGeo = new THREE.SphereGeometry(0.35, 8, 6);

  const roadLines = [];
  for (let k = -4; k <= 4; k += 1) roadLines.push(k * CITY.pitch);

  function addBuilding(x, z, w, d, h, mat) {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(w + 0.6, 0.8, d + 0.6);
    roof.position.set(x, h + 0.4, z);
    group.add(roof);
    colliders.push({ x, z, hw: w / 2 + 0.3, hd: d / 2 + 0.3 });
    return mesh;
  }

  function addPalm(x, z) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2.5;
    trunk.castShadow = true;
    palm.add(trunk);
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.1, 5.2, Math.sin(a) * 1.1);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      palm.add(leaf);
    }
    palm.position.set(x, 0, z);
    group.add(palm);
  }

  function addLamp(x, z) {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(lampPoleGeo, lampMat);
    pole.position.y = 2.75;
    lamp.add(pole);
    const head = new THREE.Mesh(lampHeadGeo, new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffdf8a }));
    head.position.y = 5.6;
    lamp.add(head);
    lamp.position.set(x, 0, z);
    group.add(lamp);
  }

  // Buildings, parks and parking lots, one per block. Four blocks must stay
  // open ground: mission targets sit in them (the job-1 sedan at 29,29, the
  // harbor and its van at 203,203, the hideout at -203,-203, the warehouse at
  // -203,174). A random building here would bury the target inside a wall.
  const OPEN_BLOCKS = new Set(['29,29', '203,203', '-203,-203', '-203,174']);
  for (let i = -4; i < 4; i += 1) {
    for (let j = -4; j < 4; j += 1) {
      const cx = (i + 0.5) * CITY.pitch;
      const cz = (j + 0.5) * CITY.pitch;
      const roll = rng.next();
      const dist = Math.hypot(cx, cz);
      if (OPEN_BLOCKS.has(`${cx},${cz}`) || roll < 0.14) {
        // Park: palms and open ground.
        for (let p = 0; p < 5; p += 1) addPalm(cx + rng.range(-16, 16), cz + rng.range(-16, 16));
        continue;
      }
      if (roll < 0.26) {
        // Parking lot: flat, a few palms at the edge.
        addPalm(cx - 18, cz - 18);
        addPalm(cx + 18, cz + 18);
        continue;
      }
      const tall = 10 + rng.range(0, 18) + Math.max(0, (1 - dist / 330)) * 38;
      const mat = rng.pick(facades);
      if (rng.chance(0.35)) {
        // Two smaller buildings side by side.
        addBuilding(cx - 10, cz, 17, 30, tall * rng.range(0.5, 0.8), mat);
        addBuilding(cx + 11, cz, 15, 26, tall, rng.pick(facades));
      } else {
        addBuilding(cx, cz, rng.range(26, 36), rng.range(26, 36), tall, mat);
      }
      // A billboard on a few tall blocks.
      if (tall > 34 && rng.chance(0.3)) {
        const board = new THREE.Mesh(
          new THREE.PlaneGeometry(16, 8),
          new THREE.MeshBasicMaterial({ map: makeBillboardTexture(rng.pick(BILLBOARDS)) }),
        );
        board.position.set(cx, tall + 2, cz - 19);
        group.add(board);
      }
    }
  }

  // Palms and lamps along the roads.
  for (let k = -4; k <= 4; k += 1) {
    for (let s = -3; s <= 3; s += 1) {
      const at = s * CITY.pitch + CITY.pitch / 2;
      if (rng.chance(0.5)) addPalm(k * CITY.pitch + CITY.roadHalf + 2.5, at);
      if (rng.chance(0.35)) addLamp(k * CITY.pitch - CITY.roadHalf - 2.5, at + 12);
    }
  }

  // Distant skyline silhouettes beyond the north and west edges, for depth.
  const skyMat = new THREE.MeshLambertMaterial({ color: 0x6a7f92 });
  for (let i = 0; i < 26; i += 1) {
    const h = rng.range(20, 70);
    const w = rng.range(14, 26);
    const mesh = new THREE.Mesh(boxGeo, skyMat);
    const side = i % 2 === 0;
    mesh.scale.set(w, h, w);
    mesh.position.set(
      side ? rng.range(-320, 320) : (rng.chance(0.5) ? -320 : 320),
      h / 2,
      side ? -320 : rng.range(-320, 200),
    );
    group.add(mesh);
  }

  function randomRoadPoint() {
    const vertical = rng.chance(0.5);
    const line = rng.pick(roadLines);
    const along = rng.range(-232, 232);
    return vertical ? { x: line, z: along } : { x: along, z: line };
  }

  function nearestRoadPoint(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const line of roadLines) {
      const d1 = Math.abs(x - line);
      if (d1 < bestD) { bestD = d1; best = { x: line, z }; }
      const d2 = Math.abs(z - line);
      if (d2 < bestD) { bestD = d2; best = { x, z: line }; }
    }
    return best;
  }

  return {
    group,
    colliders,
    roadLines,
    randomRoadPoint,
    nearestRoadPoint,
    update(dt) {
      oceanTexture.offset.x += dt * 0.015;
      oceanTexture.offset.y += dt * 0.008;
    },
  };
}
