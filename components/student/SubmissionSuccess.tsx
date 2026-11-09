import React from 'react';
import type { Assignment, Submission } from '@/lib/types';
import { formatThaiTime, formatFileSize } from '@/lib/formatters';
import { CourseTag } from '@/components/shared/CourseTag';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { InfoRow } from '@/components/shared/InfoRow';
import { Button } from '@/components/shared/Button';
import { TypeIcon } from '@/components/shared/TypeIcon';
import { supabase } from '@/lib/supabase/client';

interface SubmissionSuccessProps {
  assignment: Assignment;
  submission: Submission;
  onViewSubmission: () => void;
  onBackToAssignments: () => void;
}

export const SubmissionSuccess: React.FC<SubmissionSuccessProps> = ({
  assignment,
  submission,
  onViewSubmission,
  onBackToAssignments,
}) => {
  const openFile = async () => {
    if (!submission.filePath) return;
    const { data, error } = await supabase.storage
      .from('submissions')
      .download(submission.filePath);
    if (error) {
      window.alert(`ไม่สามารถเปิดไฟล์ได้: ${error.message}`);
      return;
    }
    const url = URL.createObjectURL(data);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
  <>
  <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
    <div className="text-center mb-8">
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">ส่งงานสำเร็จ</h1>
      <p className="text-slate-500 text-sm mt-1">ระบบบันทึกการส่งงานของคุณเรียบร้อยแล้ว</p>
    </div>

    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <dl className="divide-y divide-slate-100">
        <InfoRow label="รหัสการส่งงาน">
          <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded break-all select-all font-semibold">
            {submission.id}
          </span>
        </InfoRow>
        <InfoRow label="งาน">{assignment.title}</InfoRow>
        <InfoRow label="Course">
          <CourseTag code={assignment.courseCode} name={assignment.course} />
        </InfoRow>
        <InfoRow label="เวลาที่ส่ง">{formatThaiTime(submission.submittedAt)}</InfoRow>
        <InfoRow label="Status">
          <StatusBadge status={submission.status} />
        </InfoRow>
        <InfoRow label="Type">
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
          <InfoRow label="Link">
            <a
              href={submission.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 underline underline-offset-2 break-all"
            >
              {submission.link}
            </a>
          </InfoRow>
        )}
      </dl>
    </div>

    <div className="flex flex-wrap gap-3">
      {submission.type === 'file' && (
        <Button variant="primary" onClick={openFile} disabled={!submission.filePath}>
          เปิดไฟล์
        </Button>
      )}
      <Button variant="primary" onClick={onViewSubmission}>
        ดูงานที่ส่ง
      </Button>
      <Button variant="secondary" onClick={onBackToAssignments}>
        กลับไปยังรายการงาน
      </Button>
    </div>
  </div>
  </>
  );
};
