import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getIntegrationSupabaseClient } from '@/lib/supabase/server';

const allowedColors = new Set([
  'from-indigo-500 to-violet-700',
  'from-sky-500 to-blue-700',
  'from-emerald-500 to-teal-700',
  'from-rose-500 to-pink-700',
  'from-amber-400 to-orange-600',
  'from-slate-600 to-slate-900',
]);

async function authenticate(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return null;

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const [{ data: { user }, error: authError }, { data: role, error: roleError }] = await Promise.all([
    client.auth.getUser(token),
    client.rpc('get_my_role'),
  ]);
  if (authError || !user || roleError || (role !== 'student' && role !== 'admin')) return null;
  return { user, role };
}

export async function GET(request: NextRequest) {
  if (!await authenticate(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const client = await getIntegrationSupabaseClient();
    const { data, error } = await client.from('course_appearances').select('course_id, banner_color');
    if (error) throw error;
    return NextResponse.json(Object.fromEntries((data || []).map((item) => [item.course_id, item.banner_color])));
  } catch (error) {
    console.error('Course appearance query failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Unable to load course appearances.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await authenticate(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null) as { courseId?: unknown; bannerColor?: unknown } | null;
  const courseId = typeof body?.courseId === 'string' ? body.courseId.trim() : '';
  const bannerColor = typeof body?.bannerColor === 'string' ? body.bannerColor : '';
  if (!courseId || courseId.length > 200 || !allowedColors.has(bannerColor)) {
    return NextResponse.json({ error: 'Bad Request', message: 'Invalid course appearance.' }, { status: 400 });
  }

  try {
    const client = await getIntegrationSupabaseClient();
    const { error } = await client.from('course_appearances').upsert({
      course_id: courseId,
      banner_color: bannerColor,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'course_id' });
    if (error) throw error;
    return NextResponse.json({ courseId, bannerColor });
  } catch (error) {
    console.error('Course appearance update failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Unable to save course appearance.' }, { status: 500 });
  }
}
