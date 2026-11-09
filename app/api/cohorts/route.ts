import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchTeam05Cohorts } from '@/lib/integrations/team05';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const [{ data: { user }, error: authError }, { data: role, error: roleError }] = await Promise.all([client.auth.getUser(token), client.rpc('get_my_role')]);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (roleError || (role !== 'student' && role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    return NextResponse.json(await fetchTeam05Cohorts());
  } catch (error) {
    console.error('Student cohort query failed:', error);
    return NextResponse.json({ error: 'Bad Gateway', message: 'ไม่สามารถโหลดรายวิชาจาก Team 05 ได้' }, { status: 502 });
  }
}
