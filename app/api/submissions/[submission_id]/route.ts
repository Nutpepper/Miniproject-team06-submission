import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getIntegrationSupabaseClient } from '@/lib/supabase/server';

type RouteContext = {
  params: Promise<{ submission_id: string }>;
};

/**
 * Authenticates the request using the Bearer token and returns the authenticated
 * Supabase user along with a request-scoped Supabase client that forwards the JWT to PostgREST.
 */
async function authenticateRequest(request: NextRequest) {
  const authHeader =
    request.headers.get('authorization') || request.headers.get('Authorization');

  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return {
      errorResponse: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Missing or invalid Authorization header. A valid Supabase Bearer token is required.',
        },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return {
      errorResponse: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Empty Bearer token provided.',
        },
        { status: 401 }
      ),
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      errorResponse: NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Supabase configuration is missing on the server.',
        },
        { status: 500 }
      ),
    };
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return {
      errorResponse: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Invalid or expired Supabase authentication token.',
        },
        { status: 401 }
      ),
    };
  }

  return { user, userClient };
}

/**
 * Validates whether a string is a valid UUIDv4 format
 */
function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * GET /api/submissions/:submission_id
 * Retrieves a submission belonging to the authenticated student.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { user, userClient, errorResponse } = await authenticateRequest(request);
  if (errorResponse || !user || !userClient) {
    return errorResponse!;
  }

  const { submission_id } = await context.params;

  if (!submission_id || !isValidUuid(submission_id)) {
    return NextResponse.json(
      {
        error: 'Not Found',
        message: 'Submission not found or does not belong to the authenticated user.',
      },
      { status: 404 }
    );
  }

  const { data: submission, error } = await userClient
    .from('submissions')
    .select('submission_id, assignment_id, student_id, submission_type, file_name, file_path, external_link, submitted_at, cancelled_at, status, client_request_id')
    .eq('submission_id', submission_id)
    .eq('student_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Database query error in GET /api/submissions/:submission_id:', error.message);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to retrieve submission.',
      },
      { status: 500 }
    );
  }

  if (!submission) {
    return NextResponse.json(
      {
        error: 'Not Found',
        message: 'Submission not found or does not belong to the authenticated user.',
      },
      { status: 404 }
    );
  }

  return NextResponse.json(submission, { status: 200 });
}

/**
 * PATCH /api/submissions/:submission_id
 * Updates allowed fields (such as external_link for LINK submissions) on an active submission.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { user, userClient, errorResponse } = await authenticateRequest(request);
  if (errorResponse || !user || !userClient) {
    return errorResponse!;
  }

  const { submission_id } = await context.params;

  if (!submission_id || !isValidUuid(submission_id)) {
    return NextResponse.json(
      {
        error: 'Not Found',
        message: 'Submission not found or does not belong to the authenticated user.',
      },
      { status: 404 }
    );
  }

  // Parse request body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: 'Invalid JSON payload.',
      },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: 'Request body must be a valid JSON object.',
      },
      { status: 400 }
    );
  }

  // Retrieve existing submission to check ownership, type, and cancellation state
  const { data: existing, error: fetchError } = await userClient
    .from('submissions')
    .select('submission_id, assignment_id, student_id, submission_type, file_name, file_path, external_link, submitted_at, cancelled_at, superseded_at, status, client_request_id')
    .eq('submission_id', submission_id)
    .eq('student_id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.error('Database fetch error in PATCH /api/submissions/:submission_id:', fetchError.message);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to verify submission state.',
      },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      {
        error: 'Not Found',
        message: 'Submission not found or does not belong to the authenticated user.',
      },
      { status: 404 }
    );
  }

  // Check if submission is cancelled
  if (existing.cancelled_at !== null || existing.superseded_at !== null) {
    return NextResponse.json(
      {
        error: 'Conflict',
        message: 'Cannot update a cancelled submission.',
      },
      { status: 409 }
    );
  }

  // Validate allowed fields for update
  // For LINK submissions, allow updating external_link
  if (existing.submission_type === 'LINK') {
    if (!body.external_link || typeof body.external_link !== 'string' || body.external_link.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'external_link is required and must be a non-empty string.',
        },
        { status: 400 }
      );
    }

    const trimmedUrl = body.external_link.trim();
    try {
      const parsedUrl = new URL(trimmedUrl);
      if (parsedUrl.protocol !== 'https:') {
        return NextResponse.json(
          {
            error: 'Bad Request',
            message: 'external_link must be a valid HTTPS URL (must start with https://).',
          },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'external_link must be a valid HTTPS URL.',
        },
        { status: 400 }
      );
    }

    // Execute update
    let serviceClient;
    try { serviceClient = await getIntegrationSupabaseClient(); } catch {
      return NextResponse.json({ error: 'Internal Server Error', message: 'Submission service is unavailable.' }, { status: 500 });
    }
    const { data: updated, error: updateError } = await serviceClient
      .from('submissions')
      .update({ external_link: trimmedUrl })
      .eq('submission_id', submission_id)
      .eq('student_id', user.id)
      .is('cancelled_at', null)
      .is('superseded_at', null)
      .select('submission_id, assignment_id, student_id, submission_type, file_name, file_path, external_link, submitted_at, cancelled_at, status, client_request_id')
      .maybeSingle();

    if (updateError) {
      console.error('Database update error in PATCH /api/submissions/:submission_id:', updateError?.message);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to update submission.',
        },
        { status: 500 }
      );
    }

    if (!updated) return NextResponse.json({ error: 'Conflict', message: 'Submission is no longer active.' }, { status: 409 });

    return NextResponse.json(updated, { status: 200 });
  }

  // If FILE submission, updating metadata without a new upload is not supported in this phase
  return NextResponse.json(
    {
      error: 'Bad Request',
      message: 'Direct PATCH update on FILE submission is not supported. Please resubmit if files need changes.',
    },
    { status: 400 }
  );
}

/**
 * DELETE /api/submissions/:submission_id
 * Soft deletes / cancels an active submission by populating cancelled_at = now().
 * The record remains in the database for traceability.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { user, userClient, errorResponse } = await authenticateRequest(request);
  if (errorResponse || !user || !userClient) {
    return errorResponse!;
  }

  const { submission_id } = await context.params;

  if (!submission_id || !isValidUuid(submission_id)) {
    return NextResponse.json(
      {
        error: 'Not Found',
        message: 'Submission not found or does not belong to the authenticated user.',
      },
      { status: 404 }
    );
  }

  // Check if submission exists and verify current cancellation state
  const { data: existing, error: fetchError } = await userClient
    .from('submissions')
    .select('submission_id, assignment_id, student_id, submission_type, file_name, file_path, external_link, submitted_at, cancelled_at, superseded_at, status, client_request_id')
    .eq('submission_id', submission_id)
    .eq('student_id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.error('Database fetch error in DELETE /api/submissions/:submission_id:', fetchError.message);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to verify submission state.',
      },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      {
        error: 'Not Found',
        message: 'Submission not found or does not belong to the authenticated user.',
      },
      { status: 404 }
    );
  }

  // If already cancelled, return 409 Conflict
  if (existing.cancelled_at !== null || existing.superseded_at !== null) {
    return NextResponse.json(
      {
        error: 'Conflict',
        message: 'Submission is no longer active.',
        submission_id: existing.submission_id,
        cancelled_at: existing.cancelled_at,
      },
      { status: 409 }
    );
  }

  // Soft cancel: update cancelled_at to current timestamp (record remains in DB)
  const cancelledTimestamp = new Date().toISOString();
  let serviceClient;
  try { serviceClient = await getIntegrationSupabaseClient(); } catch {
    return NextResponse.json({ error: 'Internal Server Error', message: 'Submission service is unavailable.' }, { status: 500 });
  }
  const { data: cancelled, error: updateError } = await serviceClient
    .from('submissions')
    .update({ cancelled_at: cancelledTimestamp })
    .eq('submission_id', submission_id)
    .eq('student_id', user.id)
    .is('cancelled_at', null)
    .is('superseded_at', null)
    .select('submission_id, assignment_id, student_id, submission_type, file_name, file_path, external_link, submitted_at, cancelled_at, status, client_request_id')
    .maybeSingle();

  if (updateError) {
    console.error('Database cancellation error in DELETE /api/submissions/:submission_id:', updateError?.message);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to cancel submission.',
      },
      { status: 500 }
    );
  }

  if (!cancelled) return NextResponse.json({ error: 'Conflict', message: 'Submission is no longer active.' }, { status: 409 });

  return NextResponse.json(
    {
      message: 'Submission cancelled successfully.',
      submission_id: cancelled.submission_id,
      cancelled_at: cancelled.cancelled_at,
      status: cancelled.status,
      submission: cancelled,
    },
    { status: 200 }
  );
}
