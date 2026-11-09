"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { Role } from '@/lib/types';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { ProfileMenu } from '@/components/shared/ProfileMenu';

interface TopNavProps {
  role: Role;
  showSwitchRole?: boolean;
  userEmail?: string;
  onLogout?: () => void;
  onMobileMenu?: () => void;
  onSidebarToggle?: () => void;
  sidebarCollapsed?: boolean;
  mobileMenuOpen?: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  role,
  showSwitchRole = false,
  userEmail,
  onLogout,
  onMobileMenu,
  onSidebarToggle,
  sidebarCollapsed = false,
  mobileMenuOpen = false,
}) => {
  const isStudent = role === 'student';
  const homeHref = isStudent ? '/student' : '/admin';
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLogoutConfirmOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const confirmLogout = () => {
    setLogoutConfirmOpen(false);
    void onLogout?.();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className={`flex h-14 w-full items-center justify-between gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6 ${onSidebarToggle ? 'lg:pl-0 lg:pr-8' : 'lg:px-8'}`}>
        {/* Brand */}
        <div className={`flex min-w-0 items-center gap-1.5 sm:gap-2 ${onSidebarToggle ? 'lg:gap-0' : ''}`}>
          {onMobileMenu && (
            <button
              type="button"
              onClick={onMobileMenu}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 lg:hidden"
              aria-label="เปิดเมนู"
              aria-expanded={mobileMenuOpen}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          )}
          {onSidebarToggle && (
            <button
              type="button"
              onClick={onSidebarToggle}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 lg:mx-4 lg:flex"
              aria-label={sidebarCollapsed ? 'ขยายเมนู' : 'ยุบเมนู'}
              aria-expanded={!sidebarCollapsed}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          )}
          <Link href={homeHref} className="shrink-0 group" aria-label="กลับสู่หน้าหลัก UniLearn">
            <BrandLogo />
          {/*
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-200 group-hover:bg-indigo-700 transition-colors">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm leading-tight block">
              UniLearn
            </span>
            <span className="text-xs text-slate-500 leading-tight">
              ระบบส่งงาน · ทีม 06
            </span>
          </div> */}
          </Link>
        </div>

        {/* User Info */}
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <ProfileMenu role={role} />

          {!isStudent && (
            <Link href="/admin/users" className="hidden rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 md:inline-flex">
              อนุมัติอีเมล
            </Link>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={() => {
                setLogoutConfirmOpen(true);
              }}
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
              className="ml-1 flex h-10 w-10 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 p-0 text-xs font-semibold text-red-700 transition-colors hover:border-red-200 hover:bg-red-100 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 sm:h-auto sm:w-auto sm:px-2.5 sm:py-2 [&>span]:hidden sm:[&>span]:inline"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span>ออกจากระบบ</span>
            </button>
          )}

          {showSwitchRole && (
            <Link
              href="/"
              className="text-xs font-medium text-slate-500 hover:text-indigo-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-indigo-300 transition-colors"
            >
              เปลี่ยนบทบาท
            </Link>
          )}
        </div>
      </div>
      {logoutConfirmOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={() => setLogoutConfirmOpen(false)}>
          <section className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700" aria-hidden="true">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </div>
            <h2 id="logout-confirm-title" className="mt-4 text-lg font-bold text-slate-900">ออกจากระบบ?</h2>
            <p className="mt-2 text-sm text-slate-600">คุณต้องการออกจากระบบ UniLearn ใช่หรือไม่</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button type="button" onClick={() => setLogoutConfirmOpen(false)} className="min-h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">ยกเลิก</button>
              <button type="button" onClick={confirmLogout} className="min-h-10 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">ออกจากระบบ</button>
            </div>
          </section>
        </div>,
        document.body
      )}
    </header>
  );
};
