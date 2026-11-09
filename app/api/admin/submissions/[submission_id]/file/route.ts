import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getIntegrationSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ submission_id: string }> }) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await client.auth.getUser(token);
  const { data: role } = await client.rpc('get_my_role');
  if (!user || role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  const integrationClient = await getIntegrationSupabaseClient();
  const { submission_id } = await params;
  const fileId = request.nextUrl.searchParams.get('fileId');
  let filePath: string | null = null;
  if (fileId) {
    const { data: file } = await client.from('submission_files').select('file_path').eq('file_id', fileId).eq('submission_id', submission_id).maybeSingle();
    filePath = file?.file_path || null;
  } else {
    const { data: submission, error } = await client.from('submissions').select('file_path').eq('submission_id', submission_id).single();
    filePath = submission?.file_path || null;
  }
  if (!filePath) {
    // Submission visibility can be restricted by an older RLS policy even after
    // this route has verified an admin caller. Resolve the metadata with the
    // server-only integration client; the signed URL below still uses the
    // current instructor session and Storage RLS.
    if (fileId) {
      const { data: file } = await integrationClient.from('submission_files').select('file_path').eq('file_id', fileId).eq('submission_id', submission_id).maybeSingle();
      filePath = file?.file_path || null;
    } else {
      const { data: submission } = await integrationClient.from('submissions').select('file_path').eq('submission_id', submission_id).single();
      filePath = submission?.file_path || null;
    }
  }
  if (!filePath) return NextResponse.json({ message: 'ไม่พบไฟล์แนบของงานนี้' }, { status: 404 });
  const { data, error: signedUrlError } = await integrationClient.storage.from('submissions').createSignedUrl(filePath, 60);
  if (signedUrlError || !data?.signedUrl) return NextResponse.json({ message: 'ไม่สามารถเปิดไฟล์ได้' }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
