
/**
 * Team 05 Assignment API Integration Client
 * Base Endpoint: https://learning-platform-api-five.vercel.app/api/assignments/{assignment_id}
 */

export interface Team05RawDueDate {
  _seconds: number;
  _nanoseconds?: number;
}

export interface Team05AssignmentResponse {
  id: string;
  cohortId?: string;
  instructorId?: string;
  title?: string;
  description?: string;
  criteria?: string;
  dueDate: Team05RawDueDate;
  attachmentUrl?: string | null;
  createdAt?: {
    _seconds: number;
    _nanoseconds?: number;
  };
}

export interface Team05AssignmentData {
  id: string;
  title: string;
  description?: string;
  criteria?: string;
  cohortId?: string;
  instructorId?: string;
  createdAt?: Date;
  dueDate: Date;
  rawDueDate: Team05RawDueDate;
}

export type Team05FetchResult =
  | {
    success: true;
    assignment: Team05AssignmentData;
  }
  | {
    success: false;
    errorType: 'NOT_FOUND';
    status: 404;
    message: string;
  }
  | {
    success: false;
    errorType: 'TIMEOUT';
    status: 502;
    message: string;
  }
  | {
    success: false;
    errorType: 'DEPENDENCY_ERROR';
    status: 502;
    message: string;
  };

const TEAM05_BASE_URL = 'https://learning-platform-api-five.vercel.app/api/assignments';
// The Team 05 API is deployed on Vercel and can take several seconds to wake
// after inactivity. Three seconds caused valid responses to be aborted during
// a cold start, so leave enough room for the partner service to respond.
const TIMEOUT_MS = 15_000;
const LIST_FETCH_ATTEMPTS = 2;

export interface Team05Cohort {
  id: string;
  name: string;
  instructorId?: string;
  courseCode?: string;
  courseName?: string;
}

export async function fetchTeam05Cohorts(): Promise<Team05Cohort[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch('https://learning-platform-api-five.vercel.app/api/cohorts', {
      headers: { Accept: 'application/json' }, signal: controller.signal, cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Team 05 cohort API responded with status ${response.status}.`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('Team 05 cohort API returned an invalid list.');
    return payload.flatMap((item: unknown) => {
      if (!item || typeof item !== 'object') return [];
      const cohort = item as Record<string, unknown>;
      if (typeof cohort.id !== 'string' || !cohort.id.trim() || typeof cohort.name !== 'string' || !cohort.name.trim()) return [];
      return [{ id: cohort.id, name: cohort.name.trim(), instructorId: typeof cohort.instructorId === 'string' ? cohort.instructorId : undefined, courseCode: typeof cohort.courseCode === 'string' ? cohort.courseCode.trim() : undefined, courseName: typeof cohort.courseName === 'string' ? cohort.courseName.trim() : undefined }];
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchTeam05Assignments(): Promise<Team05AssignmentData[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= LIST_FETCH_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(TEAM05_BASE_URL, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Team 05 Assignment API responded with status ${response.status}.`);
      }

      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error('Team 05 Assignment API returned an invalid assignment list.');
      }

      return payload.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const assignment = item as Partial<Team05AssignmentResponse> & { dueDate?: unknown };
        const rawDueDate = assignment.dueDate;
        const dueDate = typeof rawDueDate === 'string'
          ? new Date(rawDueDate)
          : rawDueDate && typeof rawDueDate === 'object' && typeof (rawDueDate as Team05RawDueDate)._seconds === 'number'
            ? new Date((rawDueDate as Team05RawDueDate)._seconds * 1000)
            : null;

        if (typeof assignment.id !== 'string' || !dueDate || Number.isNaN(dueDate.getTime())) return [];

        const rawCreatedAt = assignment.createdAt;
        const createdAt = rawCreatedAt && typeof rawCreatedAt._seconds === 'number'
          ? new Date(rawCreatedAt._seconds * 1000 + Math.floor((rawCreatedAt._nanoseconds || 0) / 1_000_000))
          : undefined;
        return [{
          id: assignment.id,
          title: typeof assignment.title === 'string' ? assignment.title : '',
          description: typeof assignment.description === 'string' ? assignment.description : '',
          criteria: typeof assignment.criteria === 'string' ? assignment.criteria : '',
          cohortId: typeof assignment.cohortId === 'string' ? assignment.cohortId : undefined,
          instructorId: typeof assignment.instructorId === 'string' ? assignment.instructorId : undefined,
          createdAt,
          dueDate,
          rawDueDate: typeof rawDueDate === 'object' && rawDueDate && '_seconds' in rawDueDate
            ? rawDueDate as Team05RawDueDate
            : { _seconds: Math.floor(dueDate.getTime() / 1000) },
        }];
      });
    } catch (error) {
      lastError = error;
      if (attempt === LIST_FETCH_ATTEMPTS) throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

/**
 * Validates that an assignment ID consists strictly of safe alphanumeric characters,
 * underscores, or hyphens to prevent SSRF and path traversal attacks.
 */
function isValidAssignmentIdFormat(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

/**
 * Fetches assignment details from Team 05 Assignment GET API.
 * Safely parses the Firestore timestamp into a JavaScript Date representing an absolute instant.
 *
 * @param assignmentId - The external assignment ID owned by Team 05.
 * @returns Team05FetchResult containing either the parsed assignment data or error details.
 */
export async function fetchTeam05Assignment(
  assignmentId: string
): Promise<Team05FetchResult> {
  const trimmedId = assignmentId ? assignmentId.trim() : '';

  // 1. SSRF & Path Traversal Guard
  if (!trimmedId || !isValidAssignmentIdFormat(trimmedId)) {
    return {
      success: false,
      errorType: 'NOT_FOUND',
      status: 404,
      message: `Assignment "${assignmentId}" not found.`,
    };
  }

  const targetUrl = `${TEAM05_BASE_URL}/${encodeURIComponent(trimmedId)}`;

  // 2. AbortController for 3-second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 3. Handle HTTP 404 Not Found
    if (res.status === 404) {
      return {
        success: false,
        errorType: 'NOT_FOUND',
        status: 404,
        message: `Assignment "${trimmedId}" was not found in Team 05.`,
      };
    }

    // 4. Handle non-200 responses (e.g. 500, 502, 503)
    if (!res.ok) {
      return {
        success: false,
        errorType: 'DEPENDENCY_ERROR',
        status: 502,
        message: `Team 05 Assignment API responded with unexpected status code ${res.status}.`,
      };
    }

    // 5. Parse JSON payload
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return {
        success: false,
        errorType: 'DEPENDENCY_ERROR',
        status: 502,
        message: 'Team 05 Assignment API returned an unparseable JSON response.',
      };
    }

    // 6. Validate payload structure
    if (!data || typeof data !== 'object') {
      return {
        success: false,
        errorType: 'DEPENDENCY_ERROR',
        status: 502,
        message: 'Team 05 Assignment API returned an invalid data payload.',
      };
    }

    const payload = data as Partial<Team05AssignmentResponse>;

    if (typeof payload.id !== 'string' || payload.id.trim().length === 0) {
      return {
        success: false,
        errorType: 'DEPENDENCY_ERROR',
        status: 502,
        message: 'Team 05 Assignment API response is missing assignment id.',
      };
    }

    // Team 05 has used both Firestore timestamps and ISO-8601 strings across
    // its list/detail endpoints. Accept either representation consistently.
    const rawDueDate: unknown = (data as { dueDate?: unknown }).dueDate;
    const timestamp = rawDueDate && typeof rawDueDate === 'object' &&
      typeof (rawDueDate as Team05RawDueDate)._seconds === 'number'
      ? rawDueDate as Team05RawDueDate
      : null;
    const dueDate = timestamp
      ? new Date(timestamp._seconds * 1000 + Math.floor((timestamp._nanoseconds || 0) / 1_000_000))
      : typeof rawDueDate === 'string'
        ? new Date(rawDueDate)
        : null;

    if (!dueDate || Number.isNaN(dueDate.getTime())) {
      return {
        success: false,
        errorType: 'DEPENDENCY_ERROR',
        status: 502,
        message: 'Team 05 Assignment API response is missing a valid dueDate.',
      };
    }

    const seconds = timestamp?._seconds ?? Math.floor(dueDate.getTime() / 1000);
    const nanoseconds = timestamp?._nanoseconds ?? 0;

    return {
      success: true,
      assignment: {
        id: payload.id,
        title: typeof payload.title === 'string' ? payload.title : '',
        description: typeof payload.description === 'string' ? payload.description : '',
        criteria: typeof payload.criteria === 'string' ? payload.criteria : '',
        cohortId: typeof payload.cohortId === 'string' ? payload.cohortId : undefined,
        instructorId: typeof payload.instructorId === 'string' ? payload.instructorId : undefined,
        createdAt: payload.createdAt && typeof payload.createdAt._seconds === 'number'
          ? new Date(payload.createdAt._seconds * 1000 + Math.floor((payload.createdAt._nanoseconds || 0) / 1_000_000))
          : undefined,
        dueDate,
        rawDueDate: {
          _seconds: seconds,
          _nanoseconds: nanoseconds,
        },
      },
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (
      (err instanceof Error && err.name === 'AbortError') ||
      controller.signal.aborted
    ) {
      return {
        success: false,
        errorType: 'TIMEOUT',
        status: 502,
        message: `Team 05 Assignment API timed out after ${TIMEOUT_MS}ms.`,
      };
    }

    return {
      success: false,
      errorType: 'DEPENDENCY_ERROR',
      status: 502,
      message:
        err instanceof Error
          ? `Team 05 Assignment API network failure: ${err.message}`
          : 'Team 05 Assignment API request failed.',
    };
  }
}
