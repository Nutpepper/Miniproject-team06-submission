import React from 'react';

interface InfoRowProps {
  label: string;
  children: React.ReactNode;
}

export const InfoRow: React.FC<InfoRowProps> = ({ label, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-3 border-b border-slate-100 last:border-0">
    <dt className="text-sm font-medium text-slate-500 sm:w-40 flex-shrink-0">{label}</dt>
    <dd className="text-sm text-slate-900 flex-1 min-w-0">{children}</dd>
  </div>
);
