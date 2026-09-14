// Sitting with someone is mostly not talking. These pin the two lines it is
// allowed to say and the length it was asked for.
import assert from 'node:assert/strict';
import test from 'node:test';
import { asksToStay, elapsedLine, spanLabel, stayingLine } from '../shared/companion.ts';

test('the length asked for is the length held', () => {
  assert.equal(asksToStay('stay with me for twenty minutes'), 20);
  assert.equal(asksToStay('stay with me for 45 minutes'), 45);
  assert.equal(asksToStay('keep me company for half an hour'), 30);
  assert.equal(asksToStay('sit with me for an hour'), 60);
  assert.equal(asksToStay('stay with me for two hours'), 120);
  assert.equal(asksToStay('stick with me for an hour and a half'), 90);
});

test('no length given still gets a definite one', () => {
  assert.equal(asksToStay('stay with me'), 20);
  assert.equal(asksToStay('keep me company a while'), 20);
});

test('it does not answer a question it was not asked', () => {
  assert.equal(asksToStay('what have I got on today'), null);
  assert.equal(asksToStay('remind me in twenty minutes'), null);
  assert.equal(asksToStay('morning'), null);
});

// A deadline days out is not company, it is a forgotten timer.
test('an absurd length is brought back to something sane', () => {
  assert.equal(asksToStay('stay with me for 900 hours'), 8 * 60);
  assert.equal(asksToStay('stay with me for 0 minutes'), 20);
});

test('a stretch of time is said the way a person says it', () => {
  assert.equal(spanLabel(30), 'half an hour');
  assert.equal(spanLabel(60), 'an hour');
  assert.equal(spanLabel(90), 'an hour and a half');
  assert.equal(spanLabel(120), '2 hours');
  assert.equal(spanLabel(20), '20 minutes');
});

// Two lines, both short, and neither claiming anything was done.
test('it says one thing on being asked and one when the time is up', () => {
  assert.equal(stayingLine(20), "I'll be here. 20 minutes.");
  assert.equal(stayingLine(30), "I'll be here. Half an hour.");
  assert.equal(elapsedLine(20), "That's 20 minutes gone.");
  assert.equal(elapsedLine(60), "That's an hour gone.");
});
