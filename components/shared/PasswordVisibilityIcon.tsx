import React from 'react';

export function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6.5 4.5 12 4.5s9.5 7.5 9.5 7.5-4 7.5-9.5 7.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6.5 4.5 12 4.5c1.9 0 3.6.9 5 2.1M21.5 12S17.5 19.5 12 19.5c-1.9 0-3.6-.9-5-2.1" />
      <path strokeLinecap="round" d="M3 3l18 18" />
      <path strokeLinecap="round" d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
