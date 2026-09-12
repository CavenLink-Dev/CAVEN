import assert from 'node:assert/strict';
import test from 'node:test';
import {
  alignToRule,
  dayKey,
  dayLabel,
  daysBetween,
  monthKey,
  nextOccurrence,
  parseStamp,
  readRepeat,
  repeatLabel,
  stepOccurrence,
} from '../shared/when.ts';
import { boardBrief } from '../shared/boardBrief.ts';

const NOW = new Date('2026-09-11T10:00:00+09:30'); // Friday

test('a day key is the local day, not the UTC one', () => {
  assert.equal(dayKey(NOW), '2026-09-11');
  // 08:00 Adelaide is still the previous day in UTC; the key must not slip.
  assert.equal(dayKey(new Date('2026-09-11T08:00:00+09:30')), '2026-09-11');
});

test('stored dates of every vintage read back', () => {
  // The shape written since ISO stamps landed.
  assert.equal(dayKey(parseStamp('2026-09-12T09:30:00.000Z') as Date), '2026-09-12');
  // The older en-AU shape, day first — Date.parse would call this 9 December.
  assert.equal(dayKey(parseStamp('12/09/2026') as Date), '2026-09-12');
  // One of our own day keys, which must mean that local day.
  assert.equal(dayKey(parseStamp('2026-09-12') as Date), '2026-09-12');
  assert.equal(parseStamp('not a date'), null);
  assert.equal(parseStamp(undefined), null);
});

test('days are counted by calendar day, not by elapsed hours', () => {
  const lateFriday = new Date('2026-09-11T23:30:00+09:30');
  const earlySaturday = new Date('2026-09-12T00:30:00+09:30');
  assert.equal(daysBetween(lateFriday, earlySaturday), 1);
  assert.equal(daysBetween(NOW, NOW), 0);
});

test('a day is spoken the way a person would say it', () => {
  assert.equal(dayLabel(new Date('2026-09-11T18:00:00+09:30'), NOW), 'today');
  assert.equal(dayLabel(new Date('2026-09-12T10:00:00+09:30'), NOW), 'tomorrow');
  assert.equal(dayLabel(new Date('2026-09-10T10:00:00+09:30'), NOW), 'yesterday');
  assert.equal(dayLabel(new Date('2026-09-15T10:00:00+09:30'), NOW), 'Tuesday');
  // Far enough out that a weekday name would be ambiguous.
  assert.match(dayLabel(new Date('2026-10-20T10:00:00+09:30'), NOW), /20 October/);
});

test('a month key groups by calendar month', () => {
  assert.equal(monthKey(NOW), '2026-09');
  assert.notEqual(monthKey(new Date('2026-08-31T23:00:00+09:30')), monthKey(NOW));
});

test('repeat phrases are read and lifted out cleanly', () => {
  const weekdays = readRepeat('remind me every weekday at 9am to take my tablets');
  assert.deepEqual(weekdays.rule, { repeat: 'weekdays' });
  assert.equal(weekdays.rest, 'remind me at 9am to take my tablets');

  assert.deepEqual(readRepeat('every day at 7pm').rule, { repeat: 'daily' });
  assert.deepEqual(readRepeat('water the plants weekly').rule, { repeat: 'weekly' });
  assert.deepEqual(readRepeat('every Tuesday at 6').rule, { repeat: 'weekly', weekday: 2 });
  // "every weekday" must win over "every day" — longest meaning first.
  assert.deepEqual(readRepeat('every weekday').rule, { repeat: 'weekdays' });
  assert.equal(readRepeat('remind me at 9am tomorrow').rule, null);
});

test('a weekday rule steps over the weekend', () => {
  const friday = new Date('2026-09-11T09:00:00+09:30');
  const next = stepOccurrence(friday, 'weekdays');
  assert.equal(next.getDay(), 1, 'Friday should roll to Monday');
  assert.equal(stepOccurrence(friday, 'daily').getDay(), 6);
  assert.equal(stepOccurrence(friday, 'weekly').getDate(), 18);
});

test('a missed run rolls forward to the next real occurrence, not past it', () => {
  const lastFired = new Date('2026-08-28T09:00:00+09:30'); // a Friday, a fortnight back
  const next = nextOccurrence(lastFired, 'weekdays', NOW);
  assert.ok(next.getTime() > NOW.getTime());
  assert.ok(next.getDay() >= 1 && next.getDay() <= 5, 'landed on a weekend');
  assert.equal(next.getHours(), 9, 'the time of day drifted');
});

test('a rule that has not started yet is pulled onto its own footing', () => {
  // "Every Monday at 9", said on a Friday, must wait for the Monday.
  const start = new Date('2026-09-11T09:00:00+09:30');
  const monday = alignToRule(start, { repeat: 'weekly', weekday: 1 }, NOW);
  assert.equal(monday.getDay(), 1);
  // "Every weekday at 6", said on a Saturday, must not open on the Saturday.
  const saturday = new Date('2026-09-12T06:00:00+09:30');
  const aligned = alignToRule(saturday, { repeat: 'weekdays' }, new Date('2026-09-12T05:00:00+09:30'));
  assert.ok(aligned.getDay() >= 1 && aligned.getDay() <= 5);
});

test('a rule says itself out loud', () => {
  assert.equal(repeatLabel('daily'), 'every day');
  assert.equal(repeatLabel('weekdays'), 'every weekday');
  assert.match(repeatLabel('weekly', new Date('2026-09-14T09:00:00+09:30')), /every Monday/);
});

test('the briefing separates today from what is merely coming', () => {
  const brief = boardBrief(
    {
      calendar: [
        { id: '1', title: 'Physio', time: '2:00 pm', kind: 'event', at: '2026-09-11T04:30:00.000Z' },
        { id: '2', title: 'UX audit check', time: '10:00 am', kind: 'event', at: '2026-09-12T00:30:00.000Z' },
      ],
    },
    NOW,
  );
  assert.match(brief, /Today: 2:00 pm Physio/);
  assert.match(brief, /Upcoming: tomorrow 10:00 am UX audit check/);
  // The bug: tomorrow's booking listed as today's.
  assert.doesNotMatch(brief, /Today:.*UX audit check/);
});

test('the briefing can actually see the notes it took', () => {
  const brief = boardBrief(
    { voiceNotes: [{ id: 'n', text: 'the UX audit notebook is in the blue drawer', when: '11/09/2026' }] },
    NOW,
  );
  // "I am afraid I cannot see the contents of those notes, sir" — this is why.
  assert.match(brief, /Notes: the UX audit notebook is in the blue drawer/);
});

test('the briefing reads a habit tick by date, never by the stale flag', () => {
  const done = boardBrief({ habits: [{ id: 'h', name: 'Read', streak: 3, done: true, lastDone: '2026-09-11' }] }, NOW);
  assert.match(done, /Read streak 3 done today/);
  const stale = boardBrief({ habits: [{ id: 'h', name: 'Read', streak: 3, done: true, lastDone: '2026-09-10' }] }, NOW);
  assert.match(stale, /Read streak 3 not done/);
});

test('the briefing dates reminders in words and names a repeat', () => {
  const brief = boardBrief(
    {
      reminders: [
        { id: 'r', title: 'Tablets', date: '14/09/2026', time: '9:00 am', dueAt: '2026-09-13T23:30:00.000Z', repeat: 'weekdays' },
      ],
    },
    NOW,
  );
  assert.match(brief, /Tablets Monday 9:00 am repeats weekdays/);
});

test('an empty board briefs as nothing at all', () => {
  assert.equal(boardBrief({}), '');
  assert.equal(boardBrief(null), '');
});
