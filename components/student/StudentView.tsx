'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { cancelSubmissionAndRefresh, SubmissionRefreshError } from '@/lib/cancel-submission';
import { uploadSubmissionFiles } from '@/lib/upload-submission-files';
import type { StudentScreen, Submission, PendingSubmission, Assignment, Course } from '@/lib/types';
import { formatThaiTime } from '@/lib/formatters';
import { TopNav } from '@/components/shared/TopNav';
import { StudentCourseList } from './StudentCourseList';
import { StudentCourseDetail } from './StudentCourseDetail';
import { AllAssignments } from './AllAssignments';
import { AssignmentDetail } from './AssignmentDetail';
import { SubmitAssignment } from './SubmitAssignment';
import { SubmissionCheck } from './SubmissionCheck';
import { SubmissionSuccess } from './SubmissionSuccess';
import { CurrentSubmission } from './CurrentSubmission';
import { NoActiveSubmission } from './NoActiveSubmission';
import { StudentSidebar } from './StudentSidebar';
import { StudentTodo } from './StudentTodo';
import { CourseFiles } from './CourseFiles';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'error';
  message: string;
}

interface StudentViewProps {
  initialSession?: Session;
  roleVerified?: boolean;
}

export const StudentView: React.FC<StudentViewProps> = ({
  initialSession,
  roleVerified = false,
}) => {
  const router = useRouter();
  const [screen, setScreen] = useState<StudentScreen>({ id: 'courses' });
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionHistory, setSubmissionHistory] = useState<Array<{ id: string; assignmentId: string; submittedAt: string; lifecycle: string; link?: string; files: Array<{ name: string; path: string }> }>>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [submissionLoadError, setSubmissionLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Real Team 05 Assignment state
  const [realAssignments, setRealAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingAssignment, setLoadingAssignment] = useState<boolean>(true);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(true);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const fetchAssignment = async (accessToken?: string) => {
    setLoadingAssignment(true);
    setLoadingCourses(true);
    setAssignmentError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 35000);
    try {
      const token = accessToken || (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error('กรุณาเข้าสู่ระบบเพื่อดูรายการงาน');
      }

      const options = { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } };
      const assignmentsRequest = fetch('/api/assignments', options).then(
        response => ({ response, error: null }),
        error => ({ response: null, error }),
      );
      const cohortsResponse = await fetch('/api/cohorts', options);
      if (!cohortsResponse.ok) {
        const errorData = await cohortsResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'ไม่สามารถโหลดรายวิชาได้ กรุณาลองใหม่');
      }
      const cohorts: Array<{ id: string; name: string; courseCode?: string; courseName?: string }> = await cohortsResponse.json();
      const courseMap = new Map<string, Course>(cohorts.map((cohort) => [cohort.id, {
        id: cohort.id, code: cohort.courseCode || '', name: cohort.name,
        instructor: 'ไม่ระบุชื่อผู้สอน', description: '',
      }]));
      setCourses([...courseMap.values()]);
      setLoadingCourses(false);
      const assignmentResult = await assignmentsRequest;
      if (assignmentResult.error) throw assignmentResult.error;
      const res = assignmentResult.response!;
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'ไม่สามารถโหลดรายการงานได้ กรุณาลองใหม่');
      }
      const data: Array<{
        id: string;
        title: string;
        description?: string;
        criteria?: string;
        cohortId?: string;
        createdAt?: string;
        dueDate: string;
      }> = await res.json();
      const mappedAssignments = data.map((item) => {
        const courseId = item.cohortId?.trim() || '__unassigned__';
        if (!courseMap.has(courseId)) courseMap.set(courseId, {
          id: courseId, code: '', name: courseId === '__unassigned__' ? 'งานที่ยังไม่ระบุรายวิชา' : `ไม่พบข้อมูลรายวิชา (${courseId})`,
          instructor: 'ไม่ระบุชื่อผู้สอน', description: '',
        });
        const course = courseMap.get(courseId)!;
        return {
        id: item.id,
        courseId,
        title: item.title,
        course: course.name,
        courseCode: course.code,
        description: item.description || '',
        criteria: item.criteria || '',
        postedAt: item.createdAt ? new Date(item.createdAt) : undefined,
        deadline: new Date(item.dueDate),
        };
      });
      setCourses([...courseMap.values()]);
      setRealAssignments(mappedAssignments);
    } catch (err: unknown) {
      setAssignmentError(
        err instanceof DOMException && err.name === 'AbortError'
          ? 'การเชื่อมต่อบริการงานหมดเวลา กรุณาลองใหม่'
          : err instanceof Error
          ? err.message
          : 'ไม่สามารถโหลดรายการงานได้ กรุณาลองใหม่'
      );
      setRealAssignments([]);
      setCourses([]);
    } finally {
      window.clearTimeout(timeoutId);
      setLoadingCourses(false);
      setLoadingAssignment(false);
    }
  };

  const loadSubmissions = async (session: Session) => {
    setLoadingSubmissions(true);
    setSubmissionLoadError(null);
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*, submission_files(file_id, file_name, file_path, file_size, sort_order)')
        .eq('student_id', session.user.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      const mapped: Submission[] = (data || []).filter((row) => !row.cancelled_at && !row.superseded_at).map((row) => ({
        id: row.submission_id,
        assignmentId: row.assignment_id,
        studentId: row.student_id,
        studentName: session.user.email || 'Student',
        studentEmail: session.user.email || '',
        status: row.status as 'ON_TIME' | 'LATE',
        submittedAt: new Date(row.submitted_at),
        type: (row.submission_type?.toLowerCase() as 'file' | 'link') || 'link',
        fileName: row.file_name || undefined,
        filePath: row.file_path || undefined,
        attachments: Array.isArray(row.submission_files) ? row.submission_files.map((file: { file_id: string; file_name: string; file_path: string; file_size: number | null }) => ({ id: file.file_id, fileName: file.file_name, filePath: file.file_path, fileSize: file.file_size || undefined })) : undefined,
        link: row.external_link || undefined,
      }));
      setSubmissions(mapped);
      setSubmissionHistory((data || []).filter((row) => row.cancelled_at || row.superseded_at).map((row) => ({
        id: row.submission_id, assignmentId: row.assignment_id, submittedAt: row.submitted_at,
        lifecycle: row.cancelled_at ? 'ยกเลิกการส่ง' : 'แทนที่ด้วยการส่งใหม่',
        link: row.external_link || undefined,
        files: Array.isArray(row.submission_files) && row.submission_files.length
          ? row.submission_files.map((file: { file_name: string; file_path: string }) => ({ name: file.file_name, path: file.file_path }))
          : row.file_path ? [{ name: row.file_name || 'ไฟล์ที่ส่ง', path: row.file_path }] : [],
      })));
      return mapped;
    } catch (error) {
      setSubmissionLoadError('ไม่สามารถโหลดไฟล์ที่ส่งได้ กรุณาโหลดหน้าใหม่');
      throw error;
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      let session;
      try {
        if (initialSession) {
          session = initialSession;
        } else {
          const sessionResult = await Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) =>
              window.setTimeout(() => reject(new Error('Authentication request timed out.')), 8000)
            ),
          ]);
          session = sessionResult.data.session;
        }
      } catch {
        setLoadingAuth(false);
        router.push('/login?error=auth-timeout');
        return;
      }

      if (!session) {
        setLoadingAuth(false);
        router.push('/login');
        return;
      }

      if (!roleVerified) {
        const roleResponse = await fetch('/api/auth/role', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const roleData = await roleResponse.json().catch(() => ({}));
        if (!roleResponse.ok) {
          setLoadingAuth(false);
          router.push('/login?error=role-check');
          return;
        }
        if (roleData.role === 'admin') {
          setLoadingAuth(false);
          router.replace('/admin');
          return;
        }
      }

      setUserEmail(session.user.email);
      setUserId(session.user.id);
      setLoadingAuth(false);
      void fetchAssignment(session.access_token);

      await loadSubmissions(session).catch(() => {});
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        setUserEmail(session.user.email);
        setUserId(session.user.id);
        setLoadingAuth(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initialSession, roleVerified, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const addToast = (type: 'success' | 'info' | 'error', message: string) => {
    const id = Math.random().toString(36).substring(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const downloadHistoryFile = async (file: { name: string; path: string }) => {
    const { data, error } = await supabase.storage.from('submissions').download(file.path);
    if (error || !data) { addToast('error', 'ไม่สามารถดาวน์โหลดไฟล์ในประวัติได้'); return; }
    const url = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const getCourse = (id: string): Course => {
    const course = courses.find((item) => item.id === id);
    if (!course) throw new Error('Course not loaded.');
    return course;
  };

  const getAssignment = (id: string): Assignment => {
    const assignment = realAssignments.find((item) => item.id === id);
    if (assignment) {
      return assignment;
    }
    throw new Error('Assignment not loaded.');
  };

  const getStudentSub = (assignmentId: string) =>
    submissions.find(
      (s) =>
        s.assignmentId === assignmentId &&
        (userId ? s.studentId === userId : false)
    );

  const handleSubmit = async (
    courseId: string,
    assignmentId: string,
    pending: PendingSubmission
  ) => {
    const assignment = getAssignment(assignmentId);
    if (!assignment) {
      addToast('error', 'ยังโหลดข้อมูลงานไม่สำเร็จ จึงไม่สามารถส่งงานได้');
      return;
    }

    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setSubmitting(true);
    let uploadedFilePath: string | null = null;
    let uploadedFiles: Array<{ file_name: string; file_path: string; file_size: number }> = [];

    try {
      // 1. Retrieve current session from existing Supabase client
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // 2. If no session, show authentication error and do not call API
      if (!session) {
        addToast('error', 'ไม่พบการเข้าสู่ระบบ กรุณาเข้าสู่ระบบก่อนส่งงาน');
        setSubmitting(false);
        return;
      }

      // 3. Obtain access token (do NOT log or display the token)
      const accessToken = session.access_token;

      // 4. Construct payload strictly using the loaded Team 05 assignment ID
      if (pending.type === 'file') {
        const result = await uploadSubmissionFiles(pending.files, session.user.id, async (path, file) => {
          const { error } = await supabase.storage.from('submissions').upload(path, file, {
            cacheControl: '3600', contentType: file.type || 'application/octet-stream', upsert: false,
          });
          return { error };
        });
        uploadedFiles = result.files;
        if (result.error !== null) {
          addToast('error', `อัปโหลดไฟล์ไม่สำเร็จ: ${result.error}`);
          return;
        }
        uploadedFilePath = uploadedFiles[0]?.file_path || null;
      }

      const payload =
        pending.type === 'link'
          ? {
              assignment_id: assignment.id,
              submission_type: 'LINK',
              external_link: pending.link,
              client_request_id: crypto.randomUUID(),
            }
          : {
              assignment_id: assignment.id,
              submission_type: 'FILE',
              file_name: uploadedFiles[0]?.file_name,
              file_path: uploadedFilePath,
              attachments: uploadedFiles,
              client_request_id: crypto.randomUUID(),
            };

      // 5. Call POST /api/submissions
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => ({}));

      // 6. Handle response status codes
      if (response.status === 201) {
        // 201: show submission success and returned submission_id
        const returnedSubmissionId = responseData.submission_id;
        try {
          const active = await loadSubmissions(session);
          if (active.some((item) => item.id === returnedSubmissionId)) {
            addToast('success', `ส่งงานสำเร็จ รหัสการส่ง: ${returnedSubmissionId}`);
            setScreen({ id: 'success', courseId, assignmentId: assignment.id, submissionId: returnedSubmissionId });
          } else {
            addToast('info', 'ส่งงานสำเร็จ แต่มีรายการส่งใหม่กว่าหรือถูกยกเลิกแล้ว');
            setScreen({ id: 'current-submission', courseId, assignmentId: assignment.id });
          }
        } catch {
          addToast('error', 'ส่งงานแล้ว แต่โหลดสถานะล่าสุดไม่สำเร็จ กรุณาโหลดหน้าใหม่');
          setScreen({ id: 'current-submission', courseId, assignmentId: assignment.id });
        }
      } else if (response.status === 400) {
        // 400: show API validation error
        addToast(
          'error',
          `ข้อมูลส่งงานไม่ถูกต้อง: ${responseData.message || 'กรุณาตรวจสอบข้อมูลอีกครั้ง'}`
        );
      } else if (response.status === 401) {
        // 401: show authentication error
        addToast(
          'error',
          `การยืนยันตัวตนไม่สำเร็จ: ${responseData.message || 'กรุณาเข้าสู่ระบบอีกครั้ง'}`
        );
      } else if (response.status === 409) {
        // 409: show duplicate submission request
        addToast(
          'error',
          `คำขอส่งงานซ้ำ: ${responseData.message || 'ระบบได้ดำเนินการส่งงานนี้แล้ว'}`
        );
      } else {
        // other: show generic submission error
        addToast(
          'error',
          `ส่งงานไม่สำเร็จ (${response.status}): ${responseData.message || 'กรุณาลองใหม่'}`
        );
      }

    } catch (err: unknown) {
      addToast('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  };

  const handleCancel = async (assignmentId: string) => {
    const sub = submissions.find((s) => s.assignmentId === assignmentId && s.studentId === userId);
    if (!sub) {
      addToast('error', 'ไม่พบรายการส่งงาน กรุณาโหลดหน้าใหม่');
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== sub.studentId) {
        throw new Error('ไม่พบการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
      }
      await cancelSubmissionAndRefresh(sub.id, session.access_token, () => loadSubmissions(session));
      addToast('info', 'ยกเลิกการส่งงานแล้ว');
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการยกเลิกการส่งงาน');
      if (error instanceof SubmissionRefreshError) setSubmissionLoadError(error.message);
    }
  };

  if (loadingAuth || loadingCourses) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {loadingAuth ? 'กำลังตรวจสอบการเข้าสู่ระบบ...' : 'กำลังโหลดรายการงาน...'}
          </p>
        </div>
      </div>
    );
  }

  if (assignmentError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">
            ไม่สามารถโหลดรายการงานได้ กรุณาลองใหม่
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            {assignmentError || 'ไม่สามารถเชื่อมต่อบริการรายการงานได้'}
          </p>
          <button
            type="button"
            onClick={() => void fetchAssignment()}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors cursor-pointer"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  const activeAssignments = realAssignments;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={[
                'flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto animate-slide-in',
                t.type === 'success'
                  ? 'bg-emerald-600 text-white'
                  : t.type === 'info'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-red-600 text-white',
              ].join(' ')}
            >
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="ml-2 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Dismiss"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Navigation - Student */}
      <TopNav role="student" userEmail={userEmail} onLogout={handleLogout} onMobileMenu={() => setMobileSidebarOpen(true)} onSidebarToggle={() => setSidebarCollapsed((current) => !current)} sidebarCollapsed={sidebarCollapsed} mobileMenuOpen={mobileSidebarOpen} />

      {/* Main Student Views: Course -> Assignment -> Submission */}
      <div className="flex">
      <StudentSidebar courses={courses} activeCourseId={screen.id === 'courses' || screen.id === 'todo' ? undefined : screen.courseId} todoActive={screen.id === 'todo'} collapsed={sidebarCollapsed} onHome={() => setScreen({ id: 'courses' })} onTodo={() => setScreen({ id: 'todo' })} onSelectCourse={(courseId) => setScreen({ id: 'course-detail', courseId })} mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      <main className="min-w-0 flex-1">
        {/* 1. My Courses */}
        {screen.id === 'courses' && (
          <StudentCourseList
            courses={courses}
            assignments={activeAssignments}
            loadingAssignments={loadingAssignment}
            studentLabel={userEmail || 'Enrolled courses'}
            onSelectCourse={(courseId) => setScreen({ id: 'course-detail', courseId })}
            onViewAssignments={(courseId) => setScreen({ id: 'course-assignments', courseId })}
            onViewFiles={(courseId) => setScreen({ id: 'course-files', courseId })}
          />
        )}

        {loadingAssignment && screen.id !== 'courses' && <p className="p-6 text-sm text-slate-500" role="status">กำลังโหลดรายการงาน...</p>}
        {!loadingAssignment && <>
        {!loadingAssignment && screen.id === 'todo' && <StudentTodo assignments={activeAssignments} submissions={submissions} currentUserId={userId} onSelect={(assignment) => setScreen({ id: 'assignment-detail', courseId: assignment.courseId, assignmentId: assignment.id })} />}

        {screen.id === 'course-files' && <CourseFiles course={getCourse(screen.courseId)} assignments={activeAssignments.filter((assignment) => assignment.courseId === screen.courseId)} submissions={submissions} currentUserId={userId} loading={loadingSubmissions} loadError={submissionLoadError} onBack={() => setScreen({ id: 'courses' })} onAssignment={(assignmentId) => setScreen({ id: 'assignment-detail', courseId: screen.courseId, assignmentId })} />}

        {screen.id === 'course-assignments' && <AllAssignments course={getCourse(screen.courseId)} assignments={activeAssignments.filter((assignment) => assignment.courseId === screen.courseId)} submissions={submissions} currentUserId={userId} onBack={() => setScreen({ id: 'courses' })} onSelectAssignment={(assignmentId) => setScreen({ id: 'assignment-detail', courseId: screen.courseId, assignmentId })} />}

        {/* 2. Course Detail (Course's assignments) */}
        {screen.id === 'course-detail' && (() => {
          const course = getCourse(screen.courseId);
          const courseAssignments = activeAssignments.filter((a) => a.courseId === screen.courseId);
          return (
            <StudentCourseDetail
              course={course}
              assignments={courseAssignments}
              submissions={submissions}
              currentUserId={userId}
              onBack={() => setScreen({ id: 'courses' })}
              onSelectAssignment={(assignmentId) =>
                setScreen({ id: 'assignment-detail', courseId: screen.courseId, assignmentId })
              }
            />
          );
        })()}

        {/* 3. Assignment Detail */}
        {screen.id === 'assignment-detail' && (() => {
          const a = getAssignment(screen.assignmentId);
          const sub = getStudentSub(screen.assignmentId);
          return (
            <AssignmentDetail
              assignment={a}
              submission={sub}
              onBack={() => setScreen({ id: 'course-detail', courseId: screen.courseId })}
              onBackToCourses={() => setScreen({ id: 'courses' })}
              onSubmit={() => setScreen({ id: 'submit', courseId: screen.courseId, assignmentId: screen.assignmentId })}
              onViewSubmission={() =>
                setScreen({ id: 'current-submission', courseId: screen.courseId, assignmentId: screen.assignmentId })
              }
              onCancelResubmit={() =>
                setScreen({ id: 'current-submission', courseId: screen.courseId, assignmentId: screen.assignmentId })
              }
            />
          );
        })()}

        {/* 4. Submit Assignment */}
        {screen.id === 'submit' && (() => {
          const a = getAssignment(screen.assignmentId);
          return (
            <SubmitAssignment
              assignment={a}
              submitting={submitting}
              onBack={() => setScreen({ id: 'assignment-detail', courseId: screen.courseId, assignmentId: screen.assignmentId })}
              onProceed={(pending) => handleSubmit(screen.courseId, screen.assignmentId, pending)}
            />
          );
        })()}

        {/* 5. Submission Check */}
        {screen.id === 'submission-check' && (() => {
          const a = getAssignment(screen.assignmentId);
          return (
            <SubmissionCheck
              assignment={a}
              pending={screen.pending}
              submitting={submitting}
              onBack={() =>
                setScreen({ id: 'submit', courseId: screen.courseId, assignmentId: screen.assignmentId })
              }
              onSubmit={() => handleSubmit(screen.courseId, screen.assignmentId, screen.pending)}
            />
          );
        })()}

        {/* 6. Submission Success */}
        {screen.id === 'success' && (() => {
          const a = getAssignment(screen.assignmentId);
          const sub = submissions.find((s) => s.id === screen.submissionId);
          if (!sub) return null;
          return (
            <SubmissionSuccess
              assignment={a}
              submission={sub}
              onViewSubmission={() =>
                setScreen({ id: 'current-submission', courseId: screen.courseId, assignmentId: screen.assignmentId })
              }
              onBackToAssignments={() =>
                setScreen({ id: 'course-detail', courseId: screen.courseId })
              }
            />
          );
        })()}

        {/* 7. Current Submission */}
        {screen.id === 'current-submission' && (() => {
          const a = getAssignment(screen.assignmentId);
          const sub = getStudentSub(screen.assignmentId);

          if (loadingSubmissions || submissionLoadError) {
            return <p role="status" className="mx-auto max-w-3xl px-4 py-6 text-sm text-slate-600">{submissionLoadError || 'กำลังโหลดสถานะการส่งงาน...'}</p>;
          }

          const history = submissionHistory.filter((item) => item.assignmentId === screen.assignmentId);
          const historyView = history.length > 0 && <section className="mx-auto max-w-3xl px-4 pb-6"><h2 className="font-semibold">ประวัติการส่งงาน</h2><ul className="mt-2 space-y-2 text-sm text-slate-600">{history.map((item) => <li key={item.id}>{formatThaiTime(new Date(item.submittedAt))} — {item.lifecycle} <span className="font-mono text-xs">{item.id}</span>{item.link && <a className="ml-2 text-indigo-600 underline" href={item.link} target="_blank" rel="noopener noreferrer">เปิดลิงก์</a>}{item.files.map((file) => <button className="ml-2 text-indigo-600 underline" key={file.path} type="button" onClick={() => void downloadHistoryFile(file)}>{file.name}</button>)}</li>)}</ul></section>;
          if (!sub) {
            return <>
              <NoActiveSubmission
                assignment={a}
                onBack={() => setScreen({ id: 'assignment-detail', courseId: screen.courseId, assignmentId: screen.assignmentId })}
                onSubmit={() => setScreen({ id: 'submit', courseId: screen.courseId, assignmentId: screen.assignmentId })}
              />
              {historyView}</>;
          }

          return (
            <><CurrentSubmission
              assignment={a}
              submission={sub}
              onBack={() => setScreen({ id: 'assignment-detail', courseId: screen.courseId, assignmentId: screen.assignmentId })}
              onCancelSubmission={() => { void handleCancel(screen.assignmentId); }}
              onSubmitAgain={() => setScreen({ id: 'submit', courseId: screen.courseId, assignmentId: screen.assignmentId })}
            />{historyView}</>
          );
        })()}
        </>}
      </main>
      </div>
    </div>
  );
};
