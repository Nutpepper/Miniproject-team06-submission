'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { TopNav } from '@/components/shared/TopNav';
import { formatThaiTime } from '@/lib/formatters';

type User = { id: string; email?: string; fullName?: string | null; studentId?: string | null; emailConfirmedAt: string | null; createdAt: string; bannedUntil?: string | null };

export const AdminUsersView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/login'; return; }
    setEmail(session.user.email);
    const response = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${session.access_token}` } });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setUsers(body.users || []);
    else setError(body.error || 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้');
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const approve = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setBusy(id);
    const response = await fetch('/api/admin/users', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id }) });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setUsers((current) => current.map((user) => user.id === id ? { ...user, emailConfirmedAt: body.user.emailConfirmedAt } : user));
    else setError(body.error || 'ไม่สามารถอนุมัติอีเมลได้');
    setBusy(null);
  };

  const deleteUser = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setBusy(id);
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id }) });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setUsers((current) => current.filter((user) => user.id !== id));
    else setError(body.error || 'ไม่สามารถลบผู้ใช้ได้');
    setBusy(null);
  };

  return <div className="min-h-screen bg-slate-50">
    <TopNav role="admin" userEmail={email} onLogout={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }} />
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <a href="/admin" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">← กลับหน้ารายวิชา</a>
      <div className="mb-6 mt-5"><p className="text-sm font-medium text-indigo-600">ผู้ดูแลระบบ</p><h1 className="mt-1 text-2xl font-bold text-slate-900">อนุมัติอีเมลผู้ใช้</h1><p className="mt-1 text-sm text-slate-500">อนุมัติบัญชีก่อนเข้าใช้งานระบบ</p></div>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? <p className="p-8 text-center text-sm text-slate-500">กำลังโหลดรายชื่อผู้ใช้...</p> : <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">ชื่อ-นามสกุล</th><th className="px-5 py-3">รหัสนักศึกษา</th><th className="px-5 py-3">อีเมล</th><th className="px-5 py-3">วันที่สมัคร</th><th className="px-5 py-3">สถานะ</th><th className="px-5 py-3 text-right">ดำเนินการ</th></tr></thead><tbody className="divide-y divide-slate-100">{users.map((user) => <tr key={user.id}><td className="px-5 py-4 font-medium text-slate-900">{user.fullName || '-'}</td><td className="px-5 py-4 font-mono text-slate-600">{user.studentId || '-'}</td><td className="px-5 py-4 text-slate-700">{user.email || '-'}</td><td className="px-5 py-4 text-slate-600">{formatThaiTime(new Date(user.createdAt))}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.bannedUntil ? 'bg-red-100 text-red-700' : user.emailConfirmedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{user.bannedUntil ? 'ถูกระงับ' : user.emailConfirmedAt ? 'อนุมัติแล้ว' : 'รออนุมัติ'}</span></td><td className="px-5 py-4 text-right">{user.bannedUntil ? <span className="text-xs text-slate-400">ถูกระงับแล้ว</span> : !user.emailConfirmedAt ? <button type="button" disabled={busy === user.id} onClick={() => void approve(user.id)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy === user.id ? 'กำลังอนุมัติ...' : 'อนุมัติอีเมล'}</button> : <button type="button" disabled={busy === user.id} onClick={() => setPendingDelete(user)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{busy === user.id ? 'กำลังลบ...' : 'ลบผู้ใช้'}</button>}</td></tr>)}</tbody></table></div>}
      </div>
    </main>
    {pendingDelete && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl text-red-600">!</div><h2 className="mt-4 text-lg font-bold">ยืนยันการลบผู้ใช้</h2><p className="mt-2 text-sm leading-6 text-slate-600">เมื่อลบผู้ใช้นี้แล้ว จะไม่สามารถเรียกคืนบัญชีหรือข้อมูลเดิมกลับมาได้</p><div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">{pendingDelete.email || '-'}</div><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setPendingDelete(null)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold sm:flex-none">ยกเลิก</button><button type="button" onClick={() => { const id = pendingDelete.id; setPendingDelete(null); void deleteUser(id); }} className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white sm:flex-none">ยืนยันการลบผู้ใช้</button></div></div></div>}
  </div>;
};
