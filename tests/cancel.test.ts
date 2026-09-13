// Calling a turn off costs nothing — and must never be confused with a deletion.
import assert from 'node:assert/strict';
import test from 'node:test';
import { isCancel } from '../shared/cancel.ts';
import { REMOVAL } from '../shared/actions.ts';

test('the whole utterance calls it off', () => {
  for (const said of [
    'stop',
    'Stop.',
    'cancel',
    'cancel that',
    'never mind',
    'Never mind!',
    'nevermind',
    'forget it',
    'Forget that.',
    'leave it',
    'drop it',
    'scrap that',
    'abort',
  ]) {
    assert.equal(isCancel(said), true, `should call it off: ${said}`);
  }
});

test('his chosen term of address does not defeat it', () => {
  assert.equal(isCancel('stop, sir', 'sir'), true);
  assert.equal(isCancel('never mind, Master', 'Master'), true);
  assert.equal(isCancel('Leave it, Your Lordship', 'Your Lordship'), true);
  assert.equal(isCancel('cancel that please', 'sir'), true);
  // The term he has not chosen is just a word, and a word makes it a sentence.
  assert.equal(isCancel('stop the timer', 'sir'), false);
});

// The line that matters. One extra word turns "drop it" into "drop this record",
// which is a removal: the model path owns that, asks which one was meant, and
// stashes it for undo. Answering it here would delete on a guess.
test('a cancel phrase with an object is not a cancel', () => {
  for (const said of [
    'never mind the dentist reminder',
    'forget the dentist reminder',
    'cancel the reminder for 6:26pm',
    'cancel my dentist appointment',
    'stop reminding me about the bins',
    'leave it with me',
  ]) {
    assert.equal(isCancel(said), false, `should not be read as calling it off: ${said}`);
  }
});

// And the ones that are removals still read as removals, so they keep taking the
// model path rather than the regex fast path.
test('removals stay removals', () => {
  assert.equal(REMOVAL.test('cancel the reminder for 6:26pm'), true);
  assert.equal(REMOVAL.test('delete the dentist reminder'), true);
});

test('nothing said is not a cancellation', () => {
  assert.equal(isCancel(''), false);
  assert.equal(isCancel('   '), false);
});
