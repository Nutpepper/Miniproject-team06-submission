import React from 'react';
import type { Course, Assignment } from '@/lib/types';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { CourseCard } from '@/components/shared/CourseCard';

interface StudentCourseListProps {
  courses: Course[];
  assignments: Assignment[];
  loadingAssignments?: boolean;
  studentLabel?: string;
  onSelectCourse: (courseId: string) => void;
  onViewAssignments: (courseId: string) => void;
  onViewFiles: (courseId: string) => void;
}

export const StudentCourseList: React.FC<StudentCourseListProps> = ({
  courses,
  assignments,
  loadingAssignments = false,
  studentLabel,
  onSelectCourse,
  onViewAssignments,
  onViewFiles,
}) => {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <SectionHeader
        title="รายวิชาของฉัน"
        subtitle={studentLabel || 'รายวิชาที่ลงทะเบียน'}
        action={
          <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900">
            <span>รายวิชาทั้งหมด</span>
            <span className="font-bold tabular-nums text-indigo-700">{courses.length}</span>
            <span>รายวิชา</span>
          </span>
        }
      />

      <p className="mb-4 text-xs text-slate-500">แสดงรายวิชาจาก Team 05 ทั้งหมด ระบบยังไม่มีข้อมูลตรวจสอบการลงทะเบียนรายบุคคล</p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-4 [&>*]:w-full [&>*]:max-w-md">
        {courses.map((course) => {
          const courseAssignments = assignments.filter((a) => a.courseId === course.id);
          return (
            <CourseCard
              key={course.id}
              course={course}
              assignmentCount={loadingAssignments ? null : courseAssignments.length}
              onSelect={() => onSelectCourse(course.id)}
              onViewAssignments={() => onViewAssignments(course.id)}
              onViewFiles={() => onViewFiles(course.id)}
              actionLabel="ดูรายวิชา"
            />
          );
        })}
      </div>
    </div>
  );
};
