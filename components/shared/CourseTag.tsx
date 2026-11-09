import React from 'react';

interface CourseTagProps {
  code: string;
  name: string;
}

export const CourseTag: React.FC<CourseTagProps> = ({ code, name }) => (
  <div className="flex items-start gap-2 min-w-0">
    {code && <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-100 text-indigo-700 flex-shrink-0 mt-0.5">
      {code}
    </span>}
    <span className="text-sm text-slate-600 break-words">{name}</span>
  </div>
);
