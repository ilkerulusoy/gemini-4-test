export class InputManager {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.virtualMove = { x: 0, y: 0 };
    this.cameraDelta = { x: 0, y: 0 };
    this.isPointerDragging = false;
    this.cameraPointerId = null;
    this.lastPointer = { x: 0, y: 0 };

    this.bindEvents();
  }

  bindEvents() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (!this.keys.has(code)) {
        this.justPressed.add(code);
      }
      this.keys.add(code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        if (document.activeElement === document.body || document.activeElement?.tagName === 'CANVAS') {
          e.preventDefault();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.justPressed.clear();
      this.virtualMove = { x: 0, y: 0 };
      this.isPointerDragging = false;
      this.cameraPointerId = null;
    });
  }

  bindCanvasLook(canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      if (e.target !== canvas) return;
      if ((e.button === 0 || e.button === 2) && this.cameraPointerId === null) {
        this.isPointerDragging = true;
        this.cameraPointerId = e.pointerId;
        this.lastPointer.x = e.clientX;
        this.lastPointer.y = e.clientY;
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.cameraDelta.x += e.movementX;
        this.cameraDelta.y += e.movementY;
        return;
      }
      if (!this.isPointerDragging || e.pointerId !== this.cameraPointerId) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer.x = e.clientX;
      this.lastPointer.y = e.clientY;
      this.cameraDelta.x += dx;
      this.cameraDelta.y += dy;
    });

    const releaseCameraPointer = (e) => {
      if (e.pointerId === this.cameraPointerId) {
        this.isPointerDragging = false;
        this.cameraPointerId = null;
      }
    };
    window.addEventListener('pointerup', releaseCameraPointer);
    window.addEventListener('pointercancel', releaseCameraPointer);
  }
  triggerAction(code, holdMs = 260) {
    this.justPressed.add(code);
    this.keys.add(code);
    setTimeout(() => {
      this.keys.delete(code);
    }, holdMs);
  }

  isJumpHeld() {
    return this.keys.has('Space') || this.keys.has('KeyK');
  }
  getMoveVector() {
    let x = this.virtualMove.x;
    let z = this.virtualMove.y;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;

    // Gamepad support
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const gp = navigator.getGamepads()[0];
      if (gp) {
        if (Math.abs(gp.axes[0]) > 0.18) x += gp.axes[0];
        if (Math.abs(gp.axes[1]) > 0.18) z += gp.axes[1];
        if (Math.abs(gp.axes[2]) > 0.18) this.cameraDelta.x += gp.axes[2] * 10;
        if (Math.abs(gp.axes[3]) > 0.18) this.cameraDelta.y += gp.axes[3] * 8;
      }
    }

    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  consumeJump() {
    return this.consumeAny(['Space', 'KeyK']);
  }

  consumeDive() {
    return this.consumeAny(['ShiftLeft', 'ShiftRight', 'KeyE']);
  }

  consumeGroundPound() {
    return this.consumeAny(['KeyQ', 'ControlLeft', 'KeyC']);
  }

  consumeAttack() {
    return this.consumeAny(['KeyF', 'KeyJ', 'Enter']);
  }

  consumeInteract() {
    return this.consumeAny(['KeyE', 'KeyF', 'Enter']);
  }

  consumeGrab() {
    return this.consumeAny(['KeyR', 'KeyG']);
  }

  consumePause() {
    return this.consumeAny(['Escape', 'KeyP']);
  }

  consumeAny(codes) {
    for (const c of codes) {
      if (this.justPressed.has(c)) {
        this.justPressed.delete(c);
        return true;
      }
    }
    return false;
  }

  consumeCameraDelta() {
    let dx = this.cameraDelta.x;
    let dy = this.cameraDelta.y;
    if (this.keys.has('KeyQ')) dx -= 0; // Q is ground pound; use [ and ] or mouse for camera
    if (this.keys.has('BracketLeft')) dx -= 18;
    if (this.keys.has('BracketRight')) dx += 18;
    this.cameraDelta.x = 0;
    this.cameraDelta.y = 0;
    return { x: dx, y: dy };
  }

  endFrame() {
    this.justPressed.clear();
  }
}
