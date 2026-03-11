export class InputManager {
  private keys: Map<string, boolean> = new Map();
  private _mouseDeltaX = 0;
  private _mouseDeltaY = 0;
  private _locked = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      this.keys.set(e.code, true);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false);
    });

    canvas.addEventListener('click', () => {
      canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this._locked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (this._locked) {
        this._mouseDeltaX += e.movementX;
        this._mouseDeltaY += e.movementY;
      }
    });
  }

  isDown(code: string): boolean {
    return this.keys.get(code) === true;
  }

  get mouseDeltaX(): number {
    const v = this._mouseDeltaX;
    this._mouseDeltaX = 0;
    return v;
  }

  get mouseDeltaY(): number {
    const v = this._mouseDeltaY;
    this._mouseDeltaY = 0;
    return v;
  }

  get isLocked(): boolean {
    return this._locked;
  }
}
