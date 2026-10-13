import * as THREE from 'three';
import { CAPES } from '../state/SaveManager.js';

export function createBearRig({
  furColor = 0x9c5a25,
  bellyColor = 0xf6c992,
  hatId = 'none',
  capeId = 'none',
  scale = 1.0,
  isEnemy = false
} = {}) {
  const root = new THREE.Group();
  root.scale.setScalar(scale);

  // Squash & stretch wrapper group
  const squashGroup = new THREE.Group();
  root.add(squashGroup);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.74;
  squashGroup.add(bodyPivot);

  const furMat = new THREE.MeshStandardMaterial({
    color: furColor,
    roughness: 0.62,
    metalness: 0.04
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: bellyColor,
    roughness: 0.7
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: isEnemy ? 0xff0055 : 0x1a1412,
    roughness: 0.25
  });
  const blushMat = new THREE.MeshStandardMaterial({
    color: 0xff758f,
    roughness: 0.6,
    transparent: true,
    opacity: 0.75
  });

  // Rounded chubby plush torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.36, 10, 18), furMat);
  torso.scale.set(1.06, 1.0, 0.88);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  // Soft cream tummy patch
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.37, 16, 14), bellyMat);
  belly.scale.set(0.95, 1.08, 0.42);
  belly.position.set(0, -0.04, 0.31);
  torso.add(belly);

  // Cute backpack / honey pack on back
  const packMat = new THREE.MeshStandardMaterial({ color: 0x3a86ff, roughness: 0.5 });
  const packFlapMat = new THREE.MeshStandardMaterial({ color: 0xffbe0b, roughness: 0.4 });
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.52, 0.28), packMat);
  backpack.position.set(0, 0.04, -0.42);
  backpack.castShadow = true;
  const packFlap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.3), packFlapMat);
  packFlap.position.set(0, 0.22, 0);
  backpack.add(packFlap);
  torso.add(backpack);

  // Neck Bandana / Cape
  const capeInfo = CAPES.find((c) => c.id === capeId) || CAPES[0];
  const scarfMat = new THREE.MeshStandardMaterial({
    color: capeInfo.color,
    roughness: 0.48
  });
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.095, 10, 20), scarfMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.set(0, 0.43, 0);
  torso.add(scarf);

  const capePivot = new THREE.Group();
  capePivot.position.set(0, 0.42, -0.38);
  torso.add(capePivot);

  const isLongCape = capeId !== 'none';
  const capeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(isLongCape ? 0.86 : 0.32, isLongCape ? 0.9 : 0.34, 0.07),
    scarfMat
  );
  capeMesh.position.set(0, isLongCape ? -0.44 : -0.16, -0.05);
  capeMesh.castShadow = true;
  capePivot.add(capeMesh);

  // Fluffy pom-pom tail
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), furMat);
  tail.position.set(0, -0.34, -0.42);
  torso.add(tail);

  // Expressive Rounded Bear Head
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.54, 0);
  bodyPivot.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), furMat);
  head.scale.set(1.08, 0.96, 0.98);
  head.position.set(0, 0.38, 0.02);
  head.castShadow = true;
  headPivot.add(head);

  // Rounded muzzle / snout
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), bellyMat);
  snout.scale.set(1.15, 0.82, 0.95);
  snout.position.set(0, 0.27, 0.45);
  headPivot.add(snout);

  // Shiny button nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), darkMat);
  nose.scale.set(1.25, 0.85, 0.9);
  nose.position.set(0, 0.07, 0.2);
  snout.add(nose);

  // Smile mouth curve
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.075, 0.018, 6, 12, Math.PI),
    darkMat
  );
  mouth.rotation.x = Math.PI;
  mouth.position.set(0, -0.03, 0.21);
  snout.add(mouth);

  // Glossy Eyes + Sparkle Catchlights + Eyebrows + Rosy Cheeks
  const eyeGeo = new THREE.SphereGeometry(0.08, 12, 10);
  const leftEye = new THREE.Mesh(eyeGeo, darkMat);
  leftEye.position.set(-0.21, 0.44, 0.44);
  const rightEye = new THREE.Mesh(eyeGeo, darkMat);
  rightEye.position.set(0.21, 0.44, 0.44);
  headPivot.add(leftEye, rightEye);

  const pupilMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const lp = new THREE.Mesh(pupilGeo, pupilMat);
  lp.position.set(0.025, 0.03, 0.065);
  leftEye.add(lp);
  const rp = new THREE.Mesh(pupilGeo, pupilMat);
  rp.position.set(0.025, 0.03, 0.065);
  rightEye.add(rp);

  // Expressive eyebrows
  const browGeo = new THREE.BoxGeometry(0.16, 0.04, 0.04);
  const leftBrow = new THREE.Mesh(browGeo, darkMat);
  leftBrow.position.set(-0.21, 0.57, 0.44);
  leftBrow.rotation.z = 0.1;
  const rightBrow = new THREE.Mesh(browGeo, darkMat);
  rightBrow.position.set(0.21, 0.57, 0.44);
  rightBrow.rotation.z = -0.1;
  headPivot.add(leftBrow, rightBrow);

  // Rosy cheek blushes
  const cheekGeo = new THREE.SphereGeometry(0.075, 10, 8);
  const leftCheek = new THREE.Mesh(cheekGeo, blushMat);
  leftCheek.scale.set(1.2, 0.7, 0.4);
  leftCheek.position.set(-0.32, 0.32, 0.42);
  const rightCheek = new THREE.Mesh(cheekGeo, blushMat);
  rightCheek.scale.set(1.2, 0.7, 0.4);
  rightCheek.position.set(0.32, 0.32, 0.42);
  headPivot.add(leftCheek, rightCheek);

  // Round Teddy Ears
  const earGeo = new THREE.SphereGeometry(0.19, 14, 12);
  const innerEarGeo = new THREE.SphereGeometry(0.11, 10, 10);

  const leftEar = new THREE.Mesh(earGeo, furMat);
  leftEar.scale.set(1, 1, 0.55);
  leftEar.position.set(-0.38, 0.78, -0.02);
  const leftInner = new THREE.Mesh(innerEarGeo, bellyMat);
  leftInner.scale.set(1, 1, 0.4);
  leftInner.position.set(0, 0, 0.11);
  leftEar.add(leftInner);

  const rightEar = new THREE.Mesh(earGeo, furMat);
  rightEar.scale.set(1, 1, 0.55);
  rightEar.position.set(0.38, 0.78, -0.02);
  const rightInner = new THREE.Mesh(innerEarGeo, bellyMat);
  rightInner.scale.set(1, 1, 0.4);
  rightInner.position.set(0, 0, 0.11);
  rightEar.add(rightInner);
  headPivot.add(leftEar, rightEar);

  // Hat mount
  const hatAnchor = new THREE.Group();
  hatAnchor.position.set(0, 0.82, 0.02);
  headPivot.add(hatAnchor);
  const hatVisual = buildHatMesh(hatId);
  if (hatVisual) hatAnchor.add(hatVisual);

  // Capsule Arms with Cute Paw Pads
  const armGeo = new THREE.CapsuleGeometry(0.145, 0.34, 8, 12);
  const pawPadGeo = new THREE.SphereGeometry(0.08, 8, 8);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.56, 0.34, 0);
  const leftArm = new THREE.Mesh(armGeo, furMat);
  leftArm.position.y = -0.22;
  leftArm.castShadow = true;
  const leftPad = new THREE.Mesh(pawPadGeo, bellyMat);
  leftPad.position.set(0, -0.18, 0.1);
  leftArm.add(leftPad);
  leftArmPivot.add(leftArm);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.56, 0.34, 0);
  const rightArm = new THREE.Mesh(armGeo, furMat);
  rightArm.position.y = -0.22;
  rightArm.castShadow = true;
  const rightPad = new THREE.Mesh(pawPadGeo, bellyMat);
  rightPad.position.set(0, -0.18, 0.1);
  rightArm.add(rightPad);
  rightArmPivot.add(rightArm);

  bodyPivot.add(leftArmPivot, rightArmPivot);

  // Capsule Legs with Rounded Feet
  const legGeo = new THREE.CapsuleGeometry(0.17, 0.28, 8, 12);
  const footGeo = new THREE.SphereGeometry(0.18, 12, 10);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.25, -0.44, 0);
  const leftLeg = new THREE.Mesh(legGeo, furMat);
  leftLeg.position.y = -0.18;
  leftLeg.castShadow = true;
  const leftFoot = new THREE.Mesh(footGeo, furMat);
  leftFoot.scale.set(1.0, 0.65, 1.35);
  leftFoot.position.set(0, -0.16, 0.08);
  leftLeg.add(leftFoot);
  leftLegPivot.add(leftLeg);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.25, -0.44, 0);
  const rightLeg = new THREE.Mesh(legGeo, furMat);
  rightLeg.position.y = -0.18;
  rightLeg.castShadow = true;
  const rightFoot = new THREE.Mesh(footGeo, furMat);
  rightFoot.scale.set(1.0, 0.65, 1.35);
  rightFoot.position.set(0, -0.16, 0.08);
  rightLeg.add(rightFoot);
  rightLegPivot.add(rightLeg);

  bodyPivot.add(leftLegPivot, rightLegPivot);

  return {
    root,
    squashGroup,
    bodyPivot,
    headPivot,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    leftEye,
    rightEye,
    leftBrow,
    rightBrow,
    capePivot,
    tail,
    hatAnchor,
    scarfMat,
    capeMesh,
    setCosmetics(newHatId, newCapeId) {
      while (hatAnchor.children.length > 0) {
        hatAnchor.remove(hatAnchor.children[0]);
      }
      const nextHat = buildHatMesh(newHatId);
      if (nextHat) hatAnchor.add(nextHat);

      const cInfo = CAPES.find((c) => c.id === newCapeId) || CAPES[0];
      scarfMat.color.setHex(cInfo.color);
      const long = newCapeId !== 'none';
      capeMesh.scale.set(long ? 2.5 : 1, long ? 2.4 : 1, 1);
      capeMesh.position.y = long ? -0.42 : -0.16;
    }
  };
}

function buildHatMesh(hatId) {
  if (!hatId || hatId === 'none') return null;
  const g = new THREE.Group();

  if (hatId === 'crown') {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffc300,
      metalness: 0.6,
      roughness: 0.22
    });
    const rubyMat = new THREE.MeshStandardMaterial({
      color: 0xe63946,
      emissive: 0x550011
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.29, 0.22, 12), goldMat);
    base.position.y = 0.1;
    g.add(base);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 8), goldMat);
      spike.position.set(Math.cos(a) * 0.22, 0.26, Math.sin(a) * 0.22);
      g.add(spike);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), rubyMat);
    gem.position.set(0, 0.12, 0.3);
    g.add(gem);
  } else if (hatId === 'propeller') {
    const capMat = new THREE.MeshStandardMaterial({ color: 0x3a86ff, roughness: 0.45 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffbe0b, roughness: 0.35 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff006e, roughness: 0.35 });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      capMat
    );
    g.add(dome);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), yellowMat);
    stem.position.y = 0.38;
    g.add(stem);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.03, 0.11), redMat);
    blade.position.y = 0.48;
    blade.name = 'propellerBlade';
    g.add(blade);
  } else if (hatId === 'viking') {
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x8d99ae,
      metalness: 0.65,
      roughness: 0.32
    });
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xfefae0, roughness: 0.5 });
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.28, 12), ironMat);
    dome.position.y = 0.1;
    g.add(dome);
    const leftHorn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 8), hornMat);
    leftHorn.position.set(-0.44, 0.24, 0);
    leftHorn.rotation.z = 0.85;
    const rightHorn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 8), hornMat);
    rightHorn.position.set(0.44, 0.24, 0);
    rightHorn.rotation.z = -0.85;
    g.add(leftHorn, rightHorn);
  } else if (hatId === 'fez') {
    const fezMat = new THREE.MeshStandardMaterial({ color: 0xbc4749, roughness: 0.55 });
    const tasselMat = new THREE.MeshStandardMaterial({ color: 0xffb703 });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.36, 14), fezMat);
    cone.position.y = 0.16;
    const tassel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), tasselMat);
    tassel.position.set(0.18, 0.22, 0);
    g.add(cone, tassel);
  } else if (hatId === 'astronaut') {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x90e0ef,
      transparent: true,
      opacity: 0.5,
      metalness: 0.35,
      roughness: 0.08
    });
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 16), glassMat);
    helm.position.set(0, -0.38, 0.02);
    g.add(helm);
  }

  return g;
}
