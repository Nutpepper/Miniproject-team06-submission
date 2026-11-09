import React from 'react';

interface BackButtonProps {
  onClick: () => void;
  label?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onClick,
  label = 'ย้อนกลับ',
}) => (
  <button
    type="button"
    onClick={onClick}
    className="mb-5 inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 shadow-sm transition-all hover:-translate-x-0.5 hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 group cursor-pointer"
  >
    <svg
      className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
    {label}
  </button>
);
