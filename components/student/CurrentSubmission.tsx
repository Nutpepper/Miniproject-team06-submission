import React, { useState } from 'react';
import type { Assignment, Submission } from '@/lib/types';
import { formatThaiTime, formatFileSize } from '@/lib/formatters';
import { BackButton } from '@/components/shared/BackButton';
import { CourseTag } from '@/components/shared/CourseTag';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { InfoRow } from '@/components/shared/InfoRow';
import { Button } from '@/components/shared/Button';
import { TypeIcon } from '@/components/shared/TypeIcon';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { supabase } from '@/lib/supabase/client';

interface CurrentSubmissionProps {
  assignment: Assignment;
  submission: Submission;
  onBack: () => void;
  onCancelSubmission: () => void;
  onSubmitAgain: () => void;
}

export const CurrentSubmission: React.FC<CurrentSubmissionProps> = ({
  assignment,
  submission,
  onBack,
  onCancelSubmission,
  onSubmitAgain,
}) => {
  const [showCancel, setShowCancel] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; kind: 'image' | 'pdf' | 'other' } | null>(null);

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const openFile = async () => {
    if (!submission.filePath) return;
    setOpeningFile(true);
    const { data, error } = await supabase.storage
      .from('submissions')
      .download(submission.filePath);
    if (error) {
      window.alert(`ไม่สามารถเปิดไฟล์ได้: ${error.message}`);
      setOpeningFile(false);
      return;
    }
    const url = URL.createObjectURL(data);
    const fileName = submission.fileName || 'ไฟล์ที่ส่ง';
    const isPdf = data.type === 'application/pdf' || /\.pdf$/i.test(fileName);
    const isImage = data.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
    setPreview({ url, name: fileName, kind: isImage ? 'image' : isPdf ? 'pdf' : 'other' });
    setOpeningFile(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <BackButton onClick={onBack} />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-slate-900">Current Submission</h1>
        <StatusBadge status={submission.status} />
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <dl className="divide-y divide-slate-100">
          <InfoRow label="Submission ID">
            <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded break-all select-all font-semibold">
              {submission.id}
            </span>
          </InfoRow>
          <InfoRow label="Assignment">{assignment.title}</InfoRow>
          <InfoRow label="Course">
            <CourseTag code={assignment.courseCode} name={assignment.course} />
          </InfoRow>
          <InfoRow label="Status">
            <StatusBadge status={submission.status} />
          </InfoRow>
          <InfoRow label="Submitted At">{formatThaiTime(submission.submittedAt)}</InfoRow>
          <InfoRow label="Type">
            <button
              type="button"
              onClick={openFile}
              disabled={openingFile || !submission.filePath}
              className="inline-flex items-center gap-1.5 text-indigo-600 underline underline-offset-2 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <TypeIcon type={submission.type} className="w-4 h-4 text-slate-400" />
              {submission.type === 'file' ? 'ไฟล์ที่อัปโหลด' : 'ลิงก์'}
            </button>
          </InfoRow>
          {submission.type === 'file' && (
            <>
              <InfoRow label="ไฟล์">
                <button
                  type="button"
                  onClick={openFile}
                  disabled={openingFile || !submission.filePath}
                  className="text-left text-indigo-600 underline underline-offset-2 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {openingFile ? 'กำลังเปิดไฟล์...' : submission.fileName}
                </button>
              </InfoRow>
              {submission.fileSize && (
                <InfoRow label="File Size">{formatFileSize(submission.fileSize)}</InfoRow>
              )}
            </>
          )}
          {submission.type === 'file' ? null : (
            <InfoRow label="Link">
              <a
                href={submission.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline underline-offset-2 break-all hover:text-indigo-800"
              >
                {submission.link}
              </a>
            </InfoRow>
          )}
        </dl>
      </div>

      <div className="flex flex-wrap gap-3">
        {submission.type === 'link' && (
          <Button
            variant="primary"
            icon={<TypeIcon type="link" className="w-4 h-4" />}
            onClick={() => window.open(submission.link, '_blank')}
          >
            เปิดลิงก์
          </Button>
        )}
        <Button variant="ghost" onClick={onSubmitAgain}>
          ส่งงานใหม่
        </Button>
        <Button variant="danger" onClick={() => setShowCancel(true)}>
          ยกเลิกการส่งงาน
        </Button>
      </div>

      {showCancel && (
        <ConfirmModal
          title="ยกเลิกการส่งงานปัจจุบัน?"
          body="รายการส่งงานนี้จะไม่ใช่รายการที่ใช้งานอยู่ และคุณสามารถส่งไฟล์หรือลิงก์ใหม่ได้"
          confirmLabel="ยกเลิกการส่งงาน"
          cancelLabel="เก็บรายการไว้"
          confirmVariant="danger"
          onConfirm={() => {
            setShowCancel(false);
            onCancelSubmission();
          }}
          onCancel={() => setShowCancel(false)}
        />
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3" role="dialog" aria-modal="true" aria-label={`ตัวอย่าง ${preview.name}`}>
          <div className="flex h-[min(90dvh,56rem)] w-full max-w-5xl flex-col rounded-xl bg-white p-3 shadow-xl">
            <div className="flex min-w-0 items-center justify-between gap-3 pb-3">
              <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{preview.name}</p>
              <button type="button" onClick={closePreview} className="min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">ปิด</button>
            </div>
            {preview.kind === 'image' ? (
              <img src={preview.url} alt={preview.name} className="min-h-0 w-full flex-1 object-contain" />
            ) : preview.kind === 'pdf' ? (
              <iframe title={preview.name} src={preview.url} className="min-h-0 w-full flex-1 border-0" />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-slate-50 p-6 text-center">
                <p className="text-sm text-slate-600">ไฟล์ชนิดนี้ยังไม่รองรับการแสดงตัวอย่างในระบบ</p>
                <a href={preview.url} download={preview.name} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">ดาวน์โหลดไฟล์</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
