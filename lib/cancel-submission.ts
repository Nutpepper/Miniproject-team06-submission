export class SubmissionRefreshError extends Error {}

export async function cancelSubmissionAndRefresh(
  submissionId: string,
  token: string,
  refresh: () => Promise<unknown>,
  request: typeof fetch = fetch,
): Promise<void> {
  const response = await request(`/api/submissions/${encodeURIComponent(submissionId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('ไม่สามารถยกเลิกการส่งงานได้ กรุณาลองใหม่');
  }
  try {
    await refresh();
  } catch {
    throw new SubmissionRefreshError('ยกเลิกการส่งงานแล้ว แต่โหลดสถานะล่าสุดไม่สำเร็จ กรุณาโหลดหน้าใหม่');
  }
}
