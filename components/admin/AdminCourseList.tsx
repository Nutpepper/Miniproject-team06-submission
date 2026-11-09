import React from 'react';
import type { Course, Assignment } from '@/lib/types';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { CourseCard } from '@/components/shared/CourseCard';

interface AdminCourseListProps {
  courses: Course[];
  assignments: Assignment[];
  onSelectCourse: (courseId: string) => void;
}

export const AdminCourseList: React.FC<AdminCourseListProps> = ({
  courses,
  assignments,
  onSelectCourse,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <SectionHeader
        title="My Courses"
        subtitle="Teaching Staff"
        action={
          <span className="text-sm font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
            {courses.length} Active Courses
          </span>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => {
          const courseAssignments = assignments.filter((a) => a.courseId === course.id);
          return (
            <CourseCard
              key={course.id}
              course={course}
              assignmentCount={courseAssignments.length}
              onSelect={() => onSelectCourse(course.id)}
              actionLabel="ดูงานในรายวิชา"
            />
          );
        })}
      </div>
    </div>
  );
};
