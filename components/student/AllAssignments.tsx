import React, { useState } from 'react';
import type { Course, Assignment, Submission } from '@/lib/types';
import { formatThaiTime, isPastDeadline } from '@/lib/formatters';
import { BackButton } from '@/components/shared/BackButton';
import { BreadcrumbNav } from '@/components/shared/BreadcrumbNav';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/shared/Button';
import { getCourseBannerColor } from '@/lib/course-theme';

interface StudentCourseDetailProps {
  course: Course;
  assignments: Assignment[];
  submissions: Submission[];
  onBack: () => void;
  onSelectAssignment: (assignmentId: string) => void;
  currentUserId?: string;
}

type Filter = 'all' | 'pending' | 'submitted' | 'overdue';
const filters: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'pending', label: 'รอส่ง' },
  { value: 'submitted', label: 'ส่งแล้ว' },
  { value: 'overdue', label: 'เกินกำหนด' },
];

export const AllAssignments: React.FC<StudentCourseDetailProps> = ({ course, assignments, submissions, onBack, onSelectAssignment, currentUserId }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const getSubmission = (id: string) => submissions.find((submission) => submission.assignmentId === id && submission.studentId === currentUserId);
  const visible = assignments.filter((assignment) => {
    const submission = getSubmission(assignment.id);
    if (filter === 'pending') return !submission;
    if (filter === 'submitted') return Boolean(submission);
    if (filter === 'overdue') return !submission && isPastDeadline(assignment.deadline);
    return true;
  });

  return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <BreadcrumbNav items={[{ label: 'รายวิชาของฉัน', onClick: onBack }, { label: course.code ? `[${course.code}] ${course.name}` : course.name }]} />
    <BackButton onClick={onBack} label="กลับไปยังรายวิชาของฉัน" />
    <header className="mb-6 border-b border-slate-200 pb-5">
      <div className={`mb-3 h-1.5 w-16 rounded-full bg-gradient-to-r ${course.bannerColor || getCourseBannerColor(course.id)}`} />
      {course.code && <p className="text-sm font-semibold text-indigo-700">{course.code}</p>}
      <h1 className="mt-1 break-words text-xl font-bold text-slate-900 sm:text-2xl">{course.name}</h1>
      <p className="mt-1 text-sm text-slate-500">ผู้สอน: {course.instructor}</p>
      {course.description && <p className="mt-3 whitespace-pre-line break-words text-sm text-slate-600">{course.description}</p>}
    </header>
    <section aria-labelledby="assignments-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="assignments-title" className="text-lg font-bold text-slate-900">งานที่ได้รับมอบหมาย</h2><p className="mt-1 text-xs text-slate-500">ทั้งหมด {assignments.length} งานในรายวิชานี้</p></div>
        <label className="flex items-center gap-2 text-sm text-slate-600">สถานะ <select value={filter} onChange={(event) => { setFilter(event.target.value as Filter); setExpandedId(null); }} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">{filters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      {visible.length === 0 ? <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">{assignments.length ? 'ไม่มีงานในสถานะนี้' : 'ยังไม่มีงานที่เผยแพร่'}</p> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {visible.map((assignment, index) => {
          const submission = getSubmission(assignment.id);
          const past = isPastDeadline(assignment.deadline);
          const expanded = expandedId === assignment.id;
          const panelId = `assignment-panel-${index}`;
          return <article key={assignment.id} className="border-b border-slate-200 last:border-b-0">
            <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpandedId(expanded ? null : assignment.id)} className={`flex w-full items-start gap-3 px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:items-center sm:px-5 ${expanded ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white ${course.bannerColor || getCourseBannerColor(course.id)}`} aria-hidden="true"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 10h8M8 14h8M8 18h5"/></svg></span>
              <span className="min-w-0 flex-1"><span className="block break-words font-semibold text-slate-900">{assignment.title}</span><span className="mt-1 block text-xs text-slate-500">กำหนดส่ง: {formatThaiTime(assignment.deadline)}</span><span className="mt-2 block sm:hidden"><StatusBadge status={submission ? submission.status : past ? 'overdue' : 'not_submitted'} size="sm" /></span></span>
              <span className="hidden shrink-0 sm:block"><StatusBadge status={submission ? submission.status : past ? 'overdue' : 'not_submitted'} size="sm" /></span>
              <svg className={`mt-2 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div id={panelId} inert={!expanded} aria-hidden={!expanded} className={`grid transition-[grid-template-rows,opacity] duration-[220ms] ease-in-out motion-reduce:transition-none ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="min-h-0 overflow-hidden"><div className="px-4 pb-5 pt-4 sm:pl-17 sm:pr-5">
                <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-700">{assignment.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                <p className="mt-3 text-sm text-slate-500">กำหนดส่ง: {formatThaiTime(assignment.deadline)}</p>
                {submission && <p className="mt-1 text-sm text-slate-500">ส่งเมื่อ: {formatThaiTime(submission.submittedAt)}{submission.fileName ? ` · ${submission.fileName}` : submission.type === 'link' ? ' · ลิงก์' : ''}</p>}
                <Button variant={submission ? 'secondary' : 'primary'} className="mt-4 min-h-10" onClick={() => onSelectAssignment(assignment.id)}>{submission ? 'ดูรายละเอียด' : 'ดูรายละเอียดและส่งงาน'}</Button>
              </div></div>
            </div>
          </article>;
        })}
      </div>}
    </section>
  </div>;
};
