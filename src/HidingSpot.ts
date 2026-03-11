import {
  Scene,
  MeshBuilder,
  Vector3,
  AbstractMesh,
} from '@babylonjs/core';

export class HidingSpot {
  private trigger: AbstractMesh;

  constructor(scene: Scene, position: Vector3, size: Vector3) {
    this.trigger = MeshBuilder.CreateBox('hidingSpot', {
      width: size.x,
      height: size.y,
      depth: size.z,
    }, scene);
    this.trigger.position = position.clone();
    this.trigger.visibility = 0;
    this.trigger.isPickable = false;
    this.trigger.checkCollisions = false;
  }

  containsPlayer(playerMesh: AbstractMesh): boolean {
    return this.trigger.intersectsMesh(playerMesh, false);
  }
}
