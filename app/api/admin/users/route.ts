import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function getAdminClients(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token || !url || !anonKey) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!serviceRoleKey) {
    return {
      error: NextResponse.json(
        { error: 'ยังไม่ได้ตั้งค่าคีย์สำหรับจัดการการอนุมัติอีเมล กรุณาเพิ่ม SUPABASE_SERVICE_ROLE_KEY ในไฟล์ .env.local แล้ว Restart ระบบ' },
        { status: 503 }
      ),
    };
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const [{ data: { user }, error: authError }, { data: role, error: roleError }] = await Promise.all([
    authClient.auth.getUser(token),
    authClient.rpc('get_my_role'),
  ]);
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (roleError || role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { adminClient };
}

export async function GET(request: NextRequest) {
  const result = await getAdminClients(request);
  if ('error' in result) return result.error;

  const { data, error } = await result.adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) {
    return NextResponse.json({ error: 'Failed to load users.' }, { status: 500 });
  }

  return NextResponse.json({
    users: data.users.map((user) => {
      const metadata = user.user_metadata;
      const firstName = typeof metadata.first_name === 'string' ? metadata.first_name.trim() : '';
      const lastName = typeof metadata.last_name === 'string' ? metadata.last_name.trim() : '';
      const legacyName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '';

      return {
        id: user.id,
        email: user.email,
        fullName: `${firstName} ${lastName}`.trim() || legacyName || null,
        studentId: typeof metadata.student_id === 'string' ? metadata.student_id.trim() || null : null,
        emailConfirmedAt: user.email_confirmed_at,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        bannedUntil: user.banned_until,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const result = await getAdminClients(request);
  if ('error' in result) return result.error;

  const body = await request.json().catch(() => null);
  const userId = body && typeof body.userId === 'string' ? body.userId : '';
  if (!userId) {
    return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
  }

  const { data, error } = await result.adminClient.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  if (error) {
    return NextResponse.json({ error: 'Failed to approve email.' }, { status: 500 });
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      emailConfirmedAt: data.user.email_confirmed_at,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const result = await getAdminClients(request);
  if ('error' in result) return result.error;
  const body = await request.json().catch(() => null);
  const userId = body && typeof body.userId === 'string' ? body.userId : '';
  if (!userId) return NextResponse.json({ error: 'userId is required.' }, { status: 400 });

  const { error } = await result.adminClient.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: 'Failed to delete user.' }, { status: 500 });
  return NextResponse.json({ deletedUserId: userId });
}
