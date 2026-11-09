import React, { useCallback, useState } from 'react';
import type { Assignment, PendingSubmission } from '@/lib/types';
import { BackButton } from '@/components/shared/BackButton';
import { CourseTag } from '@/components/shared/CourseTag';
import { DeadlineInfo } from '@/components/shared/DeadlineInfo';
import { Button } from '@/components/shared/Button';
import { FileUploadZone, type SelectedFile } from './FileUploadZone';

interface SubmitAssignmentProps { assignment: Assignment; onBack: () => void; onProceed: (pending: PendingSubmission) => void; submitting?: boolean; }

export const SubmitAssignment: React.FC<SubmitAssignmentProps> = ({ assignment, onBack, onProceed, submitting = false }) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const maxFileSize = 20 * 1024 * 1024;
  const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'jpg', 'jpeg', 'png', 'gif', 'webp']);

  const handleFilesSelect = useCallback((files: File[]) => {
    const unsupported = files.find((file) => !allowedExtensions.has(file.name.split('.').pop()?.toLowerCase() || ''));
    if (unsupported) { setFileError(`ไม่รองรับไฟล์ ${unsupported.name}`); return; }
    if (files.some((file) => file.size > maxFileSize)) { setFileError('ไฟล์แต่ละไฟล์ต้องมีขนาดไม่เกิน 20 MB'); return; }
    setSelectedFiles((current) => {
      const fresh = files.filter((file) => !current.some((selected) => selected.file.name === file.name && selected.file.size === file.size && selected.file.lastModified === file.lastModified));
      if (!fresh.length) { setFileError('ไฟล์นี้ถูกเลือกไว้แล้ว'); return current; }
      const merged = [...current, ...fresh.map((file) => ({ file, name: file.name, size: file.size }))];
      if (merged.length > 10) { setFileError('แนบได้สูงสุด 10 ไฟล์'); return current; }
      if (merged.reduce((total, selected) => total + selected.size, 0) > 100 * 1024 * 1024) { setFileError('ขนาดไฟล์รวมต้องไม่เกิน 100 MB'); return current; }
      setFileError(null); return merged;
    });
  }, [allowedExtensions]);

  const requestSubmission = () => {
    if (!selectedFiles.length) { setFileError('กรุณาเลือกอย่างน้อย 1 ไฟล์'); return; }
    setConfirmOpen(true);
  };
  const confirmSubmission = () => { setConfirmOpen(false); onProceed({ type: 'file', files: selectedFiles.map((selectedFile) => ({ file: selectedFile.file, fileName: selectedFile.name, fileSize: selectedFile.size })) }); };
  const discardAndBack = () => { setSelectedFiles([]); setFileError(null); onBack(); };

  return <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
    <BackButton onClick={discardAndBack} />
    <div className="mb-6"><h1 className="text-xl font-bold text-slate-900">ส่งงาน</h1><div className="mt-2 space-y-1"><p className="text-sm font-medium text-slate-700">{assignment.title}</p><CourseTag code={assignment.courseCode} name={assignment.course} /></div><div className="mt-3"><DeadlineInfo deadline={assignment.deadline} /></div></div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 bg-indigo-50 px-6 py-3 text-sm font-semibold text-indigo-700">แนบไฟล์จากอุปกรณ์ของคุณ</div><div className="p-6"><FileUploadZone selectedFiles={selectedFiles} error={fileError} onFilesSelect={handleFilesSelect} onRemove={(index) => setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} /><div className="mt-6 flex gap-3"><Button variant="secondary" onClick={discardAndBack}>ย้อนกลับ</Button><Button variant="primary" onClick={requestSubmission}>ยืนยันการส่งงาน</Button></div></div></div>
    {confirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200"><h2 className="text-lg font-bold text-slate-900">ยืนยันการส่งงาน?</h2><p className="mt-2 text-sm text-slate-600">คุณกำลังจะส่งไฟล์ {selectedFiles.length} ไฟล์สำหรับ “{assignment.title}” หลังยืนยัน ระบบจะเริ่มอัปโหลดไฟล์ทันที</p><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={() => setConfirmOpen(false)}>กลับไปตรวจไฟล์</Button><Button variant="primary" onClick={confirmSubmission}>ส่งงานเลย</Button></div></div></div>}
    {submitting && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4" role="status" aria-live="polite"><div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-2xl"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"/><h2 className="mt-5 text-lg font-bold text-slate-900">กำลังส่งงาน</h2><p className="mt-2 text-sm text-slate-500">กำลังอัปโหลดไฟล์และบันทึกการส่งงาน กรุณาอย่าปิดหน้านี้</p></div></div>}
  </div>;
};
