import {
  Scene,
  MeshBuilder,
  Vector3,
  Mesh,
  StandardMaterial,
  Color3,
  PhysicsAggregate,
  PhysicsShapeType,
} from '@babylonjs/core';
import { HidingSpot } from './HidingSpot';

export interface LevelData {
  jellyBeanPositions: Vector3[];
  hidingSpots: HidingSpot[];
  patrolWaypoints: Vector3[][];  // per-cat patrol routes
  guardPositions: Vector3[];     // guard cat positions
  spawnPosition: Vector3;
  bagPosition: Vector3;
}

const FLOOR_HEIGHT = 12;
const FLOOR_W = 40;
const FLOOR_D = 30;

function makeMat(scene: Scene, color: Color3, emissive?: Color3): StandardMaterial {
  const mat = new StandardMaterial('mat_' + Math.random(), scene);
  mat.diffuseColor = color;
  if (emissive) mat.emissiveColor = emissive;
  return mat;
}

function addBox(
  scene: Scene,
  name: string,
  w: number, h: number, d: number,
  pos: Vector3,
  mat: StandardMaterial,
  isStatic = true,
): Mesh {
  const box = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  box.position = pos.clone();
  box.material = mat;
  if (isStatic) {
    new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene);
  }
  return box;
}

export function buildLevel(scene: Scene): LevelData {
  const floorMat = makeMat(scene, new Color3(0.7, 0.65, 0.55));
  const wallMat = makeMat(scene, new Color3(0.85, 0.82, 0.75));
  const rampMat = makeMat(scene, new Color3(0.6, 0.55, 0.45));

  const jellyBeanPositions: Vector3[] = [];
  const hidingSpots: HidingSpot[] = [];

  // ---------- FLOOR 1 (y=0) ----------
  const f1y = 0;
  // Floor plane
  const floor1 = MeshBuilder.CreateBox('floor1', { width: FLOOR_W, height: 0.5, depth: FLOOR_D }, scene);
  floor1.position = new Vector3(0, f1y - 0.25, 0);
  floor1.material = floorMat;
  new PhysicsAggregate(floor1, PhysicsShapeType.BOX, { mass: 0 }, scene);

  // Ceiling for floor 1
  const ceil1 = MeshBuilder.CreateBox('ceil1', { width: FLOOR_W, height: 0.5, depth: FLOOR_D }, scene);
  ceil1.position = new Vector3(0, f1y + FLOOR_HEIGHT - 0.25, 0);
  ceil1.material = wallMat;
  new PhysicsAggregate(ceil1, PhysicsShapeType.BOX, { mass: 0 }, scene);

  // Outer walls floor 1
  buildOuterWalls(scene, wallMat, f1y, FLOOR_W, FLOOR_D, FLOOR_HEIGHT, 'f1');

  // Floor 1 furniture: giant books as walls
  const bookMat = makeMat(scene, new Color3(0.3, 0.5, 0.8));
  addBox(scene, 'book1', 8, 6, 1, new Vector3(-10, f1y + 3, -5), bookMat);
  addBox(scene, 'book2', 6, 5, 1, new Vector3(-10, f1y + 2.5, 3), bookMat);
  addBox(scene, 'book3', 1, 7, 10, new Vector3(5, f1y + 3.5, -8), makeMat(scene, new Color3(0.7, 0.3, 0.3)));

  // Pencil column
  const pencilMat = makeMat(scene, new Color3(1, 0.85, 0.2));
  const pencil = MeshBuilder.CreateCylinder('pencil', { diameter: 1.5, height: 10, tessellation: 6 }, scene);
  pencil.position = new Vector3(10, f1y + 5, 5);
  pencil.material = pencilMat;
  new PhysicsAggregate(pencil, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);

  // Shoe box room
  const shoeBoxMat = makeMat(scene, new Color3(0.55, 0.38, 0.2));
  addBox(scene, 'shoebox_w1', 0.5, 5, 10, new Vector3(12, f1y + 2.5, 8), shoeBoxMat);
  addBox(scene, 'shoebox_w2', 0.5, 5, 10, new Vector3(18, f1y + 2.5, 8), shoeBoxMat);
  addBox(scene, 'shoebox_back', 6.5, 5, 0.5, new Vector3(15, f1y + 2.5, 3.5), shoeBoxMat);

  // Hiding spot under book stack
  const hs1 = new HidingSpot(scene, new Vector3(-10, f1y + 1, -5), new Vector3(8, 2, 2));
  hidingSpots.push(hs1);

  // Jelly beans floor 1
  jellyBeanPositions.push(
    new Vector3(-8, f1y + 1, -8),
    new Vector3(2, f1y + 1, 6),
    new Vector3(14, f1y + 1, 8),
    new Vector3(-15, f1y + 1, 8),
  );

  // Staircase 1→2: diagonal ramp at east end (runs along Z axis)
  buildRamp(scene, rampMat, 'ramp1',
    new Vector3(16, f1y + 0.25, -2),
    new Vector3(16, f1y + FLOOR_HEIGHT, 14),
    5, 0.5,
  );

  // ---------- FLOOR 2 (y = FLOOR_HEIGHT) ----------
  const f2y = FLOOR_HEIGHT;
  const floor2 = MeshBuilder.CreateBox('floor2', { width: FLOOR_W, height: 0.5, depth: FLOOR_D }, scene);
  floor2.position = new Vector3(0, f2y - 0.25, 0);
  floor2.material = floorMat;
  new PhysicsAggregate(floor2, PhysicsShapeType.BOX, { mass: 0 }, scene);

  const ceil2 = MeshBuilder.CreateBox('ceil2', { width: FLOOR_W, height: 0.5, depth: FLOOR_D }, scene);
  ceil2.position = new Vector3(0, f2y + FLOOR_HEIGHT - 0.25, 0);
  ceil2.material = wallMat;
  new PhysicsAggregate(ceil2, PhysicsShapeType.BOX, { mass: 0 }, scene);

  buildOuterWalls(scene, wallMat, f2y, FLOOR_W, FLOOR_D, FLOOR_HEIGHT, 'f2');

  // Floor 2 furniture: coffee mug
  const mugMat = makeMat(scene, new Color3(0.9, 0.85, 0.8));
  const mug = MeshBuilder.CreateCylinder('mug', { diameter: 5, height: 6, tessellation: 16 }, scene);
  mug.position = new Vector3(-8, f2y + 3, -6);
  mug.material = mugMat;
  new PhysicsAggregate(mug, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);

  // Notebook pages (flat quads as walls)
  const notebookMat = makeMat(scene, new Color3(0.95, 0.95, 0.85));
  addBox(scene, 'notebook1', 10, 7, 0.3, new Vector3(5, f2y + 3.5, -4), notebookMat);
  addBox(scene, 'notebook2', 10, 7, 0.3, new Vector3(5, f2y + 3.5, 4), notebookMat);

  // Eraser blocks
  const eraserMat = makeMat(scene, new Color3(1, 0.6, 0.6));
  addBox(scene, 'eraser1', 4, 3, 6, new Vector3(12, f2y + 1.5, 8), eraserMat);
  addBox(scene, 'eraser2', 3, 3, 4, new Vector3(-14, f2y + 1.5, 6), makeMat(scene, new Color3(0.6, 0.8, 1)));

  // Hiding spot inside mug (between mug and wall)
  const hs2 = new HidingSpot(scene, new Vector3(-8, f2y + 2, -6), new Vector3(3, 4, 3));
  hidingSpots.push(hs2);

  // Jelly beans floor 2
  jellyBeanPositions.push(
    new Vector3(-4, f2y + 1, 8),
    new Vector3(8, f2y + 1, -10),
    new Vector3(-16, f2y + 1, -10),
    new Vector3(0, f2y + 1, 0),
  );

  // Staircase 2→3: diagonal ramp at west end (runs along Z axis)
  buildRamp(scene, rampMat, 'ramp2',
    new Vector3(-16, f2y + 0.25, -2),
    new Vector3(-16, f2y + FLOOR_HEIGHT, 14),
    5, 0.5,
  );

  // ---------- FLOOR 3 (y = 2*FLOOR_HEIGHT) ----------
  const f3y = 2 * FLOOR_HEIGHT;
  const floor3 = MeshBuilder.CreateBox('floor3', { width: FLOOR_W, height: 0.5, depth: FLOOR_D }, scene);
  floor3.position = new Vector3(0, f3y - 0.25, 0);
  floor3.material = floorMat;
  new PhysicsAggregate(floor3, PhysicsShapeType.BOX, { mass: 0 }, scene);

  // No ceiling on top floor (open)
  buildOuterWalls(scene, wallMat, f3y, FLOOR_W, FLOOR_D, FLOOR_HEIGHT, 'f3');

  // Floor 3 furniture: ruler bridge
  const rulerMat = makeMat(scene, new Color3(0.9, 0.8, 0.5));
  addBox(scene, 'ruler', 20, 0.5, 2, new Vector3(0, f3y + 3, -5), rulerMat);
  addBox(scene, 'rulerSupport1', 1, 3, 1, new Vector3(-10, f3y + 1.5, -5), rulerMat);
  addBox(scene, 'rulerSupport2', 1, 3, 1, new Vector3(10, f3y + 1.5, -5), rulerMat);

  // Tape dispenser
  const tapeMat = makeMat(scene, new Color3(0.4, 0.7, 0.9));
  const tape = MeshBuilder.CreateCylinder('tape', { diameter: 6, height: 3, tessellation: 16 }, scene);
  tape.position = new Vector3(10, f3y + 1.5, 6);
  tape.material = tapeMat;
  new PhysicsAggregate(tape, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);

  // Coin piles
  const coinMat = makeMat(scene, new Color3(1, 0.85, 0.3));
  for (let i = 0; i < 3; i++) {
    const coin = MeshBuilder.CreateCylinder(`coin_${i}`, { diameter: 4, height: 0.5 + i * 0.4, tessellation: 16 }, scene);
    coin.position = new Vector3(-12 + i * 5, f3y + (0.5 + i * 0.4) / 2, 8);
    coin.material = coinMat;
    new PhysicsAggregate(coin, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
  }

  // Hiding spot under ruler bridge
  const hs3 = new HidingSpot(scene, new Vector3(0, f3y + 1, -5), new Vector3(20, 2.5, 3));
  hidingSpots.push(hs3);

  // Jelly beans floor 3
  jellyBeanPositions.push(
    new Vector3(-10, f3y + 1, -10),
    new Vector3(8, f3y + 3.5, -5),   // on ruler
    new Vector3(-5, f3y + 1, 6),
    new Vector3(10, f3y + 1.5, 6),   // near tape
  );

  // Patrol waypoints per cat (4 patrol cats)
  const patrolWaypoints: Vector3[][] = [
    // Cat 0: floor 1 patrol
    [
      new Vector3(-15, f1y + 1, -10),
      new Vector3(15, f1y + 1, -10),
      new Vector3(15, f1y + 1, 10),
      new Vector3(-15, f1y + 1, 10),
    ],
    // Cat 1: floor 2 patrol
    [
      new Vector3(-14, f2y + 1, -10),
      new Vector3(14, f2y + 1, -10),
      new Vector3(14, f2y + 1, 10),
      new Vector3(-14, f2y + 1, 10),
    ],
    // Cat 2: floor 3 patrol
    [
      new Vector3(-14, f3y + 1, -10),
      new Vector3(14, f3y + 1, -10),
      new Vector3(14, f3y + 1, 10),
      new Vector3(-14, f3y + 1, 10),
    ],
    // Cat 3: staircase patrol
    [
      new Vector3(14, f1y + 1, 8),
      new Vector3(16, f1y + 6, 10),
      new Vector3(14, f2y + 1, 8),
      new Vector3(16, f1y + 6, 10),
    ],
  ];

  // Guard positions (near jelly beans)
  const guardPositions: Vector3[] = [
    new Vector3(14, f1y + 1, 8),   // guard near floor1 bean
    new Vector3(-8, f2y + 1, 8),   // guard near floor2 beans
    new Vector3(8, f3y + 1, -10),  // guard near floor3 beans
  ];

  const spawnPosition = new Vector3(0, 1, 0);
  const bagPosition = new Vector3(0, 0.8, 0);

  // Bag mesh at spawn
  buildBag(scene, bagPosition);

  return {
    jellyBeanPositions,
    hidingSpots,
    patrolWaypoints,
    guardPositions,
    spawnPosition,
    bagPosition,
  };
}

function buildOuterWalls(
  scene: Scene,
  mat: StandardMaterial,
  baseY: number,
  w: number,
  d: number,
  h: number,
  prefix: string,
): void {
  // North wall with doorway gap (center 4 units wide)
  addBox(scene, `${prefix}_wN1`, w / 2 - 2, h, 0.5, new Vector3(-w / 4 - 1, baseY + h / 2, -d / 2), mat);
  addBox(scene, `${prefix}_wN2`, w / 2 - 2, h, 0.5, new Vector3(w / 4 + 1, baseY + h / 2, -d / 2), mat);
  // Lintel above door
  addBox(scene, `${prefix}_wN3`, 4, h / 3, 0.5, new Vector3(0, baseY + h - h / 6, -d / 2), mat);
  // South wall
  addBox(scene, `${prefix}_wS`, w, h, 0.5, new Vector3(0, baseY + h / 2, d / 2), mat);
  // East wall with staircase opening
  addBox(scene, `${prefix}_wE1`, 0.5, h - 4, d, new Vector3(w / 2, baseY + (h - 4) / 2, 0), mat);
  addBox(scene, `${prefix}_wE2`, 0.5, 4, d / 2 - 4, new Vector3(w / 2, baseY + h - 2, -d / 4 - 2), mat);
  // West wall with staircase opening
  addBox(scene, `${prefix}_wW1`, 0.5, h - 4, d, new Vector3(-w / 2, baseY + (h - 4) / 2, 0), mat);
  addBox(scene, `${prefix}_wW2`, 0.5, 4, d / 2 - 4, new Vector3(-w / 2, baseY + h - 2, -d / 4 - 2), mat);
}

function buildRamp(
  scene: Scene,
  mat: StandardMaterial,
  name: string,
  bottom: Vector3,
  top: Vector3,
  width: number,
  thickness: number,
): void {
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y;
  const dz = top.z - bottom.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const ramp = MeshBuilder.CreateBox(name, { width, height: thickness, depth: len }, scene);
  // Center position
  ramp.position = new Vector3(
    (bottom.x + top.x) / 2,
    (bottom.y + top.y) / 2,
    (bottom.z + top.z) / 2,
  );
  // Pitch angle: atan2(rise, horizontal run)
  const horiz = Math.sqrt(dx * dx + dz * dz);
  ramp.rotation.x = -Math.atan2(dy, horiz > 0.01 ? horiz : 1);
  ramp.material = mat;
  new PhysicsAggregate(ramp, PhysicsShapeType.BOX, { mass: 0 }, scene);

  // Add side rails
  const railMat = makeMat(scene, new Color3(0.4, 0.35, 0.3));
  const rail1 = MeshBuilder.CreateBox(name + '_r1', { width: 0.3, height: 1, depth: len }, scene);
  rail1.position = ramp.position.clone();
  rail1.position.x -= width / 2;
  rail1.position.y += 0.5;
  rail1.rotation.x = ramp.rotation.x;
  rail1.material = railMat;
  new PhysicsAggregate(rail1, PhysicsShapeType.BOX, { mass: 0 }, scene);

  const rail2 = rail1.clone(name + '_r2');
  rail2.position.x += width;
  new PhysicsAggregate(rail2, PhysicsShapeType.BOX, { mass: 0 }, scene);
}

function buildBag(scene: Scene, pos: Vector3): void {
  // Simple bag: sphere body + cylinder neck
  const bagMat = makeMat(scene, new Color3(0.2, 0.6, 0.2), new Color3(0.05, 0.15, 0.05));
  const body = MeshBuilder.CreateSphere('bagBody', { diameter: 2.5, segments: 10 }, scene);
  body.position = pos.clone();
  body.position.y += 1.25;
  body.material = bagMat;

  const neck = MeshBuilder.CreateCylinder('bagNeck', { diameter: 1, height: 0.8, tessellation: 12 }, scene);
  neck.position = pos.clone();
  neck.position.y += 2.9;
  neck.material = bagMat;

  // Gold tie
  const tieMat = makeMat(scene, new Color3(1, 0.8, 0));
  const tie = MeshBuilder.CreateTorus('bagTie', { diameter: 1.2, thickness: 0.15, tessellation: 12 }, scene);
  tie.position = pos.clone();
  tie.position.y += 3.2;
  tie.material = tieMat;
}
