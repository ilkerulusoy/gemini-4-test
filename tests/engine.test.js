import assert from 'node:assert/strict';
import { PhysicsWorld } from '../src/engine/PhysicsWorld.js';
import { SaveManager } from '../src/state/SaveManager.js';
import { LEVELS } from '../src/levels/LevelRegistry.js';

// 1. Verify LevelRegistry integrity
assert.equal(LEVELS.length, 4, 'Must have 4 playable worlds');
const totalBears = LEVELS.reduce((acc, l) => acc + l.bears.length, 0);
assert.equal(totalBears, 10, 'Must have 10 unique rescuable bears across the Kingdom');

// 2. Verify Cannon-es Rigid-Body PhysicsWorld collision and dynamic crate gravity
const physics = new PhysicsWorld();
physics.addBox({ x: 0, y: -1, z: 0, w: 10, h: 2, d: 10 });
const crate = physics.addDynamicCrate({ x: 2, y: 4, z: 0, size: 1.2, mass: 5 });
assert.equal(crate.y, 4, 'Dynamic crate starts at y=4');

// Step Cannon-es simulation for 15 frames
for (let i = 0; i < 15; i++) {
  physics.updatePlatforms(1 / 60, i / 60);
}
assert.ok(crate.y < 3.5, 'Cannon-es gravity pulls dynamic crate downward');

// 3. Verify Seesaw HingeConstraint creation and water buoyancy zone
const seesaw = physics.addSeesaw({ x: -4, y: 1, z: 0, w: 8, h: 0.4, d: 2.5 });
assert.ok(seesaw.body, 'Seesaw has a Cannon-es rigid body');
assert.equal(physics.constraints.length, 1, 'Seesaw registers a HingeConstraint');

physics.addWaterZone({ x: 0, y: -5, z: 0, w: 50, h: 6, d: 50 });
const waterSurface = physics.getWaterSurfaceAt({ x: 0, y: -3, z: 0 });
assert.equal(waterSurface, -2, 'Water surface detected at y=-2');

// 4. Verify Player landing resolution
const dummyPlayer = {
  pos: { x: 0, y: 0.25, z: 0 },
  vel: { x: 0, y: -5, z: 0 },
  radius: 0.5,
  height: 1.6,
  grounded: false,
  groundCollider: null
};
physics.resolvePlayer(dummyPlayer, 0.1);
assert.equal(dummyPlayer.grounded, true, 'Player lands on ground box');
assert.equal(dummyPlayer.pos.y, 0, 'Player Y snaps to top of platform (y=0)');


// 4b. Verify Moving Platform carries the bear without dropping or ejecting
const movingPlat = physics.addBox({
  x: 10,
  y: 2,
  z: 0,
  w: 4,
  h: 1,
  d: 4,
  mover: (t) => ({ x: 10 + t * 6, y: 2 - t * 2, z: 0 })
});
const rider = {
  pos: { x: 10, y: 2.5, z: 0 },
  vel: { x: 0, y: -1, z: 0 },
  radius: 0.5,
  height: 1.6,
  grounded: true,
  groundCollider: movingPlat
};
for (let i = 1; i <= 20; i++) {
  physics.updatePlatforms(1 / 60, i / 60);
  rider.vel.y -= 30 * (1 / 60);
  physics.resolvePlayer(rider, 1 / 60);
  assert.equal(rider.grounded, true, `Bear stays grounded on moving platform at step ${i}`);
  assert.ok(Math.abs(rider.pos.x - movingPlat.x) < 0.01, 'Bear moves horizontally with platform');
}

// 4c. Verify Ledge Grab detection when jumping near an overhead rock ledge
physics.addBox({ x: 0, y: 2.0, z: -2.0, w: 4, h: 2, d: 4 });
const climber = {
  pos: { x: 0, y: 1.8, z: 0.35 },
  vel: { x: 0, y: 1.0, z: -2 },
  facingAngle: Math.PI,
  radius: 0.52,
  height: 1.65,
  grounded: false
};
const ledge = physics.findLedgeCandidate(climber);
assert.ok(ledge, 'Bear detects overhead rock ledge when jumping near its edge');
// 5. Verify SaveManager progression and shop unlocks
const save = new SaveManager();
save.reset();
assert.equal(save.getTotalRescued(), 0);
const isNew = save.rescueBear('tt_b1');
assert.equal(isNew, true);
assert.equal(save.getTotalRescued(), 1);
assert.equal(save.data.coins, 10, 'Rescuing a new bear awards 10 Honey Coins');

save.addCoins(50);
const buyRes = save.buyOrEquipHat('crown');
assert.equal(buyRes.ok, true);
assert.equal(save.data.equippedHat, 'crown');

console.log('ALL CANNON-ES PHYSICS, BUOYANCY, SEESAW & PROGRESSION TESTS PASSED');
