const EARLY_PHRASES = [
  'Nice work.',
  'You showed up again.',
  'Another step forward.',
  'Progress today.',
  'You stayed focused.',
  'Consistency wins.',
  'One day stronger.',
  'Well done today.',
  'Keep going.',
  'That counts.',
  'Small wins matter.',
  'One more done.',
  'Progress continues.',
  'You did it today.',
  'Momentum grows.',
  'A step ahead.',
  'Focus pays off.',
  'Keep the rhythm.',
  "You're building it.",
  'Another brick placed.',
] as const;

const HABIT_PHRASES = [
  "You're on track.",
  'Quiet progress.',
  'Discipline today.',
  'Keep the chain.',
  'Strong move.',
  'Another day kept.',
  'Keep stacking.',
  'The habit grows.',
  'Good discipline.',
  'A solid step.',
  'Momentum continues.',
  'One more victory.',
  'Today counts.',
  'Nice consistency.',
  'Stay steady.',
  'A strong day.',
  'Keep showing up.',
  'Focus maintained.',
  'Progress holds.',
  'You stayed true.',
  'This builds strength.',
  'One step further.',
  'Keep the focus.',
  'Quiet progress wins.',
  'You stayed the course.',
  'Strong consistency.',
  'Another mark made.',
  'Keep moving forward.',
  'Discipline matters.',
  'One day better.',
  'Progress adds up.',
  'That was important.',
  'Stay the path.',
  'Habit forming.',
  'Momentum lives.',
  'Another good day.',
  'Keep the flow.',
  'Well kept.',
  "That's commitment.",
  'You kept it.',
] as const;

const LATE_PHRASES = [
  'Progress continues.',
  'Focus again.',
  "You're doing it.",
  'Another solid day.',
  'Keep building.',
  'The chain grows.',
  'One more done.',
  "That's progress.",
  'You held the line.',
  'Strong focus today.',
  'Good momentum.',
  'Another win.',
  'Habit reinforced.',
  'Nice discipline.',
  'Keep stacking days.',
  'Focus secured.',
  'The path continues.',
  'Keep showing up.',
  "You're consistent.",
  'Progress confirmed.',
  'Good focus.',
  'A day well kept.',
  'Momentum stays.',
  'Another forward step.',
  'The habit holds.',
  "You're committed.",
  'One more mark.',
  'A steady move.',
  'Keep the chain alive.',
  'The streak grows.',
  'Discipline works.',
  'Progress holds steady.',
  'Another good choice.',
  'You stayed strong.',
  'One day closer.',
  'Progress locked.',
  'The journey continues.',
  'Another focused day.',
  'Keep building momentum.',
  'You did the work.',
] as const;

function getPool(completedDays: number): readonly string[] {
  if (completedDays <= 7) {
    return EARLY_PHRASES;
  }
  if (completedDays <= 30) {
    return HABIT_PHRASES;
  }
  return LATE_PHRASES;
}

export function getCelebrationMessage(completedDays: number, previousMessage: string | null): string {
  const pool = getPool(completedDays);
  if (pool.length === 1) {
    return pool[0];
  }

  let nextMessage = pool[Math.floor(Math.random() * pool.length)];
  if (previousMessage && pool.includes(previousMessage) && nextMessage === previousMessage) {
    const currentIndex = pool.indexOf(previousMessage);
    nextMessage = pool[(currentIndex + 1) % pool.length];
  }

  return nextMessage;
}
