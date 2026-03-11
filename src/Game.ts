import {
  Engine,
  Scene,
  Vector3,
  HavokPlugin,
  Color4,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  Color3,
} from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { InputManager } from './InputManager';
import { Player } from './Player';
import { Cat, CatState } from './Cat';
import { JellyBean } from './JellyBean';
import { buildLevel } from './Level';
import { UIManager } from './UIManager';

const enum GameState {
  START,
  PLAYING,
  CAUGHT,
  WIN,
}

const CAUGHT_RESPAWN_DELAY = 2.0;

export class Game {
  private engine: Engine;
  private scene!: Scene;
  private input!: InputManager;
  private player!: Player;
  private cats: Cat[] = [];
  private beans: JellyBean[] = [];
  private ui: UIManager;
  private state = GameState.START;
  private caughtTimer = 0;
  private respawnGraceTimer = 0;
  private spawnPos = new Vector3(0, 1, 0);
  private bagPos = new Vector3(0, 0.8, 0);
  private totalBeans = 0;
  private beansDeposited = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      adaptToDeviceRatio: true,
    });
    this.ui = new UIManager();

    document.getElementById('startBtn')?.addEventListener('click', () => {
      document.getElementById('start')!.style.display = 'none';
      this.startGame();
    });

    window.addEventListener('resize', () => this.engine.resize());
  }

  async init(): Promise<void> {
    // Init Havok
    const havokInstance = await HavokPhysics();
    const havokPlugin = new HavokPlugin(true, havokInstance);

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.12, 0.12, 0.18, 1);
    this.scene.enablePhysics(new Vector3(0, -20, 0), havokPlugin);

    // Lighting
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.6;
    ambient.diffuse = new Color3(0.9, 0.88, 0.8);
    ambient.groundColor = new Color3(0.3, 0.28, 0.25);

    const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.3), this.scene);
    sun.intensity = 1.2;
    sun.position = new Vector3(20, 50, 20);

    // Shadows (optional, lite)
    const shadows = new ShadowGenerator(512, sun);
    shadows.useBlurExponentialShadowMap = true;

    // Build level
    const input = new InputManager(this.canvas);
    this.input = input;

    const levelData = buildLevel(this.scene);
    this.spawnPos = levelData.spawnPosition;
    this.bagPos = levelData.bagPosition;

    // Player
    this.player = new Player(this.scene, this.spawnPos, input, levelData.hidingSpots);
    shadows.addShadowCaster(this.player.mesh);

    // Jelly beans
    for (let i = 0; i < levelData.jellyBeanPositions.length; i++) {
      const bean = new JellyBean(this.scene, levelData.jellyBeanPositions[i], i);
      this.beans.push(bean);
    }
    this.totalBeans = this.beans.length;

    // Patrol cats
    for (let i = 0; i < levelData.patrolWaypoints.length; i++) {
      const wp = levelData.patrolWaypoints[i];
      const cat = new Cat(this.scene, wp[0], wp, CatState.PATROL);
      cat.onCatch = () => this.handleCaught();
      this.cats.push(cat);
      shadows.addShadowCaster(cat.mesh);
    }

    // Guard cats
    for (let i = 0; i < levelData.guardPositions.length; i++) {
      const pos = levelData.guardPositions[i];
      const cat = new Cat(this.scene, pos, [], CatState.GUARD);
      cat.onCatch = () => this.handleCaught();
      this.cats.push(cat);
      shadows.addShadowCaster(cat.mesh);
    }

    // Receive meshes for shadows
    this.scene.meshes.forEach(m => {
      m.receiveShadows = true;
    });

    // Register game loop
    this.scene.registerBeforeRender(() => {
      const dt = this.engine.getDeltaTime() / 1000;
      this.update(dt);
    });

    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  private startGame(): void {
    this.state = GameState.PLAYING;
  }

  private update(dt: number): void {
    if (this.state === GameState.START) return;

    if (this.state === GameState.WIN) return;

    if (this.state === GameState.CAUGHT) {
      this.caughtTimer -= dt;
      if (this.caughtTimer <= 0) {
        this.respawn();
        this.state = GameState.PLAYING;
      }
      return;
    }

    // PLAYING
    const clampedDt = Math.min(dt, 0.05);

    this.player.update(clampedDt, this.scene);
    this.ui.setFloor(this.player.getCurrentFloor());

    // Bean updates & pickup
    for (const bean of this.beans) {
      bean.update(clampedDt);
      if (!bean.collected && bean.isNearPlayer(this.player.getPosition())) {
        bean.collect();
        this.player.collectBean();
      }
    }

    // Bag deposit check
    const bagDist = Vector3.Distance(this.player.getPosition(), this.bagPos);
    if (bagDist < 3 && this.player.carriedBeans > 0) {
      this.beansDeposited += this.player.carriedBeans;
      this.player.depositBeans();

      if (this.beansDeposited >= this.totalBeans) {
        this.state = GameState.WIN;
        this.ui.showWin();
      }
    }

    // UI counter: deposited + carried vs total
    this.ui.update(
      this.beansDeposited,
      this.totalBeans,
      this.player.carriedBeans,
    );

    // Respawn grace period: suppress cat detection and flash the player
    const inGrace = this.respawnGraceTimer > 0;
    if (inGrace) {
      this.respawnGraceTimer -= clampedDt;
      // Flash player character by toggling visibility every ~0.15s
      const flash = Math.floor(this.respawnGraceTimer / 0.15) % 2 === 0;
      this.player.setCharacterOpacity(flash ? 1.0 : 0.0);
      if (this.respawnGraceTimer <= 0) {
        this.player.setCharacterOpacity(1.0);
      }
    }

    // Cat AI (suppress LOS detection during grace period)
    let anyAlert = false;
    for (const cat of this.cats) {
      cat.update(clampedDt, this.player.mesh, this.player.isHiding || inGrace, this.cats, this.scene);
      if (cat.state === CatState.ALERT || cat.state === CatState.CHASE) anyAlert = true;
    }
    if (anyAlert) this.ui.showAlert();
  }

  private handleCaught(): void {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.CAUGHT;
    this.caughtTimer = CAUGHT_RESPAWN_DELAY;
    this.ui.showCaught();

    // Drop carried beans back at current location
    const pos = this.player.getPosition();
    const carriedCount = this.player.carriedBeans;
    this.player.dropBeans();

    // Re-enable dropped beans near player position (scatter a bit)
    let dropped = 0;
    for (const bean of this.beans) {
      if (bean.collected && dropped < carriedCount) {
        bean.collected = false;
        bean.mesh.setEnabled(true);
        // Scatter around caught position
        const angle = (dropped / carriedCount) * Math.PI * 2;
        bean.mesh.position = new Vector3(
          pos.x + Math.cos(angle) * 2,
          pos.y,
          pos.z + Math.sin(angle) * 2,
        );
        dropped++;
      }
    }
  }

  private respawn(): void {
    this.player.teleportTo(this.spawnPos);
    for (const cat of this.cats) {
      cat.resetToPatrol();
    }
    this.respawnGraceTimer = 1.5;
  }
}
