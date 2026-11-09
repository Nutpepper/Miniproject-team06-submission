import React from 'react';
import { formatThaiTime } from '@/lib/formatters';

interface DeadlineInfoProps {
  deadline: Date;
  label?: string;
}

export const DeadlineInfo: React.FC<DeadlineInfoProps> = ({
  deadline,
  label = 'กำหนดส่ง',
}) => {
  const past = new Date() > deadline;
  return (
    <div className={`flex items-start gap-2 text-sm ${past ? 'text-red-600' : 'text-slate-600'}`}>
      <svg
        className="w-4 h-4 mt-0.5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div>
        <span className="font-medium">{label}: </span>
        <span>{formatThaiTime(deadline)}</span>
        {past && (
          <span className="ml-2 text-xs font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
            เลยกำหนด
          </span>
        )}
      </div>
    </div>
  );
};
