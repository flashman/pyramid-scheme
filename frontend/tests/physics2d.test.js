import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBody, SolidSet, resolveMove, contactDirection, moveSolids } from '../engine/physics2d.js';

const GROUND = { x: 0, y: 100, w: 1000, h: 50 };   // floor top at y=100

test('falls under gravity and lands on a floor solid', () => {
  const b = makeBody({ x: 50, y: 90 });
  b.vy = 20;
  resolveMove(b, [GROUND]);
  assert.equal(b.y, 100);
  assert.equal(b.vy, 0);
  assert.equal(b.grounded, true);
});

test('walking off a ledge clears grounded', () => {
  const ledge = { x: 0, y: 100, w: 40, h: 50 };
  const b = makeBody({ x: 30, y: 100 });
  b.vx = 25; b.vy = 1;
  resolveMove(b, [ledge]);
  assert.equal(b.grounded, false);
});

test('wall stops horizontal motion, zeroes vx, sets wallRight', () => {
  const wall = { x: 100, y: 0, w: 50, h: 200 };
  const b = makeBody({ x: 70, y: 100 });
  b.vx = 30;
  resolveMove(b, [GROUND, wall]);
  assert.equal(b.x, 100 - b.w / 2);
  assert.equal(b.vx, 0);
  assert.equal(b.wallRight, true);
});

test('step-up: a rise within maxStepUp is climbed while walking', () => {
  const step = { x: 100, y: 78, w: 100, h: 72 };   // 22px above the floor
  const b = makeBody({ x: 80, y: 100 });
  b.vx = 15;
  resolveMove(b, [GROUND, step], { maxStepUp: 23 });
  assert.equal(b.y, 78);
  assert.ok(b.x > 100 - b.w / 2);                  // walked onto it, not blocked
});

test('step-up refused when the rise exceeds maxStepUp', () => {
  const step = { x: 100, y: 60, w: 100, h: 90 };   // 40px rise
  const b = makeBody({ x: 80, y: 100 });
  b.vx = 15;
  resolveMove(b, [GROUND, step], { maxStepUp: 23 });
  assert.equal(b.x, 100 - b.w / 2);
  assert.equal(b.wallRight, true);
});

test('step-up refused when there is no headroom above the step', () => {
  const step = { x: 100, y: 90, w: 100, h: 60 };            // 10px rise — fits maxStepUp
  const lid  = { x: 100, y: 40, w: 100, h: 30 };            // ceiling 20px above step top
  const b = makeBody({ x: 80, y: 100 });                    // body is 34 tall — no room
  b.vx = 15;
  resolveMove(b, [GROUND, step, lid], { maxStepUp: 23 });
  assert.equal(b.x, 100 - b.w / 2);                         // blocked instead
});

test('one-way platform: passes through from below, lands from above', () => {
  const reed = { x: 40, y: 60, w: 40, h: 6, oneWay: true };
  const up = makeBody({ x: 60, y: 100 });
  up.vy = -50;                                     // jumping up through it (100 → 50)
  resolveMove(up, [GROUND, reed]);
  assert.equal(up.headBonk, false);
  assert.ok(up.y < 60);                            // passed through
  const down = makeBody({ x: 60, y: 50 });
  down.vy = 20;                                    // falling onto it
  resolveMove(down, [GROUND, reed]);
  assert.equal(down.y, 60);
  assert.equal(down.grounded, true);
});

test('ceiling: rising into a solid clamps, zeroes vy, sets headBonk, fires onBonk', () => {
  let bonked = null;
  const block = { x: 40, y: 20, w: 40, h: 20, onBonk: (b) => { bonked = b; } };
  const b = makeBody({ x: 60, y: 100 });
  b.vy = -80;                                      // head would pass block bottom (y=40)
  resolveMove(b, [GROUND, block]);
  assert.equal(b.y, 40 + b.h);                     // head clamped to block bottom
  assert.equal(b.vy, 0);
  assert.equal(b.headBonk, true);
  assert.equal(bonked, b);
});

test('externalVx (current) moves the body but respects walls and does not alter vx', () => {
  const wall = { x: 0, y: 0, w: 20, h: 200 };
  const b = makeBody({ x: 45, y: 100 });
  b.vx = 0;
  resolveMove(b, [GROUND, wall], { externalVx: -60 });
  assert.equal(b.x, 20 + b.w / 2);                 // swept into the wall, clamped
  assert.equal(b.vx, 0);
});

test('depenetration: geometry grown around the body lifts it to the surface', () => {
  const grown = { x: 0, y: 80, w: 200, h: 70 };    // new pyramid layer under our feet
  const b = makeBody({ x: 50, y: 100 });           // feet now inside it
  resolveMove(b, [grown]);
  assert.equal(b.y, 80);
});

test('SolidSet: providers are re-evaluated on rebuild', () => {
  const set = new SolidSet();
  set.addStatic([GROUND]);
  let wx = 100;
  set.addProvider(() => [{ x: wx, y: 90, w: 40, h: 10, oneWay: true }]);
  set.rebuild();
  assert.equal(set.all().length, 2);
  assert.equal(set.all()[1].x, 100);
  wx = 300;
  set.rebuild();
  assert.equal(set.all()[1].x, 300);
});

test('contactDirection classifies all four sides and non-overlap', () => {
  const b = makeBody({ x: 100, y: 100, w: 20, h: 20 });
  assert.equal(contactDirection(makeBody({ x: 100, y: 84,  w: 20, h: 20 }), b), 'top');
  assert.equal(contactDirection(makeBody({ x: 100, y: 116, w: 20, h: 20 }), b), 'bottom');
  assert.equal(contactDirection(makeBody({ x: 84,  y: 100, w: 20, h: 20 }), b), 'left');
  assert.equal(contactDirection(makeBody({ x: 116, y: 100, w: 20, h: 20 }), b), 'right');
  assert.equal(contactDirection(makeBody({ x: 500, y: 500, w: 20, h: 20 }), b), null);
});

test('moveSolids carries a grounded rider by the platform delta', () => {
  const plat = { x: 40, y: 60, w: 40, h: 10, vx: 3, vy: 0 };
  const b = makeBody({ x: 60, y: 60 });
  b.grounded = true;
  moveSolids([plat], b);
  assert.equal(plat.x, 43);
  assert.equal(b.x, 63);
});

test('moveSolids pushes a body it moves into; squish reported against a wall', () => {
  const pusher = { x: 0, y: 0, w: 50, h: 200, vx: 10, vy: 0 };
  const b = makeBody({ x: 65, y: 100 });           // clear of pusher (right edge 50 vs body left edge 55)
  const free = moveSolids([pusher], b);            // pusher → 10..60, overlaps body → push
  assert.equal(b.x, 60 + b.w / 2);                 // shoved to the pusher's new right edge (70)
  assert.equal(free, false);                       // not squished — nothing behind
  const wall = { x: 85, y: 0, w: 20, h: 200 };
  const squished = moveSolids([pusher, wall], b);  // pusher → 20..70, push to 80 → body overlaps wall
  assert.equal(squished, true);
});
