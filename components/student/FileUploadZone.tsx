import React, { useRef, useState } from 'react';
import { formatFileSize } from '@/lib/formatters';

export interface SelectedFile { file: File; name: string; size: number; }

interface FileUploadZoneProps {
  selectedFiles: SelectedFile[];
  error: string | null;
  onFilesSelect: (files: File[]) => void;
  onRemove: (index: number) => void;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({ selectedFiles, error, onFilesSelect, onRemove }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<{ file: SelectedFile; url: string } | null>(null);
  const select = (files: FileList | null) => {
    const values = files ? Array.from(files) : [];
    if (values.length) onFilesSelect(values);
  };
  const openFile = (selectedFile: SelectedFile) => {
    setPreview({ file: selectedFile, url: URL.createObjectURL(selectedFile.file) });
  };

  return (
    <div>
      {selectedFiles.length > 0 && <div className="mb-4 space-y-2">{selectedFiles.map((file, index) => (
        <div key={`${file.name}-${index}`} onClick={() => openFile(file)} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 transition-colors hover:bg-emerald-100">
          <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{file.name}</p><p className="text-xs text-slate-500">{formatFileSize(file.size)} · พร้อมอัปโหลด</p></div>
          <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(index); }} className="shrink-0 rounded-md p-1 text-lg text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500" aria-label={`ลบ ${file.name}`}>×</button>
        </div>
      ))}</div>}
      <div onDrop={(event) => { event.preventDefault(); setIsDragging(false); select(event.dataTransfer.files); }} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onClick={() => inputRef.current?.click()} className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer ${isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50'}`} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && inputRef.current?.click()}>
        <p className="text-sm font-medium text-slate-900">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</p><p className="mt-1 text-xs text-slate-500">แนบหลายไฟล์ในการส่งงานหนึ่งครั้งได้</p><p className="mt-3 text-xs text-slate-400">สูงสุด 10 ไฟล์ ไฟล์ละไม่เกิน 20 MB · รองรับ PDF, เอกสาร Office, รูปภาพ และ ZIP</p>
      </div>
      <input ref={inputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip" className="hidden" onChange={(event) => { select(event.target.files); event.target.value = ''; }} />
      <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:shadow active:scale-[0.98]"><span className="text-base">+</span> เลือกไฟล์จากอุปกรณ์</button>
      {error && <p className="mt-2 text-xs font-medium text-red-600" role="alert">{error}</p>}
      {preview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="ตัวอย่างรูปภาพ">
        <div className="flex h-full w-full max-w-6xl flex-col rounded-2xl bg-white p-3 shadow-2xl">
          <div className="flex items-center justify-between gap-3 px-2 py-1"><button type="button" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }} className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200">← กลับไปเลือกไฟล์</button><p className="truncate text-right text-sm font-semibold text-slate-800">{preview.file.name}</p></div>
          <div className="min-h-0 flex-1">{preview.file.file.type.startsWith('image/') ? <img src={preview.url} alt={`ตัวอย่าง ${preview.file.name}`} className="h-full w-full rounded-xl bg-slate-950 object-contain" /> : preview.file.file.type === 'application/pdf' ? <iframe src={preview.url} title={preview.file.name} className="h-full w-full rounded-xl border-0 bg-white" /> : <div className="flex h-full flex-col items-center justify-center rounded-xl bg-slate-100 p-8 text-center"><p className="text-lg font-semibold text-slate-800">{preview.file.name}</p><p className="mt-2 text-sm text-slate-500">ไฟล์ชนิดนี้ยังไม่รองรับการแสดงตัวอย่างในเบราว์เซอร์ แต่ไฟล์ยังคงถูกเลือกไว้สำหรับส่งงาน</p></div>}</div>
        </div>
      </div>}
    </div>
  );
};
