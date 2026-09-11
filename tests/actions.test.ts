import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommand } from '../shared/actions.ts';
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
