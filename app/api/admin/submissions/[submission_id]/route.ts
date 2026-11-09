import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ submission_id: string }> }) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await client.auth.getUser(token);
  const { data: role } = await client.rpc('get_my_role');
  if (!user || role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > 100 || typeof body.feedback !== 'string') return NextResponse.json({ message: 'คะแนนต้องอยู่ระหว่าง 0 ถึง 100' }, { status: 400 });
  const { submission_id } = await params;
  const { data, error } = await client.from('submissions').update({ score, feedback: body.feedback.trim() || null }).eq('submission_id', submission_id).select('submission_id, score, feedback').single();
  if (error) return NextResponse.json({ message: 'ไม่สามารถบันทึกคะแนนได้' }, { status: 500 });
  return NextResponse.json({ submission: data });
}
