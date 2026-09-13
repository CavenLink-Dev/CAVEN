// Regression tests for the two ways CAVEN used to write, or claim to write,
// something the user never asked for. Both were observed in production on
// 13 Sep 2026 and are described in claude/user-review-13sep2026.md.
import assert from 'node:assert/strict';
import test from 'node:test';
import { claimsChange, runAction, type CavenAction } from '../shared/actions.ts';
import type { CavenData } from '../src/lib/store';

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

const NOW = new Date('2026-09-13T18:00:00+09:30');
const run = (action: CavenAction, prev: CavenData = empty()) => runAction(action, prev, NOW);

// ── claimsChange ────────────────────────────────────────────────────────────
// The exact line the deployed app spoke while deleting nothing at all.
test('claimsChange catches a bare past participle', () => {
  assert.equal(claimsChange('Removed.'), true);
  assert.equal(claimsChange('Done.'), true);
  assert.equal(claimsChange('Saved.'), true);
});

test('claimsChange catches first-person completions', () => {
  for (const line of [
    "I've added that to your list.",
    'I have put it in the diary.',
    "I've already logged it, sir.",
    "It's on the board for tomorrow at nine.",
    "That's off the list.",
    'Call the bank is off the board. Say undo if that was wrong.',
    // The phrasing most natural to him, and the easiest to say when nothing ran.
    'Consider it done.',
    'Consider it noted, sir.',
  ]) {
    assert.equal(claimsChange(line), true, `should claim: ${line}`);
  }
});

test('claimsChange leaves ordinary conversation alone', () => {
  for (const line of [
    'Just dinner with your mother at six.',
    'What would you like me to remind you about?',
    'Nothing on the list at all.',
    'A fair point, though what is done is rarely undone so easily.',
    "I'm afraid I've lost the thread there, sir.",
    'Which reminder should go, sir? Nothing has changed.',
    'Consider it carefully before you commit to it.',
  ]) {
    assert.equal(claimsChange(line), false, `should not claim: ${line}`);
  }
});

// ── subject() guards on the model write path ────────────────────────────────
// Production row: reminder titled "Hey there can you please set a reminder",
// invented for 6:00pm because the fast path refused and the model "recovered".
test('an utterance is never stored as a reminder title', () => {
  assert.throws(
    () => run({ do: 'reminder.add', title: 'Hey there can you please set a reminder', when: 'today at 6pm' }),
    /what should the reminder say/i,
  );
});

// Production row: a *deletion* stored as a new reminder.
test('a removal never becomes a new record', () => {
  assert.throws(
    () => run({ do: 'reminder.add', title: 'Delete the reminder titled check the UX audit', when: 'today at 6pm' }),
    /which reminder should go/i,
  );
  assert.throws(
    () => run({ do: 'task.add', title: 'remove the gym task' }),
    /which task should go/i,
  );
});

test('a whole sentence is too long to be a title', () => {
  assert.throws(
    () =>
      run({
        do: 'reminder.add',
        title: 'I was wondering whether you might possibly be able to remember for me that the bins go out on a Tuesday evening',
        when: 'tomorrow at 9am',
      }),
    /short version/i,
  );
});

test('command wrapping is stripped rather than stored', () => {
  const out = run({ do: 'reminder.add', title: 'remind me to call the bank', when: 'tomorrow at 9am' });
  assert.equal(out.changed, true);
  assert.equal(out.data.reminders[0]?.title, 'call the bank');
});

test('a real title still goes straight through', () => {
  for (const title of ['call the bank', 'Dinner with Mom', 'take the tablets', 'ring the dentist']) {
    const out = run({ do: 'reminder.add', title, when: 'tomorrow at 9am' });
    assert.equal(out.changed, true, `${title} should save`);
    assert.equal(out.data.reminders[0]?.title, title);
  }
});

test('a missing time is still refused outright', () => {
  assert.throws(() => run({ do: 'reminder.add', title: 'call the bank' }), /what date and time/i);
});
