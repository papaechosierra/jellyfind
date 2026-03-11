export class UIManager {
  private counter = document.getElementById('counter')!;
  private status = document.getElementById('status')!;
  private caught = document.getElementById('caught')!;
  private win = document.getElementById('win')!;
  private floor = document.getElementById('floor-indicator')!;
  private alert = document.getElementById('alert-indicator')!;

  private caughtTimeout: ReturnType<typeof setTimeout> | null = null;
  private alertTimeout: ReturnType<typeof setTimeout> | null = null;

  update(collected: number, total: number, carrying: number): void {
    this.counter.textContent = `🫘 ${collected} / ${total}`;
    this.status.textContent = `Carry: ${carrying}`;
  }

  showCaught(): void {
    this.caught.style.display = 'block';
    if (this.caughtTimeout) clearTimeout(this.caughtTimeout);
    this.caughtTimeout = setTimeout(() => {
      this.caught.style.display = 'none';
    }, 2000);
  }

  showWin(): void {
    this.win.style.display = 'block';
  }

  setFloor(n: number): void {
    this.floor.textContent = `Floor ${n}`;
  }

  showAlert(): void {
    this.alert.style.display = 'block';
    if (this.alertTimeout) clearTimeout(this.alertTimeout);
    this.alertTimeout = setTimeout(() => {
      this.alert.style.display = 'none';
    }, 3000);
  }
}
