const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateString(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

function toUTCDate(value: string): Date | null {
  const parsed = parseDateString(value);
  if (!parsed) {
    return null;
  }
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

function formatUTCDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToDateString(value: string, days: number): string {
  const parsed = toUTCDate(value);
  if (!parsed || !Number.isFinite(days)) {
    return value;
  }
  return formatUTCDate(new Date(parsed.getTime() + Math.floor(days) * MS_PER_DAY));
}

export function getDateDiffInDays(from: string, to: string): number {
  const fromDate = toUTCDate(from);
  const toDate = toUTCDate(to);
  if (!fromDate || !toDate) {
    return 0;
  }
  return Math.floor((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY);
}

export function canMarkDone(today: string, lastCompletedDate: string | null): boolean {
  if (!lastCompletedDate) {
    return true;
  }
  return lastCompletedDate < today;
}

export function canUndoToday(today: string, lastCompletedDate: string | null): boolean {
  return lastCompletedDate === today;
}
