import React from 'react';
import type { SubmissionStatus } from '@/lib/types';

export type BadgeStatus = SubmissionStatus | 'not_submitted' | 'overdue';

const badgeConfig: Record<BadgeStatus, { label: string; classes: string; dot: string }> = {
  ON_TIME: {
    label: 'ส่งตรงเวลา',
    classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-500',
  },
  LATE: {
    label: 'ส่งล่าช้า',
    classes: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-500',
  },
  not_submitted: {
    label: 'ยังไม่ได้ส่ง',
    classes: 'bg-slate-100 text-slate-600 border border-slate-200',
    dot: 'bg-slate-400',
  },
  overdue: {
    label: 'เกินกำหนด',
    classes: 'bg-red-50 text-red-700 border border-red-200',
    dot: 'bg-red-500',
  },
};

interface StatusBadgeProps {
  status: BadgeStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const cfg = badgeConfig[status];
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 font-semibold rounded-full whitespace-nowrap flex-shrink-0',
        cfg.classes,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs',
      ].join(' ')}
      role="status"
      aria-label={`สถานะการส่งงาน: ${cfg.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} aria-hidden="true" />
      {cfg.label}
    </span>
  );
};
