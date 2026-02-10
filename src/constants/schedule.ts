export const SCHEDULE_SLOTS = [
  // Manhã
  { id: 1, label: '1ª Aula', startTime: '07:35', endTime: '08:25', period: 'Manhã' },
  { id: 2, label: '2ª Aula', startTime: '08:25', endTime: '09:10', period: 'Manhã' },
  { id: 3, label: '3ª Aula', startTime: '09:30', endTime: '10:20', period: 'Manhã' },
  { id: 4, label: '4ª Aula', startTime: '10:20', endTime: '11:10', period: 'Manhã' },
  { id: 5, label: '5ª Aula', startTime: '11:10', endTime: '12:00', period: 'Manhã' },
  // Tarde
  { id: 6, label: '6ª Aula', startTime: '13:30', endTime: '14:20', period: 'Tarde' },
  { id: 7, label: '7ª Aula', startTime: '14:20', endTime: '15:05', period: 'Tarde' },
  { id: 8, label: '8ª Aula', startTime: '15:20', endTime: '16:10', period: 'Tarde' },
  { id: 9, label: '9ª Aula', startTime: '16:10', endTime: '17:00', period: 'Tarde' },
] as const;

export type ScheduleSlot = typeof SCHEDULE_SLOTS[number];
