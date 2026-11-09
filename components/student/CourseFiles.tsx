import React, { useEffect, useMemo, useState } from 'react';
import type { Assignment, Course, Submission } from '@/lib/types';
import { formatThaiTime } from '@/lib/formatters';
import { supabase } from '@/lib/supabase/client';
import { BackButton } from '@/components/shared/BackButton';

type FileKind = 'PDF' | 'Word' | 'Excel' | 'PowerPoint' | 'Image' | 'Other';
type FileItem = { key: string; name: string; path: string; assignment: Assignment; date: Date; kind: FileKind };
type Filter = 'all' | 'documents' | 'images' | 'mine' | 'teacher';

function fileKind(name: string): FileKind {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(extension || '')) return 'Word';
  if (['xls', 'xlsx'].includes(extension || '')) return 'Excel';
  if (['ppt', 'pptx'].includes(extension || '')) return 'PowerPoint';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) return 'Image';
  return 'Other';
}

interface Props {
  course: Course; assignments: Assignment[]; submissions: Submission[]; currentUserId?: string;
  loading: boolean; loadError: string | null; onBack: () => void; onAssignment: (id: string) => void;
}

export const CourseFiles: React.FC<Props> = ({ course, assignments, submissions, currentUserId, loading, loadError, onBack, onAssignment }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; kind: 'PDF' | 'Image' } | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const files = useMemo(() => {
    const byAssignment = new Map(assignments.map((assignment) => [assignment.id, assignment]));
    const latest = new Map<string, Submission>();
    for (const submission of submissions) {
      if (!currentUserId || submission.studentId !== currentUserId || !byAssignment.has(submission.assignmentId)) continue;
      const previous = latest.get(submission.assignmentId);
      if (!previous || submission.submittedAt > previous.submittedAt) latest.set(submission.assignmentId, submission);
    }
    return [...latest.values()].flatMap((submission) => {
      const assignment = byAssignment.get(submission.assignmentId)!;
      if (submission.type !== 'file') return [];
      const attachments = submission.attachments?.length ? submission.attachments : submission.filePath && submission.fileName ? [{ fileName: submission.fileName, filePath: submission.filePath }] : [];
      return attachments.map((file) => ({ key: `${submission.id}:${file.filePath}`, name: file.fileName, path: file.filePath, assignment, date: submission.submittedAt, kind: fileKind(file.fileName) }));
    }).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [assignments, submissions, currentUserId]);

  const filtered = files.filter((file) => {
    if (!file.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) return false;
    if (filter === 'teacher') return false;
    if (filter === 'images') return file.kind === 'Image';
    if (filter === 'documents') return ['PDF', 'Word', 'Excel', 'PowerPoint'].includes(file.kind);
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const visible = filtered.slice((page - 1) * 20, page * 20);

  const openFile = async (file: FileItem, download: boolean) => {
    setOpening(file.key); setError(null);
    try {
      const { data, error: downloadError } = await supabase.storage.from('submissions').download(file.path);
      if (downloadError || !data) throw new Error('ไม่สามารถเปิดไฟล์ได้ ไฟล์อาจถูกลบหรือคุณไม่มีสิทธิ์เข้าถึง');
      const url = URL.createObjectURL(data);
      if (!download && (file.kind === 'PDF' || file.kind === 'Image')) {
        setPreview({ url, name: file.name, kind: file.kind });
      } else {
        const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ไม่สามารถเปิดไฟล์ได้'); }
    finally { setOpening(null); }
  };

  return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <BackButton onClick={onBack} label="กลับไปรายวิชาของฉัน" />
    <header className="mb-6"><p className="text-sm font-semibold text-indigo-700">{course.code ? `${course.code} · ` : ''}{course.name}</p><h1 className="mt-1 text-2xl font-bold text-slate-900">ไฟล์ในรายวิชา</h1><p className="mt-1 text-sm text-slate-500">ไฟล์ที่ฉันส่ง {files.length} ไฟล์</p></header>
    <p className="mb-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">ไฟล์จากอาจารย์ยังไม่พร้อมแสดง เนื่องจากข้อมูลรายวิชาที่เชื่อมต่อยังไม่มีรายการไฟล์แนบ</p>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">ค้นหาชื่อไฟล์</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="ค้นหาชื่อไฟล์" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></label><label><span className="sr-only">กรองประเภทไฟล์</span><select value={filter} onChange={(event) => { setFilter(event.target.value as Filter); setPage(1); }} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-48"><option value="all">ไฟล์ทั้งหมด</option><option value="documents">เอกสาร</option><option value="images">รูปภาพ</option><option value="mine">ไฟล์ที่ฉันส่ง</option><option value="teacher">ไฟล์จากอาจารย์</option></select></label></div>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section aria-label="รายการไฟล์" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {loading ? <div role="status" className="space-y-3 p-5"><span className="sr-only">กำลังโหลดไฟล์</span>{[0, 1, 2].map((item) => <div key={item} className="h-10 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />)}</div> : loadError ? <p role="alert" className="p-5 text-sm text-red-700">{loadError}</p> : visible.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">{filter === 'teacher' ? 'ยังไม่มีข้อมูลไฟล์จากอาจารย์' : 'ไม่พบไฟล์ที่ตรงกับเงื่อนไข'}</p> : <ul className="divide-y divide-slate-100">{visible.map((file) => <li key={file.key} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap sm:px-5"><div className="min-w-0 flex-1 basis-full sm:basis-auto"><p className="break-all text-sm font-semibold text-slate-900">{file.name}</p><p className="mt-1 text-xs text-slate-500">{file.kind} · ไฟล์ที่ฉันส่ง · {formatThaiTime(file.date)}</p><button type="button" onClick={() => onAssignment(file.assignment.id)} className="mt-1 max-w-full break-words text-left text-xs font-medium text-indigo-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">งาน: {file.assignment.title}</button></div><div className="flex shrink-0 gap-2">{(file.kind === 'PDF' || file.kind === 'Image') && <button type="button" disabled={opening !== null} onClick={() => void openFile(file, false)} className="min-h-10 rounded-lg border border-indigo-200 px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{opening === file.key ? 'กำลังเปิด...' : 'ดูตัวอย่าง'}</button>}<button type="button" disabled={opening !== null} onClick={() => void openFile(file, true)} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">ดาวน์โหลด</button></div></li>)}</ul>}
    </section>
    {!loading && !loadError && pageCount > 1 && <div className="mt-4 flex items-center justify-center gap-4 text-sm"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="min-h-10 rounded-lg px-3 text-indigo-700 disabled:text-slate-400">ก่อนหน้า</button><span>หน้า {page} / {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage(page + 1)} className="min-h-10 rounded-lg px-3 text-indigo-700 disabled:text-slate-400">ถัดไป</button></div>}
    {preview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3" role="dialog" aria-modal="true" aria-label={`ตัวอย่าง ${preview.name}`}><div className="flex h-[min(90dvh,56rem)] w-full max-w-5xl flex-col rounded-xl bg-white p-3"><div className="flex min-w-0 items-center justify-between gap-3 pb-3"><p className="min-w-0 truncate text-sm font-semibold">{preview.name}</p><button type="button" onClick={() => setPreview(null)} className="min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold hover:bg-slate-100">ปิด</button></div>{preview.kind === 'Image' ? <img src={preview.url} alt={preview.name} className="min-h-0 w-full flex-1 object-contain" /> : <iframe title={preview.name} src={preview.url} className="min-h-0 w-full flex-1 border-0" />}</div></div>}
  </div>;
};
