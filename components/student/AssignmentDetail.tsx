import React from 'react';
import type { Assignment, Submission } from '@/lib/types';
import { formatThaiTime, formatFileSize, isPastDeadline } from '@/lib/formatters';
import { BackButton } from '@/components/shared/BackButton';
import { BreadcrumbNav } from '@/components/shared/BreadcrumbNav';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { InfoRow } from '@/components/shared/InfoRow';
import { Button } from '@/components/shared/Button';
import { TypeIcon } from '@/components/shared/TypeIcon';

const lines = (value: string) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

interface AssignmentDetailProps {
  assignment: Assignment;
  submission: Submission | undefined;
  onBack: () => void;
  onBackToCourses?: () => void;
  onSubmit: () => void;
  onViewSubmission: () => void;
  onCancelResubmit: () => void;
}

export const AssignmentDetail: React.FC<AssignmentDetailProps> = ({
  assignment,
  submission,
  onBack,
  onBackToCourses,
  onSubmit,
  onViewSubmission,
  onCancelResubmit,
}) => {
  const past = isPastDeadline(assignment.deadline);
  const criteria = assignment.criteria ? lines(assignment.criteria) : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Breadcrumbs */}
      <BreadcrumbNav
        items={[
          ...(onBackToCourses ? [{ label: 'รายวิชาของฉัน', onClick: onBackToCourses }] : []),
          { label: assignment.courseCode ? `[${assignment.courseCode}] ${assignment.course}` : assignment.course, onClick: onBack },
          { label: assignment.title },
        ]}
      />
      <BackButton onClick={onBack} label="กลับไปยังรายวิชา" />

      <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-5 text-white sm:px-6">
          <div className="flex items-center gap-2 text-sm text-indigo-50">{assignment.courseCode && <span className="rounded-md bg-white/20 px-2.5 py-1 text-xs font-bold text-white ring-1 ring-inset ring-white/30">{assignment.courseCode}</span>}<span className="font-medium text-white/90">{assignment.course}</span></div>
          <h1 className="text-xl font-bold text-white mt-2 leading-snug break-words">
            {assignment.title}
          </h1>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 text-sm"><span><span className="text-slate-500">รายวิชา: </span><span className="font-semibold text-slate-900">{assignment.courseCode ? `${assignment.courseCode} — ` : ''}{assignment.course}</span></span><div className="flex flex-wrap items-center gap-2"><div className={`rounded-lg border px-3 py-1.5 text-right ${past ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}><p className="text-[11px] font-semibold text-slate-500">กำหนดส่ง</p><p className={`text-xs font-bold ${past ? 'text-red-700' : 'text-amber-800'}`}>{formatThaiTime(assignment.deadline)}</p></div><StatusBadge status={submission ? submission.status : 'not_submitted'} /></div></div>
          <section><h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100 text-xs text-indigo-700">1</span>สิ่งที่ต้องทำ</h2><div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="whitespace-pre-line text-sm leading-7 text-slate-700">{assignment.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p></div></section>
          {criteria.length > 0 && <section><h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-100 text-xs text-violet-700">2</span>เกณฑ์การให้คะแนน</h2><ul className="mt-3 space-y-2">{criteria.map((criterion, index) => <li key={`${criterion}-${index}`} className="flex gap-3 rounded-lg border border-violet-100 bg-violet-50/50 px-4 py-3 text-sm leading-6 text-slate-700"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet-500"/><span>{criterion}</span></li>)}</ul></section>}
          {past && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">เลยกำหนดส่งแล้ว — ระบบยังรับงานและจะระบุสถานะส่งล่าช้า</p>}
        </div>
      </div>

      {!submission ? (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-800 mb-1">ยังไม่ได้ส่งงาน</p>
          <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
            You have not submitted this assignment yet.
            {past && ' The deadline has passed — late submissions are still accepted.'}
          </p>
          <Button onClick={onSubmit} variant={past ? 'outline' : 'primary'}>
            ส่งงาน
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            งานที่คุณส่ง
          </h2>
          <dl>
            <InfoRow label="สถานะ">
              <StatusBadge status={submission.status} />
            </InfoRow>
            <InfoRow label="เวลาที่ส่ง">
              {formatThaiTime(submission.submittedAt)}
            </InfoRow>
            <InfoRow label="ประเภท">
              <span className="inline-flex items-center gap-1.5 text-slate-700 capitalize">
                <TypeIcon type={submission.type} className="w-4 h-4 text-slate-400" />
                {submission.type === 'file' ? 'ไฟล์แนบ' : 'ลิงก์'}
              </span>
            </InfoRow>
            {submission.type === 'file' && (
              <InfoRow label="ไฟล์">
                <span className="font-medium text-slate-900">{submission.fileName}</span>
                {submission.fileSize && (
                  <span className="text-slate-400 ml-2">({formatFileSize(submission.fileSize)})</span>
                )}
              </InfoRow>
            )}
            {submission.type === 'link' && (
              <InfoRow label="ลิงก์">
                <a
                  href={submission.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800 break-all"
                >
                  {submission.link}
                </a>
              </InfoRow>
            )}
          </dl>
          <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-slate-100">
            <Button onClick={onViewSubmission} variant="secondary">
              ดูงานที่ส่ง
            </Button>
            <Button onClick={onCancelResubmit} variant="ghost">
              ยกเลิกและส่งใหม่
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
