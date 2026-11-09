import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  fetchTeam05Assignment,
  fetchTeam05Assignments,
  fetchTeam05Cohorts,
  type Team05AssignmentData,
} from '@/lib/integrations/team05';
import { getIntegrationSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token || !url || !anonKey) {
    return NextResponse.json({ error: 'Unauthorized', message: 'A valid session is required.' }, { status: 401 });
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const [{ data: { user }, error: authError }, { data: role, error: roleError }] = await Promise.all([
    authClient.auth.getUser(token),
    authClient.rpc('get_my_role'),
  ]);
  if (authError || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized', message: 'Invalid or expired session.' }, { status: 401 });
  }

  if (roleError || role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Administrator access is required.' },
      { status: 403 },
    );
  }

  // Fetch independent course data while submissions are loading.
  const team05Request = Promise.all([fetchTeam05Assignments(), fetchTeam05Cohorts()]).then(
    data => ({ data, error: null }),
    error => ({ data: null, error }),
  );

  const submissionFields = 'submission_id, assignment_id, student_id, submission_type, file_name, file_path, external_link, submitted_at, cancelled_at, superseded_at, status, submission_files(file_id, file_name, file_path, file_size, sort_order)';
  const { data: roleScopedData, error } = await authClient
    .from('submissions')
    // Keep this read compatible with existing deployments. The optional grading
    // columns are added separately by the grading migration.
    .select(submissionFields)
    .is('cancelled_at', null)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('Admin submissions query failed:', error.message);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to load submissions.' }, { status: 500 });
  }

  // If an older RLS policy does not recognize an instructor account, the route
  // has already verified the caller's admin role and can use the server-only
  // service-role client. This must never depend on an end user's password.
  let submissions = roleScopedData || [];
  if (submissions.length === 0) {
    try {
      const integrationClient = await getIntegrationSupabaseClient();
      const { data: integrationData, error: integrationError } = await integrationClient
        .from('submissions')
        .select(submissionFields)
        .is('cancelled_at', null)
        .order('submitted_at', { ascending: false });
      if (integrationError) {
        console.error('Admin submission fallback query failed:', integrationError.message);
        return NextResponse.json({ error: 'Internal Server Error', message: 'Unable to load submissions from the server.' }, { status: 500 });
      }
      submissions = integrationData || [];
    } catch (integrationError) {
      console.error('Admin submission fallback query failed:', integrationError);
      return NextResponse.json({ error: 'Internal Server Error', message: 'Unable to load submissions from the server.' }, { status: 500 });
    }
  }
  let allAssignments: Team05AssignmentData[];
  let cohorts: Awaited<ReturnType<typeof fetchTeam05Cohorts>>;
  const team05Result = await team05Request;
  if (!team05Result.data) {
    console.error('Admin assignments query failed:', team05Result.error);
    return NextResponse.json({ error: 'Bad Gateway', message: 'ไม่สามารถโหลดรายวิชาหรืองานจาก Team 05 ได้' }, { status: 502 });
  }
  [allAssignments, cohorts] = team05Result.data;
  const knownAssignmentIds = new Set(allAssignments.map((assignment) => assignment.id));
  const assignmentIds = [...new Set(submissions.map((submission) => submission.assignment_id))].filter((id) => !knownAssignmentIds.has(id));
  const assignmentResultsRequest = Promise.all(
    assignmentIds.map(async (assignmentId) => {
      const result = await fetchTeam05Assignment(assignmentId);
      return result.success
        ? [assignmentId, {
            id: result.assignment.id,
            title: result.assignment.title,
            description: result.assignment.description || '',
            criteria: result.assignment.criteria || '',
            cohortId: result.assignment.cohortId,
            instructorName: result.assignment.instructorName,
            dueDate: result.assignment.dueDate.toISOString(),
          }] as const
        : [assignmentId, null] as const;
    })
  );

  const studentIds = [...new Set(submissions.map((submission) => submission.student_id))];
  const studentProfiles: Record<string, { fullName: string; studentId: string; avatarUrl: string; email: string }> = {};
  if (studentIds.length > 0) {
    try {
      const adminClient = await getIntegrationSupabaseClient();
      const results = await Promise.all(studentIds.map(async (studentId) => {
        const { data, error: userError } = await adminClient.auth.admin.getUserById(studentId);
        if (userError || !data.user) return null;
        const metadata = data.user.user_metadata;
        const firstName = typeof metadata.first_name === 'string' ? metadata.first_name : '';
        const lastName = typeof metadata.last_name === 'string' ? metadata.last_name : '';
        const legacyName = typeof metadata.full_name === 'string' ? metadata.full_name : '';
        return [studentId, {
          fullName: `${firstName} ${lastName}`.trim() || legacyName || data.user.email || 'ไม่ระบุชื่อ',
          studentId: typeof metadata.student_id === 'string' ? metadata.student_id : '-',
          avatarUrl: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : '',
          email: data.user.email || '',
        }] as const;
      }));
      for (const result of results) {
        if (result) studentProfiles[result[0]] = result[1];
      }
    } catch (profileError) {
      console.error('Admin student-profile lookup failed:', profileError);
    }
  }

  const assignmentResults = await assignmentResultsRequest;

  return NextResponse.json({
    submissions,
    studentProfiles,
    cohorts,
    assignments: Object.fromEntries([
      ...allAssignments.map((assignment) => [assignment.id, {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description || '',
        criteria: assignment.criteria || '',
        cohortId: assignment.cohortId,
        instructorName: assignment.instructorName,
        dueDate: assignment.dueDate.toISOString(),
      }] as const),
      ...assignmentResults,
    ]),
  });
}
