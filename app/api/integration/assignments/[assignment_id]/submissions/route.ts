import { NextRequest, NextResponse } from 'next/server';
import { fetchTeam05Assignment } from '@/lib/integrations/team05';
import { getIntegrationSupabaseClient } from '@/lib/supabase/server';

// Integration results must always reflect the current database state.
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ assignment_id: string }>;
};

type StudentProfile = {
  full_name: string;
  student_number: string | null;
  email: string | null;
  avatar_url: string | null;
};

/**
 * GET /api/integration/assignments/[assignment_id]/submissions
 * Team 06 Business Integration API provided for Team 05.
 * Retrieves submissions for an assignment. Protected via X-Integration-Key shared secret.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  // 1. Authenticate integration key
  const integrationKey =
    request.headers.get('x-integration-key') ||
    request.headers.get('X-Integration-Key');

  const expectedSecret = process.env.TEAM05_INTEGRATION_SECRET;

  if (!expectedSecret || !integrationKey || integrationKey !== expectedSecret) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Invalid or missing integration key.',
      },
      { status: 401 }
    );
  }

  // 2. Extract and validate assignment_id
  const { assignment_id } = await context.params;

  if (!assignment_id || typeof assignment_id !== 'string' || assignment_id.trim().length === 0) {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: 'assignment_id must be a non-empty string.',
      },
      { status: 400 }
    );
  }

  const trimmedId = assignment_id.trim();

  // 3. Verify that the assignment exists in Team 05
  const team05Result = await fetchTeam05Assignment(trimmedId);
  if (!team05Result.success) {
    if (team05Result.errorType === 'NOT_FOUND') {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: team05Result.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Bad Gateway',
        message: team05Result.message,
      },
      { status: 502 }
    );
  }

  // 4. Retrieve submissions from Supabase
  try {
    const supabase = await getIntegrationSupabaseClient();
    const { data, error } = await supabase
      .from('submissions')
      .select('submission_id, student_id, submission_type, file_name, external_link, submitted_at, cancelled_at, status')
      .eq('assignment_id', trimmedId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Failed to query submissions for integration:', error.message);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to retrieve submissions from database.',
        },
        { status: 500 }
      );
    }

    // Team 05 needs a human-readable identity when displaying or grading a
    // submission. Auth user metadata is server-only and is read with the same
    // service client that retrieves the submission records.
    const studentProfiles = new Map<string, StudentProfile>();
    const studentIds = [...new Set((data || []).map((row) => row.student_id))];
    await Promise.all(studentIds.map(async (studentId) => {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(studentId);
      if (userError || !userData.user) {
        console.warn(`Unable to load integration profile for student ${studentId}:`, userError?.message);
        return;
      }

      const metadata = userData.user.user_metadata;
      const firstName = typeof metadata.first_name === 'string' ? metadata.first_name.trim() : '';
      const lastName = typeof metadata.last_name === 'string' ? metadata.last_name.trim() : '';
      const legacyName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '';
      studentProfiles.set(studentId, {
        full_name: `${firstName} ${lastName}`.trim() || legacyName || userData.user.email || 'Unknown student',
        student_number: typeof metadata.student_id === 'string' && metadata.student_id.trim()
          ? metadata.student_id.trim()
          : null,
        email: userData.user.email ?? null,
        avatar_url: typeof metadata.avatar_url === 'string' && metadata.avatar_url.trim()
          ? metadata.avatar_url.trim()
          : null,
      });
    }));

    const sanitizedSubmissions = (data || []).map((row) => ({
      submission_id: row.submission_id,
      student_id: row.student_id,
      student: studentProfiles.get(row.student_id) ?? null,
      submission_type: row.submission_type,
      file_name: row.file_name ?? null,
      external_link: row.external_link ?? null,
      submitted_at: row.submitted_at,
      cancelled_at: row.cancelled_at ?? null,
      status: row.status,
    }));

    return NextResponse.json(
      {
        assignment_id: trimmedId,
        submissions: sanitizedSubmissions,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown database error';
    console.error('Integration submissions handler error:', message);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Internal server error processing integration request.',
      },
      { status: 500 }
    );
  }
}
