import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchTeam05Assignments } from '@/lib/integrations/team05';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token || !url || !anonKey) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Please sign in to view assignments.' },
      { status: 401 },
    );
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const [
    { data: { user }, error: authError },
    { data: role, error: roleError },
  ] = await Promise.all([
    client.auth.getUser(token),
    client.rpc('get_my_role'),
  ]);

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Your session is invalid or has expired.' },
      { status: 401 },
    );
  }

  if (roleError || role !== 'student') {
    return NextResponse.json(
      { error: 'Forbidden', message: 'This assignment view is available to students only.' },
      { status: 403 },
    );
  }

  try {
    const assignments = await fetchTeam05Assignments();

    return NextResponse.json(
      assignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        description: assignment.description || '',
        criteria: assignment.criteria || '',
        cohortId: assignment.cohortId,
        createdAt: assignment.createdAt?.toISOString(),
        dueDate: assignment.dueDate.toISOString(),
      })),
    );
  } catch (error) {
    console.error('Student assignments query failed:', error);
    return NextResponse.json(
      { error: 'Bad Gateway', message: 'ไม่สามารถโหลดรายการงานจาก Team 05 ได้' },
      { status: 502 },
    );
  }
}
