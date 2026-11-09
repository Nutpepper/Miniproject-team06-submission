import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function loadUploader() {
  const source = await readFile(new URL('../lib/upload-submission-files.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', compiled)(module, module.exports);
  return module.exports.uploadSubmissionFiles;
}

test('uploads multiple submission files with unique student-owned paths', async () => {
  const uploadFiles = await loadUploader();
  const seen = [];
  const files = [{ file: { type: 'application/pdf' }, fileName: 'first.pdf', fileSize: 12 }, { file: { type: 'image/png' }, fileName: 'งาน.png', fileSize: 7 }];
  let id = 0;
  const result = await uploadFiles(files, 'student-id', async (path, file) => { seen.push({ path, file }); return { error: null }; }, () => String(++id));
  assert.equal(result.error, null);
  assert.deepEqual(seen.map((item) => item.path), ['student-id/1-first.pdf', 'student-id/2-___.png']);
  assert.deepEqual(result.files.map((item) => item.file_name), ['first.pdf', 'งาน.png']);
  assert.equal(result.files[1].file_size, 7);
});

test('partial upload failure stops the flow and retains uploaded object references', async () => {
  const uploadFiles = await loadUploader();
  const seen = [];
  const files = ['a.pdf', 'b.pdf', 'c.pdf'].map((fileName) => ({ file: {}, fileName, fileSize: 10 }));
  const result = await uploadFiles(files, 'student-id', async (path) => {
    seen.push(path);
    return { error: seen.length === 2 ? { message: 'upload failed' } : null };
  }, () => String(seen.length));
  assert.equal(result.error, 'upload failed');
  assert.equal(seen.length, 2);
  assert.deepEqual(result.files.map((item) => item.file_path), [seen[0]]);
});

test('network errors are propagated without performing cleanup', async () => {
  const uploadFiles = await loadUploader();
  let calls = 0;
  const files = ['a.pdf', 'b.pdf'].map((fileName) => ({ file: {}, fileName, fileSize: 10 }));
  await assert.rejects(uploadFiles(files, 'student-id', async () => {
    if (++calls === 2) throw new Error('network failed');
    return { error: null };
  }, () => String(calls)), /network failed/);
  assert.equal(calls, 2);
});
