import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canFocusCamera, improveCameraFocus } from '../artifacts/nasaem-inventory/src/lib/scanner-camera.ts';

function camera(caps = {}, reject = () => false) {
  const calls = [];
  return {
    calls,
    readyState: 'live',
    getCapabilities: () => caps,
    applyConstraints: async constraint => {
      calls.push(constraint);
      if (reject(constraint)) throw new Error('Unsupported camera constraint');
    },
  };
}

test('requests autofocus and exposure but never changes camera zoom', async () => {
  const track = camera({ focusMode: ['continuous', 'single-shot'], exposureMode: ['continuous'], zoom: { min: 1, max: 10 } });
  assert.equal(canFocusCamera(track), true);
  assert.equal(await improveCameraFocus(track), true);
  assert.deepEqual(track.calls, [
    { advanced: [{ focusMode: 'continuous' }] },
    { advanced: [{ exposureMode: 'continuous' }] },
  ]);
  await improveCameraFocus(track, true);
  assert.deepEqual(track.calls[2], { advanced: [{ focusMode: 'single-shot' }] });
  assert.ok(track.calls.every(call => !('zoom' in call.advanced[0])));
});

test('unsupported cameras still scan without optional constraints', async () => {
  const track = camera();
  assert.equal(canFocusCamera(track), false);
  assert.equal(await improveCameraFocus(track), false);
  assert.equal(track.calls.length, 0);
  track.getCapabilities = () => { throw new Error('Unavailable'); };
  assert.equal(await improveCameraFocus(track), false);
});

test('rejected focus does not prevent exposure or propagate an error', async () => {
  const track = camera({ focusMode: ['continuous'], exposureMode: ['continuous'] }, constraint => 'focusMode' in constraint.advanced[0]);
  assert.equal(await improveCameraFocus(track), false);
  assert.equal(track.calls.length, 2);
});

test('ended camera tracks are not modified', async () => {
  const track = camera({ focusMode: ['continuous'] });
  track.readyState = 'ended';
  assert.equal(await improveCameraFocus(track), false);
  assert.equal(track.calls.length, 0);
});
