import assert from 'node:assert/strict';
import test from 'node:test';
import { GEORGE_VOICE, JAMES_VOICE, fallbackVoice, preferredVoice } from '../shared/ttsVoice.ts';

test('preferred voice uses the env id when set', () => {
  assert.equal(preferredVoice('goT3UYdM9bhm0n2lmKQx'), 'goT3UYdM9bhm0n2lmKQx');
  assert.equal(preferredVoice('  xru6qZB94sJdkyqP12qN  '), JAMES_VOICE);
});

test('preferred voice defaults to James when env is empty', () => {
  assert.equal(preferredVoice(undefined), JAMES_VOICE);
  assert.equal(preferredVoice(''), JAMES_VOICE);
  assert.equal(preferredVoice('   '), JAMES_VOICE);
});

test('402 on a library voice falls back to premade George', () => {
  assert.equal(fallbackVoice(JAMES_VOICE, 402), GEORGE_VOICE);
  assert.equal(fallbackVoice('goT3UYdM9bhm0n2lmKQx', 402), GEORGE_VOICE);
});

test('George is never retried against himself', () => {
  assert.equal(fallbackVoice(GEORGE_VOICE, 402), null);
});

test('non-payment failures do not switch voice', () => {
  assert.equal(fallbackVoice(JAMES_VOICE, 401), null);
  assert.equal(fallbackVoice(JAMES_VOICE, 404), null);
  assert.equal(fallbackVoice(JAMES_VOICE, 500), null);
});
