// "Can I spend this?" — the question where an invented number does real damage.
// Every figure asserted here traces back to a budgets row on the board.
import assert from 'node:assert/strict';
import test from 'node:test';
import { amountIn, spendCheck } from '../shared/spendCheck.ts';
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

const board = (budgets: CavenData['budgets']): CavenData => ({ ...empty(), budgets });

test('an amount is read in either form he might say it', () => {
  assert.equal(amountIn('can I spend $80 on dinner'), 80);
  assert.equal(amountIn('can I spend 80 dollars'), 80);
  assert.equal(amountIn('can I spend eighty dollars on dinner'), 80);
  assert.equal(amountIn('can I spend a hundred and fifty'), 150);
  assert.equal(amountIn('can I spend two thousand'), 2000);
  assert.equal(amountIn('can I spend $1,200'), 1200);
  assert.equal(amountIn('can I spend 12.50'), 12.5);
  assert.equal(amountIn('can I afford it'), null);
});

test('it only answers the question it was asked', () => {
  const data = board([{ id: 'b1', category: 'dining', spent: 120, limit: 300 }]);
  assert.equal(spendCheck(data, 'what have I got on today'), null);
  assert.equal(spendCheck(data, 'spend $40 on lunch'), null, 'recording a spend is a different job');
  // The question, but with no amount in it — the model can ask him how much.
  assert.equal(spendCheck(data, 'can I afford dinner'), null);
});

test('an empty board never invents a balance', () => {
  assert.equal(spendCheck(empty(), 'can I spend $80 on dinner'), "I don't have a budget saved for that.");
  assert.equal(spendCheck(null, 'can I spend $80'), "I don't have a budget saved for that.");
});

test('a budget with room says yes, with the real numbers', () => {
  const data = board([{ id: 'b1', category: 'dining', spent: 120, limit: 300 }]);
  assert.equal(spendCheck(data, 'can I spend $80 on dining'), "You've $180 left on dining, so yes — $100 after.");
});

test('a budget without room says how far over, not just no', () => {
  const data = board([{ id: 'b1', category: 'dining', spent: 280, limit: 300 }]);
  assert.equal(
    spendCheck(data, 'can I spend $80 on dining'),
    "That would put you $60 over on dining. There's $20 left on it.",
  );
});

test('a budget already blown says so plainly', () => {
  const data = board([{ id: 'b1', category: 'dining', spent: 340, limit: 300 }]);
  assert.equal(spendCheck(data, 'can I spend $10 on dining'), "You're already $40 over on dining, so no.");
});

// With one budget saved there is nothing to be ambiguous about. With several and
// no category named, guessing which one he meant would attach a real number to
// the wrong thing, so he gets asked.
test('one budget needs no naming; several do', () => {
  const one = board([{ id: 'b1', category: 'dining', spent: 120, limit: 300 }]);
  assert.match(spendCheck(one, 'can I spend $80')!, /\$180 left on dining/);

  const several = board([
    { id: 'b1', category: 'dining', spent: 120, limit: 300 },
    { id: 'b2', category: 'petrol', spent: 40, limit: 200 },
  ]);
  assert.equal(spendCheck(several, 'can I spend $80'), "I've a few budgets saved. Which one did you mean?");
  assert.match(spendCheck(several, 'can I spend $80 on petrol')!, /\$160 left on petrol/);
});

// "lunch" is not "dining" unless he saved it that way. Deciding otherwise is how
// a confident answer gets attached to the wrong budget.
test('a category he never saved is not quietly matched to one he did', () => {
  const data = board([{ id: 'b1', category: 'dining', spent: 120, limit: 300 }]);
  // One budget saved, so it is still unambiguous — but the answer names the row
  // it actually used rather than pretending "lunch" is a budget.
  assert.match(spendCheck(data, 'can I spend $80 on lunch')!, /on dining/);

  const several = board([
    { id: 'b1', category: 'dining', spent: 120, limit: 300 },
    { id: 'b2', category: 'petrol', spent: 40, limit: 200 },
  ]);
  assert.equal(spendCheck(several, 'can I spend $80 on lunch'), "I've a few budgets saved. Which one did you mean?");
});

test('cents are spoken only when there are any', () => {
  const data = board([{ id: 'b1', category: 'dining', spent: 120.5, limit: 300 }]);
  assert.match(spendCheck(data, 'can I spend $80 on dining')!, /\$179\.50 left on dining/);
});
