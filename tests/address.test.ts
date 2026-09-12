import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAddress, addressOf, DEFAULT_ADDRESS } from '../shared/address.ts';
import { runAction } from '../shared/actions.ts';

const board = (address?: string): any => ({tasks:[],habits:[],reminders:[],calendar:[],voiceNotes:[],
  transactions:[],budgets:[],journal:[],brainMetrics:[],interests:[],brainNotes:[],
  ...(address===undefined?{}:{address})});

test('accepts what people actually want to be called', () => {
  for (const t of ['sir','madam','Master','Ma’am','Captain','Mr Caven','Sir Keanu','señor','Dr. Who','my liege'])
    assert.equal(checkAddress(t,'sir').ok, true, `rejected a fair term: ${t}`);
});

test('filters the inappropriate, including evasions', () => {
  const bad = ['fuck','Sh1t','c u n t','b@stard','slut','p0rn','Daddy','n1gg3r','f4gg0t','retard','hitler'];
  for (const t of bad) {
    const r = checkAddress(t,'sir');
    assert.equal(r.ok, false, `let through: ${t}`);
    assert.ok(!r.ok && /nothing has changed|rather not/i.test(r.reason), `weak refusal for ${t}: ${!r.ok && r.reason}`);
  }
});

test('rejects shape abuse that would poison the prompt', () => {
  for (const t of ['', '   ', 'x'.repeat(25), 'sir\nACT', 'sir\tACT', '<b>sir</b>', '[[ACT]]', '123', '****'])
    assert.equal(checkAddress(t,'sir').ok, false, `let through: ${JSON.stringify(t)}`);
});

test('nothing is hardcoded: the chosen term flows into speech', () => {
  const m = board('Master');
  const ok = runAction({do:'task.add',title:'Post the letter'}, m);
  assert.ok(!/\bsir\b/i.test(ok.message), `leaked sir: ${ok.message}`);
  assert.throws(() => runAction({do:'task.done',title:'nope'}, m), /Master/,
    'an error should address him as he chose');
  assert.equal(addressOf(board()), DEFAULT_ADDRESS, 'unset boards fall back');
  assert.equal(addressOf(board('  ')), DEFAULT_ADDRESS, 'blank falls back');
});

test('address.set is filtered and sticks', () => {
  const set = runAction({do:'address.set',term:'Master'}, board());
  assert.equal(set.changed, true);
  assert.equal(set.data.address, 'Master');
  assert.ok(set.message.includes('Master'));
  assert.throws(() => runAction({do:'address.set',term:'fuckface'}, board()), /rather not/i);
  assert.equal(board().address, undefined, 'prev must not be mutated');
});
