// Keyboard and mouse: arrows/WASD pitch and bank, Shift/Ctrl throttle,
// Space to start, C camera, P pause, M mute, R restart. The mouse steers
// too — hold the left button and the plane follows the pointer.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CAMERA = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseSeen = false;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    if (event.key === ' ' || event.key === 'Enter') actions |= ACTION_CONFIRM;
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') actions |= ACTION_PAUSE;
    if (event.key === 'c' || event.key === 'C') actions |= ACTION_CAMERA;
    if (event.key === 'm' || event.key === 'M') actions |= ACTION_MUTE;
    if (event.key === 'r' || event.key === 'R') actions |= ACTION_RESTART;
  }
  function onKeyUp(event) {
    keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / rect.width - 0.5;
    mouseY = (event.clientY - rect.top) / rect.height - 0.5;
    mouseSeen = true;
  }
  function onMouseDown(event) {
    mouseDown = true;
    onMouseMove(event);
  }
  function onMouseUp() {
    mouseDown = false;
  }
  function onClick() {
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('click', onClick);

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  /** Steering for this frame: -1..1 pitch (up positive), bank and throttle. */
  function control() {
    let pitch = 0;
    let bank = 0;
    let throttle = 0;
    if (keys.has('ArrowUp') || keys.has('w')) pitch += 1;
    if (keys.has('ArrowDown') || keys.has('s')) pitch -= 1;
    if (keys.has('ArrowLeft') || keys.has('a')) bank -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) bank += 1;
    if (keys.has('Shift')) throttle += 0.9;
    if (keys.has('Control')) throttle -= 0.9;
    // Mouse steering while the button is held: pointer offset is the stick.
    if (mouseDown && mouseSeen) {
      bank = Math.max(-1, Math.min(1, mouseX * 2.4));
      pitch = Math.max(-1, Math.min(1, -mouseY * 2.4));
    }
    return { pitch, bank, throttle };
  }

  return { takeActions, control };
}
