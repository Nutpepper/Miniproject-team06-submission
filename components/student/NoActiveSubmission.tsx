import React from 'react';
import type { Assignment } from '@/lib/types';
import { BackButton } from '@/components/shared/BackButton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/shared/Button';

interface NoActiveSubmissionProps {
  assignment: Assignment;
  onBack: () => void;
  onSubmit: () => void;
}

export const NoActiveSubmission: React.FC<NoActiveSubmissionProps> = ({
  assignment,
  onBack,
  onSubmit,
}) => (
  <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
    <BackButton onClick={onBack} />
    <h1 className="text-xl font-bold text-slate-900 mb-6">งานที่ส่งปัจจุบัน</h1>

    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-4">
      <div className="text-sm text-slate-500 mb-4">
        <span className="font-semibold text-slate-900">{assignment.title}</span>
      </div>
      <EmptyState
        title="ไม่มีงานที่ส่งอยู่"
        description="Your submission was cancelled. You can submit a new file or link."
        action={<Button onClick={onSubmit} variant="primary">ส่งงาน</Button>}
        icon={
          <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        }
      />
    </div>
  </div>
);
