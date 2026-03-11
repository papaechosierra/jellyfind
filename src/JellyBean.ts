import {
  Scene,
  MeshBuilder,
  Vector3,
  Mesh,
  DynamicTexture,
  StandardMaterial,
  Color3,
  AbstractMesh,
} from '@babylonjs/core';

const BEAN_COLORS: [number, number, number][] = [
  [255, 80, 80],
  [80, 200, 255],
  [100, 255, 100],
  [255, 200, 60],
  [200, 80, 255],
  [255, 140, 40],
];

export class JellyBean {
  mesh: Mesh;
  collected = false;
  private bobTime = Math.random() * Math.PI * 2;
  private baseY: number;

  constructor(scene: Scene, position: Vector3, index: number) {
    this.mesh = MeshBuilder.CreateSphere(`bean_${index}`, { diameter: 0.6, segments: 8 }, scene);
    this.mesh.position = position.clone();
    this.baseY = position.y;

    const color = BEAN_COLORS[index % BEAN_COLORS.length];
    const mat = new StandardMaterial(`beanMat_${index}`, scene);

    // Smiley face via DynamicTexture
    const tex = new DynamicTexture(`beanTex_${index}`, { width: 128, height: 128 }, scene);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    // Background
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.fillRect(0, 0, 128, 128);
    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(44, 50, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(84, 50, 8, 0, Math.PI * 2);
    ctx.fill();
    // Smile
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 60, 26, 0.2, Math.PI - 0.2);
    ctx.stroke();
    tex.update();

    mat.diffuseTexture = tex;
    mat.emissiveColor = new Color3(
      color[0] / 510,
      color[1] / 510,
      color[2] / 510,
    );
    mat.specularColor = new Color3(0.5, 0.5, 0.5);
    this.mesh.material = mat;
  }

  update(dt: number): void {
    if (this.collected) return;
    this.bobTime += dt * 1.5;
    this.mesh.position.y = this.baseY + Math.sin(this.bobTime) * 0.15;
    this.mesh.rotation.y += dt * 1.2;
  }

  isNearPlayer(playerPos: Vector3): boolean {
    if (this.collected) return false;
    return Vector3.Distance(this.mesh.position, playerPos) < 1.8;
  }

  collect(): void {
    this.collected = true;
    this.mesh.setEnabled(false);
  }

  getMesh(): AbstractMesh {
    return this.mesh;
  }
}
