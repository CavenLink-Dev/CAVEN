import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTION_VERBS, applyCommand, parseActions, runAction, type CavenAction } from '../shared/actions.ts';
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
  assert.throws(() => runAction({ do: 'task.done', title: 'call' }, prev, NOW), /several tasks match/i);
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

test('habit.done moves the streak once a day', () => {
  const prev = frozen({ habits: [{ id: 'h', name: 'Read', streak: 4, goal: 7, done: false, icon: 'o' }] });
  const first = runAction({ do: 'habit.done', name: 'read' }, prev, NOW);
  assert.equal(first.changed, true);
  assert.equal(first.data.habits[0]?.streak, 5);
  const again = runAction({ do: 'habit.done', name: 'read' }, first.data, NOW);
  assert.equal(again.changed, false);
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
    assert.throws(() => runAction({ do: verb }, frozen(), NOW), /\S/, verb);
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
