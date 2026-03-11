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
  SceneLoader,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
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
  private characterMesh: Mesh | null = null;

  constructor(scene: Scene, spawnPos: Vector3, input: InputManager, hidingSpots: HidingSpot[]) {
    this.input = input;
    this.hidingSpots = hidingSpots;

    this.mesh = MeshBuilder.CreateCapsule('player', {
      radius: 0.45,
      height: 1.8,
      tessellation: 10,
      subdivisions: 2,
    }, scene);
    this.mesh.position = spawnPos.clone();
    // Make the physics capsule invisible — character mesh will be loaded separately
    this.mesh.visibility = 0;

    this.loadCharacterMesh(scene);

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

  private loadCharacterMesh(scene: Scene): void {
    SceneLoader.ImportMeshAsync('', 'https://assets.babylonjs.com/meshes/', 'HVGirl.glb', scene)
      .then((result) => {
        const root = result.meshes[0];
        root.parent = this.mesh;
        root.scaling = new Vector3(0.008, 0.008, 0.008);
        root.position = new Vector3(0, -0.9, 0);
        this.characterMesh = root as Mesh;
      })
      .catch(() => {
        // Fallback: simple procedural humanoid
        const mat = new StandardMaterial('playerFallbackMat', scene);
        mat.diffuseColor = new Color3(0.4, 0.7, 1.0);

        const torso = MeshBuilder.CreateBox('playerTorso', { width: 0.6, height: 0.7, depth: 0.3 }, scene);
        torso.material = mat;
        torso.parent = this.mesh;
        torso.position = new Vector3(0, 0.1, 0);

        const head = MeshBuilder.CreateSphere('playerHead', { diameter: 0.45 }, scene);
        head.material = mat;
        head.parent = this.mesh;
        head.position = new Vector3(0, 0.65, 0);

        const legL = MeshBuilder.CreateCylinder('playerLegL', { diameter: 0.22, height: 0.6 }, scene);
        legL.material = mat;
        legL.parent = this.mesh;
        legL.position = new Vector3(-0.17, -0.5, 0);

        const legR = MeshBuilder.CreateCylinder('playerLegR', { diameter: 0.22, height: 0.6 }, scene);
        legR.material = mat;
        legR.parent = this.mesh;
        legR.position = new Vector3(0.17, -0.5, 0);

        this.characterMesh = torso as Mesh;
      });
  }

  update(dt: number, scene: Scene): void {
    // Update camera target to follow player
    this.camera.target = this.mesh.position.add(new Vector3(0, 0.9, 0));

    // Mouse look
    const dx = this.input.mouseDeltaX;
    const dy = this.input.mouseDeltaY;
    this.camera.alpha += dx * 0.003;
    this.camera.beta = Math.max(0.2, Math.min(Math.PI / 2.2, this.camera.beta + dy * 0.003));

    // Movement direction relative to camera (ArcRotateCamera: camera is at target + offset,
    // so forward = target - camera position = (-cos(alpha), 0, -sin(alpha)) horizontally)
    const forward = new Vector3(
      -Math.cos(this.camera.alpha),
      0,
      -Math.sin(this.camera.alpha),
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

    // Apply horizontal velocity and lock rotation (prevent toppling)
    this.physicsBody.body.setLinearVelocity(new Vector3(
      moveDir.x,
      vel.y,
      moveDir.z,
    ));
    this.physicsBody.body.setAngularVelocity(Vector3.Zero());

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
        this.setCharacterOpacity(this.isHiding ? 0.3 : 1.0);
      }
    }
    this.eWasDown = eDown;

    // Stop hiding if not in any spot
    if (this.isHiding) {
      const inSpot = this.hidingSpots.some(s => s.containsPlayer(this.mesh));
      if (!inSpot) {
        this.isHiding = false;
        this.setCharacterOpacity(1.0);
      }
    }
  }

  setCharacterOpacity(alpha: number): void {
    if (this.characterMesh) {
      this.characterMesh.getChildMeshes(false).forEach(m => {
        m.visibility = alpha;
      });
      this.characterMesh.visibility = alpha;
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
    this.setCharacterOpacity(1.0);
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
