import React from 'react';
import type { Assignment, Submission } from '@/lib/types';
import { isPastDeadline, getDaysUntilDeadline } from '@/lib/formatters';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DeadlineInfo } from '@/components/shared/DeadlineInfo';
import { Button } from '@/components/shared/Button';

interface MyAssignmentsProps {
  assignments: Assignment[];
  submissions: Submission[];
  onView: (id: string) => void;
}

export const MyAssignments: React.FC<MyAssignmentsProps> = ({
  assignments,
  submissions,
  onView,
}) => {
  const getStudentSubmission = (aId: string) =>
    submissions.find(
      (s) => s.assignmentId === aId
    );

  const submitted = assignments.filter((a) => getStudentSubmission(a.id));
  const pending = assignments.filter((a) => !getStudentSubmission(a.id));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <SectionHeader
        title="My Assignments"
        subtitle="Your assignments"
        action={
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>
              <span className="font-semibold text-slate-900">{submitted.length}</span> submitted
            </span>
            <span>
              <span className="font-semibold text-slate-900">{pending.length}</span> pending
            </span>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assignments.map((a) => {
          const sub = getStudentSubmission(a.id);
          const past = isPastDeadline(a.deadline);
          const days = getDaysUntilDeadline(a.deadline);

          return (
            <div
              key={a.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-150 flex flex-col justify-between"
            >
              <div className="p-5 flex-1 flex flex-col">
                {/* Responsive Card Header: Course Code & Name (flexible wrap) + Status Badge (non-shrinking) */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-100 text-indigo-700 flex-shrink-0 mt-0.5">
                      {a.courseCode}
                    </span>
                    <span className="text-sm font-medium text-slate-700 leading-snug break-words">
                      {a.course}
                    </span>
                  </div>
                  <div className="flex-shrink-0 self-start">
                    <StatusBadge
                      status={sub ? sub.status : past ? 'overdue' : 'not_submitted'}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Assignment Title */}
                <h3 className="font-semibold text-slate-900 text-base leading-snug mt-1 mb-3">
                  {a.title}
                </h3>

                {/* Deadline Info */}
                <div className="mt-auto pt-2">
                  <DeadlineInfo deadline={a.deadline} />
                  {!past && (
                    <p className="text-xs text-slate-400 mt-1 ml-6">
                      {days === 1 ? '1 day left' : days > 0 ? `${days} days left` : 'Due today'}
                    </p>
                  )}
                </div>
              </div>

              {/* Card Footer Action Button */}
              <div className="px-5 pb-5 pt-2">
                <Button
                  variant={sub ? 'secondary' : past ? 'outline' : 'primary'}
                  fullWidth
                  size="sm"
                  onClick={() => onView(a.id)}
                >
                  View Assignment
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
