// "What am I doing first?" and "Read me the day", answered off the board.
//
// The thing being defended here is that an empty board stays empty out loud.
// Every number and every name in the spoken line has to come off a real row.
import assert from 'node:assert/strict';
import test from 'node:test';
import { ASKS_FIRST_TASK, ASKS_FOR_THE_DAY, firstTask, firstTaskLine, readTheDay } from '../shared/daySpeak.ts';
import type { CavenData } from '../src/lib/store';

const NOW = new Date('2026-09-13T08:00:00+09:30'); // Sunday morning

const empty = (): CavenData => ({
  tasks: [],
  habits: [],
  reminders: [],
  calendar: [],
  voiceNotes: [],
  transactions: [],
  budgets: [],
  journal: [],
  brainMetrics: [],
  interests: [],
  brainNotes: [],
  address: 'sir',
});

const board = (over: Partial<CavenData>): CavenData => ({ ...empty(), ...over });

test('an empty board has nothing to say about the day', () => {
  assert.equal(readTheDay(empty(), NOW), 'Nothing saved for today.');
  assert.equal(readTheDay(null, NOW), 'Nothing saved for today.');
  assert.equal(firstTask(empty()), null);
});

test('the first open task is the one he has not done', () => {
  const data = board({
    tasks: [
      { id: '1', title: 'ring the dentist', done: true },
      { id: '2', title: 'call the bank', done: false },
      { id: '3', title: 'book the car in', done: false },
    ],
  });
  assert.equal(firstTask(data), 'call the bank');
  assert.equal(firstTaskLine(data), 'Call the bank.');
});

// Nothing open is a real answer, but a blunt "nothing" to a question that might
// have meant something richer is not. Null hands the turn to the model.
test('nothing open hands the turn on rather than answering flatly', () => {
  assert.equal(firstTaskLine(empty()), null);
  assert.equal(firstTaskLine(board({ tasks: [{ id: '1', title: 'done thing', done: true }] })), null);
});

test('the day names only what is actually saved', () => {
  const data = board({
    calendar: [{ id: 'e1', title: 'dinner with Mum', time: '6:00 pm', kind: 'event', at: '2026-09-13T18:00:00+09:30' }],
    reminders: [{ id: 'r1', title: 'ring the bank', date: '13/09/2026', time: '9:00 am', dueAt: '2026-09-13T09:00:00+09:30' }],
    tasks: [{ id: 't1', title: 'book the car in', done: false }],
  });
  const said = readTheDay(data, NOW);
  assert.match(said, /dinner with Mum at 6:00 pm/i);
  assert.match(said, /a reminder to ring the bank at 9:00 am/i);
  assert.match(said, /book the car in is still on your list/i);
  // Spoken aloud, so no markup and no list formatting.
  assert.doesNotMatch(said, /[*•\-]\s/);
});

test('a missing piece is left out, not announced', () => {
  const data = board({ tasks: [{ id: 't1', title: 'book the car in', done: false }] });
  const said = readTheDay(data, NOW);
  assert.equal(said, 'Book the car in is still on your list.');
  assert.doesNotMatch(said, /diary|calendar|reminder/i);
});

// Today is deliberately left unnamed — "at six", not "today at six" — but any
// other day has to be said, or a Tuesday appointment sounds like this morning.
test('a later day is named and today is not', () => {
  const today = board({
    calendar: [{ id: 'e1', title: 'dentist', time: '9:00 am', kind: 'event', at: '2026-09-13T09:00:00+09:30' }],
  });
  assert.equal(readTheDay(today, NOW), 'Dentist at 9:00 am.');

  const tomorrow = board({
    calendar: [{ id: 'e1', title: 'dentist', time: '9:00 am', kind: 'event', at: '2026-09-14T09:00:00+09:30' }],
  });
  assert.equal(readTheDay(tomorrow, NOW), 'Dentist tomorrow at 9:00 am.');
});

// Yesterday's dinner is not part of today, and reading it out would be worse
// than saying nothing.
test('a day that has been and gone is not read back', () => {
  const data = board({
    calendar: [{ id: 'e1', title: 'dinner with Mum', time: '6:00 pm', kind: 'event', at: '2026-09-12T18:00:00+09:30' }],
  });
  assert.equal(readTheDay(data, NOW), 'Nothing saved for today.');
});

// Rows written before ISO stamps existed have no `at`. boardBrief treats those
// as today rather than discarding them, and so must this.
test('an older undated row is still today', () => {
  const data = board({ calendar: [{ id: 'e1', title: 'gym', time: '7:00 am', kind: 'routine' }] });
  assert.equal(readTheDay(data, NOW), 'Gym at 7:00 am.');
});

// The stored human string is what gets spoken, exactly as it was saved, rather
// than a re-rendering of the stamp that might disagree with the board on screen.
test('the time is spoken the way the board holds it', () => {
  const data = board({
    reminders: [{ id: 'r1', title: 'bins out', date: '13/09/2026', time: '6:26pm', dueAt: '2026-09-13T18:26:00+09:30' }],
  });
  assert.match(readTheDay(data, NOW), /6:26pm/);
});

test('the two questions are recognised, and ordinary talk is not', () => {
  for (const said of ['what am I doing first', "what's first", 'where do I start', 'What should I do first?']) {
    assert.equal(ASKS_FIRST_TASK.test(said), true, `should ask for the first task: ${said}`);
  }
  for (const said of ['read me the day', 'run me through my day', "how's my day looking", 'what does my day look like']) {
    assert.equal(ASKS_FOR_THE_DAY.test(said), true, `should ask for the day: ${said}`);
  }
  for (const said of ['morning', 'hey how you going?', 'remind me to ring the bank', 'what have I got on today']) {
    assert.equal(ASKS_FIRST_TASK.test(said), false, `should not ask for the first task: ${said}`);
    assert.equal(ASKS_FOR_THE_DAY.test(said), false, `should not ask for the day: ${said}`);
  }
});
