import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { beforeEach } from 'node:test';
import ts from 'typescript';

const user = { id: '11111111-1111-4111-8111-111111111111' };
const submissionId = '22222222-2222-4222-8222-222222222222';

function json(body, init = {}) {
  return { status: init.status ?? 200, json: async () => body };
}

function assignment(dueDate = new Date(Date.now() + 60_000)) {
  return { success: true, assignment: { id: 'assignment-1', title: 'Assignment', dueDate, rawDueDate: { _seconds: Math.floor(dueDate.getTime() / 1000) } } };
}

function createdSubmission(overrides = {}) {
  return {
    submission_id: submissionId, assignment_id: 'assignment-1', student_id: user.id,
    submission_type: 'FILE', file_name: 'work.pdf', file_path: `${user.id}/work.pdf`,
    external_link: null, submitted_at: new Date().toISOString(), cancelled_at: null,
    superseded_at: null,
    status: 'ON_TIME', client_request_id: null, ...overrides,
  };
}

async function loadRoute(relativePath, dependencies) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const require = (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  };
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
  return module.exports;
}

function makeRequest(body, token = 'test-token') {
  return {
    headers: { get: (name) => name.toLowerCase() === 'authorization' && token ? `Bearer ${token}` : null },
    json: async () => body,
  };
}

let context;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  context = {
    getUser: async () => ({ data: { user }, error: null }),
    from: () => ({}),
    fetchAssignment: async () => assignment(),
    sendWebhook: async () => ({ success: true }),
    role: 'student',
    rpc: async (args) => ({ data: createdSubmission({ submission_type: args.p_submission_type, status: new Date(args.p_due_at) < new Date() ? 'LATE' : 'ON_TIME' }), error: null }),
  };
});

async function submissionPost() {
  const route = await loadRoute('../app/api/submissions/route.ts', {
    'next/server': { NextResponse: { json } },
    '@supabase/supabase-js': { createClient: () => ({ auth: { getUser: context.getUser }, from: context.from, rpc: async () => ({ data: context.role, error: null }) }) },
    '@/lib/supabase/server': { getIntegrationSupabaseClient: async () => ({ rpc: (_name, args) => ({ single: () => context.rpc(args) }) }) },
    '@/lib/integrations/team05': { fetchTeam05Assignment: (...args) => context.fetchAssignment(...args) },
    '@/lib/integrations/team05WebhookSender': { sendTeam05Webhook: (...args) => context.sendWebhook(...args) },
  });
  return route.POST;
}

test('creates an ON_TIME file submission for an authenticated student', async () => {
  const inserted = [];
  context.rpc = async (payload) => { inserted.push(payload); return { data: createdSubmission(), error: null }; };
  const post = await submissionPost();
  const response = await post(makeRequest({ assignment_id: 'assignment-1', submission_type: 'FILE', file_name: 'work.pdf', file_path: `${user.id}/work.pdf` }));

  assert.equal(response.status, 201);
  assert.equal((await response.json()).status, 'ON_TIME');
  assert.equal(inserted.length, 1);
});

test('creates a LINK submission with a valid HTTPS URL', async () => {
  context.rpc = async () => ({ data: createdSubmission({ submission_type: 'LINK', file_name: null, file_path: null, external_link: 'https://example.com/work' }), error: null });
  const post = await submissionPost();
  const response = await post(makeRequest({ assignment_id: 'assignment-1', submission_type: 'LINK', external_link: 'https://example.com/work' }));

  assert.equal(response.status, 201);
});

test('rejects an invalid payload without calling Team 05', async () => {
  let team05Called = false;
  context.fetchAssignment = async () => { team05Called = true; return assignment(); };
  const post = await submissionPost();
  const response = await post(makeRequest({ assignment_id: 'assignment-1', submission_type: 'LINK', external_link: 'http://example.com/work' }));

  assert.equal(response.status, 400);
  assert.equal(team05Called, false);
});

test('rejects a valid payload without authentication', async () => {
  const post = await submissionPost();
  const response = await post(makeRequest({ assignment_id: 'assignment-1', submission_type: 'LINK', external_link: 'https://example.com/work' }, ''));

  assert.equal(response.status, 401);
});

test('sets LATE from server time and the Team 05 deadline', async () => {
  const inserted = [];
  context.fetchAssignment = async () => assignment(new Date(Date.now() - 60_000));
  context.rpc = async (payload) => { inserted.push(payload); return { data: createdSubmission({ status: 'LATE' }), error: null }; };
  const post = await submissionPost();
  const response = await post(makeRequest({ assignment_id: 'assignment-1', submission_type: 'FILE', file_name: 'work.pdf', file_path: `${user.id}/work.pdf` }));

  assert.equal(response.status, 201);
  assert.ok(new Date(inserted[0].p_due_at) < new Date());
});

test('returns 409 for a duplicate client request id', async () => {
  context.from = () => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: createdSubmission({ client_request_id: 'same-request' }), error: null }) }) }) }),
  });
  const post = await submissionPost();
  const response = await post(makeRequest({ assignment_id: 'assignment-1', submission_type: 'LINK', external_link: 'https://example.com/work', client_request_id: 'same-request' }));

  assert.equal(response.status, 409);
});

test('handles a duplicate detected atomically after the initial lookup', async () => {
  let lookups = 0;
  let webhooks = 0;
  context.from = () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: ++lookups === 1 ? null : createdSubmission({ client_request_id: 'same-request' }), error: null }) }) }) }) });
  context.rpc = async () => ({ data: null, error: { code: '23505', message: 'Duplicate submission request' } });
  context.sendWebhook = async () => { webhooks++; };
  const post = await submissionPost();
  const response = await post(makeRequest({ assignment_id: 'assignment-1', submission_type: 'LINK', external_link: 'https://example.com/work', client_request_id: 'same-request' }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).submission_id, submissionId);
  assert.equal(webhooks, 0);
});

test('resubmissions are delegated to the atomic RPC', async () => {
  let inserts = 0;
  context.rpc = async () => { inserts++; return { data: createdSubmission(), error: null }; };
  context.from = () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) });
  const post = await submissionPost();
  const payload = { assignment_id: 'assignment-1', submission_type: 'FILE', file_name: 'work.pdf', file_path: `${user.id}/work.pdf` };

  assert.equal((await post(makeRequest(payload))).status, 201);
  assert.equal((await post(makeRequest({ ...payload, client_request_id: 'new-request' }))).status, 201);
  assert.equal(inserts, 2);
});

test('rejects an attachment in another student folder before RPC', async () => {
  let called = false;
  context.rpc = async () => { called = true; };
  const post = await submissionPost();
  const response = await post(makeRequest({ assignment_id: 'assignment-1', submission_type: 'FILE', file_name: 'work.pdf', file_path: 'other-user/work.pdf' }));
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test('rejects admin accounts and does not call the submission RPC', async () => {
  context.role = 'admin';
  let called = false;
  context.rpc = async () => { called = true; };
  const post = await submissionPost();
  assert.equal((await post(makeRequest({ assignment_id: 'assignment-1', submission_type: 'LINK', external_link: 'https://example.com/work' }))).status, 403);
  assert.equal(called, false);
});

test('does not send a webhook when the database operation fails', async () => {
  let sent = false;
  context.rpc = async () => ({ data: null, error: { code: 'XX000', message: 'simulated failure' } });
  context.sendWebhook = async () => { sent = true; };
  const post = await submissionPost();
  assert.equal((await post(makeRequest({ assignment_id: 'assignment-1', submission_type: 'LINK', external_link: 'https://example.com/work' }))).status, 500);
  assert.equal(sent, false);
});

test('Team 05 integration preserves its existing response shape and history', async () => {
  process.env.TEAM05_INTEGRATION_SECRET = 'test-only-secret';
  const rows = [createdSubmission(), createdSubmission({ submission_id: '33333333-3333-4333-8333-333333333333', superseded_at: '2026-01-01T00:00:00Z' })];
  const route = await loadRoute('../app/api/integration/assignments/[assignment_id]/submissions/route.ts', {
    'next/server': { NextResponse: { json } },
    '@/lib/integrations/team05': { fetchTeam05Assignment: async () => assignment() },
    '@/lib/supabase/server': { getIntegrationSupabaseClient: async () => ({
      from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }) }),
      auth: { admin: { getUserById: async () => ({ data: { user: { email: 'test@example.invalid', user_metadata: {} } }, error: null }) } },
    }) },
  });
  const response = await route.GET({ headers: { get: () => 'test-only-secret' } }, { params: Promise.resolve({ assignment_id: 'assignment-1' }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.submissions.length, 2);
  assert.deepEqual(Object.keys(body.submissions[0]).sort(), ['cancelled_at', 'external_link', 'file_name', 'status', 'student', 'student_id', 'submission_id', 'submission_type', 'submitted_at'].sort());
  assert.equal(body.submissions[1].cancelled_at, null);
});

test('soft-cancels an authenticated student submission', async () => {
  const active = createdSubmission();
  const cancelled = { ...active, cancelled_at: new Date().toISOString() };
  const updates = [];
  const filters = [];
  const eq = (next) => (column, value) => { filters.push([column, value]); return next; };
  context.from = () => ({
    select: () => ({ eq: eq({ eq: eq({ maybeSingle: async () => ({ data: active, error: null }) }) }) }),
    update: (payload) => { updates.push(payload); return { eq: eq({ eq: eq({ is: () => ({ is: () => ({ select: () => ({ maybeSingle: async () => ({ data: cancelled, error: null }) }) }) }) }) }) }; },
  });
  const route = await loadRoute('../app/api/submissions/[submission_id]/route.ts', {
    'next/server': { NextResponse: { json } },
    '@supabase/supabase-js': { createClient: () => ({ auth: { getUser: context.getUser }, from: context.from }) },
    '@/lib/supabase/server': { getIntegrationSupabaseClient: async () => ({ from: context.from }) },
  });
  const response = await route.DELETE(makeRequest(null), { params: Promise.resolve({ submission_id: submissionId }) });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).cancelled_at, cancelled.cancelled_at);
  assert.deepEqual(Object.keys(updates[0]), ['cancelled_at']);
  assert.ok(!Number.isNaN(Date.parse(updates[0].cancelled_at)));
  assert.equal(filters.filter(([key, value]) => key === 'submission_id' && value === submissionId).length, 2);
  assert.equal(filters.filter(([key, value]) => key === 'student_id' && value === user.id).length, 2);
});

test('DELETE rejects unauthenticated and already cancelled submissions', async () => {
  let writes = 0;
  context.from = () => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: createdSubmission({ cancelled_at: '2026-01-01T00:00:00Z' }), error: null }) }) }) }),
    update: () => { writes++; },
  });
  const route = await loadRoute('../app/api/submissions/[submission_id]/route.ts', {
    'next/server': { NextResponse: { json } },
    '@supabase/supabase-js': { createClient: () => ({ auth: { getUser: context.getUser }, from: context.from }) },
    '@/lib/supabase/server': { getIntegrationSupabaseClient: async () => ({ from: context.from }) },
  });
  const params = { params: Promise.resolve({ submission_id: submissionId }) };
  assert.equal((await route.DELETE(makeRequest(null, ''), params)).status, 401);
  assert.equal((await route.DELETE(makeRequest(null), params)).status, 409);
  assert.equal(writes, 0);
});

test('DELETE reports conflict if the active row changes concurrently', async () => {
  context.from = () => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: createdSubmission(), error: null }) }) }) }),
    update: () => ({ eq: () => ({ eq: () => ({ is: () => ({ is: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }) }),
  });
  const route = await loadRoute('../app/api/submissions/[submission_id]/route.ts', {
    'next/server': { NextResponse: { json } },
    '@supabase/supabase-js': { createClient: () => ({ auth: { getUser: context.getUser }, from: context.from }) },
    '@/lib/supabase/server': { getIntegrationSupabaseClient: async () => ({ from: context.from }) },
  });
  const response = await route.DELETE(makeRequest(null), { params: Promise.resolve({ submission_id: submissionId }) });
  assert.equal(response.status, 409);
});

test('DELETE does not allow cancellation of another student submission', async () => {
  let writes = 0;
  context.from = () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }), update: () => { writes++; } });
  const route = await loadRoute('../app/api/submissions/[submission_id]/route.ts', {
    'next/server': { NextResponse: { json } },
    '@supabase/supabase-js': { createClient: () => ({ auth: { getUser: context.getUser }, from: context.from }) },
    '@/lib/supabase/server': { getIntegrationSupabaseClient: async () => ({ from: context.from }) },
  });
  const response = await route.DELETE(makeRequest(null), { params: Promise.resolve({ submission_id: submissionId }) });
  assert.equal(response.status, 404);
  assert.equal(writes, 0);
});

test('PATCH reports conflict if a link is superseded while updating', async () => {
  context.from = () => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: createdSubmission({ submission_type: 'LINK', file_name: null, file_path: null, external_link: 'https://example.com/old' }), error: null }) }) }) }),
    update: () => ({ eq: () => ({ eq: () => ({ is: () => ({ is: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }) }),
  });
  const route = await loadRoute('../app/api/submissions/[submission_id]/route.ts', {
    'next/server': { NextResponse: { json } },
    '@supabase/supabase-js': { createClient: () => ({ auth: { getUser: context.getUser }, from: context.from }) },
    '@/lib/supabase/server': { getIntegrationSupabaseClient: async () => ({ from: context.from }) },
  });
  const response = await route.PATCH(makeRequest({ external_link: 'https://example.com/new' }), { params: Promise.resolve({ submission_id: submissionId }) });
  assert.equal(response.status, 409);
});

test('cancel client sends DELETE with token and refreshes after success', async () => {
  const { cancelSubmissionAndRefresh } = await loadRoute('../lib/cancel-submission.ts', {});
  let refreshed = false;
  await cancelSubmissionAndRefresh(submissionId, 'student-token', async () => { refreshed = true; }, async (url, options) => {
    assert.equal(url, `/api/submissions/${submissionId}`);
    assert.equal(options.method, 'DELETE');
    assert.equal(options.headers.Authorization, 'Bearer student-token');
    assert.equal(options.body, undefined);
    assert.equal(refreshed, false);
    return { ok: true };
  });
  assert.equal(refreshed, true);
});

test('cancel client rejects API and network errors without refreshing', async () => {
  const { cancelSubmissionAndRefresh } = await loadRoute('../lib/cancel-submission.ts', {});
  let refreshes = 0;
  const refresh = async () => { refreshes++; };
  await assert.rejects(cancelSubmissionAndRefresh(submissionId, 'token', refresh, async () => ({ ok: false })));
  await assert.rejects(cancelSubmissionAndRefresh(submissionId, 'token', refresh, async () => { throw new Error('network'); }));
  assert.equal(refreshes, 0);
});

test('cancel client reports a failed refresh separately after successful DELETE', async () => {
  const { cancelSubmissionAndRefresh, SubmissionRefreshError } = await loadRoute('../lib/cancel-submission.ts', {});
  await assert.rejects(
    cancelSubmissionAndRefresh(submissionId, 'token', async () => { throw new Error('database'); }, async () => ({ ok: true })),
    SubmissionRefreshError,
  );
});
