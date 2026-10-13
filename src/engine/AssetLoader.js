import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class AssetLoader {
  static loader = new GLTFLoader();
  static cache = new Map();
  static pending = new Map();

  static loadGLB(url) {
    if (this.cache.has(url)) {
      return Promise.resolve(this.cloneModel(this.cache.get(url)));
    }
    if (this.pending.has(url)) {
      return this.pending.get(url).then((scene) => this.cloneModel(scene));
    }

    const p = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        resolve(new THREE.Group());
        return;
      }
      this.loader.load(
        url,
        (gltf) => {
          const root = gltf.scene;
          root.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.roughness = 0.58;
                child.material.metalness = 0.05;
                if (child.material.map) {
                  child.material.map.colorSpace = THREE.SRGBColorSpace;
                }
              }
            }
          });
          this.cache.set(url, root);
          resolve(root);
        },
        undefined,
        (err) => {
          reject(err);
        }
      );
    });

    this.pending.set(url, p);
    return p.then((scene) => this.cloneModel(scene));
  }

  static cloneModel(source) {
    const clone = source.clone(true);
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
      }
    });
    return clone;
  }

  static attachPetModel(targetGroup, petName = 'animal-polar', scale = 1.0, yOffset = 0, tintColor = null) {
    const url = `/assets/pets/${petName}.glb`;
    this.loadGLB(url)
      .then((model) => {
        model.scale.setScalar(scale);
        model.position.y = yOffset;
        if (tintColor !== null) {
          model.traverse((c) => {
            if (c.isMesh && c.material) {
              c.material.color.lerp(new THREE.Color(tintColor), 0.45);
            }
          });
        }
        targetGroup.add(model);
      })
      .catch(() => {});
  }

  static attachHexModel(targetGroup, hexName = 'unit-house', scale = 8.0, yOffset = 0) {
    const url = `/assets/hex/${hexName}.glb`;
    this.loadGLB(url)
      .then((model) => {
        model.scale.setScalar(scale);
        model.position.y = yOffset;
        targetGroup.add(model);
      })
      .catch(() => {});
  }
}
