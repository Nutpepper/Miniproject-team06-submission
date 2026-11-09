'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';

const StudentView = dynamic(
  () => import('@/components/student/StudentView').then(({ StudentView }) => StudentView),
  { ssr: false }
);

export default function HomePage() {
  const router = useRouter();
  const [studentSession, setStudentSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;

    const resolveRole = async () => {
      const { supabase } = await import('@/lib/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      const response = await fetch('/api/auth/role', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const roleData = await response.json().catch(() => ({}));

      if (!response.ok) {
        router.replace('/login?error=role-check');
        return;
      }

      if (roleData.role === 'admin') {
        router.replace('/admin');
        return;
      }

      if (active) setStudentSession(session);
    };

    resolveRole().catch(() => {
      if (active) router.replace('/login?error=role-check');
    });

    return () => {
      active = false;
    };
  }, [router]);

  return studentSession ? <StudentView initialSession={studentSession} roleVerified /> : null;
}
