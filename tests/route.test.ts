// What opens a card, and — far more often — what does not.
//
// A card is the loudest thing the app can do to a man who only said hello, so
// route() returns null for the overwhelming majority of speech. These tests pin
// that down before routines arrive: "morning" must stay a greeting rather than
// becoming a way to start the Morning routine, and a removal must keep taking
// the model path instead of the reminder fast path.
import assert from 'node:assert/strict';
import test from 'node:test';
import { route } from '../src/lib/cavenState.ts';

test('a greeting is conversation, never a card', () => {
  for (const said of [
    'hey',
    'morning',
    'good morning',
    'hey how you going?',
    "how's it going",
    'hello',
    'thanks',
    'ok',
    'nothing',
    'never mind',
    'stop',
    'what can you do',
  ]) {
    assert.equal(route(said), null, `should stay conversation: ${said}`);
  }
});

test('an explicit ask opens the card it asked for', () => {
  const cases: [string, string][] = [
    ['remind me to ring the bank at nine', 'reminder'],
    ["don't let me forget the bins", 'reminder'],
    ['add a task to call mum', 'tasks'],
    ['tick ring the dentist off', 'tasks'],
    ['what have I got on today', 'calendar'],
    ['what is on today', 'calendar'],
    ["what's on tomorrow", 'calendar'],
    ['make a note the spare key is in the drawer', 'voicenote'],
    ['journal: a long day', 'journal'],
  ];
  for (const [said, kind] of cases) {
    assert.equal(route(said)?.kind, kind, `should open ${kind}: ${said}`);
  }
});

// "delete the reminder for 6:26pm" matches the reminder intent on the words
// "reminder for", and the fast path once answered it by saving a *second*
// reminder for 6:26pm. Removal belongs to the model, which owns the delete verbs.
test('a removal never takes the reminder fast path', () => {
  for (const said of [
    'delete the reminder for 6:26pm',
    'remove the gym task',
    'cancel the reminder for six',
    'get rid of my dentist reminder',
  ]) {
    assert.equal(route(said), null, `should go to the model: ${said}`);
  }
});

// Routines are not built yet, and nothing about saying "morning" may start one
// when they are. Only an explicit instruction should ever run a routine.
test('a time of day does not start anything', () => {
  assert.equal(route('morning'), null);
  assert.equal(route('start the morning'), null);
  assert.equal(route('bedtime'), null);
});

test('nothing said opens nothing', () => {
  assert.equal(route(''), null);
  assert.equal(route('   '), null);
});
