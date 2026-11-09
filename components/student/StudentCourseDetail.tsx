import React from 'react';
import type { Course, Assignment, Submission } from '@/lib/types';
import { isPastDeadline, getDaysUntilDeadline } from '@/lib/formatters';
import { BackButton } from '@/components/shared/BackButton';
import { BreadcrumbNav } from '@/components/shared/BreadcrumbNav';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DeadlineInfo } from '@/components/shared/DeadlineInfo';
import { Button } from '@/components/shared/Button';
import { EmptyState } from '@/components/shared/EmptyState';
import { getCourseBannerColor } from '@/lib/course-theme';

interface StudentCourseDetailProps {
  course: Course;
  assignments: Assignment[];
  submissions: Submission[];
  onBack: () => void;
  onSelectAssignment: (assignmentId: string) => void;
  currentUserId?: string;
}

export const StudentCourseDetail: React.FC<StudentCourseDetailProps> = ({ course, assignments, submissions, onBack, onSelectAssignment, currentUserId }) => {
  const getStudentSubmission = (id: string) => submissions.find((submission) => submission.assignmentId === id && Boolean(currentUserId) && submission.studentId === currentUserId);
  const submitted = assignments.filter((assignment) => getStudentSubmission(assignment.id));
  const pending = assignments.filter((assignment) => !getStudentSubmission(assignment.id));

  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <BreadcrumbNav items={[{ label: 'รายวิชาของฉัน', onClick: onBack }, { label: course.code ? `[${course.code}] ${course.name}` : course.name }]} />
    <BackButton onClick={onBack} label="กลับไปยังรายวิชาของฉัน" />

    <div className="mb-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`bg-gradient-to-r ${course.bannerColor || getCourseBannerColor(course.id)} px-5 py-6 text-white sm:px-6`}>
        {course.code && <div className="mb-2 inline-flex items-center rounded-md bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white backdrop-blur-xs">{course.code}</div>}
        <h1 className="break-words text-2xl font-bold leading-snug">{course.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-indigo-100"><svg className="h-4 w-4 flex-shrink-0 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg><span>ผู้สอน: {course.instructor}</span></p>
      </div>
      {course.description && <div className="bg-white p-5 sm:p-6"><p className="max-w-3xl text-sm leading-relaxed text-slate-600">{course.description}</p></div>}
    </div>

    <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><h2 className="text-lg font-bold text-slate-900">งานที่ได้รับมอบหมาย</h2><p className="mt-0.5 text-xs text-slate-500">ทั้งหมด {assignments.length} งานในรายวิชานี้</p></div>
      <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500"><span><span className="font-semibold text-slate-900">{submitted.length}</span> ส่งแล้ว</span><span className="text-slate-300">|</span><span><span className="font-semibold text-slate-900">{pending.length}</span> รอส่ง</span></div>
    </div>
    {assignments.length === 0 ? <EmptyState title="ยังไม่มีงานที่เผยแพร่" description="ขณะนี้ยังไม่มีงานในรายวิชานี้" /> : <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-2.5 sm:gap-4">
      {assignments.map((assignment) => {
        const submission = getStudentSubmission(assignment.id);
        const past = isPastDeadline(assignment.deadline);
        const days = getDaysUntilDeadline(assignment.deadline);
        const statusBorder = submission ? 'border-l-emerald-500' : past ? 'border-l-red-500' : 'border-l-indigo-500';
        return <div key={assignment.id} className={`flex w-full max-w-md flex-col justify-between rounded-lg border border-slate-200 border-l-4 bg-white shadow-sm transition-shadow hover:shadow-md sm:rounded-xl ${statusBorder}`}>
          <div className="flex flex-1 flex-col p-3.5 sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">{assignment.courseCode && <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">{assignment.courseCode}</span>}<div className="ml-auto flex-shrink-0"><StatusBadge status={submission ? submission.status : past ? 'overdue' : 'not_submitted'} size="sm" /></div></div>
            <h3 className="mb-2 break-words text-sm font-bold leading-snug text-slate-900 sm:text-base sm:font-semibold">{assignment.title}</h3>
            <div className="mt-auto border-t border-slate-100 pt-2 sm:pt-3"><DeadlineInfo deadline={assignment.deadline} />{!past && <p className="ml-6 mt-1 text-xs text-slate-400">{days === 1 ? 'เหลือ 1 วัน' : days > 0 ? `เหลือ ${days} วัน` : 'ครบกำหนดวันนี้'}</p>}</div>
          </div>
          <div className="flex justify-end px-3.5 pb-3.5 pt-0 sm:justify-stretch sm:px-5 sm:pb-5 sm:pt-1"><Button variant={submission ? 'secondary' : past ? 'outline' : 'primary'} size="sm" className="min-h-10 sm:w-full" onClick={() => onSelectAssignment(assignment.id)}>{!submission ? 'ส่งงาน' : submission.status === 'LATE' ? 'ดูงานที่ส่ง' : 'ดูรายละเอียดงาน'}</Button></div>
        </div>;
      })}
    </div>}
  </div>;
};
