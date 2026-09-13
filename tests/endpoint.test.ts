// When the mic is allowed to close.
//
// The old rule was one fixed number: 1800ms of quiet after any partial, and a
// mere 400ms after the browser's own onspeechend. A trailing "um—" reads as
// end-of-speech to the recogniser, so the mic shut and a fragment was processed
// as a command. Every case here is something someone actually says half way
// through a thought; none of them may close the mic early.
import assert from 'node:assert/strict';
import test from 'node:test';
import { hasFillerTail, isExplicitEnd, isIncomplete, silenceMs } from '../shared/endpoint.ts';

// Anything at or above this is "he is still talking, wait".
const PATIENT = 1400;

test('a trailing filler means he is still talking', () => {
  for (const said of ['I need to, um', 'I need to um—', 'Right, so', 'Book the, ah', 'Tell her that, like']) {
    assert.equal(hasFillerTail(said), true, `should read as still talking: ${said}`);
    assert.ok(silenceMs(said) >= PATIENT, `should wait longer: ${said}`);
  }
});

test('a held-open phrase is not a command', () => {
  for (const said of ['hold on', 'hang on', 'actually', 'I mean', 'wait']) {
    assert.equal(hasFillerTail(said), true, `should read as still talking: ${said}`);
    assert.ok(silenceMs(said) >= PATIENT, `should wait longer: ${said}`);
  }
});

test('an unfinished clause waits', () => {
  for (const said of [
    'Remind me to',
    'I need to',
    'Can you',
    'Tomorrow at',
    'Add',
    'Call',
    'Dinner with Mum tomorrow at',
    'Put it in the diary for',
    'Wait, no',
  ]) {
    assert.equal(isIncomplete(said), true, `should read as unfinished: ${said}`);
    assert.ok(silenceMs(said) >= PATIENT, `should wait longer: ${said}`);
  }
});

test('a finished sentence closes promptly', () => {
  for (const said of [
    'Remind me dinner with Mum tomorrow at five',
    'Add milk to the list',
    'What have I got on today',
    'Tick ring the dentist off',
    'Nothing, thanks',
  ]) {
    assert.equal(isIncomplete(said), false, `should read as finished: ${said}`);
    assert.equal(hasFillerTail(said), false, `should read as finished: ${said}`);
    assert.ok(silenceMs(said) <= 1000, `should close promptly: ${said}`);
  }
});

test('an explicit closer ends the turn at once', () => {
  for (const said of ["that's it", 'thats it', 'That is all', 'go ahead', 'send it', 'Remind me at five, that’s it']) {
    assert.equal(isExplicitEnd(said), true, `should end the turn: ${said}`);
    assert.equal(silenceMs(said), 0, `should close at once: ${said}`);
  }
});

// "done" is the routine answer as well as a closer, so it only counts when it is
// the whole utterance. "I need to get this done" is an ordinary sentence.
test('done closes only when it is the whole of what was said', () => {
  assert.equal(isExplicitEnd('done'), true);
  assert.equal(isExplicitEnd('Done.'), true);
  assert.equal(isExplicitEnd('I need to get this done'), false);
  assert.ok(silenceMs('I need to get this done') > 0);
});

// A short answer carries little for the recogniser to work with, so it keeps its
// own window rather than the plain sentence one. A filler still outranks it:
// being early is the unrecoverable mistake, being late costs a moment.
test('a short answer has its own window, and a filler still outranks it', () => {
  const short = silenceMs('yes', { expectShort: true });
  assert.ok(short >= 700 && short <= 1200, `short answer window out of band: ${short}`);
  assert.ok(silenceMs('um', { expectShort: true }) >= PATIENT);
});

// Nothing heard yet is the caller's business (voice.ts keeps its own lead-in),
// so an empty string must not be mistaken for a finished sentence.
test('silence so far is never treated as a finished sentence', () => {
  assert.equal(isIncomplete(''), true);
  assert.ok(silenceMs('') >= PATIENT);
  assert.ok(silenceMs('   ') >= PATIENT);
});
