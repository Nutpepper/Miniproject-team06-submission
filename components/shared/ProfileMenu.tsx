'use client';

import { ChangeEvent, PointerEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase/client';
import type { Role } from '@/lib/types';

type Profile = { firstName: string; lastName: string; studentId: string; avatarUrl: string; email: string };
type View = 'overview' | 'profile' | 'password';
type Confirmation = 'profile' | 'password' | null;
type Crop = { source: string; width: number; height: number; zoom: number; x: number; y: number };
const cropSize = 256;

function fullName(profile: Profile) { return `${profile.firstName} ${profile.lastName}`.trim() || profile.email || 'ผู้ใช้'; }
function initials(profile: Profile) { return `${profile.firstName[0] || ''}${profile.lastName[0] || ''}`.toUpperCase() || profile.email[0]?.toUpperCase() || 'U'; }
function cropMetrics(crop: Crop) { const base = Math.max(cropSize / crop.width, cropSize / crop.height); const scale = base * crop.zoom; return { width: crop.width * scale, height: crop.height * scale }; }
function clampCrop(crop: Crop, x: number, y: number) { const size = cropMetrics(crop); return { x: Math.min(0, Math.max(cropSize - size.width, x)), y: Math.min(0, Math.max(cropSize - size.height, y)) }; }

function Avatar({ profile, size = 'header' }: { profile: Profile; size?: 'header' | 'dropdown' | 'settings' }) {
  const classes = size === 'header' ? 'h-9 w-9 text-xs' : size === 'dropdown' ? 'h-24 w-24 text-2xl' : 'h-28 w-28 text-3xl';
  return profile.avatarUrl ? <img src={profile.avatarUrl} alt="รูปโปรไฟล์" className={`${classes} aspect-square rounded-full border-2 border-white/80 object-cover shadow-sm`} /> : <span className={`flex ${classes} aspect-square items-center justify-center rounded-full border-2 border-white/80 bg-indigo-100 font-bold text-indigo-700 shadow-sm`}>{initials(profile)}</span>;
}

function EditableAvatar({ profile, size, onClick }: { profile: Profile; size: 'dropdown' | 'settings'; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group relative shrink-0 rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2" title="เปลี่ยนรูปโปรไฟล์">
    <Avatar profile={profile} size={size} />
    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/50 text-center text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><span>📷<br />เปลี่ยนรูป</span></span>
    <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-violet-600 text-sm text-white shadow-sm">📷</span>
  </button>;
}

function CropDialog({ crop, saving, onChange, onCancel, onSave }: { crop: Crop; saving: boolean; onChange: (crop: Crop) => void; onCancel: () => void; onSave: () => void }) {
  const drag = useRef<{ x: number; y: number; cropX: number; cropY: number } | null>(null);
  const { width, height } = cropMetrics(crop);
  const startDrag = (event: PointerEvent<HTMLDivElement>) => { drag.current = { x: event.clientX, y: event.clientY, cropX: crop.x, cropY: crop.y }; event.currentTarget.setPointerCapture(event.pointerId); };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => { if (!drag.current) return; const next = clampCrop(crop, drag.current.cropX + event.clientX - drag.current.x, drag.current.cropY + event.clientY - drag.current.y); onChange({ ...crop, ...next }); };
  const setZoom = (zoom: number) => { const old = cropMetrics(crop); const nextCrop = { ...crop, zoom }; const next = cropMetrics(nextCrop); const position = clampCrop(nextCrop, crop.x - (next.width - old.width) / 2, crop.y - (next.height - old.height) / 2); onChange({ ...nextCrop, ...position }); };
  return createPortal(<div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="crop-title">
    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
      <h2 id="crop-title" className="text-lg font-bold text-slate-900">ปรับรูปโปรไฟล์</h2><p className="mt-1 text-sm text-slate-500">ลากรูปเพื่อจัดตำแหน่ง และปรับการซูมตามต้องการ</p>
      <div className="mt-5 flex justify-center"><div onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} className="relative h-64 w-64 touch-none overflow-hidden rounded-full bg-slate-100 ring-4 ring-violet-100 cursor-grab active:cursor-grabbing"><img src={crop.source} alt="ตัวอย่างรูปโปรไฟล์" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ width, height, left: crop.x, top: crop.y }} /></div></div>
      <label className="mt-5 block text-sm font-semibold text-slate-700">ซูม<input aria-label="ซูมรูปโปรไฟล์" type="range" min="1" max="3" step="0.01" value={crop.zoom} onChange={(event) => setZoom(Number(event.target.value))} className="mt-2 w-full accent-violet-600" /></label>
      <div className="mt-6 flex gap-3"><button type="button" onClick={onCancel} disabled={saving} className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">ยกเลิก</button><button type="button" onClick={onSave} disabled={saving} className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{saving ? 'กำลังบันทึก...' : 'บันทึกรูปโปรไฟล์'}</button></div>
    </div>
  </div>, document.body);
}

export function ProfileMenu({ role }: { role: Role }) {
  const [profile, setProfile] = useState<Profile>({ firstName: '', lastName: '', studentId: '', avatarUrl: '', email: '' });
  const [view, setView] = useState<View>('overview'); const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [confirmation, setConfirmation] = useState<Confirmation>(null); const [crop, setCrop] = useState<Crop | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const clearNotice = () => { setError(null); setMessage(null); };
  const switchView = (next: View) => { setView(next); clearNotice(); };

  useEffect(() => { void supabase.auth.getUser().then(({ data: { user } }) => { if (!user) return; const data = user.user_metadata; const legacy = typeof data.full_name === 'string' ? data.full_name.trim().split(/\s+/) : []; setProfile({ firstName: typeof data.first_name === 'string' ? data.first_name : legacy[0] || '', lastName: typeof data.last_name === 'string' ? data.last_name : legacy.slice(1).join(' '), studentId: typeof data.student_id === 'string' ? data.student_id : '', avatarUrl: typeof data.avatar_url === 'string' ? data.avatar_url : '', email: user.email || '' }); }); }, []);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: globalThis.PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  const closeCrop = () => { if (crop) URL.revokeObjectURL(crop.source); setCrop(null); };
  const pickAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('รองรับเฉพาะไฟล์ JPEG, PNG และ WebP'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('รูปภาพต้องมีขนาดไม่เกิน 5 MB'); return; }
    const source = URL.createObjectURL(file); const image = new Image();
    image.onload = () => { const base = Math.max(cropSize / image.width, cropSize / image.height); setCrop({ source, width: image.width, height: image.height, zoom: 1, x: (cropSize - image.width * base) / 2, y: (cropSize - image.height * base) / 2 }); };
    image.onerror = () => { URL.revokeObjectURL(source); setError('ไม่สามารถเปิดรูปภาพได้'); }; image.src = source;
  };
  const saveAvatar = async () => {
    if (!crop) return; setSaving(true); clearNotice();
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = reject; element.src = crop.source; });
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512; const context = canvas.getContext('2d'); if (!context) throw new Error('ไม่สามารถเตรียมรูปภาพได้');
      const { width, height } = cropMetrics(crop); context.drawImage(image, crop.x * 2, crop.y * 2, width * 2, height * 2);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85)); if (!blob) throw new Error('ไม่สามารถเตรียมรูปภาพได้');
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
      const path = `${user.id}/avatar-${Date.now()}.jpg`; const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600' }); if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path); const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } }); if (updateError) throw updateError;
      setProfile((current) => ({ ...current, avatarUrl: data.publicUrl })); closeCrop(); setMessage('บันทึกรูปโปรไฟล์แล้ว');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ไม่สามารถบันทึกรูปโปรไฟล์ได้'); } finally { setSaving(false); }
  };
  const saveProfile = async () => { const firstName = profile.firstName.trim(), lastName = profile.lastName.trim(), studentId = profile.studentId.trim(); if (!firstName || !lastName) { setError('กรุณาระบุชื่อและนามสกุล'); return; } if (!studentId) { setError('กรุณาระบุรหัสนักศึกษา'); return; } setSaving(true); clearNotice(); const { error: updateError } = await supabase.auth.updateUser({ data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`, student_id: studentId } }); setSaving(false); if (updateError) { setError(updateError.message); return; } setProfile((current) => ({ ...current, firstName, lastName, studentId })); setMessage('บันทึกข้อมูลโปรไฟล์แล้ว'); };
  const savePassword = async () => { if (!currentPassword) { setError('กรุณาระบุรหัสผ่านเดิม'); return; } if (newPassword.length < 6) { setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'); return; } if (newPassword !== confirmPassword) { setError('ยืนยันรหัสผ่านไม่ตรงกัน'); return; } setSaving(true); clearNotice(); const { error: verifyError } = await supabase.auth.signInWithPassword({ email: profile.email, password: currentPassword }); if (verifyError) { setSaving(false); setError('รหัสผ่านเดิมไม่ถูกต้อง'); return; } const { error: updateError } = await supabase.auth.updateUser({ password: newPassword }); setSaving(false); if (updateError) { setError(updateError.message); return; } setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMessage('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว'); };
  const requestProfile = () => { if (!profile.firstName.trim() || !profile.lastName.trim() || !profile.studentId.trim()) { setError('กรุณากรอกข้อมูลให้ครบ'); return; } setConfirmation('profile'); };
  const requestPassword = () => { if (!currentPassword || newPassword.length < 6 || newPassword !== confirmPassword) { setError('กรุณาตรวจสอบรหัสผ่านเดิมและรหัสผ่านใหม่'); return; } setConfirmation('password'); };
  const roleLabel = role === 'student' ? 'นักศึกษา' : 'อาจารย์ · ภาควิชา CS';
  const Notice = () => <>{error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}{message && <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">{message}</p>}</>;
  const editable = () => fileRef.current?.click();

  return <div ref={menuRef} className="relative"><button type="button" onClick={() => { setOpen((value) => !value); switchView('overview'); }} aria-label="ดูข้อมูลบัญชี" className="flex min-w-0 items-center gap-2 rounded-lg p-1 text-left hover:bg-slate-100"><Avatar profile={profile}/><span className="hidden min-w-0 text-right sm:block"><span className="block max-w-[12rem] truncate text-xs font-semibold text-slate-900">{fullName(profile)}</span><span className="block text-xs text-slate-500">{profile.studentId || roleLabel}</span></span></button>
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickAvatar}/>
    {open && <div className="fixed inset-x-3 top-16 z-50 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96">
      {view === 'overview' && <div className="p-5"><div className="flex items-center gap-4 border-b border-slate-100 pb-5"><EditableAvatar profile={profile} size="dropdown" onClick={editable}/><div className="min-w-0"><p className="truncate text-base font-bold text-slate-900">{fullName(profile)}</p><p className="text-sm text-slate-500">{roleLabel}</p></div></div><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">อีเมล</dt><dd className="truncate font-medium">{profile.email || '-'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">ชื่อ</dt><dd className="font-medium">{profile.firstName || '-'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">นามสกุล</dt><dd className="font-medium">{profile.lastName || '-'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">รหัสนักศึกษา</dt><dd className="font-medium">{profile.studentId || '-'}</dd></div></dl><div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2"><button type="button" onClick={() => switchView('profile')} className="rounded-lg border border-violet-200 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">ตั้งค่าโปรไฟล์</button><button type="button" onClick={() => switchView('password')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">เปลี่ยนรหัสผ่าน</button></div></div>}
      {view === 'profile' && <div className="p-5"><button type="button" onClick={() => switchView('overview')} className="text-sm font-semibold text-violet-700">← ข้อมูลบัญชี</button><h2 className="mt-4 text-lg font-bold">ตั้งค่าโปรไฟล์</h2><p className="text-xs text-slate-500">แก้ไขข้อมูลส่วนตัวและรูปโปรไฟล์</p><Notice/><div className="mt-5 flex justify-center"><EditableAvatar profile={profile} size="settings" onClick={editable}/></div><p className="mt-2 text-center text-xs text-slate-500">คลิกที่รูปเพื่อเปลี่ยนรูปโปรไฟล์</p><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-xs font-medium">ชื่อ<input value={profile.firstName} onChange={(e) => setProfile({...profile,firstName:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><label className="text-xs font-medium">นามสกุล<input value={profile.lastName} onChange={(e) => setProfile({...profile,lastName:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label></div><label className="mt-3 block text-xs font-medium">รหัสนักศึกษา<input value={profile.studentId} onChange={(e) => setProfile({...profile,studentId:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><button type="button" disabled={saving} onClick={requestProfile} className="mt-5 w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700">บันทึกการตั้งค่า</button></div>}
      {view === 'password' && <div className="p-5"><button type="button" onClick={() => switchView('overview')} className="text-sm font-semibold text-violet-700">← ข้อมูลบัญชี</button><h2 className="mt-4 text-lg font-bold">เปลี่ยนรหัสผ่าน</h2><p className="text-xs text-slate-500">ยืนยันรหัสผ่านเดิมก่อนตั้งรหัสใหม่</p><Notice/><label className="mt-5 block text-xs font-medium">รหัสผ่านเดิม<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><label className="mt-3 block text-xs font-medium">รหัสผ่านใหม่<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><label className="mt-3 block text-xs font-medium">ยืนยันรหัสผ่านใหม่<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label><button type="button" disabled={saving} onClick={requestPassword} className="mt-5 w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700">เปลี่ยนรหัสผ่าน</button></div>}
    </div>}
    {crop && <CropDialog crop={crop} saving={saving} onChange={setCrop} onCancel={closeCrop} onSave={() => void saveAvatar()}/>}
    {confirmation && typeof document !== 'undefined' && createPortal(<div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">✓</div><h3 className="mt-4 text-lg font-bold">{confirmation === 'profile' ? 'ยืนยันการบันทึกข้อมูล' : 'ยืนยันการเปลี่ยนรหัสผ่าน'}</h3><p className="mt-2 text-sm text-slate-600">{confirmation === 'profile' ? `ชื่อ: ${fullName(profile)} · รหัสนักศึกษา: ${profile.studentId}` : 'รหัสผ่านใหม่จะมีผลทันทีในการเข้าสู่ระบบครั้งถัดไป'}</p><div className="mt-6 flex gap-3"><button type="button" onClick={() => setConfirmation(null)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">ยกเลิก</button><button type="button" onClick={() => { const action=confirmation; setConfirmation(null); if(action==='profile') void saveProfile(); else void savePassword(); }} className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white">ยืนยัน</button></div></div></div>,document.body)}
  </div>;
}
