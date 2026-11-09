export type SubmissionStatus = 'ON_TIME' | 'LATE';
export type SubmissionType = 'file' | 'link';
export type Role = 'student' | 'admin';

export interface Course {
  id: string;
  code: string;
  name: string;
  instructor: string;
  description: string;
  bannerColor?: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  course: string;
  courseCode: string;
  description: string;
  criteria?: string;
  postedAt?: Date;
  deadline: Date;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: SubmissionStatus;
  submittedAt: Date;
  type: SubmissionType;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  link?: string;
  attachments?: SubmissionAttachment[];
}

export interface SubmissionAttachment {
  id?: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
}

export interface PendingFileSubmission {
  type: 'file';
  files: Array<{ file: File; fileName: string; fileSize: number }>;
}

export interface PendingLinkSubmission {
  type: 'link';
  link: string;
}

export type PendingSubmission = PendingFileSubmission | PendingLinkSubmission;

export type StudentScreen =
  | { id: 'courses' }
  | { id: 'todo' }
  | { id: 'course-detail'; courseId: string }
  | { id: 'course-assignments'; courseId: string }
  | { id: 'course-files'; courseId: string }
  | { id: 'assignment-detail'; courseId: string; assignmentId: string }
  | { id: 'submit'; courseId: string; assignmentId: string }
  | { id: 'submission-check'; courseId: string; assignmentId: string; pending: PendingSubmission }
  | { id: 'success'; courseId: string; assignmentId: string; submissionId: string }
  | { id: 'current-submission'; courseId: string; assignmentId: string };

export type AdminScreen =
  | { id: 'courses' }
  | { id: 'course-detail'; courseId: string }
  | { id: 'assignment-submissions'; courseId: string; assignmentId: string }
  | { id: 'submission-detail'; courseId: string; assignmentId: string; submissionId: string };
