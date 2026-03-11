import {
  Scene,
  MeshBuilder,
  Vector3,
  Mesh,
  StandardMaterial,
  Color3,
  Ray,
  AbstractMesh,
} from '@babylonjs/core';

export const enum CatState {
  PATROL,
  GUARD,
  CHASE,
  SEARCH,
  ALERT,
}

const PATROL_SPEED = 3;
const CHASE_SPEED = 3.5;
const FOV_ANGLE = Math.cos((120 / 2) * (Math.PI / 180)); // cos(60°)
const SIGHT_DIST = 20;
const ALERT_RADIUS = 15;
const SEARCH_TIME = 4;

export class Cat {
  mesh: Mesh;
  private earL: Mesh;
  private earR: Mesh;
  private tailMesh: Mesh;

  state: CatState;
  private waypoints: Vector3[];
  private waypointIdx = 0;
  private guardPos: Vector3;
  private lastKnownPlayerPos: Vector3 | null = null;
  private searchTimer = 0;
  private alertPos: Vector3 | null = null;
  private losFrameCounter = 0;
  private tailTime = 0;

  // Called when cat catches player
  onCatch: (() => void) | null = null;

  constructor(
    scene: Scene,
    position: Vector3,
    waypoints: Vector3[],
    initialState: CatState,
  ) {
    this.waypoints = waypoints;
    this.guardPos = position.clone();
    this.state = initialState;

    // Orange cat body
    const mat = new StandardMaterial('catMat_' + Math.random(), scene);
    mat.diffuseColor = new Color3(1, 0.5, 0.1);
    mat.specularColor = new Color3(0.3, 0.3, 0.3);

    this.mesh = MeshBuilder.CreateCapsule('cat_' + Math.random(), {
      radius: 0.6,
      height: 2.4,
      tessellation: 10,
      subdivisions: 2,
    }, scene);
    this.mesh.position = position.clone();
    this.mesh.material = mat;

    // Ears (triangular-ish cylinders)
    const earMat = new StandardMaterial('earMat', scene);
    earMat.diffuseColor = new Color3(1, 0.35, 0.1);
    this.earL = MeshBuilder.CreateCylinder('earL', { diameterTop: 0, diameterBottom: 0.4, height: 0.6, tessellation: 6 }, scene);
    this.earL.material = earMat;
    this.earL.parent = this.mesh;
    this.earL.position = new Vector3(-0.35, 1.3, 0);

    this.earR = MeshBuilder.CreateCylinder('earR', { diameterTop: 0, diameterBottom: 0.4, height: 0.6, tessellation: 6 }, scene);
    this.earR.material = earMat;
    this.earR.parent = this.mesh;
    this.earR.position = new Vector3(0.35, 1.3, 0);

    // Tail
    const tailMat = new StandardMaterial('tailMat', scene);
    tailMat.diffuseColor = new Color3(0.9, 0.45, 0.1);
    this.tailMesh = MeshBuilder.CreateCylinder('tail', { diameterTop: 0.1, diameterBottom: 0.3, height: 1.8, tessellation: 8 }, scene);
    this.tailMesh.material = tailMat;
    this.tailMesh.parent = this.mesh;
    this.tailMesh.position = new Vector3(0, -0.5, -0.8);
    this.tailMesh.rotation.x = -Math.PI / 3;
  }

  update(
    dt: number,
    playerMesh: AbstractMesh,
    playerIsHiding: boolean,
    allCats: Cat[],
    scene: Scene,
  ): void {
    this.tailTime += dt;
    this.tailMesh.rotation.x = -Math.PI / 3 + Math.sin(this.tailTime * 2) * 0.3;

    // LOS check every 10 frames worth (throttled by counter)
    this.losFrameCounter++;
    let canSeePlayer = false;
    if (this.losFrameCounter >= 10) {
      this.losFrameCounter = 0;
      if (!playerIsHiding) {
        canSeePlayer = this.checkLOS(playerMesh, scene);
      }
    }

    if (canSeePlayer) {
      this.lastKnownPlayerPos = playerMesh.position.clone();
      if (this.state !== CatState.CHASE) {
        this.state = CatState.CHASE;
        // Alert nearby cats
        this.alertNearbyCats(allCats, playerMesh.position);
      }
    }

    switch (this.state) {
      case CatState.PATROL:
        this.doPatrol(dt);
        break;
      case CatState.GUARD:
        this.doGuard(dt);
        break;
      case CatState.CHASE:
        this.doChase(dt, playerMesh);
        break;
      case CatState.SEARCH:
        this.doSearch(dt);
        break;
      case CatState.ALERT:
        this.doAlert(dt);
        break;
    }
  }

  private checkLOS(playerMesh: AbstractMesh, scene: Scene): boolean {
    const catHead = this.mesh.position.add(new Vector3(0, 1, 0));
    const playerHead = playerMesh.position.add(new Vector3(0, 1, 0));
    const toPlayer = playerHead.subtract(catHead);
    const dist = toPlayer.length();

    if (dist > SIGHT_DIST) return false;

    // Forward direction from cat rotation
    const forward = new Vector3(
      -Math.sin(this.mesh.rotation.y),
      0,
      -Math.cos(this.mesh.rotation.y),
    );
    const toPlayerNorm = toPlayer.normalize();
    const dot = Vector3.Dot(forward, toPlayerNorm);
    if (dot < FOV_ANGLE) return false;

    // Raycast
    const ray = new Ray(catHead, toPlayerNorm, dist + 0.5);
    const hit = scene.pickWithRay(ray, (mesh) => {
      return mesh !== this.mesh &&
        mesh.isPickable &&
        !mesh.name.startsWith('bean') &&
        !mesh.name.startsWith('cat') &&
        !mesh.name.startsWith('ear') &&
        !mesh.name.startsWith('tail') &&
        !mesh.name.startsWith('bag') &&
        !mesh.name.startsWith('hidingSpot');
    });

    if (!hit || !hit.hit) return true; // no obstruction → can see
    if (hit.pickedMesh === playerMesh) return true;

    // Check if the hit point is past the player
    const hitDist = hit.distance ?? Infinity;
    return hitDist >= dist - 0.5;
  }

  private alertNearbyCats(cats: Cat[], playerPos: Vector3): void {
    for (const cat of cats) {
      if (cat === this) continue;
      const d = Vector3.Distance(cat.mesh.position, this.mesh.position);
      if (d < ALERT_RADIUS && cat.state !== CatState.CHASE) {
        cat.receiveAlert(playerPos.clone());
      }
    }
  }

  receiveAlert(pos: Vector3): void {
    this.alertPos = pos;
    this.lastKnownPlayerPos = pos;
    this.state = CatState.ALERT;
  }

  private doPatrol(dt: number): void {
    if (this.waypoints.length === 0) return;
    const target = this.waypoints[this.waypointIdx];
    const arrived = this.moveTo(target, PATROL_SPEED, dt);
    if (arrived) {
      this.waypointIdx = (this.waypointIdx + 1) % this.waypoints.length;
    }
  }

  private doGuard(dt: number): void {
    // Slowly orbit guard position
    const angle = this.tailTime * 0.5;
    const orbitR = 3;
    const target = new Vector3(
      this.guardPos.x + Math.cos(angle) * orbitR,
      this.guardPos.y,
      this.guardPos.z + Math.sin(angle) * orbitR,
    );
    this.moveTo(target, PATROL_SPEED * 0.6, dt);
  }

  private doChase(dt: number, playerMesh: AbstractMesh): void {
    const target = playerMesh.position.clone();
    this.moveTo(target, CHASE_SPEED, dt);

    // Catch check
    const dist = Vector3.Distance(this.mesh.position, playerMesh.position);
    if (dist < 1.5) {
      this.onCatch?.();
    }

    // Lost player (no LOS for a while — handled by lastKnown becoming stale)
    if (!this.lastKnownPlayerPos) return;
    // If we've been chasing but haven't re-detected (losFrameCounter handles it),
    // transition to SEARCH after reaching last known pos
    const distToKnown = Vector3.Distance(this.mesh.position, target);
    if (distToKnown < 1 && this.losFrameCounter > 50) {
      this.state = CatState.SEARCH;
      this.searchTimer = SEARCH_TIME;
    }
  }

  private doSearch(dt: number): void {
    if (this.lastKnownPlayerPos) {
      this.moveTo(this.lastKnownPlayerPos, PATROL_SPEED, dt);
    }
    this.searchTimer -= dt;
    // Rotate in place
    this.mesh.rotation.y += dt * 1.5;

    if (this.searchTimer <= 0) {
      this.lastKnownPlayerPos = null;
      this.state = this.waypoints.length > 0 ? CatState.PATROL : CatState.GUARD;
    }
  }

  private doAlert(dt: number): void {
    if (this.alertPos) {
      const arrived = this.moveTo(this.alertPos, CHASE_SPEED, dt);
      if (arrived) {
        this.searchTimer = SEARCH_TIME;
        this.state = CatState.SEARCH;
        this.alertPos = null;
      }
    }
  }

  /** Returns true when arrived at target */
  private moveTo(target: Vector3, speed: number, dt: number): boolean {
    const diff = target.subtract(this.mesh.position);
    diff.y = 0; // horizontal movement only
    const dist = diff.length();
    if (dist < 0.3) return true;

    const dir = diff.normalize();
    this.mesh.position.addInPlace(dir.scale(speed * dt));

    // Face direction of travel
    this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    return false;
  }

  losePlayer(): void {
    if (this.state === CatState.CHASE) {
      this.state = CatState.SEARCH;
      this.searchTimer = SEARCH_TIME;
    }
  }

  resetToPatrol(): void {
    this.state = this.waypoints.length > 0 ? CatState.PATROL : CatState.GUARD;
    this.lastKnownPlayerPos = null;
    this.alertPos = null;
    this.searchTimer = 0;
  }
}
