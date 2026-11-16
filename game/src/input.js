// Keyboard and mouse, read every frame. The world only ever sees this module's
// snapshot: axes, aim, firing, and one-shot actions the loop consumes.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_NOVA = 8;
export const ACTION_MUTE = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 640;
  let mouseY = 300;
  let mouseDown = false;
  let clicked = false;
  let clickX = 0;
  let clickY = 0;

  function press(action) {
    actions |= action;
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') press(ACTION_CONFIRM);
    if (event.code === 'KeyP' || event.code === 'Escape') press(ACTION_PAUSE);
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') press(ACTION_DASH);
    if (event.code === 'KeyE') press(ACTION_NOVA);
    if (event.code === 'KeyM') press(ACTION_MUTE);
    if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3') {
      press(ACTION_CONFIRM);
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function updateMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 1280;
    mouseY = ((event.clientY - rect.top) / rect.height) * 720;
  }

  function onMouseMove(event) {
    updateMouse(event);
  }

  function onMouseDown(event) {
    updateMouse(event);
    if (event.button === 0) {
      mouseDown = true;
      clicked = true;
      clickX = mouseX;
      clickY = mouseY;
    }
  }

  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }

  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  return {
    /** Movement axes in -1..1, from WASD or the arrow keys. */
    axes() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    aim() {
      return { x: mouseX, y: mouseY };
    },
    get firing() {
      return mouseDown;
    },
    /** The 1/2/3 key pressed this frame, or 0. */
    digit() {
      if (keys.has('Digit1')) return 1;
      if (keys.has('Digit2')) return 2;
      if (keys.has('Digit3')) return 3;
      return 0;
    },
    takeClick() {
      if (!clicked) return null;
      clicked = false;
      return { x: clickX, y: clickY };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
