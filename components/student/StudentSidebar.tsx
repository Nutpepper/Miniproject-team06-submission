import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Course } from '@/lib/types';

interface StudentSidebarProps {
  courses: Course[]; activeCourseId?: string; onHome: () => void; onTodo: () => void; todoActive: boolean;
  collapsed: boolean; onSelectCourse: (courseId: string) => void; mobileOpen: boolean; onMobileClose: () => void;
}

const iconClass = 'h-6 w-6 shrink-0';
const homeIcon = <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-6h6v6"/></svg>;
const todoIcon = <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 4V2m8 2V2M8 10h8m-8 4h8m-8 4h5"/></svg>;
const courseIcon = <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 10-10-5L2 10l10 5 10-5ZM6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 10v6"/></svg>;

export const StudentSidebar: React.FC<StudentSidebarProps> = ({ courses, activeCourseId, onHome, onTodo, todoActive, onSelectCourse, collapsed, mobileOpen, onMobileClose }) => {
  const [coursesOpen, setCoursesOpen] = useState(true);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onMobileClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); };
  }, [mobileOpen, onMobileClose]);

  useEffect(() => { setTooltip(null); setHoverOpen(false); }, [collapsed]);
  useEffect(() => { if (hoverOpen) setTooltip(null); }, [hoverOpen]);

  const navigate = (action: () => void) => { setTooltip(null); action(); onMobileClose(); };
  const showTooltip = (event: React.SyntheticEvent<HTMLButtonElement>, label: string, rail: boolean) => {
    if (!rail) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, left: rect.right + 8, top: rect.top + rect.height / 2 });
  };
  const tooltipEvents = (label: string, rail: boolean) => ({
    onMouseEnter: (event: React.MouseEvent<HTMLButtonElement>) => showTooltip(event, label, rail),
    onMouseLeave: () => setTooltip(null),
    onFocus: (event: React.FocusEvent<HTMLButtonElement>) => showTooltip(event, label, rail),
    onBlur: () => setTooltip(null),
  });
  const navigation = (drawer = false) => {
    const rail = collapsed && !hoverOpen && !drawer;
    const itemClass = (active = false) => `flex min-h-12 w-full cursor-pointer items-center rounded-full text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${rail ? 'justify-center px-2' : 'gap-5 px-4'} ${active ? 'bg-slate-200 font-semibold text-slate-900 hover:bg-slate-300' : 'text-slate-700 hover:bg-slate-200'}`;
    return <nav onScroll={() => setTooltip(null)} className={drawer ? 'h-[calc(100dvh-3.5rem)] overflow-y-auto px-3 py-4' : 'sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto px-2 py-4'} aria-label="เมนูนักศึกษา">
      <button type="button" onClick={() => navigate(onHome)} aria-label="หน้าหลัก" className={itemClass()} {...tooltipEvents('หน้าหลัก', rail)}>{homeIcon}{!rail && <span>หน้าหลัก</span>}</button>
      <button type="button" onClick={() => navigate(onTodo)} aria-label="สิ่งที่ต้องทำ" className={`mt-1 ${itemClass(todoActive)}`} {...tooltipEvents('สิ่งที่ต้องทำ', rail)}>{todoIcon}{!rail && <span>สิ่งที่ต้องทำ</span>}</button>
      <button type="button" onClick={() => { setCoursesOpen((open) => !open); setTooltip(null); }} aria-label="ลงทะเบียนแล้ว" aria-expanded={coursesOpen} aria-controls={drawer ? 'enrolled-courses-mobile' : 'enrolled-courses-desktop'} className={`mt-4 ${itemClass()}`} {...tooltipEvents('ลงทะเบียนแล้ว', rail)}>{courseIcon}{!rail && <><span className="flex-1">ลงทะเบียนแล้ว</span><svg className={`h-4 w-4 transition-transform motion-reduce:transition-none ${coursesOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></>}</button>
      <div id={drawer ? 'enrolled-courses-mobile' : 'enrolled-courses-desktop'} hidden={!coursesOpen} className="mt-1 space-y-1">{courses.map((course) => {
        const label = course.code ? `${course.code} · ${course.name}` : course.name;
        return <button key={course.id} type="button" onClick={() => navigate(() => onSelectCourse(course.id))} aria-label={label} aria-current={activeCourseId === course.id ? 'page' : undefined} className={itemClass(activeCourseId === course.id)} {...tooltipEvents(label, rail)}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[10px] font-bold text-indigo-700">{course.code ? course.code.slice(0, 3) : courseIcon}</span>{!rail && <span className="min-w-0"><span className="block truncate">{course.name}</span>{course.code && <span className="block text-xs font-normal text-slate-500">{course.code}</span>}</span>}</button>;
      })}</div>
    </nav>;
  };

  return <>
    <aside className={`relative z-30 hidden shrink-0 lg:block ${collapsed ? 'w-[4.5rem]' : 'w-72'}`} onMouseEnter={() => { if (collapsed) { setTooltip(null); setHoverOpen(true); } }} onMouseLeave={() => { setTooltip(null); setHoverOpen(false); }} onFocusCapture={() => { if (collapsed) { setTooltip(null); setHoverOpen(true); } }} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setTooltip(null); setHoverOpen(false); } }}>
      <div className={`sticky top-16 h-[calc(100dvh-4rem)] overflow-hidden border-r border-slate-200 bg-slate-50 transition-[width,box-shadow] duration-[240ms] ease-in-out motion-reduce:transition-none ${collapsed && !hoverOpen ? 'w-[4.5rem]' : 'w-72'} ${collapsed && hoverOpen ? 'shadow-lg' : ''}`}>
        {navigation()}
      </div>
    </aside>
    {tooltip && collapsed && typeof document !== 'undefined' && createPortal(<div role="tooltip" className="pointer-events-none fixed z-[60] max-w-[min(18rem,calc(100vw-6rem))] -translate-y-1/2 break-words rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg" style={{ top: tooltip.top, left: tooltip.left }}>{tooltip.label}</div>, document.body)}
    {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="เมนูนักศึกษา"><button type="button" className="absolute inset-0 bg-slate-950/35" onClick={onMobileClose} aria-label="ปิดเมนู" /><aside className="relative h-full w-[min(19rem,85vw)] bg-white shadow-xl"><div className="flex h-14 items-center justify-between border-b border-slate-200 px-4"><span className="font-semibold text-slate-900">เมนูนักศึกษา</span><button type="button" onClick={onMobileClose} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" aria-label="ปิดเมนู">×</button></div>{navigation(true)}</aside></div>}
  </>;
};
