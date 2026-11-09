import React from 'react';
import type { Assignment, PendingSubmission } from '@/lib/types';
import { formatThaiTime, formatFileSize, isPastDeadline } from '@/lib/formatters';
import { BackButton } from '@/components/shared/BackButton';
import { CourseTag } from '@/components/shared/CourseTag';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { InfoRow } from '@/components/shared/InfoRow';
import { Button } from '@/components/shared/Button';
import { TypeIcon } from '@/components/shared/TypeIcon';

interface SubmissionCheckProps {
  assignment: Assignment;
  pending: PendingSubmission;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}

export const SubmissionCheck: React.FC<SubmissionCheckProps> = ({
  assignment,
  pending,
  onBack,
  onSubmit,
  submitting,
}) => {
  const isLate = isPastDeadline(assignment.deadline);
  const expectedStatus = isLate ? 'LATE' : 'ON_TIME';
  const now = new Date();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <BackButton onClick={onBack} label="กลับไปแก้ไขงาน" />

      <h1 className="text-xl font-bold text-slate-900 mb-1">ตรวจสอบงานก่อนส่ง</h1>
      <p className="text-sm text-slate-500 mb-6">กรุณาตรวจสอบรายละเอียดก่อนยืนยันการส่งงาน</p>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-4">รายละเอียดการส่งงาน</h2>
          <dl className="divide-y divide-slate-100">
            <InfoRow label="งาน">{assignment.title}</InfoRow>
            <InfoRow label="รายวิชา">
              <CourseTag code={assignment.courseCode} name={assignment.course} />
            </InfoRow>
            <InfoRow label="กำหนดส่ง">{formatThaiTime(assignment.deadline)}</InfoRow>
            <InfoRow label="Your submission">
              {pending.type === 'file' ? (
                <ul className="space-y-1">
                  {pending.files.map((file) => <li key={file.fileName} className="flex items-center gap-2"><TypeIcon type="file" className="w-4 h-4 text-slate-400" /><span className="font-medium text-slate-900">{file.fileName}</span><span className="text-slate-400">({formatFileSize(file.fileSize)})</span></li>)}
                </ul>
              ) : (
                <a
                  href={pending.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 underline underline-offset-2 break-all"
                >
                  {pending.link}
                </a>
              )}
            </InfoRow>
            <InfoRow label="เวลาปัจจุบัน">{formatThaiTime(now)}</InfoRow>
            <InfoRow label="สถานะที่คาดว่าจะได้รับ">
              <StatusBadge status={expectedStatus} />
            </InfoRow>
          </dl>
        </div>

        {isLate && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">ส่งงานล่าช้า</p>
              <p className="text-sm text-amber-700 mt-0.5">
                งานนี้จะถูกระบุว่า <strong>ส่งล่าช้า</strong> เนื่องจากเลยกำหนดส่งแล้ว แต่ยังสามารถส่งงานได้
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-slate-600">
            ไฟล์จะถูกอัปโหลดไปยังพื้นที่จัดเก็บที่ปลอดภัยเมื่อคุณยืนยันส่งงาน และระบบจะบันทึกเวลาหลังอัปโหลดเสร็จ
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-6">
        <Button variant="secondary" onClick={onBack} disabled={submitting}>
          ย้อนกลับ
        </Button>
        <Button variant={isLate ? 'outline' : 'primary'} onClick={onSubmit} loading={submitting}>
          ยืนยันส่งงาน
        </Button>
      </div>
    </div>
  );
};
