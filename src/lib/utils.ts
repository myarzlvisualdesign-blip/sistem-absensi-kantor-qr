import crypto from 'crypto';

const DEFAULT_TIME_ZONE = process.env.APP_TIMEZONE || 'Asia/Jakarta';

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getTodayString(date: Date = new Date(), timeZone = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function isLate(checkInTime: Date, lateLimitTime: string, timeZone = DEFAULT_TIME_ZONE): boolean {
  const [lateHour, lateMinute] = lateLimitTime.split(':').map(Number);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(checkInTime);

  const hour = Number(parts.find((part) => part.type === 'hour')?.value || '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || '0');

  if (hour > lateHour) return true;
  if (hour === lateHour && minute > lateMinute) return true;
  return false;
}

export function generateEmployeeId(): string {
  const year = new Date().getFullYear();
  const random = crypto.randomInt(0, 10000).toString().padStart(4, '0');
  return `EMP-${year}-${random}`;
}

export function generateQRToken(): string {
  return crypto.randomUUID();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emptyToNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
