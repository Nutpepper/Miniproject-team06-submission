/**
 * Team 06 -> Team 05 Webhook Sender
 * Dispatches event notifications (e.g. submission.created) to Team 05.
 * Features:
 * - Configurable URL and shared-secret via environment variables
 * - 3-second timeout to prevent hanging requests
 * - Non-blocking, safe error handling (never crashes the submission flow)
 * - Safe logging (never exposes secrets or keys)
 */

export interface SubmissionCreatedWebhookEvent {
  event: 'submission.created';
  submission_id: string;
  assignment_id: string;
  student_id: string;
  submission_type: 'FILE' | 'LINK';
  submitted_at: string;
  status: 'ON_TIME' | 'LATE';
}

export type Team05WebhookEvent = SubmissionCreatedWebhookEvent;

export interface WebhookDispatchResult {
  success: boolean;
  skipped?: boolean;
  status?: number;
  error?: string;
}

export async function sendTeam05Webhook(event: Team05WebhookEvent): Promise<WebhookDispatchResult> {
  const webhookUrl = process.env.TEAM05_WEBHOOK_URL;
  const webhookSecret = process.env.TEAM05_WEBHOOK_SECRET;

  // If partner webhook URL is not configured, skip delivery safely
  if (!webhookUrl || webhookUrl.trim().length === 0) {
    console.log(
      `[Team 05 Webhook Sender] TEAM05_WEBHOOK_URL is not set. Webhook for event "${event.event}" (submission_id: ${event.submission_id}) skipped.`
    );
    return { success: true, skipped: true };
  }

  const targetUrl = webhookUrl.trim();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (webhookSecret && webhookSecret.trim().length > 0) {
      headers['X-Webhook-Secret'] = webhookSecret.trim();
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[Team 05 Webhook Sender] Partner webhook returned non-2xx status ${response.status} for event "${event.event}" (submission_id: ${event.submission_id}).`
      );
      return { success: false, status: response.status, error: `HTTP ${response.status}` };
    }

    console.log(
      `[Team 05 Webhook Sender] Successfully delivered event "${event.event}" (submission_id: ${event.submission_id}) to partner.`
    );
    return { success: true, status: response.status };
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
    const errorMessage = isTimeout
      ? 'Webhook delivery timed out after 3000ms.'
      : err instanceof Error
      ? err.message
      : 'Unknown network error';

    console.warn(
      `[Team 05 Webhook Sender] Delivery failed for event "${event.event}" (submission_id: ${event.submission_id}): ${errorMessage}`
    );

    return {
      success: false,
      error: errorMessage,
    };
  }
}
