// Solara Bay — small helpers: seeded random, math, collision, canvas textures.
// Everything here is pure: no DOM access except canvasTexture, no game state.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => Math.floor(a + next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
// Frame-rate independent smoothing: damp(current, target, rate, dt)
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
// Shortest-arc angle lerp
export function dampAngle(a, b, rate, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-rate * dt));
}
export function angleDiff(a, b) {
  return ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// Push a circle (x, z, radius) out of axis-aligned boxes. Mutates pos {x, z}.
export function resolveCircle(pos, radius, boxes) {
  for (const b of boxes) {
    const cx = clamp(pos.x, b.minX, b.maxX);
    const cz = clamp(pos.z, b.minZ, b.maxZ);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // Center inside the box: push out along the smallest penetration axis.
        const pushL = pos.x - b.minX + radius;
        const pushR = b.maxX - pos.x + radius;
        const pushT = pos.z - b.minZ + radius;
        const pushB = b.maxZ - pos.z + radius;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) pos.x = b.minX - radius;
        else if (m === pushR) pos.x = b.maxX + radius;
        else if (m === pushT) pos.z = b.minZ - radius;
        else pos.z = b.maxZ + radius;
      }
    }
  }
}

export function pointInBox(x, z, b, pad = 0) {
  return x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad;
}

// Build a THREE.CanvasTexture from a draw callback (no external images).
export function canvasTexture(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
