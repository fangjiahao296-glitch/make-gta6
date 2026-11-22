// Solara Bay — world: renderer, input, loop, state machine, wiring.
import * as THREE from 'three';
import { WORLD, PALETTE, WANTED, PLAYER } from './config.js';
import { makeRng, dist2d } from './util.js';
import { City } from './city.js';
import { Traffic } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { Wanted } from './wanted.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { SaveGame } from './save.js';
import { AudioEngine } from './audio.js';
import { ShotStager } from './shots.js';

export class World {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.seed = parseInt(params.get('seed') || '1', 10) || 1;
    this.shot = params.get('shot') || null;
    this.time = 0;
    this.state = 'title'; // title | playing | paused
    this.frame = 0;
    this.autosaveTimer = 0;
    this.rng = makeRng(this.seed);

    window.__gameReady = false;
    window.__gameError = null;
    window.addEventListener('error', (e) => { window.__gameError = String(e.message || e.error); });

    // Renderer / scene / camera.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('game-root').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.fog, 140, 460);
    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(90, 42, 150);

    // Lights.
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3f5a3a, 1.05);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
    sun.position.set(120, 180, 60);
    this.scene.add(sun);

    // Systems.
    this.city = new City(this.scene, this.seed);
    this.traffic = new Traffic(this.scene, this.city, this.seed);
    this.peds = new Pedestrians(this.scene, this.city, this.seed);
    this.player = new Player(this.scene, 0, 26);
    this.combat = new Combat(this.scene, this.camera);
    this.wanted = new Wanted(this.scene, this.city, this.seed);
    this.hud = new HUD();
    this.missions = new Missions(this.scene, this);
    this.save = new SaveGame(this);
    this.audio = new AudioEngine();
    this.stager = new ShotStager(this);
    this.input = { keys: new Set() };

    this._bindInput();
    this._bindMenus();
    window.addEventListener('resize', () => this._resize());

    if (this.shot) {
      this.stager.stage(this.shot);
      if (this.shot === 'start') {
        // Cover shot: the title screen stays up over the orbiting city.
        document.getElementById('hud').classList.add('hidden');
      } else {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
      }
    } else {
      this._refreshContinueButton();
    }
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._loop());
  }

  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _bindInput() {
    const canvas = this.renderer.domElement;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      this.input.keys.add(e.code);
      if (e.code === 'KeyM') {
        this.audio.setMuted(!this.audio.muted);
      }
      if (e.code === 'KeyH' && this.state === 'playing') this.audio.horn();
      if (e.code === 'KeyE' && this.state === 'playing') this._toggleCar();
      if ((e.code === 'KeyP') && this.state === 'playing') this._pause();
      else if ((e.code === 'KeyP') && this.state === 'paused') this._resume();
      if (this.state === 'playing') { this.audio.ensure(); this.audio.startMusic(); }
    });
    window.addEventListener('keyup', (e) => this.input.keys.delete(e.code));
    window.addEventListener('blur', () => this.input.keys.clear());
    canvas.addEventListener('click', () => {
      if (this.state !== 'playing') return;
      this.audio.ensure();
      this.audio.startMusic();
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas && this.state === 'playing') {
        this.player.look(e.movementX || 0, e.movementY || 0);
      }
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== canvas && this.state === 'playing' && !this.shot) {
        this._pause();
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.state !== 'playing') return;
      if (this.player.inCar) return;
      const hit = this.combat.firePlayer(this.camera.position, this.city.solids);
      if (hit) {
        this.audio.shot();
        this.peds.scare(this.player.pos.x, this.player.pos.z, 30);
        this.wanted.addHeat(4);
        const shooter = [...this.missions.guards, ...this.wanted.footCops].find((s) => s === hit);
        if (shooter) {
          const killed = shooter.damage(34);
          this.audio.hit();
          if (killed) {
            this.combat.unregisterTarget(shooter.mesh);
            if (shooter.kind === 'cop') this.wanted.addHeat(WANTED.killHeat);
          }
        }
      } else {
        this.audio.shot();
        this.peds.scare(this.player.pos.x, this.player.pos.z, 30);
        this.wanted.addHeat(2);
      }
    });
  }

  _bindMenus() {
    const $ = (id) => document.getElementById(id);
    $('btn-new').addEventListener('click', () => {
      this.save.clear();
      this.player.cash = 0;
      this.missions.index = 0;
      this.missions.done = 0;
      this._startPlay();
      this.missions.startStory();
    });
    $('btn-continue').addEventListener('click', () => {
      const data = this.save.load();
      if (data) this.save.apply(data);
      this._startPlay();
    });
    $('btn-resume').addEventListener('click', () => this._resume());
    $('btn-restart').addEventListener('click', () => {
      this.save.clear();
      location.reload();
    });
    $('btn-quit').addEventListener('click', () => {
      this._toTitle();
    });
    $('btn-mute').addEventListener('click', () => {
      this.audio.setMuted(!this.audio.muted);
      $('btn-mute').textContent = this.audio.muted ? 'Unmute (M)' : 'Mute (M)';
    });
  }

  _refreshContinueButton() {
    const btn = document.getElementById('btn-continue');
    btn.style.display = this.save.hasSave() ? 'inline-block' : 'none';
  }

  _startPlay() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.state = 'playing';
    this.audio.ensure();
    this.audio.startMusic();
  }

  _pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.exitPointerLock?.();
    document.getElementById('pause-menu').classList.remove('hidden');
  }

  _resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    document.getElementById('pause-menu').classList.add('hidden');
  }

  _toTitle() {
    this.state = 'title';
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    this.player.mesh.visible = true;
    this._refreshContinueButton();
  }

  _toggleCar() {
    const p = this.player;
    if (p.inCar) {
      // Exit: step out to the side of the car.
      const car = p.inCar;
      car.speed = 0;
      const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
      p.pos.set(car.pos.x + side.x * 2.8, 0, car.pos.z + side.z * 2.8);
      p.inCar = null;
      p.mesh.visible = true;
      p.mesh.position.copy(p.pos);
      p.camYaw = car.heading + Math.PI;
      return;
    }
    // Enter: nearest stealable car, or the mission van once guards are down.
    const candidates = [...this.traffic.parked, ...this.traffic.cars];
    if (this.missions.van && this.missions.guards.every((g) => !g.alive)) {
      candidates.push(this.missions.van);
    }
    let best = null;
    let bestD = 4.5;
    for (const car of candidates) {
      const d = dist2d(p.pos.x, p.pos.z, car.pos.x, car.pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return;
    if (best.isParked) this.traffic.removeParked(best);
    if (best.isTraffic) {
      const i = this.traffic.cars.indexOf(best);
      if (i >= 0) this.traffic.cars.splice(i, 1);
    }
    p.inCar = best;
    p.mesh.visible = false;
    p.driveYawOffset = 0;
    this.audio.blip(180, 320, 0.18, 'triangle', 0.2);
    // Stealing in front of witnesses draws heat.
    const witnessed = this.peds.witnessed(p.pos.x, p.pos.z, 30)
      || this.wanted.policeCars.some((c) => dist2d(c.pos.x, c.pos.z, p.pos.x, p.pos.z) < 40)
      || this.wanted.footCops.some((c) => c.alive && dist2d(c.pos.x, c.pos.z, p.pos.x, p.pos.z) < 30);
    if (witnessed && !best.isVan) this.wanted.addHeat(WANTED.stealHeat);
  }

  _loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.frame++;

    if (this.state === 'title') {
      // Attract mode: slow orbit over the city, traffic and pedestrians alive.
      const a = this.time * 0.05;
      this.camera.position.set(Math.sin(a) * 150, 55, Math.cos(a) * 150);
      this.camera.lookAt(0, 6, 0);
      this.traffic.update(dt, this.city.colliders);
      this.peds.update(dt, this.city.colliders);
    } else if (this.state === 'playing') {
      this._updatePlaying(dt);
    }
    // Paused: render the frozen frame.

    this.renderer.render(this.scene, this.camera);
    if (this.frame === 3) window.__gameReady = true;
  }

  _updatePlaying(dt) {
    const p = this.player;
    const keys = this.input.keys;
    // In screenshot mode the staged drive scene plays itself: the driver
    // holds the throttle. (The chase scene's player stands still so the
    // closing police car stays in frame.)
    if (this.shot === 'drive' && p.inCar) keys.add('KeyW');
    if (p.inCar) {
      p.inCar.drive(dt, {
        fwd: keys.has('KeyW') || keys.has('ArrowUp'),
        back: keys.has('KeyS') || keys.has('ArrowDown'),
        left: keys.has('KeyA') || keys.has('ArrowLeft'),
        right: keys.has('KeyD') || keys.has('ArrowRight'),
        handbrake: keys.has('Space'),
      }, this.city.colliders);
      // Car vs traffic: simple push apart.
      for (const other of this.traffic.cars) {
        const d = dist2d(p.inCar.pos.x, p.inCar.pos.z, other.pos.x, other.pos.z);
        if (d < 4.4 && d > 0.01) {
          const push = (4.4 - d) / 2;
          const nx = (p.inCar.pos.x - other.pos.x) / d;
          const nz = (p.inCar.pos.z - other.pos.z) / d;
          p.inCar.pos.x += nx * push;
          p.inCar.pos.z += nz * push;
          other.pos.x -= nx * push;
          other.pos.z -= nz * push;
        }
      }
    } else {
      p.update(dt, this.input, this.city.colliders, this.time);
    }
    // In screenshot mode the camera stays exactly where the scene staged it,
    // except for the drive shot, where the chase camera follows the car.
    if (!this.shot || this.shot === 'drive') p.updateCamera(this.camera, dt);
    this.traffic.update(dt, this.city.colliders);
    this.peds.update(dt, this.city.colliders);
    this.combat.tick(dt);

    // Guards shoot back.
    const target = p.inCar ? p.inCar.pos : p.pos;
    for (const g of this.missions.guards) {
      if (!g.alive) continue;
      const fired = g.update(dt, target, this);
      if (fired) {
        const hit = this.combat.fireEnemy(g.pos, target, 0.4);
        if (hit && !this.shot) {
          const dead = p.damage(9, this.time);
          this.hud.flashDamage();
          this.audio.hit();
          if (dead) this._wasted();
        }
      }
    }
    // In the harbor shot, keep a fresh tracer in the air for the photo.
    if (this.shot === 'mission') {
      this.shotFxTimer = (this.shotFxTimer || 0) - dt;
      if (this.shotFxTimer <= 0) {
        this.shotFxTimer = 0.3;
        const g = this.missions.guards.find((x) => x.alive);
        if (g) {
          const from = new THREE.Vector3(p.pos.x, 1.5, p.pos.z);
          const to = new THREE.Vector3(g.pos.x, 1.2, g.pos.z);
          this.combat._tracer(from, to);
        }
      }
    }

    // Wanted system.
    const events = this.wanted.update(dt, this);
    if (events.rammed && !this.shot) {
      const dead = p.damage(6, this.time);
      this.hud.flashDamage();
      if (dead) this._wasted();
    }
    if (events.shotPlayer && !this.shot) {
      const dead = p.damage(9, this.time);
      this.hud.flashDamage();
      this.audio.hit();
      if (dead) this._wasted();
    }
    if (events.busted && !this.shot) this._busted();

    this.missions.update(dt, this);
    this.hud.update(this);
    this.audio.engine(p.inCar ? Math.abs(p.inCar.speed) / 36 : 0, !!p.inCar);
    this.audio.siren(this.wanted.sirenOn);

    // Autosave every 10 seconds.
    this.autosaveTimer += dt;
    if (this.autosaveTimer > 10) {
      this.autosaveTimer = 0;
      this.save.save();
    }
  }

  _applyFine() {
    const p = this.player;
    p.cash = Math.max(0, p.cash - WANTED.fine);
    p.inCar = null;
    p.mesh.visible = true;
    p.respawn(this.city.hospitalPos.x, this.city.hospitalPos.z);
    this.wanted.clear();
    // Restart the current mission cleanly.
    if (!this.missions.finished && this.missions.phase === 'active') {
      this.missions._setup(this.missions.index);
    }
    this.save.save();
  }

  _busted() {
    this.hud.showStory('Busted', `The cops caught up with you. $${WANTED.fine} bail — you wake up at the hospital.`);
    this.audio.busted();
    this._applyFine();
  }

  _wasted() {
    this.hud.showStory('Wasted', `You went down. The hospital patched you up for $${WANTED.fine}.`);
    this.audio.busted();
    this._applyFine();
  }
}
