// Solara Bay: a sun-soaked coastal city, all original. Every name, place and
// character below is invented for this game; nothing comes from Rockstar or GTA.
export const STEP = 1 / 60;
export const SAVE_KEY = 'solara-bay-save-v1';
export const GAME_TITLE = 'SOLARA BAY';
export const GAME_SUBTITLE = 'A sun-soaked getaway';

// City grid: roads run on a square lattice, buildings fill the blocks between.
export const CITY = {
  pitch: 58, // road centre to road centre
  roadWidth: 14,
  roadHalf: 7,
  lane: 3.5, // right-hand lane offset from a road centre line
  blocks: 8, // blocks across (road indices -4..4)
  ground: 620, // ground plane size
  beachZ: 250, // sand starts here (south edge, +z)
  waterZ: 288, // water starts here
};

export const PLAYER = {
  radius: 0.55,
  walkSpeed: 5.2,
  runSpeed: 9.0,
  accel: 40,
  jumpSpeed: 7.5,
  gravity: 22,
  health: 100,
};

export const CAR = {
  length: 4.4,
  width: 2.0,
  maxSpeed: 34,
  accel: 16,
  brake: 30,
  reverseMax: 10,
  steer: 0.55,
  grip: 6.5,
};

// Original vehicle names (no real-world or GTA names).
export const CAR_NAMES = ['Brisa', 'Flecha', 'Tortuga', 'Camino', 'Vela', 'Solano', 'Coral', 'Duna'];
export const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8b93a, 0x3aa655, 0x7a4fd0, 0xd97b2e, 0xdddddd, 0x222831, 0x0f766e, 0xb03a5b];
export const PED_COLORS = [0xe8b93a, 0x3aa655, 0xc25a7a, 0x4f7ad0, 0xd97b2e, 0x8a6fd0, 0xdddddd, 0x2e6f5a, 0xb03a5b, 0x5a8a2e];

export const WANTED_MAX = 5;
export const POLICE_CHASE_SPEED = 26;

// Cash pickups scattered around the city (respawn after a minute).
export const CASH_SPOTS = [
  [30, -90], [-80, 30], [145, 30], [-145, -90], [90, 145], [-30, -145],
  [200, -30], [-200, 90], [30, 200], [-90, -200], [175, -175], [-175, 175],
];

// The story: Leo Marin, a getaway driver, owes a debt to Marta Solis and works it
// off job by job for her crew. Each mission pays cash; finish all five to clear it.
export const STORY_INTRO =
  'Leo Marin owes Marta Solis one last debt. Five jobs, one city, and a crew ' +
  'that only trusts drivers who finish what they start. Pay it off, and Solara Bay is yours.';

export const MISSIONS = [
  {
    id: 1,
    name: 'First Wheels',
    intro: 'Benny needs a car, and the one parked by the plaza will do. Take it — nobody is watching. Yet.',
    payout: 500,
    steps: [
      { type: 'steal', text: 'Steal the marked sedan by the plaza', at: [40, 30], radius: 6 },
      { type: 'goto', text: "Drive it to Benny's garage", at: [116, -58], radius: 8 },
    ],
  },
  {
    id: 2,
    name: 'The Pickup',
    intro: 'A package is waiting at the marina dock. Grab it on foot, get back in the car, and take it to Marta\'s cafe. No detours.',
    payout: 800,
    steps: [
      { type: 'goto', text: 'Drive to the marina dock', at: [174, 232], radius: 8 },
      { type: 'grab', text: 'Get out and grab the package', at: [174, 232], radius: 5 },
      { type: 'goto', text: "Deliver it to Marta's cafe", at: [-174, 58], radius: 8 },
    ],
  },
  {
    id: 3,
    name: 'Hot Pursuit',
    intro: 'Somebody talked. The whole Solara Bay force is rolling. Lose them — or reach the hideout and lay low.',
    payout: 1200,
    steps: [
      { type: 'survive', text: 'Lose the cops: stay unseen for 20 seconds, or reach the hideout', at: [-203, -203], radius: 9, seconds: 20 },
    ],
  },
  {
    id: 4,
    name: 'The Getaway',
    intro: 'A client needs a driver who knows every shortcut. Four checkpoints, one hundred seconds. Do not be late.',
    payout: 1500,
    steps: [
      { type: 'checkpoints', text: 'Hit all 4 checkpoints before the clock runs out', seconds: 100,
        points: [[-174, -174], [174, -174], [174, 174], [-174, 174]] },
    ],
  },
  {
    id: 5,
    name: 'Harbor Heist',
    intro: 'The last job. An armored van sits at the harbor under guard. Take out the guards, take the van, and bring it to the warehouse. Then you are free.',
    payout: 5000,
    steps: [
      { type: 'goto', text: 'Drive to the harbor', at: [203, 203], radius: 9 },
      { type: 'shootout', text: 'Take out the harbor guards (4)', at: [203, 203], radius: 26 },
      { type: 'steal', text: 'Steal the armored van', at: [215, 215], radius: 7 },
      { type: 'goto', text: 'Deliver the van to the warehouse', at: [-203, 174], radius: 9 },
    ],
  },
];

export const SAFEHOUSE = { x: 0, z: -20 };
export const HOSPITAL = { x: 58, z: -174 };
export const GARAGE = { x: 116, z: -58 };
export const MARINA = { x: 174, z: 232 };
export const CAFE = { x: -174, z: 58 };
export const HIDEOUT = { x: -203, z: -203 };
export const HARBOR = { x: 203, z: 203 };
export const WAREHOUSE = { x: -203, z: 174 };
