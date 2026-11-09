'use client';

import { useState } from 'react';

const themes = [
  { value: 'from-indigo-500 to-violet-700', label: 'ม่วงอินดิโก' },
  { value: 'from-sky-500 to-blue-700', label: 'น้ำเงิน' },
  { value: 'from-emerald-500 to-teal-700', label: 'เขียวมรกต' },
  { value: 'from-rose-500 to-pink-700', label: 'ชมพู' },
  { value: 'from-amber-400 to-orange-600', label: 'ส้ม' },
  { value: 'from-slate-600 to-slate-900', label: 'เทาเข้ม' },
] as const;

export function CourseAppearanceSettings({ open, value, onClose, onSave }: { open: boolean; value: string; onClose: () => void; onSave: (value: string) => void }) {
  const [selected, setSelected] = useState(value);
  if (!open) return null;
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-900">ตั้งค่าหน้าปกรายวิชา</h2><p className="mt-1 text-sm text-slate-500">เลือกสีพื้นที่ด้านบนของการ์ดรายวิชา</p></div><button type="button" onClick={onClose} className="text-xl text-slate-400 hover:text-slate-700">×</button></div>
      <div className="mt-5 grid grid-cols-2 gap-3">{themes.map((theme) => <button key={theme.value} type="button" onClick={() => setSelected(theme.value)} className={`overflow-hidden rounded-xl border-2 text-left transition ${selected === theme.value ? 'border-violet-600 ring-2 ring-violet-100' : 'border-transparent hover:border-slate-200'}`}><span className={`block h-16 bg-gradient-to-br ${theme.value}`} /><span className="block px-3 py-2 text-sm font-semibold text-slate-700">{theme.label}</span></button>)}</div>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">ยกเลิก</button><button type="button" onClick={() => { onSave(selected); onClose(); }} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">บันทึกสีหน้าปก</button></div>
    </div>
  </div>;
}
