// Keyboard and mouse input. WASD moves and drives, E enters and steals cars,
// Space jumps (on foot) or handbrakes (in a car), Shift runs, mouse steers the
// camera (click the canvas to lock the pointer), left click shoots.
export const ACTION_ENTER = 1;
export const ACTION_JUMP = 2;
export const ACTION_SHOOT = 4;
export const ACTION_PAUSE = 8;
export const ACTION_CONFIRM = 16;
export const ACTION_HORN = 32;
export const ACTION_MUTE = 64;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let spaceHeld = false;
  let locked = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    const name = KEYMAP[event.code];
    if (name) {
      keys.add(name);
      event.preventDefault();
    }
    if (event.code === 'KeyE') actions |= ACTION_ENTER;
    if (event.code === 'Space') {
      actions |= ACTION_JUMP;
      spaceHeld = true;
      event.preventDefault();
    }
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyH') actions |= ACTION_HORN;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
  }

  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name) keys.delete(name);
    if (event.code === 'Space') spaceHeld = false;
  }

  function onMouseMove(event) {
    if (document.pointerLockElement === canvas) {
      mouseDX += event.movementX || 0;
      mouseDY += event.movementY || 0;
    }
  }

  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      actions |= ACTION_SHOOT;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    }
  }

  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }

  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  function onBlur() {
    keys.clear();
    mouseDown = false;
    spaceHeld = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    // Held movement keys, as -1/0/1 pairs.
    move() {
      const x = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
      const y = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
      return { x, y, run: keys.has('run') };
    },
    // One-frame actions; calling this clears them.
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // Mouse look deltas since the last read, in pixels.
    takeLook() {
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0;
      mouseDY = 0;
      return { dx, dy };
    },
    isMouseDown() {
      return mouseDown;
    },
    // Space held down (handbrake while driving).
    isJumpHeld() {
      return spaceHeld;
    },
    isLocked() {
      return locked;
    },
    releasePointer() {
      if (document.pointerLockElement) document.exitPointerLock?.();
    },
  };
}
