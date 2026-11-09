import { NextRequest, NextResponse } from 'next/server';

interface PartnerWebhookPayload {
  event?: unknown;
  timestamp?: unknown;
  data?: {
    message?: unknown;
    status?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * POST /api/webhooks/receive
 * Official Webhook Receiver implementing the Team 05 Partner Contract.
 * Headers:
 *   Content-Type: application/json
 *   x-webhook-secret: <secret>
 *
 * Payload:
 * {
 *   "event": "assignment.created",
 *   "timestamp": "2026-09-20T22:50:00Z",
 *   "data": {
 *     "message": "Hello from Partner Team",
 *     "status": "success"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  // 1. Validate Content-Type
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return NextResponse.json(
      {
        error: 'Unsupported Media Type',
        message: 'Content-Type must be application/json.',
      },
      { status: 415 }
    );
  }

  // 2. Authenticate x-webhook-secret header
  const webhookSecret =
    request.headers.get('x-webhook-secret') ||
    request.headers.get('X-Webhook-Secret');

  const expectedSecret = process.env.TEAM05_WEBHOOK_SECRET;

  if (!expectedSecret || !webhookSecret || webhookSecret !== expectedSecret) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Invalid or missing webhook secret.',
      },
      { status: 401 }
    );
  }

  // 3. Parse JSON body
  let body: PartnerWebhookPayload;
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
        message: 'Webhook payload must be a valid JSON object.',
      },
      { status: 400 }
    );
  }

  // 4. Validate payload structure
  if (typeof body.event !== 'string' || body.event.trim().length === 0) {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: 'Missing or invalid "event" field. Must be a non-empty string.',
      },
      { status: 400 }
    );
  }

  const eventName = body.event.trim();
  const timestamp = typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString();
  const data = (body.data && typeof body.data === 'object' && !Array.isArray(body.data))
    ? body.data
    : null;

  // 5. Safe processing & logging (Never expose secret in logs or response)
  console.log(
    `[Team 05 Webhook Receiver] Received event: "${eventName}" at ${timestamp}. Status: "${data?.status ?? 'N/A'}"`
  );

  return NextResponse.json(
    {
      received: true,
      event: eventName,
      timestamp,
      data: data
        ? {
            message: data.message ?? null,
            status: data.status ?? null,
          }
        : null,
      processed_at: new Date().toISOString(),
    },
    { status: 200 }
  );
}
