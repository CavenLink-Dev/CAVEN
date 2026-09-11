import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseActions, runAction, ACTION_VERBS } from '../shared/actions.ts';
const seedData = (): any => ({tasks:[],habits:[],reminders:[],calendar:[],voiceNotes:[],transactions:[],budgets:[],journal:[],brainMetrics:[],interests:[],brainNotes:[]});

test('every advertised verb actually performs', () => {
  const now = new Date('2026-09-11T09:00:00+09:30');
  let d = seedData();
  const run = (a: any) => { const r = runAction(a, d, now); d = r.data; return r; };

  const seq: [any, string][] = [
    [{do:'task.add', title:'Ring the dentist'}, 'tasks'],
    [{do:'task.done', title:'ring the dentist'}, 'tasks'],
    [{do:'task.undone', title:'Ring the dentist'}, 'tasks'],
    [{do:'reminder.add', title:'Bins out', when:'tomorrow at 6pm'}, 'reminders'],
    [{do:'event.add', title:'Physio', when:'tomorrow at 2pm'}, 'calendar'],
    [{do:'habit.add', name:'Walk'}, 'habits'],
    [{do:'habit.done', name:'walk'}, 'habits'],
    [{do:'journal.add', body:'A long day.'}, 'journal'],
    [{do:'note.add', text:'Boiler serviced in March'}, 'voiceNotes'],
    [{do:'spend.add', label:'Coffee', amount:5.5, category:'Food'}, 'transactions'],
    [{do:'budget.set', category:'Food', limit:200}, 'budgets'],
    [{do:'brain.note', text:'Prefers mornings'}, 'brainNotes'],
    [{do:'interest.add', name:'Cycling'}, 'interests'],
  ];
  for (const [action, bucket] of seq) {
    const r = run(action);
    assert.equal(r.changed, true, `${action.do} did not change anything`);
    assert.ok(r.message.length, `${action.do} said nothing`);
    assert.ok(!/[*_#`]|:\)/.test(r.message), `${action.do} message not speech-safe: ${r.message}`);
    assert.ok((d as any)[bucket].length > 0, `${action.do} did not land in ${bucket}`);
  }

  // deletes
  for (const a of [{do:'task.delete',title:'Ring the dentist'},{do:'reminder.delete',title:'Bins out'},
                   {do:'event.delete',title:'Physio'},{do:'habit.delete',name:'Walk'},
                   {do:'note.delete',text:'Boiler serviced in March'}]) {
    assert.equal(run(a).changed, true, `${(a as any).do} failed`);
  }
  assert.equal(d.tasks.length, 0);
  assert.equal(d.reminders.length, 0);
  console.log(`\n  ${ACTION_VERBS.length} verbs advertised, all exercised.`);
});

test('honesty: failures throw and write nothing', () => {
  const now = new Date('2026-09-11T09:00:00+09:30');
  const base = { ...seedData(), tasks:[{id:'1',title:'Email Bob',done:false},{id:'2',title:'Email Sue',done:false}] };
  assert.throws(() => runAction({do:'reminder.add',title:'x',when:'sometime'}, base, now), /date and time/i);
  assert.throws(() => runAction({do:'reminder.add',title:'x',when:'yesterday at 6pm'}, base, now), /passed/i);
  assert.throws(() => runAction({do:'task.done',title:'Email'}, base, now), /several|exact/i);
  assert.throws(() => runAction({do:'task.done',title:'Nonexistent'}, base, now), /no task/i);
  assert.equal(runAction({do:'wat.nope'}, base, now).changed, false);
  assert.deepEqual(base.tasks.length, 2, 'prev was mutated');
});

test('parseActions strips the block and survives rubbish', () => {
  const a = parseActions('Very good, sir. [[ACT {"do":"task.add","title":"Post the letter"}]]');
  assert.equal(a.actions.length, 1);
  assert.ok(!a.spoken.includes('ACT'), `spoken leaked: ${a.spoken}`);
  assert.equal(a.spoken, 'Very good, sir.');
  const b = parseActions('Noted. [[ACT {broken json]]');
  assert.equal(b.actions.length, 0, 'malformed JSON must be discarded');
  assert.ok(!b.spoken.includes('ACT'), 'malformed block must still be stripped from speech');
  assert.equal(parseActions('Just talking.').actions.length, 0);
});
