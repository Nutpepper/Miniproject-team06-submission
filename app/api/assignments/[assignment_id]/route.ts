import { NextRequest, NextResponse } from 'next/server';
import { fetchTeam05Assignment } from '@/lib/integrations/team05';

type RouteContext = {
  params: Promise<{ assignment_id: string }>;
};

/**
 * GET /api/assignments/:assignment_id
 * Proxies assignment details securely from Team 05 Assignment API to the Student UI.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { assignment_id } = await context.params;

  if (!assignment_id || typeof assignment_id !== 'string') {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: 'assignment_id is required.',
      },
      { status: 400 }
    );
  }

  const result = await fetchTeam05Assignment(assignment_id);

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.errorType === 'NOT_FOUND' ? 'Not Found' : 'Bad Gateway',
        message: result.message,
      },
      { status: result.status }
    );
  }

  const { assignment } = result;

  return NextResponse.json(
    {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      criteria: assignment.criteria,
      cohortId: assignment.cohortId,
      dueDate: assignment.dueDate.toISOString(),
      rawDueDate: assignment.rawDueDate,
    },
    { status: 200 }
  );
}
