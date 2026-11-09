type PendingFile = { file: File; fileName: string; fileSize: number };
export type UploadedSubmissionFile = { file_name: string; file_path: string; file_size: number };

// Files are uploaded before the database transaction. Do not delete partial
// uploads from the browser: even an uncertain response may hide a committed
// operation. Orphan review is a separate privileged maintenance process.
export async function uploadSubmissionFiles(
  files: PendingFile[],
  studentId: string,
  upload: (path: string, file: File) => Promise<{ error: { message: string } | null }>,
  newId: () => string = () => crypto.randomUUID(),
): Promise<{ files: UploadedSubmissionFile[]; error: string | null }> {
  const uploaded: UploadedSubmissionFile[] = [];
  for (const file of files) {
    const safeFileName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${studentId}/${newId()}-${safeFileName}`;
    const { error } = await upload(path, file.file);
    if (error) return { files: uploaded, error: error.message };
    uploaded.push({ file_name: file.fileName, file_path: path, file_size: file.fileSize });
  }
  return { files: uploaded, error: null };
}
