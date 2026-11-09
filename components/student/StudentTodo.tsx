import React, { useMemo, useState } from 'react';
import type { Assignment, Submission } from '@/lib/types';
import { isPastDeadline, formatThaiTime } from '@/lib/formatters';

interface Props { assignments: Assignment[]; submissions: Submission[]; currentUserId?: string; onSelect: (assignment: Assignment) => void; }
type Tab = 'pending' | 'late' | 'done';

const tabStyles: Record<Tab, { label: string; base: string; selected: string; hover: string; icon: React.ReactNode }> = {
  pending: {
    label: 'รอส่ง', base: 'border-amber-200 bg-amber-50 text-amber-800', selected: 'border-amber-500 ring-2 ring-amber-200', hover: 'hover:border-amber-400 hover:bg-amber-100/70',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2.5 2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  late: {
    label: 'เกินกำหนด', base: 'border-red-200 bg-red-50 text-red-800', selected: 'border-red-500 ring-2 ring-red-200', hover: 'hover:border-red-400 hover:bg-red-100/70',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.3 3.9 2.6 17.3A2 2 0 004.3 20h15.4a2 2 0 001.7-2.7L13.7 3.9a2 2 0 00-3.4 0z" /></svg>,
  },
  done: {
    label: 'ส่งแล้ว', base: 'border-emerald-200 bg-emerald-50 text-emerald-800', selected: 'border-emerald-500 ring-2 ring-emerald-200', hover: 'hover:border-emerald-400 hover:bg-emerald-100/70',
    icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 12 2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
};

export const StudentTodo: React.FC<Props> = ({ assignments, submissions, currentUserId, onSelect }) => {
  const [tab, setTab] = useState<Tab>('pending');
  const [courseFilter, setCourseFilter] = useState('all');
  const courses = useMemo(() => {
    const uniqueCourses = new Map<string, { id: string; label: string }>();
    assignments.forEach((assignment) => {
      if (!uniqueCourses.has(assignment.courseId)) uniqueCourses.set(assignment.courseId, { id: assignment.courseId, label: assignment.courseCode ? `${assignment.courseCode} · ${assignment.course}` : assignment.course });
    });
    return [...uniqueCourses.values()];
  }, [assignments]);
  const items = useMemo(() => assignments.filter((assignment) => courseFilter === 'all' || assignment.courseId === courseFilter).map((assignment) => ({ assignment, submission: submissions.find((submission) => submission.assignmentId === assignment.id && submission.studentId === currentUserId) })), [assignments, submissions, currentUserId, courseFilter]);
  const counts = { pending: items.filter(({ assignment, submission }) => !submission && !isPastDeadline(assignment.deadline)).length, late: items.filter(({ assignment, submission }) => !submission && isPastDeadline(assignment.deadline)).length, done: items.filter(({ submission }) => Boolean(submission)).length };
  const filtered = items.filter(({ assignment, submission }) => tab === 'done' ? Boolean(submission) : tab === 'late' ? !submission && isPastDeadline(assignment.deadline) : !submission && !isPastDeadline(assignment.deadline)).sort((a, b) => a.assignment.deadline.getTime() - b.assignment.deadline.getTime());
  const tabs: Tab[] = ['pending', 'late', 'done'];
  const postedLabel = (assignment: Assignment) => assignment.postedAt && !Number.isNaN(assignment.postedAt.getTime()) ? formatThaiTime(assignment.postedAt) : null;

  return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <header className="mb-6 rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-700 px-5 py-6 text-white shadow-sm sm:px-7"><p className="text-sm font-medium text-indigo-100">งานของฉัน</p><h1 className="mt-1 text-2xl font-bold">สิ่งที่ต้องทำ</h1><p className="mt-2 text-sm text-indigo-100">ติดตามงานและกำหนดส่งจากทุกรายวิชาในที่เดียว</p></header>
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="grid w-full grid-cols-3 gap-1.5 sm:min-w-0 sm:flex-1 sm:basis-72 sm:gap-3">
        {tabs.map((id) => {
          const style = tabStyles[id]; const selected = tab === id;
          return <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={selected} aria-label={`${style.label} ${counts[id]} งาน${selected ? ', กำลังเลือกอยู่' : ''}`} className={`relative min-w-0 rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:rounded-xl sm:p-3 ${style.base} ${style.hover} ${selected ? style.selected : ''}`}>
            <span className="flex items-center gap-1.5"><span className="shrink-0" aria-hidden="true">{style.icon}</span><span className="truncate text-[11px] font-semibold sm:text-xs">{style.label}</span></span>
            <span className="mt-1 block text-lg font-bold leading-none sm:text-xl">{counts[id]}</span>
            {selected && <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-current text-[10px] text-white sm:right-2 sm:top-2" aria-hidden="true">✓</span>}
            {selected && <span className="sr-only">กำลังเลือกอยู่</span>}
          </button>;
        })}
      </div>
      <label className="block w-full sm:w-64 sm:max-w-full"><span className="mb-1.5 block text-sm font-medium text-slate-700">ชั้นเรียน</span><select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"><option value="all">ชั้นเรียนทั้งหมด</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.label}</option>)}</select></label>
    </div>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">{tabStyles[tab].label}</h2><span className="text-sm text-slate-500">{filtered.length} รายการ</span></div><div className="divide-y divide-slate-100">{filtered.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">ไม่มีงานในหมวดนี้</p> : filtered.map(({ assignment, submission }) => <button key={assignment.id} type="button" onClick={() => onSelect(assignment)} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:gap-4 sm:px-5"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base ${submission ? 'bg-emerald-50 text-emerald-700' : isPastDeadline(assignment.deadline) ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`} aria-hidden="true">▣</span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-900">{assignment.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{assignment.courseCode ? `${assignment.courseCode} · ` : ''}{assignment.course}</span>{postedLabel(assignment) && <span className="mt-1 block text-xs text-slate-400">อาจารย์โพสต์เมื่อ {postedLabel(assignment)}</span>}</span><span className={`max-w-28 text-right text-xs font-semibold sm:max-w-none ${submission ? 'text-emerald-700' : isPastDeadline(assignment.deadline) ? 'text-red-700' : 'text-amber-700'}`}>{submission ? 'ส่งแล้ว' : formatThaiTime(assignment.deadline)}</span></button>)}</div></section>
  </div>;
};
