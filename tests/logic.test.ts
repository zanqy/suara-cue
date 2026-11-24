import test from 'node:test';
import assert from 'node:assert/strict';
import {numSec, clampPct, fadeLevel, stateText} from '../src/logic.ts';

test('numSec rejects empty, invalid and negative values', () => {
  assert.equal(numSec(''), 0);
  assert.equal(numSec('abc'), 0);
  assert.equal(numSec(-2), 0);
  assert.equal(numSec(null), 0);
});
test('numSec accepts positive seconds and clamps at 30', () => {
  assert.equal(numSec(3), 3);
  assert.equal(numSec('5.5'), 5.5);
  assert.equal(numSec(45), 30);
});
test('clampPct keeps 0..100 integer', () => {
  assert.equal(clampPct(-4), 0);
  assert.equal(clampPct(101), 100);
  assert.equal(clampPct(48.6), 49);
});
test('fadeLevel interpolates linearly and clamps progress', () => {
  assert.equal(fadeLevel(80, 0, 0), 80);
  assert.equal(fadeLevel(80, 0, 0.5), 40);
  assert.equal(fadeLevel(80, 0, 1), 0);
  assert.equal(fadeLevel(0, 80, 2), 80);
});
test('stateText covers silent, fading and on-air states', () => {
  const base = {muted:false, active:true, fading:null as 'out'|'in'|null, level:80, left:0, src:'MUSIC', volume:80};
  assert.equal(stateText(base), 'ON AIR · MUSIC');
  assert.equal(stateText({...base, fading:'out', left:2.5}), 'HITUNG MUNDUR 2.5s');
  assert.equal(stateText({...base, level:0}), 'SUNYI · VOLUME 0%');
  assert.equal(stateText({...base, muted:true}), 'MUTE SEMUA');
  assert.equal(stateText({...base, active:false}), 'SIAP');
});
