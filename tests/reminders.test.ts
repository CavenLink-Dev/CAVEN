import assert from 'node:assert/strict';
import test from 'node:test';
import { dueLine, isDue, nextDue, notificationBody, settle, type DueReminder } from '../shared/reminders.ts';
import { nextOccurrenceIn } from '../shared/when.ts';

const NOW = new Date('2026-09-11T10:00:00+09:30'); // Friday morning

const reminder = (over: Partial<DueReminder> = {}): DueReminder => ({
  id: 'r1',
  title: 'Take the tablets',
  date: '11/09/2026',
  time: '9:00 am',
  dueAt: '2026-09-10T23:30:00.000Z', // 9:00 am Adelaide, an hour ago
  ...over,
});

test('a reminder is due once its time has passed, and only until announced', () => {
  assert.equal(isDue(reminder(), NOW), true);
  assert.equal(isDue(reminder({ dueAt: '2026-09-11T09:00:00.000Z' }), NOW), false, 'not yet due');
  assert.equal(isDue(reminder({}), new Date('2026-09-11T08:00:00+09:30')), false);
  // Announced after it fell due: finished with.
  assert.equal(isDue(reminder({ firedAt: '2026-09-11T00:00:00.000Z' }), NOW), false);
  // Announced *before* this occurrence — a repeat that has come round again.
  assert.equal(isDue(reminder({ firedAt: '2026-09-09T23:30:00.000Z' }), NOW), true);
  assert.equal(isDue(reminder({ dueAt: undefined }), NOW), false);
});

test('the oldest thing owed is the one announced next', () => {
  const rows = [
    reminder({ id: 'later', dueAt: '2026-09-11T00:15:00.000Z' }),
    reminder({ id: 'oldest', dueAt: '2026-09-10T20:00:00.000Z' }),
    reminder({ id: 'future', dueAt: '2026-09-12T00:00:00.000Z' }),
  ];
  assert.equal(nextDue(rows, NOW)?.id, 'oldest');
  assert.equal(nextDue([reminder({ dueAt: '2026-09-12T00:00:00.000Z' })], NOW), null);
});

test('a late reminder is announced as late, not as now', () => {
  const justNow = dueLine(reminder({ dueAt: '2026-09-11T00:20:00.000Z' }), NOW, 'sir');
  assert.match(justNow, /Take the tablets/);
  assert.doesNotMatch(justNow, /was due/i);

  const hoursOld = dueLine(reminder({ dueAt: '2026-09-10T20:00:00.000Z' }), NOW, 'sir');
  assert.match(hoursOld, /was due/i);
  assert.match(hoursOld, /sir/);
  // Spoken aloud: no markdown, no bullets, no stage directions.
  assert.doesNotMatch(hoursOld, /[*_#`]/);
});

test('a one-off is stamped and stays put', () => {
  const settled = settle(reminder(), NOW);
  assert.ok(settled.firedAt);
  assert.equal(settled.dueAt, reminder().dueAt, 'a one-off must not move');
});

test('a repeating one rolls on to its next occurrence', () => {
  const settled = settle(reminder({ repeat: 'daily', timezone: 'Australia/Adelaide' }), NOW);
  assert.ok(settled.dueAt);
  assert.ok(new Date(settled.dueAt as string).getTime() > NOW.getTime(), 'did not move past now');
  // Same clock time, next day, printed in the user's own zone.
  assert.equal(settled.time, '9:00 am');
  assert.equal(settled.date, '12/09/2026');
});

test('a weekday repeat skips the weekend in the user zone, not the server one', () => {
  // 9:00 am Monday in Adelaide is 23:30 Sunday in UTC. A server reasoning in UTC
  // reads that as a Sunday and pushes it to "Monday" a day late, every week.
  const fridayNine = new Date('2026-09-11T23:30:00.000Z'); // 9:00 am Sat 12 Sep Adelaide
  const next = nextOccurrenceIn(
    new Date('2026-09-10T23:30:00.000Z'), // 9:00 am Fri 11 Sep Adelaide
    'weekdays',
    fridayNine,
    'Australia/Adelaide',
  );
  const localDay = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Adelaide', weekday: 'long' }).format(next);
  assert.equal(localDay, 'Monday');
  const localTime = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Adelaide',
    hour: 'numeric',
    minute: '2-digit',
  }).format(next);
  assert.equal(localTime, '9:00 am');
});

test('an occurrence is never announced twice', () => {
  const settled = settle(reminder({ repeat: 'daily', timezone: 'Australia/Adelaide' }), NOW);
  assert.equal(isDue(settled, NOW), false, 'settled and still due');
});

test('a notification body says when, in the user zone and not the server one', () => {
  assert.equal(notificationBody(reminder({ dueAt: '2026-09-11T00:20:00.000Z' }), NOW), 'Reminder from CAVEN');
  // Composed on the server, which runs in UTC. 20:00 UTC is 5:30 am in Adelaide,
  // and it is the user's clock that has to be right.
  const late = reminder({ dueAt: '2026-09-10T20:00:00.000Z', timezone: 'Australia/Adelaide' });
  assert.equal(notificationBody(late, NOW), 'Due at 5:30 am');
  // No relative day, because "today" is a different day in the two zones.
  assert.doesNotMatch(notificationBody(late, NOW), /today|tomorrow/i);
});
