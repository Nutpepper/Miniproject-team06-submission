import React from 'react';

interface LinkInputProps {
  value: string;
  onChange: (v: string) => void;
  error: string | null;
}

export const LinkInput: React.FC<LinkInputProps> = ({ value, onChange, error }) => (
  <div>
    <label htmlFor="link-input" className="text-sm font-medium text-slate-700 block mb-1.5">
      Submission Link
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      </div>
      <input
        id="link-input"
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com/your-submission"
        className={[
          'w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border bg-white transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
          error
            ? 'border-red-400 focus:ring-red-500'
            : 'border-slate-300 hover:border-slate-400',
        ].join(' ')}
        aria-describedby={error ? 'link-error' : 'link-hint'}
        aria-invalid={!!error}
      />
    </div>
    {error ? (
      <p id="link-error" className="text-xs font-medium text-red-600 mt-1.5 flex items-center gap-1" role="alert">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        {error}
      </p>
    ) : (
      <p id="link-hint" className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
        <svg className="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        Link must use HTTPS (e.g. Google Docs, GitHub, OneDrive).
      </p>
    )}
  </div>
);
