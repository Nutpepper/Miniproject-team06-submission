import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchTeam05Assignment } from '@/lib/integrations/team05';
import { sendTeam05Webhook } from '@/lib/integrations/team05WebhookSender';
import { getIntegrationSupabaseClient } from '@/lib/supabase/server';

interface SubmissionPayload {
  assignment_id?: unknown;
  submission_type?: unknown;
  file_name?: unknown;
  file_path?: unknown;
  external_link?: unknown;
  client_request_id?: unknown;
}

interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  sanitized?: {
    assignment_id: string;
    submission_type: 'FILE' | 'LINK';
    file_name: string | null;
    file_path: string | null;
    external_link: string | null;
    client_request_id: string | null;
  };
}

/**
 * Validates the submission request payload strictly against business constraints:
 * - assignment_id: mandatory non-empty string
 * - submission_type: mandatory, must be 'FILE' or 'LINK'
 * - If FILE: file_name & file_path mandatory non-empty, external_link forbidden
 * - If LINK: external_link mandatory valid HTTPS URL, file_name & file_path forbidden
 */
function validatePayload(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { isValid: false, errorMessage: 'Request body must be a valid JSON object.' };
  }

  const payload = body as SubmissionPayload;

  // 1. Validate assignment_id
  if (
    typeof payload.assignment_id !== 'string' ||
    payload.assignment_id.trim().length === 0
  ) {
    return {
      isValid: false,
      errorMessage: 'assignment_id is required and must be a non-empty string.',
    };
  }

  // 2. Validate submission_type
  if (
    typeof payload.submission_type !== 'string' ||
    payload.submission_type.trim().length === 0
  ) {
    return {
      isValid: false,
      errorMessage: 'submission_type is required and must be either "FILE" or "LINK".',
    };
  }

  const normalizedType = payload.submission_type.trim().toUpperCase();
  if (normalizedType !== 'FILE' && normalizedType !== 'LINK') {
    return {
      isValid: false,
      errorMessage: `Invalid submission_type "${payload.submission_type}". Allowed values are "FILE" or "LINK".`,
    };
  }

  // 3. Validate FILE payload
  if (normalizedType === 'FILE') {
    if (
      typeof payload.file_name !== 'string' ||
      payload.file_name.trim().length === 0
    ) {
      return {
        isValid: false,
        errorMessage: 'file_name is required and must be a non-empty string for FILE submissions.',
      };
    }

    if (
      typeof payload.file_path !== 'string' ||
      payload.file_path.trim().length === 0
    ) {
      return {
        isValid: false,
        errorMessage: 'file_path is required and must be a non-empty string for FILE submissions.',
      };
    }

    if (
      payload.external_link !== undefined &&
      payload.external_link !== null &&
      String(payload.external_link).trim().length > 0
    ) {
      return {
        isValid: false,
        errorMessage: 'external_link must not be provided for FILE submissions.',
      };
    }
  }

  // 4. Validate LINK payload
  if (normalizedType === 'LINK') {
    if (
      typeof payload.external_link !== 'string' ||
      payload.external_link.trim().length === 0
    ) {
      return {
        isValid: false,
        errorMessage: 'external_link is required and must be a non-empty string for LINK submissions.',
      };
    }

    if (
      payload.file_name !== undefined &&
      payload.file_name !== null &&
      String(payload.file_name).trim().length > 0
    ) {
      return {
        isValid: false,
        errorMessage: 'file_name must not be provided for LINK submissions.',
      };
    }

    if (
      payload.file_path !== undefined &&
      payload.file_path !== null &&
      String(payload.file_path).trim().length > 0
    ) {
      return {
        isValid: false,
        errorMessage: 'file_path must not be provided for LINK submissions.',
      };
    }

    // Validate HTTPS protocol
    try {
      const parsedUrl = new URL(payload.external_link.trim());
      if (parsedUrl.protocol !== 'https:') {
        return {
          isValid: false,
          errorMessage: 'external_link must be a valid HTTPS URL (must start with https://).',
        };
      }
    } catch {
      return {
        isValid: false,
        errorMessage: 'external_link must be a valid HTTPS URL.',
      };
    }
  }

  // 5. Validate client_request_id (optional string)
  let sanitizedRequestId: string | null = null;
  if (payload.client_request_id !== undefined && payload.client_request_id !== null) {
    if (typeof payload.client_request_id !== 'string') {
      return {
        isValid: false,
        errorMessage: 'client_request_id must be a string if provided.',
      };
    }
    const trimmed = payload.client_request_id.trim();
    sanitizedRequestId = trimmed.length > 0 ? trimmed : null;
  }

  return {
    isValid: true,
    sanitized: {
      assignment_id: payload.assignment_id.trim(),
      submission_type: normalizedType as 'FILE' | 'LINK',
      file_name: normalizedType === 'FILE' ? (payload.file_name as string).trim() : null,
      file_path: normalizedType === 'FILE' ? (payload.file_path as string).trim() : null,
      external_link: normalizedType === 'LINK' ? (payload.external_link as string).trim() : null,
      client_request_id: sanitizedRequestId,
    },
  };
}

/**
 * POST /api/submissions
 * Handles assignment submission creation for authenticated students.
 */
export async function POST(request: NextRequest) {
  // 1. Parse JSON body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: 'Invalid JSON payload.',
      },
      { status: 400 }
    );
  }

  // 2. Validate payload format and mutual exclusivity constraints
  const validation = validatePayload(rawBody);
  if (!validation.isValid || !validation.sanitized) {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: validation.errorMessage,
      },
      { status: 400 }
    );
  }

  const {
    assignment_id,
    submission_type,
    file_name,
    file_path,
    external_link,
    client_request_id,
  } = validation.sanitized;
  const rawAttachments = (rawBody as { attachments?: unknown }).attachments;
  const attachments = submission_type === 'FILE' && Array.isArray(rawAttachments)
    ? rawAttachments
    : submission_type === 'FILE'
      ? [{ file_name, file_path }]
      : [];
  if (submission_type === 'FILE' && (attachments.length === 0 || attachments.length > 10 || attachments.some((attachment) =>
    !attachment || typeof attachment !== 'object' ||
    typeof (attachment as { file_name?: unknown }).file_name !== 'string' ||
    typeof (attachment as { file_path?: unknown }).file_path !== 'string'))) {
    return NextResponse.json({ error: 'Bad Request', message: 'A file submission must include 1 to 10 valid attachments.' }, { status: 400 });
  }

  // 3. Authenticate student via Supabase Auth Bearer token
  const authHeader =
    request.headers.get('authorization') || request.headers.get('Authorization');

  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. A valid Supabase Bearer token is required.',
      },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Empty Bearer token provided.',
      },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Supabase configuration is missing on the server.',
      },
      { status: 500 }
    );
  }

  // Create a request-scoped Supabase client that forwards the student's JWT to PostgREST
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

  // Verify the JWT with Supabase Auth to obtain the authenticated student's identity
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Invalid or expired Supabase authentication token.',
      },
      { status: 401 }
    );
  }

  const { data: role, error: roleError } = await userClient.rpc('get_my_role');
  if (roleError) return NextResponse.json({ error: 'Internal Server Error', message: 'Unable to verify account role.' }, { status: 500 });
  if (role === 'admin') return NextResponse.json({ error: 'Forbidden', message: 'Student access is required.' }, { status: 403 });

  // Derive student_id strictly from the authenticated Supabase user (never from request body)
  const studentId = user.id;

  if (submission_type === 'FILE' && (file_path?.startsWith(`${studentId}/`) !== true || attachments.some((attachment) => {
    const file = attachment as { file_name: string; file_path: string; file_size?: unknown };
    return !file.file_name.trim() || !file.file_path.startsWith(`${studentId}/`) ||
      (file.file_size != null && (typeof file.file_size !== 'number' || !Number.isSafeInteger(file.file_size) || file.file_size < 0));
  }))) {
    return NextResponse.json({ error: 'Bad Request', message: 'Invalid attachment metadata or file ownership.' }, { status: 400 });
  }

  // 4. Idempotency Check: prevent duplicate submissions with identical client_request_id
  if (client_request_id) {
    const { data: existingSubmission, error: lookupError } = await userClient
      .from('submissions')
      .select('submission_id, assignment_id, submission_type, file_name, file_path, external_link, submitted_at, cancelled_at, status, client_request_id')
      .eq('student_id', studentId)
      .eq('client_request_id', client_request_id)
      .maybeSingle();

    if (!lookupError && existingSubmission) {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: 'Duplicate submission request. A submission with this client_request_id has already been processed.',
          submission_id: existingSubmission.submission_id,
          existing_submission: existingSubmission,
        },
        { status: 409 }
      );
    }
  }

  // 5. Team 05 Assignment Integration & Deadline Verification
  const team05Result = await fetchTeam05Assignment(assignment_id);

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

    // Handle TIMEOUT (502) and DEPENDENCY_ERROR (502)
    return NextResponse.json(
      {
        error: 'Bad Gateway',
        message: team05Result.message,
      },
      { status: 502 }
    );
  }

  // Server-only RPC serializes the pair and commits history, submission, and files together.
  let serviceClient;
  try {
    serviceClient = await getIntegrationSupabaseClient();
  } catch {
    return NextResponse.json({ error: 'Internal Server Error', message: 'Submission service is unavailable.' }, { status: 500 });
  }
  const { data: rpcSubmission, error: insertError } = await serviceClient.rpc('create_submission_atomic', {
    p_student_id: studentId,
    p_assignment_id: assignment_id,
    p_submission_type: submission_type,
    p_file_name: file_name,
    p_file_path: file_path,
    p_external_link: external_link,
    p_due_at: team05Result.assignment.dueDate.toISOString(),
    p_client_request_id: client_request_id,
    p_attachments: attachments,
  }).single();

  if (insertError || !rpcSubmission) {
    // Check if error was due to unique constraint on (student_id, client_request_id)
    if (
      client_request_id && insertError?.code === '23505' &&
      (insertError.message?.includes('Duplicate submission request') || insertError.message?.includes('submissions_student_client_request_idx'))
    ) {
      const { data: existing } = await userClient
        .from('submissions')
        .select('submission_id, assignment_id, student_id, submission_type, file_name, file_path, external_link, submitted_at, cancelled_at, status, client_request_id')
        .eq('student_id', studentId)
        .eq('client_request_id', client_request_id)
        .maybeSingle();

      return NextResponse.json(
        {
          error: 'Conflict',
          message: 'Duplicate submission request. A submission with this client_request_id has already been processed.',
          submission_id: existing?.submission_id,
          existing_submission: existing,
        },
        { status: 409 }
      );
    }

    // Log internal error safely on server without exposing SQL/secrets to client
    console.error('Database insertion error in POST /api/submissions:', insertError?.message || 'Missing RPC result');

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to create submission record in database.',
      },
      { status: 500 }
    );
  }

  const createdSubmission = rpcSubmission as {
    submission_id: string; assignment_id: string; student_id: string;
    submission_type: 'FILE' | 'LINK'; file_name: string | null; file_path: string | null;
    external_link: string | null; submitted_at: string; cancelled_at: string | null;
    status: 'ON_TIME' | 'LATE'; client_request_id: string | null;
  };

  // 7. Dispatch Webhook Event to Team 05 (non-blocking & fail-safe)
  sendTeam05Webhook({
    event: 'submission.created',
    submission_id: createdSubmission.submission_id,
    assignment_id: createdSubmission.assignment_id,
    student_id: createdSubmission.student_id,
    submission_type: createdSubmission.submission_type,
    submitted_at: createdSubmission.submitted_at,
    status: createdSubmission.status,
  }).catch((err) => {
    console.error('[Webhook] Unexpected dispatch error:', err?.message || err);
  });

  // 8. Success Response (201 Created)
  const responseData = {
    submission_id: createdSubmission.submission_id,
    assignment_id: createdSubmission.assignment_id,
    student_id: createdSubmission.student_id,
    submission_type: createdSubmission.submission_type,
    ...(createdSubmission.submission_type === 'FILE'
      ? {
          file_name: createdSubmission.file_name,
          file_path: createdSubmission.file_path,
        }
      : {
          external_link: createdSubmission.external_link,
        }),
    submitted_at: createdSubmission.submitted_at,
    cancelled_at: createdSubmission.cancelled_at,
    status: createdSubmission.status,
    ...(createdSubmission.client_request_id
      ? { client_request_id: createdSubmission.client_request_id }
      : {}),
  };

  return NextResponse.json(responseData, { status: 201 });
}
