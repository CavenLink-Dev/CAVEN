import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTION_VERBS,
  DEFAULT_ADDRESS,
  addressOf,
  applyCommand,
  habitDoneOn,
  parseActions,
  runAction,
  type CavenAction,
} from '../shared/actions.ts';
import { dayKeyOf } from '../shared/when.ts';
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

test('reminder save does not promise a nudge', () => {
  const now = new Date('2026-09-11T10:00:00+09:30');
  const result = applyCommand('reminder', 'remind me to call the dentist at 3pm tomorrow', empty(), now);
  assert.equal(result.changed, true);
  assert.match(result.message, /on the board/i);
  assert.doesNotMatch(result.message, /see to it|nudge|I'll see/i);
  assert.match(result.data.reminders[0]?.title ?? '', /dentist/i);
});

const NOW = new Date('2026-09-11T10:00:00+09:30');

/** A board that throws if an action tries to edit it in place. */
const frozen = (over: Partial<CavenData> = {}): CavenData => {
  const data = { ...empty(), ...over };
  for (const value of Object.values(data)) if (Array.isArray(value)) Object.freeze(value);
  return Object.freeze(data);
};

test('task.add writes a new list and leaves the old board alone', () => {
  const prev = frozen();
  const result = runAction({ do: 'task.add', title: 'Post the parcel', tag: 'errand' }, prev, NOW);
  assert.equal(result.changed, true);
  assert.equal(prev.tasks.length, 0);
  assert.equal(result.data.tasks.length, 1);
  assert.equal(result.data.tasks[0]?.title, 'Post the parcel');
  assert.equal(result.data.tasks[0]?.tag, 'errand');
  assert.equal(result.data.tasks[0]?.done, false);
});

test('an ambiguous name changes nothing and says so', () => {
  const prev = frozen({
    tasks: [
      { id: 'a', title: 'Call mum', done: false },
      { id: 'b', title: 'Call the bank', done: false },
    ],
  });
  // findOne names the candidates rather than demanding "the exact wording" —
  // the whole problem is that the user can't tell the two apart from memory.
  assert.throws(() => runAction({ do: 'task.done', title: 'call' }, prev, NOW), /2 that match/i);
  assert.throws(() => runAction({ do: 'task.done', title: 'call' }, prev, NOW), /Call mum or Call the bank/i);
});

test('a name that matches nothing changes nothing and says so', () => {
  const prev = frozen({ tasks: [{ id: 'a', title: 'Call mum', done: false }] });
  assert.throws(() => runAction({ do: 'task.delete', title: 'wash the car' }, prev, NOW), /no task/i);
});

test('an exact name beats a partial one', () => {
  const prev = frozen({
    tasks: [
      { id: 'a', title: 'Call mum', done: false },
      { id: 'b', title: 'Call mum back', done: false },
    ],
  });
  const result = runAction({ do: 'task.done', title: 'CALL MUM' }, prev, NOW);
  assert.equal(result.changed, true);
  assert.equal(result.data.tasks.find((t) => t.id === 'a')?.done, true);
  assert.equal(result.data.tasks.find((t) => t.id === 'b')?.done, false);
});

test('ticking an already-ticked task writes nothing', () => {
  const prev = frozen({ tasks: [{ id: 'a', title: 'Call mum', done: true }] });
  const result = runAction({ do: 'task.done', title: 'Call mum' }, prev, NOW);
  assert.equal(result.changed, false);
  assert.equal(result.data, prev);
});

test('task.undone puts a finished task back', () => {
  const prev = frozen({ tasks: [{ id: 'a', title: 'Call mum', done: true }] });
  const result = runAction({ do: 'task.undone', title: 'Call mum' }, prev, NOW);
  assert.equal(result.changed, true);
  assert.equal(result.data.tasks[0]?.done, false);
});

test('a reminder without a certain hour is refused, not guessed', () => {
  assert.throws(
    () => runAction({ do: 'reminder.add', title: 'Dentist', when: 'sometime next week' }, frozen(), NOW),
    /what date and time/i,
  );
});

test('a reminder in the past is refused', () => {
  assert.throws(
    () => runAction({ do: 'reminder.add', title: 'Dentist', when: '9am yesterday' }, frozen(), NOW),
    /already passed/i,
  );
});

test('reminder.add saves a future due time and does not promise a nudge', () => {
  const result = runAction({ do: 'reminder.add', title: 'Dinner with Mum', when: 'tomorrow at 6pm' }, frozen(), NOW);
  assert.equal(result.changed, true);
  const saved = result.data.reminders[0];
  assert.equal(saved?.title, 'Dinner with Mum');
  assert.ok(new Date(saved?.dueAt ?? 0).getTime() > NOW.getTime());
  assert.doesNotMatch(result.message, /nudge|I'?ll remind|alert/i);
});

test('event.add stores a readable clock time and a known kind', () => {
  const result = runAction(
    { do: 'event.add', title: 'Standup', when: 'tomorrow at 9am', kind: 'nonsense' },
    frozen(),
    NOW,
  );
  assert.equal(result.changed, true);
  assert.match(result.data.calendar[0]?.time ?? '', /\d{1,2}:\d{2}/);
  assert.equal(result.data.calendar[0]?.kind, 'event');
});

test('event.add keeps the day, not just the clock', () => {
  // The audit's case: asked for tomorrow, confirmed as tomorrow, filed as today.
  const result = runAction({ do: 'event.add', title: 'UX audit check', when: 'tomorrow at 10am' }, frozen(), NOW);
  const saved = result.data.calendar[0];
  assert.ok(saved?.at, 'the event lost its date');
  assert.equal(dayKeyOf(saved?.at), '2026-09-12');
  // And the spoken line has to agree with what was filed.
  assert.match(result.message, /tomorrow/i);
});

test('a delete is never answered by creating something', () => {
  // Verbatim from the audit. It matches the reminder intent on "reminder for",
  // reached the fast path and saved a second reminder for the same time.
  const said = 'Delete the reminder titled check the UX audit. It is the audit reminder for 6:26pm on the board.';
  const prev = frozen({
    reminders: [{ id: 'r', title: 'check the UX audit', date: '12/09/2026', time: '6:26 pm' }],
  });
  const result = applyCommand('reminder', said, prev, NOW);
  assert.equal(result.changed, false, 'the fast path wrote something on a delete');
  assert.equal(result.data.reminders.length, 1);
});

test('every phrasing of removal stays off the fast path', () => {
  const prev = frozen();
  for (const said of [
    'delete my 6pm reminder',
    'remove the reminder for 9am tomorrow',
    'cancel the reminder for tomorrow at 8am',
    'get rid of the reminder for 3pm',
    'take the dentist reminder off the board',
    'clear the reminder for 5pm today',
  ]) {
    assert.equal(applyCommand('reminder', said, prev, NOW).changed, false, said);
  }
});

test('a repeating reminder keeps its rule and a clean title', () => {
  const result = applyCommand('reminder', 'remind me every weekday at 9am to take my tablets', frozen(), NOW);
  assert.equal(result.changed, true);
  const saved = result.data.reminders[0];
  assert.equal(saved?.repeat, 'weekdays');
  // The repeat phrase used to survive into the title: "every weekday at take my tablets".
  assert.equal(saved?.title, 'take my tablets');
  assert.doesNotMatch(saved?.title ?? '', /every|weekday/i);
  assert.match(result.message, /every weekday/i);
});

test('a weekday rule never first fires at the weekend', () => {
  // Saturday morning. "Every weekday at 6" must open on the Monday.
  const saturday = new Date('2026-09-12T08:00:00+09:30');
  const result = applyCommand('reminder', 'remind me every weekday at 6pm to log off', frozen(), saturday);
  const due = new Date(result.data.reminders[0]?.dueAt ?? 0);
  assert.equal(due.getDay(), 1, 'first occurrence was not a Monday');
});

test('every Monday said on a Friday waits for the Monday', () => {
  const friday = new Date('2026-09-11T10:00:00+09:30');
  const result = runAction(
    { do: 'reminder.add', title: 'Team sync', when: 'every monday at 9am' },
    frozen(),
    friday,
  );
  const saved = result.data.reminders[0];
  assert.equal(saved?.repeat, 'weekly');
  assert.equal(new Date(saved?.dueAt ?? 0).getDay(), 1);
});

test('habit.done moves the streak once a day', () => {
  // Ticked yesterday, so today continues the run.
  const prev = frozen({
    habits: [{ id: 'h', name: 'Read', streak: 4, goal: 7, done: true, lastDone: '2026-09-10', icon: 'o' }],
  });
  const first = runAction({ do: 'habit.done', name: 'read' }, prev, NOW);
  assert.equal(first.changed, true);
  assert.equal(first.data.habits[0]?.streak, 5);
  assert.equal(first.data.habits[0]?.lastDone, '2026-09-11');
  const again = runAction({ do: 'habit.done', name: 'read' }, first.data, NOW);
  assert.equal(again.changed, false);
  assert.match(again.message, /already ticked today/i);
});

test('a habit ticked yesterday is tickable again today', () => {
  // The bug the audit caught: `done` was a bare boolean that nothing reset, so
  // the next day's tick was refused as "already ticked today" for ever.
  const prev = frozen({
    habits: [{ id: 'h', name: 'Read', streak: 1, goal: 7, done: true, lastDone: '2026-09-10', icon: 'o' }],
  });
  const nextMorning = new Date('2026-09-11T07:00:00+09:30');
  const result = runAction({ do: 'habit.done', name: 'Read' }, prev, nextMorning);
  assert.equal(result.changed, true);
  assert.equal(result.data.habits[0]?.streak, 2);
});

test('a skipped day starts the streak over rather than inflating it', () => {
  const prev = frozen({
    habits: [{ id: 'h', name: 'Read', streak: 9, goal: 7, done: true, lastDone: '2026-09-01', icon: 'o' }],
  });
  const result = runAction({ do: 'habit.done', name: 'Read' }, prev, NOW);
  assert.equal(result.changed, true);
  assert.equal(result.data.habits[0]?.streak, 1);
  assert.match(result.message, /day one/i);
});

test('habitDoneOn reads the date, never the stale flag', () => {
  assert.equal(habitDoneOn({ done: true, lastDone: '2026-09-11' }, NOW), true);
  assert.equal(habitDoneOn({ done: true, lastDone: '2026-09-10' }, NOW), false);
  // A board written before lastDone existed: the flag alone proves nothing.
  assert.equal(habitDoneOn({ done: true }, NOW), false);
});

test('habit.add fills the shape the board reads', () => {
  const result = runAction({ do: 'habit.add', name: 'Stretch' }, frozen(), NOW);
  const habit = result.data.habits[0];
  assert.equal(habit?.streak, 0);
  assert.equal(habit?.done, false);
  assert.ok((habit?.goal ?? 0) > 0);
  assert.ok(typeof habit?.icon === 'string' && habit.icon.length > 0);
});

test('spend.add stores money out as negative and moves the budget along', () => {
  const prev = frozen({ budgets: [{ id: 'b', category: 'Dining', spent: 40, limit: 200 }] });
  const result = runAction({ do: 'spend.add', label: 'Ramen', amount: '$24.50', category: 'dining' }, prev, NOW);
  assert.equal(result.changed, true);
  assert.equal(result.data.transactions[0]?.amount, -24.5);
  assert.equal(result.data.transactions[0]?.when, NOW.toLocaleDateString('en-AU'));
  assert.equal(result.data.budgets[0]?.spent, 64.5);
  assert.equal(prev.budgets[0]?.spent, 40);
});

test('budget.set creates one, then adjusts the same one', () => {
  const made = runAction({ do: 'budget.set', category: 'Coffee', limit: 60 }, frozen(), NOW);
  assert.equal(made.data.budgets[0]?.spent, 0);
  assert.equal(made.data.budgets[0]?.limit, 60);
  const moved = runAction({ do: 'budget.set', category: 'coffee', limit: 80 }, made.data, NOW);
  assert.equal(moved.data.budgets.length, 1);
  assert.equal(moved.data.budgets[0]?.limit, 80);
  const same = runAction({ do: 'budget.set', category: 'COFFEE', limit: 80 }, moved.data, NOW);
  assert.equal(same.changed, false);
});

test('journal, notes, brain and interests land on their own shelves', () => {
  const journal = runAction({ do: 'journal.add', body: 'A long day.', mood: 'tired' }, frozen(), NOW);
  assert.equal(journal.data.journal[0]?.body, 'A long day.');
  assert.equal(journal.data.journal[0]?.date, NOW.toLocaleDateString('en-AU'));
  const note = runAction({ do: 'note.add', text: 'Bin night is Tuesday' }, frozen(), NOW);
  assert.equal(note.data.voiceNotes[0]?.text, 'Bin night is Tuesday');
  const gone = runAction({ do: 'note.delete', text: 'bin night is tuesday' }, note.data, NOW);
  assert.equal(gone.data.voiceNotes.length, 0);
  const brain = runAction({ do: 'brain.note', text: 'Sleeps badly on Sundays' }, frozen(), NOW);
  assert.equal(brain.data.brainNotes[0], 'Sleeps badly on Sundays');
  const twice = runAction({ do: 'brain.note', text: 'sleeps badly on sundays' }, brain.data, NOW);
  assert.equal(twice.changed, false);
  const interest = runAction({ do: 'interest.add', name: 'Bouldering' }, frozen(), NOW);
  assert.equal(interest.data.interests[0], 'Bouldering');
});

test('an unknown verb changes nothing and claims nothing', () => {
  const prev = frozen();
  const result = runAction({ do: 'launch.rocket', title: 'Apollo' }, prev, NOW);
  assert.equal(result.changed, false);
  assert.equal(result.message, '');
  assert.equal(result.data, prev);
});

test('every listed verb is actually wired up', () => {
  for (const verb of ACTION_VERBS) {
    // Wired up means: called bare, it either refuses aloud or answers aloud.
    // Silence would mean the verb fell through to the unknown-verb default and
    // the prompt is advertising something runAction does not serve. `undo` is
    // the one that answers rather than throws — nothing to undo is not an error.
    let spoke = '';
    try {
      spoke = runAction({ do: verb }, frozen(), NOW).message;
    } catch (error) {
      spoke = error instanceof Error ? error.message : '';
    }
    assert.match(spoke, /\S/, `${verb} said nothing at all`);
  }
});

test('spoken confirmations stay speakable and vary', () => {
  const prev = frozen({
    tasks: [{ id: 't', title: 'Call mum', done: false }],
    habits: [{ id: 'h', name: 'Read', streak: 1, goal: 7, done: false, icon: 'o' }],
    budgets: [{ id: 'b', category: 'Dining', spent: 10, limit: 100 }],
  });
  const messages = [
    runAction({ do: 'task.add', title: 'Post the parcel' }, prev, NOW).message,
    runAction({ do: 'task.done', title: 'Call mum' }, prev, NOW).message,
    runAction({ do: 'habit.done', name: 'Read' }, prev, NOW).message,
    runAction({ do: 'spend.add', label: 'Ramen', amount: 24.5, category: 'Dining' }, prev, NOW).message,
    runAction({ do: 'journal.add', body: 'Quiet one.' }, prev, NOW).message,
    runAction({ do: 'note.add', text: 'Bin night' }, prev, NOW).message,
  ];
  for (const message of messages) {
    assert.doesNotMatch(message, /[*#`•]|!|\p{Extended_Pictographic}/u, message);
  }
  assert.equal(new Set(messages).size, messages.length);
});

test('parseActions leaves a plain reply alone', () => {
  const { spoken, actions } = parseActions('Very good, sir. The kettle is your affair.');
  assert.equal(spoken, 'Very good, sir. The kettle is your affair.');
  assert.deepEqual(actions, []);
});

test('parseActions lifts several blocks out, mid-sentence included', () => {
  const reply =
    'Right you are. [[ACT {"do":"task.add","title":"Post the parcel"}]] And the milk [[ACT {"do":"task.add","title":"Buy milk"}]] as well, sir.';
  const { spoken, actions } = parseActions(reply);
  assert.equal(spoken, 'Right you are. And the milk as well, sir.');
  assert.equal(actions.length, 2);
  assert.equal(actions[1]?.do, 'task.add');
});

test('parseActions discards malformed JSON without breaking the reply', () => {
  const { spoken, actions } = parseActions('Noted. [[ACT {"do":"task.add",,,}]] Anything else, sir?');
  assert.equal(spoken, 'Noted. Anything else, sir?');
  assert.deepEqual(actions, []);
});

test('parseActions survives an unclosed block and a block with no verb', () => {
  const loose = parseActions('One moment. [[ACT {"do":"task.add","title":"Post');
  assert.equal(loose.spoken, 'One moment.');
  assert.deepEqual(loose.actions, []);
  const bare = parseActions('Done. [[ACT]] Quite.');
  assert.equal(bare.spoken, 'Done. Quite.');
  assert.deepEqual(bare.actions, []);
  const verbless = parseActions('Done. [[ACT {"title":"no verb"}]]');
  assert.deepEqual(verbless.actions, []);
});

test('parseActions reads a block whose text contains brackets', () => {
  const { spoken, actions } = parseActions('[[ACT {"do":"note.add","text":"see ]] in the notes"}]] Down it goes.');
  assert.equal(spoken, 'Down it goes.');
  assert.equal(actions[0]?.text, 'see ]] in the notes');
});

test('a parsed action runs end to end', () => {
  const { spoken, actions } = parseActions('Consider it done. [[ACT {"do":"task.add","title":"Ring the vet"}]]');
  assert.equal(spoken, 'Consider it done.');
  const result = runAction(actions[0] as CavenAction, frozen(), NOW);
  assert.equal(result.data.tasks[0]?.title, 'Ring the vet');
});

/** Read the message off a thrown error, whatever was thrown. */
const spoken = (error: unknown): string => (error instanceof Error ? error.message : String(error));

test('an unset address falls back to sir, and a chosen one is taken verbatim', () => {
  assert.equal(addressOf({}), DEFAULT_ADDRESS);
  assert.equal(addressOf({ address: '   ' }), 'sir');
  assert.equal(addressOf({ address: 42 }), 'sir');
  assert.equal(addressOf({ address: '  Master  ' }), 'Master');
});

test('by default he is still sir, in confirmation and in refusal alike', () => {
  const added = runAction({ do: 'task.add', title: 'Post the parcel' }, frozen(), NOW);
  assert.match(added.message, /\bsir\b/);
  assert.throws(() => runAction({ do: 'task.add' }, frozen(), NOW), /\bsir\b/);
});

test('a chosen address is spoken in a confirmation and in a thrown refusal', () => {
  const prev = frozen({ address: 'Master', tasks: [{ id: 'a', title: 'Call mum', done: false }] });
  const added = runAction({ do: 'task.add', title: 'Post the parcel' }, prev, NOW);
  assert.equal(added.changed, true);
  assert.match(added.message, /Master/);
  assert.doesNotMatch(added.message, /\bsir\b/i);
  assert.throws(
    () => runAction({ do: 'task.delete', title: 'wash the car' }, prev, NOW),
    (error: unknown) => {
      assert.match(spoken(error), /Master/);
      assert.doesNotMatch(spoken(error), /\bsir\b/i);
      return true;
    },
  );
  // Ambiguity, a missing field and a bad time all carry the term too.
  assert.throws(() => runAction({ do: 'task.done', title: 'Call' }, frozen({ address: 'Master', tasks: [
    { id: 'a', title: 'Call mum', done: false },
    { id: 'b', title: 'Call the bank', done: false },
  ] }), NOW), /Master/);
  assert.throws(() => runAction({ do: 'habit.done' }, prev, NOW), /Master/);
  assert.throws(() => runAction({ do: 'reminder.add', title: 'x', when: 'sometime' }, prev, NOW), /Master/);
});

test('the regex fast path speaks the chosen address as well', () => {
  const prev = frozen({ address: 'Master' });
  assert.throws(() => applyCommand('reminder', 'remind me to ring the bank', prev, NOW), /Master/);
  // Calendar bookings are not the fast path's to answer — they belong to the
  // model, which owns event.add — so this one changes nothing and says nothing new.
  assert.equal(applyCommand('calendar', 'book a table for two', prev, NOW).changed, false);
  assert.throws(
    () => applyCommand('reminder', 'remind me to ring the bank at 9am yesterday', prev, NOW),
    /Master/,
  );
});

test('the term is used exactly as chosen, capitals and all', () => {
  const prev = frozen({ address: 'Your Lordship' });
  const added = runAction({ do: 'task.add', title: 'Post the parcel' }, prev, NOW);
  assert.match(added.message, /Your Lordship/);
  assert.doesNotMatch(added.message, /your lordship/);
});

test('address.set records the term and confirms in it, leaving the old board alone', () => {
  const prev = frozen({ address: 'sir' });
  const result = runAction({ do: 'address.set', term: '  Master  ' }, prev, NOW);
  assert.equal(result.changed, true);
  assert.equal(result.data.address, 'Master');
  assert.equal(prev.address, 'sir');
  assert.match(result.message, /Master/);
  assert.doesNotMatch(result.message, /\bsir\b/i);
  assert.doesNotMatch(result.message, /[*#`•]|!|\p{Extended_Pictographic}/u);
  // And it sticks: the next confirmation is addressed the new way.
  const next = runAction({ do: 'task.add', title: 'Post the parcel' }, result.data, NOW);
  assert.match(next.message, /Master/);
});

test('address.set accepts twenty-four characters and refuses twenty-five', () => {
  const prev = frozen({ address: 'sir' });
  assert.equal(runAction({ do: 'address.set', term: 'M'.repeat(24) }, prev, NOW).changed, true);
  assert.throws(() => runAction({ do: 'address.set', term: 'M'.repeat(25) }, prev, NOW), /twenty-four/i);
});

test('address.set refuses what it cannot speak, and changes nothing', () => {
  const prev = frozen({ address: 'sir' });
  const bad: Record<string, unknown>[] = [
    {},
    { term: '   ' },
    { term: 'the most exalted lord of the whole manor' },
    { term: 'Master\nof the house' },
    { term: 'Master\r\nsir' },
    { term: '<b>Master</b>' },
    { term: '**Master**' },
    { term: '# Master' },
    { term: 'Master `sir`' },
  ];
  for (const extra of bad) {
    assert.throws(
      () => runAction({ do: 'address.set', ...extra }, prev, NOW),
      (error: unknown) => {
        const said = spoken(error);
        assert.match(said, /nothing has changed/i, said);
        assert.doesNotMatch(said, /[*#`•]|!|\p{Extended_Pictographic}/u, said);
        return true;
      },
      JSON.stringify(extra),
    );
    assert.equal(prev.address, 'sir');
  }
});

test('setting the address he already has writes nothing and claims nothing', () => {
  const prev = frozen({ address: 'Master' });
  const result = runAction({ do: 'address.set', term: 'Master' }, prev, NOW);
  assert.equal(result.changed, false);
  assert.equal(result.data, prev);
  assert.match(result.message, /Master/);
});
