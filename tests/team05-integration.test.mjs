import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function loadModule(path, dependencies = {}, fetchMock = () => { throw new Error('Unexpected network call'); }) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const require = (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  };
  new Function('require', 'module', 'exports', 'fetch', output)(require, module, module.exports, fetchMock);
  return module.exports;
}

const NextResponse = { json: (body, init = {}) => ({ status: init.status ?? 200, json: async () => body }) };

test('integration API rejects an invalid secret before accessing dependencies', async () => {
  process.env.TEAM05_INTEGRATION_SECRET = 'test-only-secret';
  const route = await loadModule('../app/api/integration/assignments/[assignment_id]/submissions/route.ts', {
    'next/server': { NextResponse },
    '@/lib/integrations/team05': { fetchTeam05Assignment: () => { throw new Error('Unexpected assignment lookup'); } },
    '@/lib/supabase/server': { getIntegrationSupabaseClient: () => { throw new Error('Unexpected database access'); } },
  });
  const response = await route.GET({ headers: { get: () => 'wrong-secret' } }, { params: Promise.resolve({ assignment_id: 'a1' }) });
  assert.equal(response.status, 401);
});

test('integration API maps missing assignment and dependency failure without querying DB', async () => {
  process.env.TEAM05_INTEGRATION_SECRET = 'test-only-secret';
  let errorType = 'NOT_FOUND';
  const route = await loadModule('../app/api/integration/assignments/[assignment_id]/submissions/route.ts', {
    'next/server': { NextResponse },
    '@/lib/integrations/team05': { fetchTeam05Assignment: async () => ({ success: false, errorType, message: 'test error' }) },
    '@/lib/supabase/server': { getIntegrationSupabaseClient: () => { throw new Error('Unexpected database access'); } },
  });
  const request = { headers: { get: () => 'test-only-secret' } };
  const context = { params: Promise.resolve({ assignment_id: 'a1' }) };
  assert.equal((await route.GET(request, context)).status, 404);
  errorType = 'TIMEOUT';
  assert.equal((await route.GET(request, context)).status, 502);
});

test('webhook receiver checks secret and payload without changing contract', async () => {
  process.env.TEAM05_WEBHOOK_SECRET = 'test-only-secret';
  const route = await loadModule('../app/api/webhooks/receive/route.ts', { 'next/server': { NextResponse } });
  const request = (secret, body) => ({ headers: { get: (key) => key.toLowerCase() === 'content-type' ? 'application/json' : secret }, json: async () => body });
  assert.equal((await route.POST(request('wrong-secret', { event: 'assignment.created' }))).status, 401);
  assert.equal((await route.POST(request('test-only-secret', {}))).status, 400);
  const response = await route.POST(request('test-only-secret', { event: 'assignment.created', timestamp: '2026-01-01T00:00:00Z', data: { status: 'success' } }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).event, 'assignment.created');
});

test('webhook sender preserves created event and handles timeouts without retrying', async () => {
  process.env.TEAM05_WEBHOOK_URL = 'https://webhook.invalid/test';
  process.env.TEAM05_WEBHOOK_SECRET = 'test-only-secret';
  const event = { event: 'submission.created', submission_id: 'test', assignment_id: 'a1', student_id: 'student', submission_type: 'LINK', submitted_at: '2026-01-01T00:00:00Z', status: 'ON_TIME' };
  let calls = 0;
  const sender = await loadModule('../lib/integrations/team05WebhookSender.ts', {}, async (url, options) => {
    calls++;
    assert.equal(url, 'https://webhook.invalid/test');
    assert.equal(options.headers['X-Webhook-Secret'], 'test-only-secret');
    assert.deepEqual(JSON.parse(options.body), event);
    const error = new Error('timeout'); error.name = 'AbortError'; throw error;
  });
  const result = await sender.sendTeam05Webhook(event);
  assert.equal(result.success, false);
  assert.equal(calls, 1);
});

test('assignment lookup rejects unsafe IDs and maps a timeout to a dependency error', async () => {
  let calls = 0;
  const integration = await loadModule('../lib/integrations/team05.ts', {}, async () => {
    calls++;
    const error = new Error('timeout'); error.name = 'AbortError'; throw error;
  });
  assert.equal((await integration.fetchTeam05Assignment('../other')).errorType, 'NOT_FOUND');
  assert.equal(calls, 0);
  const result = await integration.fetchTeam05Assignment('assignment-1');
  assert.equal(result.errorType, 'TIMEOUT');
  assert.equal(result.status, 502);
});
