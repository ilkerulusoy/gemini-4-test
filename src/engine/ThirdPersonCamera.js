import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor(camera, saveManager) {
    this.camera = camera;
    this.saveManager = saveManager;
    this.yaw = 0;
    this.pitch = 0.36;
    this.distance = 8.4;
    this.currentPos = new THREE.Vector3(0, 6, 10);
    this.lookTarget = new THREE.Vector3(0, 2, 0);
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.raycaster = new THREE.Raycaster();
  }

  snapBehind(facingAngle, targetPos) {
    this.yaw = facingAngle + Math.PI;
    this.pitch = 0.34;
    this.lookTarget.set(targetPos.x, targetPos.y + 1.35, targetPos.z);
    const desired = this.computeDesiredPosition(this.distance);
    this.currentPos.copy(desired);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.lookTarget);
  }

  shake(intensity = 0.35, duration = 0.25) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  computeDesiredPosition(dist = this.distance) {
    const horizDist = Math.cos(this.pitch) * dist;
    const vertDist = Math.sin(this.pitch) * dist;
    return new THREE.Vector3(
      this.lookTarget.x + Math.sin(this.yaw) * horizDist,
      this.lookTarget.y + vertDist,
      this.lookTarget.z + Math.cos(this.yaw) * horizDist
    );
  }

  update(dt, player, input, obstacleMeshes = []) {
    const sens = 0.0045 * (this.saveManager.data.cameraSensitivity || 1.0);
    const delta = input.consumeCameraDelta();
    this.yaw -= delta.x * sens;
    this.pitch = Math.max(0.08, Math.min(1.15, this.pitch + delta.y * sens));
    const desiredLook = new THREE.Vector3(player.pos.x, player.pos.y + 1.35, player.pos.z);
    this.lookTarget.lerp(desiredLook, Math.min(1, dt * 14));

    let effectiveDist = this.distance;
    const idealPos = this.computeDesiredPosition(this.distance);

    if (obstacleMeshes.length > 0) {
      const dir = idealPos.clone().sub(this.lookTarget).normalize();
      this.raycaster.set(this.lookTarget, dir);
      this.raycaster.far = this.distance;
      const hits = this.raycaster.intersectObjects(obstacleMeshes, true);
      if (hits.length > 0 && hits[0].distance < this.distance) {
        effectiveDist = Math.max(2.2, hits[0].distance - 0.35);
      }
    }

    const desiredPos = this.computeDesiredPosition(effectiveDist);
    this.currentPos.lerp(desiredPos, Math.min(1, dt * 12));

    this.camera.position.copy(this.currentPos);
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
    } else {
      this.shakeIntensity = 0;
    }

    this.camera.lookAt(this.lookTarget);
  }
}
