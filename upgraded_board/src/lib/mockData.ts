export type Task = { id: string; title: string; detail: string; done?: boolean; accent?: boolean }

export const tasks: Task[] = [
  { id: 't1', title: 'Send the tenancy email', detail: 'Draft is waiting. Mercifully short.', accent: true },
  { id: 't2', title: 'Book a dentist check-up', detail: '10 minutes, tops.' },
  { id: 't3', title: 'Water the small jungle', detail: 'Kitchen shelf · 2 plants' },
  { id: 't4', title: 'Return library book', detail: 'Due Monday' },
]

export const calendar = [
  { time: '10:30', title: 'Design catch-up', meta: '45 min · Video call', active: true },
  { time: '14:00', title: 'Physio appointment', meta: '30 min · Clifton', active: false },
  { time: '19:00', title: 'Pasta with Nia', meta: 'No preparation required', active: false },
]

export const reminders = [
  { time: '11:45', title: 'Take a proper lunch', note: 'Armed · a very sensible idea' },
  { time: '16:30', title: 'Put bins out', note: 'Armed · front gate' },
  { time: 'Tomorrow', title: 'Call Mum', note: 'Gentle nudge scheduled' },
]
