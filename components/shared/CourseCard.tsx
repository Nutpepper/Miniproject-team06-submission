import React from 'react';
import type { Course } from '@/lib/types';
import { Button } from './Button';
import { getCourseBannerColor } from '@/lib/course-theme';

interface CourseCardProps {
  course: Course;
  assignmentCount: number | null;
  assignmentCountLabel?: string;
  onSelect: () => void;
  actionLabel?: string;
  onCustomize?: () => void;
  onViewAssignments?: () => void;
  onViewFiles?: () => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  assignmentCount,
  assignmentCountLabel,
  onSelect,
  actionLabel = 'ดูรายวิชา',
  onCustomize,
  onViewAssignments,
  onViewFiles,
}) => (
  <article className="group flex min-h-72 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
    <div className={`relative min-h-32 bg-gradient-to-br ${course.bannerColor || getCourseBannerColor(course.id)} text-white`}>
      <button type="button" onClick={onSelect} className="flex min-h-32 w-full flex-col items-start justify-between gap-3 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white" aria-label={`เปิดรายวิชา ${course.name}`}>{course.code && <span className="inline-flex max-w-full break-all rounded-md bg-white/20 px-2.5 py-1 text-xs font-bold ring-1 ring-inset ring-white/25">{course.code}</span>}<span className="mt-auto block w-full break-words text-lg font-bold leading-snug">{course.name}</span></button>
      {onCustomize && <button type="button" onClick={onCustomize} className="absolute right-3 top-3 z-10 rounded-lg bg-white/20 px-2.5 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/30 backdrop-blur hover:bg-white/30" aria-label="ตั้งค่าหน้าปกรายวิชา">✎ ตั้งค่า</button>}
    </div>

    <div className="flex flex-1 flex-col p-5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2 text-slate-600"><span aria-hidden="true">♙</span><span className="truncate">{course.instructor}</span></span>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{assignmentCountLabel || (assignmentCount === null ? 'กำลังโหลดงาน...' : `${assignmentCount} งาน`)}</span>
      </div>
      <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{course.description}</p>
      <div className="mt-5 flex items-center gap-2">
        <Button variant="outline" fullWidth size="sm" onClick={onSelect} className="min-w-0 border-slate-300 text-slate-700 hover:border-indigo-600 hover:bg-indigo-600 hover:text-white">{actionLabel}</Button>
        {onViewAssignments && <button type="button" onClick={onViewAssignments} title="ดูงานทั้งหมด" aria-label={`ดูงานทั้งหมดของ ${course.name}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 10h8M8 14h8M8 18h5"/></svg></button>}
        {onViewFiles && <button type="button" onClick={onViewFiles} title="ไฟล์ในรายวิชา" aria-label={`ไฟล์ในรายวิชา ${course.name}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></button>}
      </div>
    </div>
  </article>
);
