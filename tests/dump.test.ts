// Thinking aloud is not a list of instructions. Nothing here writes anything —
// these are the rules that decide whether he gets asked first.
import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmLine, extractItems, isAffirmative, isNegative, readDump } from '../shared/dump.ts';

test('a head being emptied is read back, not saved', () => {
  const items = readDump('I need to call Sam, book the dentist, and remember the invoice');
  assert.deepEqual(items, ['call Sam', 'book the dentist', 'remember the invoice']);
  assert.equal(
    confirmLine(items!),
    "That's three things: call Sam, book the dentist, remember the invoice. Shall I save them?",
  );
});

test('the opener does not end up in the first item', () => {
  assert.deepEqual(readDump("I've got to ring the bank, then post the form"), ['ring the bank', 'post the form']);
  assert.deepEqual(readDump('I should book the car in and chase the invoice'), [
    'book the car in',
    'chase the invoice',
  ]);
});

// One errand said plainly is an instruction. Making him confirm it would be
// officious, and it already has a perfectly good path through the action engine.
test('a single errand is not a dump', () => {
  assert.equal(readDump('I need to call Sam'), null);
  assert.equal(readDump('remind me to ring the bank at nine'), null);
  assert.equal(readDump('what have I got on today'), null);
  assert.equal(readDump('morning'), null);
});

// The dangerous split. "Sam and Jo" is one errand with two people in it, and
// breaking it apart would save a task called "Jo".
test('a name after "and" does not become an errand of its own', () => {
  assert.deepEqual(extractItems('call Sam and Jo'), ['call Sam and Jo']);
  assert.equal(readDump('I need to call Sam and Jo'), null);
});

test('the same thing said twice is one thing', () => {
  assert.deepEqual(readDump('I need to call Sam, book the dentist, and call Sam'), ['call Sam', 'book the dentist']);
});

test('a yes and a no are told apart', () => {
  for (const said of ['yes', 'Yeah', 'go on', 'save them', 'please do', 'do it', "that's right"]) {
    assert.equal(isAffirmative(said), true, `should be a yes: ${said}`);
    assert.equal(isNegative(said), false, `should not be a no: ${said}`);
  }
  for (const said of ['no', 'nope', 'not those', "don't", 'leave them']) {
    assert.equal(isNegative(said), true, `should be a no: ${said}`);
    assert.equal(isAffirmative(said), false, `should not be a yes: ${said}`);
  }
  // Neither. He has moved on, and the queue should not claim the utterance.
  for (const said of ['what have I got on today', 'remind me to ring the bank']) {
    assert.equal(isAffirmative(said), false, `should not be a yes: ${said}`);
    assert.equal(isNegative(said), false, `should not be a no: ${said}`);
  }
});
