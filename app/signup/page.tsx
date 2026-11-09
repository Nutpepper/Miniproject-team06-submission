'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { allowedEmailHint, isAllowedEmail } from '@/lib/emailValidation';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { PasswordVisibilityIcon } from '@/components/shared/PasswordVisibilityIcon';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/');
    });
  }, [router]);

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSuccessModalOpen(false);

    const trimmedEmail = email.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedStudentId = studentId.trim();
    if (!trimmedEmail || !trimmedFirstName || !trimmedLastName || !trimmedStudentId || !password || !confirmPassword) {
      setErrorMessage('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    if (!isAllowedEmail(trimmedEmail)) {
      setErrorMessage(allowedEmailHint);
      return;
    }
    if (password.length < 6) {
      setErrorMessage('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          full_name: `${trimmedFirstName} ${trimmedLastName}`,
          student_id: trimmedStudentId,
        },
      },
    });

    if (error) {
      setErrorMessage(error.message);
    } else if (data.session) {
      router.push('/');
      return;
    } else {
      setIsSuccessModalOpen(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col justify-center py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-3 mb-4">
          <BrandLogo size="md" />
          {/*
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <span className="text-xl text-white">▣</span>
          </div>
          <span className="text-2xl font-bold text-slate-900 tracking-tight">UniLearn</span> */}
        </div>
        <h2 className="text-center text-xl font-bold text-slate-900">สร้างบัญชีผู้ใช้</h2>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {errorMessage && (
            <div className={`mb-5 p-3.5 rounded-lg border text-xs font-medium ${
              'bg-red-50 border-red-200 text-red-800'
            }`}>
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <label className="block text-xs font-semibold text-slate-700">
              อีเมล
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="student@lamduan.mfu.ac.th"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                className="mt-1.5 block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
              />
              <span className="mt-1.5 block text-xs text-slate-500">{allowedEmailHint}</span>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                ชื่อ
                <input type="text" required autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={loading} className="mt-1.5 block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                นามสกุล
                <input type="text" required autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={loading} className="mt-1.5 block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50" />
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-700">
              รหัสนักศึกษา
              <input type="text" required value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={loading} className="mt-1.5 block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50" placeholder="กรอกรหัสนักศึกษา" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              รหัสผ่าน
              <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                className="mt-1.5 block w-full px-3 pr-10 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} className="absolute right-0 top-1.5 bottom-0 px-3 text-slate-400 hover:text-indigo-600">
                <PasswordVisibilityIcon visible={showPassword} />
              </button>
              </div>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              ยืนยันรหัสผ่าน
              <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={loading}
                className="mt-1.5 block w-full px-3 pr-10 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
              />
              <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} className="absolute right-0 top-1.5 bottom-0 px-3 text-slate-400 hover:text-indigo-600">
                <PasswordVisibilityIcon visible={showConfirmPassword} />
              </button>
              </div>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'กำลังสร้างบัญชี...' : 'สมัครสมาชิก'}
            </button>
          </form>

          <p className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
            มีบัญชีอยู่แล้วใช่ไหม?{' '}
            <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-800">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>

      {isSuccessModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signup-success-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 id="signup-success-title" className="text-lg font-bold text-slate-900">
              สมัครสมาชิกสำเร็จ
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี แล้วกลับไปเข้าสู่ระบบ
            </p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              กลับไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
