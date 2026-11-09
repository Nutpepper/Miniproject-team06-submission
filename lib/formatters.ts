import type { SubmissionStatus } from './types';

const TH_TZ = 'Asia/Bangkok';

export const formatThaiTime = (date: Date): string => {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: TH_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${formatted} ICT`;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const determineStatus = (submittedAt: Date, deadline: Date): SubmissionStatus =>
  submittedAt <= deadline ? 'ON_TIME' : 'LATE';

export const isPastDeadline = (deadline: Date): boolean => new Date() > deadline;

export const generateId = (): string =>
  `sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const getDaysUntilDeadline = (deadline: Date): number => {
  const diff = deadline.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};
