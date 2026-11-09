'use client';

import { useState, useEffect } from 'react';
import type { Role } from './types';

export function useAppRole(): Role {
  const [role, setRole] = useState<Role>(() => {
    if (process.env.NEXT_PUBLIC_APP_ROLE === 'admin') return 'admin';
    if (process.env.NEXT_PUBLIC_APP_ROLE === 'student') return 'student';
    if (typeof window !== 'undefined') {
      return window.location.port === '3001' ? 'admin' : 'student';
    }
    return 'student';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const portRole: Role = window.location.port === '3001' ? 'admin' : 'student';
      setRole(portRole);
    }
  }, []);

  return role;
}
