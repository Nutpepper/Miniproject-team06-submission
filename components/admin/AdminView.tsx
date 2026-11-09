'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { TopNav } from '@/components/shared/TopNav';
import { CourseCard } from '@/components/shared/CourseCard';
import { CourseAppearanceSettings } from '@/components/shared/CourseAppearanceSettings';
import { formatThaiTime } from '@/lib/formatters';
import type { Assignment, Course } from '@/lib/types';

type SubmissionFile = { file_id:string; file_name:string; file_path:string; file_size:number|null; sort_order:number };
type Submission = { submission_id:string; assignment_id:string; student_id:string; submission_type:'FILE'|'LINK'; file_name:string|null; file_path:string|null; external_link:string|null; submitted_at:string; cancelled_at:string|null; superseded_at:string|null; status:'ON_TIME'|'LATE'; submission_files?:SubmissionFile[] };
type StudentProfile = { fullName:string; studentId:string; avatarUrl:string; email:string };
type AdminAssignment = { id:string; title:string; description:string; criteria:string; dueDate:string; cohortId?:string; instructorName?:string };
type AdminCohort = { id:string; name:string; courseCode?:string };
type Screen = { id:'courses' } | { id:'assignments' } | { id:'submissions'; assignmentId:string } | { id:'detail'; assignmentId:string; submissionId:string };

const SubmissionPreview = ({ url, name, onClose }: { url:string; name:string; onClose:()=>void }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ตัวอย่างงานที่ส่ง"><div className="flex h-[min(90dvh,56rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><p className="truncate pr-4 text-sm font-semibold text-slate-900">{name}</p><button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">ปิด</button></div>{/\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(name) ? <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100 p-2"><img src={url} alt={`ตัวอย่าง ${name}`} className="h-full w-full object-contain" /></div> : <iframe title={name} src={url} className="min-h-0 flex-1 border-0" />}</div></div>;

export const AdminView: React.FC = () => {
  const [screen,setScreen] = useState<Screen>({id:'courses'});
  const [rows,setRows] = useState<Submission[]>([]);
  const [studentProfiles,setStudentProfiles] = useState<Record<string,StudentProfile>>({});
  const [assignments,setAssignments] = useState<Record<string,AdminAssignment|null>>({});
  const [cohorts,setCohorts] = useState<AdminCohort[]>([]);
  const [selectedCourseId,setSelectedCourseId] = useState<string | null>(null);
  const [email,setEmail] = useState<string>();
  const [loading,setLoading] = useState(true);
  const [loadingWork,setLoadingWork] = useState(true);
  const [workError,setWorkError] = useState<string | null>(null);
  const [error,setError] = useState<string|null>(null);
  const [search,setSearch] = useState(''); const [filter,setFilter] = useState<'ACTIVE'|'ALL'|'ON_TIME'|'LATE'|'SUPERSEDED'>('ACTIVE');
  const [preview,setPreview] = useState<{url:string;name:string}|null>(null);
  const [courseBanner,setCourseBanner] = useState('from-amber-400 to-orange-600'); const [appearanceOpen,setAppearanceOpen] = useState(false);
  const [banners,setBanners] = useState<Record<string,string>>({});

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }
      if (!alive) return;
      setEmail(session.user.email);
      const options = { headers: { Authorization: `Bearer ${session.access_token}` } };
      const courseRequest = fetch('/api/cohorts', options).then(async response => {
        if (!response.ok) throw new Error('ไม่สามารถโหลดรายวิชาได้');
        const data: AdminCohort[] = await response.json();
        if (alive) { setCohorts(data); setLoading(false); }
      });
      const workRequest = fetch('/api/admin/submissions', options).then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || 'ไม่สามารถโหลดข้อมูลงานได้');
        if (alive) {
          setRows(body.submissions || []); setStudentProfiles(body.studentProfiles || {});
          setAssignments(body.assignments || {}); setCohorts(body.cohorts || []);
          setLoading(false); setLoadingWork(false);
        }
      });
      const [courseResult, workResult] = await Promise.allSettled([courseRequest, workRequest]);
      if (!alive) return;
      if (workResult.status === 'rejected') {
        const message = workResult.reason instanceof Error ? workResult.reason.message : 'ไม่สามารถโหลดข้อมูลงานได้';
        setWorkError(message); setLoadingWork(false);
        if (courseResult.status === 'rejected') { setError(message); setLoading(false); }
      }
    })().catch(() => { if (alive) { setError('ไม่สามารถเชื่อมต่อระบบอาจารย์ได้'); setLoading(false); setLoadingWork(false); } });
    return () => { alive = false; };
  }, []);

  const assignmentList=useMemo(()=>Object.values(assignments).filter((a):a is AdminAssignment=>Boolean(a)),[assignments]);
  const courses = useMemo(() => {
    const result = new Map<string, Course>(cohorts.map(c => [c.id, { id:c.id, code:c.courseCode || '', name:c.name, instructor:'ไม่ระบุชื่อผู้สอน', description:'จัดการงานและตรวจไฟล์ที่นักศึกษาส่ง' }]));
    for (const assignment of assignmentList) {
      const id = assignment.cohortId?.trim() || '__unassigned__';
      if (!result.has(id)) result.set(id, { id, code:'', name:id === '__unassigned__' ? 'งานที่ยังไม่ระบุรายวิชา' : `ไม่พบข้อมูลรายวิชา (${id})`, instructor:'ไม่ระบุชื่อผู้สอน', description:'' });
      const instructorName = assignment.instructorName?.trim();
      if (instructorName) result.get(id)!.instructor = instructorName;
    }
    return [...result.values()];
  }, [cohorts, assignmentList]);
  const course = courses.find(c => c.id === selectedCourseId);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch('/api/course-appearances', { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) return;
      const saved: Record<string, string> = await response.json();
      if (alive) setBanners(saved);
    })();
    return () => { alive = false; };
  }, []);
  const assignmentModels:Assignment[]=course ? assignmentList.filter(a => (a.cohortId?.trim() || '__unassigned__') === course.id).map(a=>({id:a.id,courseId:course.id,course:course.name,courseCode:course.code,title:a.title,description:a.description,criteria:a.criteria,deadline:new Date(a.dueDate)})) : [];
  const assignmentId=screen.id==='submissions'||screen.id==='detail'?screen.assignmentId:null;
  const selectedAssignment=assignmentId?assignments[assignmentId]:null;
  const activeRows=rows.filter(r=>!r.cancelled_at&&!r.superseded_at);
  const assignmentRows=assignmentId?rows.filter(r=>r.assignment_id===assignmentId):[];
  const visibleRows=assignmentRows.filter(r=>{const q=search.trim().toLowerCase();const rowStatus=r.superseded_at?'SUPERSEDED':r.status;const student=studentProfiles[r.student_id];return !r.cancelled_at&&(filter==='ALL'||(filter==='ACTIVE'&&!r.superseded_at)||rowStatus===filter)&&(!q||student?.studentId.toLowerCase().includes(q)||student?.fullName.toLowerCase().includes(q)||student?.email.toLowerCase().includes(q)||r.file_name?.toLowerCase().includes(q));});
  const selectedRow=screen.id==='detail'?rows.find(r=>r.submission_id===screen.submissionId):null;
  const selected=selectedRow;
  const back=()=>setScreen(screen.id==='detail'?{id:'submissions',assignmentId:screen.assignmentId}:screen.id==='submissions'?{id:'assignments'}:{id:'courses'});
  const saveCourseBanner = async (bannerColor: string) => {
    if (!selectedCourseId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const response = await fetch('/api/course-appearances', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: selectedCourseId, bannerColor }),
    });
    if (!response.ok) { setError('ไม่สามารถบันทึกสีหน้าปกรายวิชาได้'); return; }
    setBanners((current) => ({ ...current, [selectedCourseId]: bannerColor }));
  };
  const openWork=async()=>{if(!selected)return;if(selected.submission_type==='LINK'&&selected.external_link){window.open(selected.external_link,'_blank','noopener,noreferrer');return;}const {data:{session}}=await supabase.auth.getSession();if(!session)return;const res=await fetch(`/api/admin/submissions/${selected.submission_id}/file`,{headers:{Authorization:`Bearer ${session.access_token}`}});const body=await res.json().catch(()=>({}));if(!res.ok){setError(body.message||'ไม่สามารถเปิดไฟล์ได้');return;}setPreview({url:body.url,name:selected.file_name||'งานที่ส่ง'});};

  return <div className="min-h-screen bg-slate-50"><TopNav role="admin" userEmail={email} onLogout={async()=>{await supabase.auth.signOut();window.location.href='/login';}} onHome={()=>setScreen({id:'courses'})}/><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{error&&<div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}{loading?<p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">กำลังโหลดข้อมูลงาน...</p>:<>
{screen.id==='courses'&&<><div className="mb-6"><p className="text-sm font-medium text-indigo-600">หน้าผู้สอน</p><h1 className="mt-1 text-2xl font-bold text-slate-900">รายวิชาของฉัน</h1><p className="mt-1 text-sm text-slate-500">เลือกวิชาเพื่อดูงานและตรวจการส่งงานของนักศึกษา</p></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{courses.map(item => <CourseCard key={item.id} course={{...item, bannerColor:banners[item.id]}} assignmentCountLabel={workError ? 'โหลดงานไม่สำเร็จ' : undefined} assignmentCount={loadingWork || workError ? null : assignmentList.filter(a => (a.cohortId?.trim() || '__unassigned__') === item.id).length} onSelect={()=>{setSelectedCourseId(item.id);setScreen({id:'assignments'});}} onCustomize={()=>{setSelectedCourseId(item.id);setCourseBanner(banners[item.id] || 'from-amber-400 to-orange-600');setAppearanceOpen(true);}} actionLabel="ดูรายวิชา"/>)}</div></>}
    {screen.id==='assignments'&&course&&<><button type="button" onClick={back} className="mb-5 text-sm font-semibold text-indigo-600">← กลับไปรายวิชา</button><div className="mb-6"><p className="text-sm font-medium text-indigo-600">{course.code && `[${course.code}] `}{course.name}</p><h1 className="mt-1 text-2xl font-bold text-slate-900">งานในรายวิชา</h1><p className="mt-1 text-sm text-slate-500">เลือกงานเพื่อดูรายการส่งของนักศึกษา</p></div>{loadingWork || workError ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600" role="status">{workError || 'กำลังโหลดรายการงานและข้อมูลการส่ง...'}</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{assignmentModels.map(a=>{const count=activeRows.filter(r=>r.assignment_id===a.id).length;return <article key={a.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex justify-between gap-2"><span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">{course.code || course.name}</span><span className="text-xs text-slate-500">ส่งแล้ว {count} รายการ</span></div><h2 className="font-semibold text-slate-900">{a.title}</h2><p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.description||'ไม่มีรายละเอียดงาน'}</p><p className="mt-4 text-xs text-slate-500">กำหนดส่ง: {formatThaiTime(a.deadline)}</p><button type="button" onClick={()=>{setSearch('');setFilter('ACTIVE');setScreen({id:'submissions',assignmentId:a.id});}} className="mt-5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">ดูงานที่ส่ง</button></article>;})}</div>}</>}
    {screen.id==='submissions'&&selectedAssignment&&<><button type="button" onClick={back} className="mb-5 text-sm font-semibold text-indigo-600">← กลับไปรายการงาน</button><section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h1 className="text-xl font-bold">{selectedAssignment.title}</h1><p className="mt-2 text-sm text-slate-600">{selectedAssignment.description}</p>{selectedAssignment.criteria&&<p className="mt-3 whitespace-pre-line text-sm text-slate-600"><b>เกณฑ์การให้คะแนน: </b>{selectedAssignment.criteria}</p>}</section><div className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหารหัสนักศึกษา ชื่อ หรือชื่อไฟล์" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"/><select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="ACTIVE">กำลังใช้งาน</option><option value="ALL">ทุกสถานะ</option><option value="ON_TIME">ส่งตรงเวลา</option><option value="LATE">ส่งล่าช้า</option><option value="SUPERSEDED">แทนที่ด้วยการส่งใหม่</option></select></div>{visibleRows.length===0?<p className="p-8 text-center text-sm text-slate-500">ยังไม่มีการส่งงาน</p>:<div className="overflow-x-auto"><table className="w-full table-fixed text-left text-xs sm:min-w-[720px] sm:table-auto sm:text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-2 py-3 sm:px-4">นักศึกษา</th><th className="px-2 py-3 sm:px-4">ส่งเมื่อ</th><th className="px-2 py-3 sm:px-4">สถานะ</th><th className="px-2 py-3 sm:px-4"></th></tr></thead><tbody className="divide-y divide-slate-100">{visibleRows.map(r=>{const student=studentProfiles[r.student_id];return <tr key={r.submission_id} className={r.cancelled_at||r.superseded_at?'bg-slate-50 text-slate-500':''}><td className="px-2 py-3 sm:px-4"><div className="flex items-center gap-2 sm:gap-3">{student?.avatarUrl?<img src={student.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover"/>:<span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{student?.fullName?.charAt(0).toUpperCase()||'?'}</span>}<div><p className="font-semibold text-slate-900">{student?.fullName||'ไม่พบข้อมูลโปรไฟล์'}</p><p className="text-xs text-slate-500">รหัสนักศึกษา: {student?.studentId||'-'}</p></div></div></td><td className="px-2 py-3 sm:px-4">{formatThaiTime(new Date(r.submitted_at))}</td><td className="px-2 py-3 sm:px-4">{r.cancelled_at?<span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">ยกเลิกการส่ง</span>:r.superseded_at?<span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">แทนที่ด้วยการส่งใหม่</span>:r.status==='LATE'?'กำลังใช้งาน · ส่งล่าช้า':'กำลังใช้งาน · ส่งตรงเวลา'}</td><td className="px-2 py-3 text-right sm:px-4"><button type="button" onClick={()=>setScreen({id:'detail',assignmentId:selectedAssignment.id,submissionId:r.submission_id})} className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700">ดูงาน</button></td></tr>})}</tbody></table></div>}</div></>}
    {screen.id==='detail'&&selected&&selectedAssignment&&<div className="mx-auto w-full max-w-4xl"><button type="button" onClick={back} className="mb-5 text-sm font-semibold text-indigo-600">← กลับไปรายการส่งงาน</button><section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium text-indigo-600">{selectedAssignment.title}</p><h1 className="mt-1 text-xl font-bold">งานของนักศึกษา</h1><dl className="mt-5 space-y-3 text-sm"><div><dt className="text-slate-500">ชื่อนักศึกษา</dt><dd className="mt-2 flex items-center gap-3">{studentProfiles[selected.student_id]?.avatarUrl ? <img src={studentProfiles[selected.student_id].avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">{studentProfiles[selected.student_id]?.fullName?.charAt(0).toUpperCase() || '?'}</span>}<span>{studentProfiles[selected.student_id]?.fullName || 'ไม่พบข้อมูลโปรไฟล์'}</span></dd></div><div><dt className="text-slate-500">Submission ID</dt><dd className="mt-1 break-all font-mono">{selected.submission_id}</dd></div><div><dt className="text-slate-500">Student ID</dt><dd className="mt-1 font-mono">{selected.student_id}</dd></div><div><dt className="text-slate-500">ส่งเมื่อ</dt><dd className="mt-1">{formatThaiTime(new Date(selected.submitted_at))}</dd></div></dl><div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="font-semibold">ไฟล์/ลิงก์ที่ส่ง</p><p className="mt-1 truncate text-sm text-slate-600">{selected.file_name||selected.external_link||'-'}</p><button type="button" onClick={()=>void openWork()} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">เปิดงานที่ส่ง</button></div></section></div>}
  </>}</main>{preview&&<SubmissionPreview url={preview.url} name={preview.name} onClose={()=>setPreview(null)}/>}<CourseAppearanceSettings open={appearanceOpen} value={courseBanner} onClose={()=>setAppearanceOpen(false)} onSave={(value)=>{setCourseBanner(value);void saveCourseBanner(value);}}/></div>;
};
