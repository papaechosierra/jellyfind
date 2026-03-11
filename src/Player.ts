import {
  Scene,
  MeshBuilder,
  Vector3,
  Mesh,
  StandardMaterial,
  Color3,
  PhysicsAggregate,
  PhysicsShapeType,
  Ray,
  ArcRotateCamera,
} from '@babylonjs/core';
import { InputManager } from './InputManager';
import { HidingSpot } from './HidingSpot';

const WALK_SPEED = 5;
const RUN_SPEED = 10;
const JUMP_SPEED = 8;
const GROUND_RAY_DIST = 1.3;

export class Player {
  mesh: Mesh;
  private physicsBody: PhysicsAggregate;
  camera: ArcRotateCamera;
  private input: InputManager;

  carriedBeans = 0;
  totalCollected = 0;
  isHiding = false;
  private hidingSpots: HidingSpot[];
  private eWasDown = false;

  constructor(scene: Scene, spawnPos: Vector3, input: InputManager, hidingSpots: HidingSpot[]) {
    this.input = input;
    this.hidingSpots = hidingSpots;

    // Player capsule
    const mat = new StandardMaterial('playerMat', scene);
    mat.diffuseColor = new Color3(0.4, 0.7, 1.0);
    mat.specularColor = new Color3(0.5, 0.5, 0.5);

    this.mesh = MeshBuilder.CreateCapsule('player', {
      radius: 0.45,
      height: 1.8,
      tessellation: 10,
      subdivisions: 2,
    }, scene);
    this.mesh.position = spawnPos.clone();
    this.mesh.material = mat;

    // Physics
    this.physicsBody = new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.CAPSULE,
      { mass: 1, restitution: 0.1, friction: 0.8 },
      scene,
    );
    // Lock rotation via angular damping (Havok)
    this.physicsBody.body.setAngularDamping(100);
    this.physicsBody.body.setLinearDamping(0.1);

    // Camera
    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3.5, 8, Vector3.Zero(), scene);
    this.camera.minZ = 0.1;
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 12;
    this.camera.lowerBetaLimit = 0.2;
    this.camera.upperBetaLimit = Math.PI / 2.2;

    scene.activeCamera = this.camera;
  }

  update(dt: number, scene: Scene): void {
    // Update camera target to follow player
    this.camera.target = this.mesh.position.add(new Vector3(0, 0.9, 0));

    // Mouse look
    const dx = this.input.mouseDeltaX;
    const dy = this.input.mouseDeltaY;
    this.camera.alpha += dx * 0.003;
    this.camera.beta = Math.max(0.2, Math.min(Math.PI / 2.2, this.camera.beta + dy * 0.003));

    // Movement direction relative to camera
    const forward = new Vector3(
      Math.sin(this.camera.alpha),
      0,
      Math.cos(this.camera.alpha),
    ).normalize();
    const right = Vector3.Cross(Vector3.Up(), forward).normalize();

    let moveX = 0;
    let moveZ = 0;
    if (this.input.isDown('KeyW')) moveZ += 1;
    if (this.input.isDown('KeyS')) moveZ -= 1;
    if (this.input.isDown('KeyA')) moveX -= 1;
    if (this.input.isDown('KeyD')) moveX += 1;

    const speed = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight') ? RUN_SPEED : WALK_SPEED;

    const moveDir = forward.scale(moveZ).add(right.scale(moveX));
    if (moveDir.lengthSquared() > 0) {
      moveDir.normalize().scaleInPlace(speed);
      // Face movement direction
      this.mesh.rotation.y = Math.atan2(moveDir.x, moveDir.z);
    }

    // Get current velocity
    const vel = this.physicsBody.body.getLinearVelocity();

    // Apply horizontal velocity
    this.physicsBody.body.setLinearVelocity(new Vector3(
      moveDir.x,
      vel.y,
      moveDir.z,
    ));

    // Jump
    const grounded = this.isGrounded(scene);
    if (this.input.isDown('Space') && grounded) {
      this.physicsBody.body.setLinearVelocity(new Vector3(
        vel.x,
        JUMP_SPEED,
        vel.z,
      ));
    }

    // Hiding
    const eDown = this.input.isDown('KeyE');
    if (eDown && !this.eWasDown) {
      const inSpot = this.hidingSpots.some(s => s.containsPlayer(this.mesh));
      if (inSpot) {
        this.isHiding = !this.isHiding;
        const mat = this.mesh.material as StandardMaterial;
        mat.alpha = this.isHiding ? 0.3 : 1.0;
      }
    }
    this.eWasDown = eDown;

    // Stop hiding if not in any spot
    if (this.isHiding) {
      const inSpot = this.hidingSpots.some(s => s.containsPlayer(this.mesh));
      if (!inSpot) {
        this.isHiding = false;
        const mat = this.mesh.material as StandardMaterial;
        mat.alpha = 1.0;
      }
    }
  }

  private isGrounded(scene: Scene): boolean {
    const origin = this.mesh.position.clone();
    const ray = new Ray(origin, Vector3.Down(), GROUND_RAY_DIST);
    const hit = scene.pickWithRay(ray, (m) => m !== this.mesh && m.isPickable);
    return hit?.hit === true;
  }

  teleportTo(pos: Vector3): void {
    this.mesh.position = pos.clone();
    this.physicsBody.body.setLinearVelocity(Vector3.Zero());
    this.physicsBody.body.setAngularVelocity(Vector3.Zero());
    this.isHiding = false;
    const mat = this.mesh.material as StandardMaterial;
    mat.alpha = 1.0;
  }

  dropBeans(): void {
    this.carriedBeans = 0;
  }

  collectBean(): void {
    this.carriedBeans++;
    this.totalCollected++;
  }

  depositBeans(): void {
    this.totalCollected -= this.carriedBeans; // already counted; just clear carry
    this.carriedBeans = 0;
  }

  getPosition(): Vector3 {
    return this.mesh.position.clone();
  }

  getCurrentFloor(): number {
    const y = this.mesh.position.y;
    if (y < 13) return 1;
    if (y < 25) return 2;
    return 3;
  }
}
