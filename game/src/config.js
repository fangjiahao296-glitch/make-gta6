// Solara Bay — shared constants. All original values for this entry.
export const WORLD = {
  block: 40,          // building block side (m)
  road: 12,           // road width (m)
  pitch: 52,          // block + road
  blocks: 8,          // 8 x 8 blocks
  half: 214,          // city half-extent (8*40 + 9*12 = 428)
  roadCenter: (i) => -208 + i * 52,
  blockCenter: (i) => -182 + i * 52,
  beachZ: 214,        // sand strip starts here
  oceanZ: 238,        // water starts here
};

export const PALETTE = {
  sky: 0x8ec7e8,
  fog: 0x9fc6e0,
  ground: 0x3f7a4e,
  road: 0x2e2f33,
  sidewalk: 0x9a9a94,
  sand: 0xdcc98f,
  ocean: 0x2b6ea6,
  concrete: 0x8d8d88,
  building: [0x7d8aa0, 0x9a8a7a, 0x6f7f6a, 0xa08a6a, 0x8a7a90, 0x5f7086, 0xb09a80],
  car: [0xc23b2e, 0x2e6fc2, 0xe0b93c, 0x3aa655, 0xdddddd, 0x222222, 0x7a4a9a, 0xd97a2b],
  glass: 0x9fc8e8,
};

export const PLAYER = {
  walkSpeed: 5.2,
  runSpeed: 9.5,
  jumpSpeed: 8.0,
  radius: 0.55,
  height: 1.8,
  health: 100,
  cameraDist: 7.5,
  cameraHeight: 3.2,
};

export const CAR = {
  accel: 15,
  brake: 26,
  maxSpeed: 36,
  maxReverse: 11,
  steer: 0.62,
  grip: 9.5,
  radius: 2.3,
  trafficSpeed: 9,
};

export const COMBAT = {
  pistolDamage: 34,
  pistolCooldown: 0.34,
  pistolRange: 90,
  guardHealth: 100,
  copHealth: 100,
  enemyDamage: 9,
  enemyInterval: 1.35,
  enemyAccuracy: 0.45,
  regenDelay: 5,
  regenRate: 9,
};

export const WANTED = {
  stealHeat: 34,
  shotHeat: 26,
  killHeat: 42,
  decayPerSec: 2.6, // heat cools a touch faster when the law loses sight of you
  // stars by heat thresholds
  thresholds: [10, 30, 50, 70, 90],
  bustDist: 3.2,
  bustTime: 2.6,
  fine: 200,
};

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    brief: "Marta needs a set of wheels. Steal the red sedan parked on Coral Row and bring it to the crew.",
    payout: 500,
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    brief: 'A package is waiting at the port. Drive to the beacon and hold position until the handoff is done.',
    payout: 1000,
  },
  {
    id: 'hot-pursuit',
    title: 'Hot Pursuit',
    brief: 'The cops are onto the crew. Burn through all three checkpoints with the law on your tail.',
    payout: 1500,
  },
  {
    id: 'the-getaway',
    title: 'The Getaway',
    brief: 'Lose the heat and reach the hideout on the north-west corner before the timer runs out.',
    payout: 2500,
  },
  {
    id: 'harbor-heist',
    title: 'Harbor Heist',
    brief: 'Four guards watch the armored van at the port. Clear them out, take the van, and deliver it to the drop.',
    payout: 5000,
  },
];

export const SAVE_KEY = 'solara-bay-save-v1';
export const GAME_VERSION = '1.0';
