// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. Screens: title, play, paused, busted, wasted.
//
// ?seed=N fixes the city and traffic. ?shot=start|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it a few
// times and sets window.__shotReady for a screenshot.
import { STEP, GAME_TITLE, GAME_SUBTITLE, STORY_INTRO } from './config.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { createAudio } from './audio.js';
import { createWorld, loadSave } from './world.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();
const saved = loadSave();
const world = createWorld(canvas, input, audio, seed, saved);
const state = world.state;

// Test hook: lets a playtest script read money, missions, wanted and position.
window.__solara = { state, world };

function $(id) {
  return document.getElementById(id);
}

function show(id, on) {
  $(id).classList.toggle('hidden', !on);
}

function announce(message) {
  status.textContent = message;
}

function syncOverlays() {
  show('title-screen', state.screen === 'title');
  show('pause-screen', state.screen === 'paused');
  const end = state.screen === 'busted' || state.screen === 'wasted';
  show('end-screen', end);
  if (state.screen === 'busted') {
    $('end-title').textContent = 'BUSTED';
    $('end-text').textContent = 'The Solara Bay force caught up with you. $200 fine, and a night in the cells.';
  } else if (state.screen === 'wasted') {
    $('end-title').textContent = 'WASTED';
    $('end-text').textContent = 'You went down in Solara Bay. The hospital patched you up — minus $200.';
  }
  show('hud', state.screen === 'play');
  if (state.screen === 'title') {
    // Re-read the save: a run that ended earlier this session may have
    // written a newer save than the one read at boot.
    const current = loadSave();
    show('btn-continue', !!current);
    show('title-save', !!current);
    if (current) $('title-save').textContent = `Continue — $${current.money.toLocaleString('en-US')}, job ${current.missionIndex + 1} of 5`;
  }
}

function startRun(fresh) {
  audio.unlock();
  audio.startMusic();
  world.resetRun(fresh);
  state.screen = 'play';
  state.hud.hideStory();
  syncOverlays();
  announce(`Playing. ${fresh ? 'New game.' : 'Continued.'}`);
}

$('btn-new').addEventListener('click', () => {
  audio.click();
  startRun(true);
});
$('btn-continue').addEventListener('click', () => {
  audio.click();
  startRun(false);
});
$('btn-how').addEventListener('click', () => {
  audio.click();
  $('how-panel').classList.toggle('hidden');
});
$('btn-resume').addEventListener('click', () => {
  audio.click();
  state.screen = 'play';
  syncOverlays();
});
$('btn-mute').addEventListener('click', () => {
  audio.setMuted(!audio.isMuted());
  $('btn-mute').textContent = audio.isMuted() ? 'Sound: off' : 'Sound: on';
});
$('btn-quit-title').addEventListener('click', () => {
  audio.click();
  state.saveNow();
  state.screen = 'title';
  syncOverlays();
});
$('btn-respawn').addEventListener('click', () => {
  audio.click();
  world.state.respawn();
  syncOverlays();
  announce('Back on the streets.');
});
$('btn-end-quit').addEventListener('click', () => {
  audio.click();
  state.screen = 'title';
  syncOverlays();
});
$('story-close').addEventListener('click', () => {
  state.hud.hideStory();
});

function runShot(name) {
  stageShot(name, world);
  syncOverlays();
  let painted = 0;
  function paint() {
    world.renderOnce();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const actions = input.takeActions();
    const look = input.takeLook();
    if (state.screen === 'play' && (actions & ACTION_PAUSE)) {
      state.screen = 'paused';
      input.releasePointer();
      audio.engine(0);
      audio.skid(false);
      announce('Paused.');
    } else if (state.screen === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      state.screen = 'play';
      announce('Playing.');
    } else if (state.screen === 'title' && (actions & ACTION_CONFIRM)) {
      startRun(!loadSave());
    }
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (state.screen !== 'paused') {
      let first = true;
      while (accumulator >= STEP) {
        world.update(STEP, first ? actions : 0, first ? look : { dx: 0, dy: 0 });
        accumulator -= STEP;
        first = false;
        if (state.screen !== 'play' && state.screen !== 'title') break;
      }
    } else {
      accumulator = 0;
    }
    syncOverlays();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') {
      state.screen = 'paused';
      input.releasePointer();
      announce('Paused.');
    }
  });

  $('title-name').textContent = GAME_TITLE;
  $('title-sub').textContent = GAME_SUBTITLE;
  $('title-story').textContent = STORY_INTRO;
  announce(`${GAME_TITLE}. Press Enter or click New Game to start.`);
  syncOverlays();
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
