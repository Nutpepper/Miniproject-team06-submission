# Team 06 — Submission Module Database Schema Documentation

## 1. Overview
Database schema สำหรับ **Team 06 — Submission Module** ถูกออกแบบมาเพื่อจัดการการส่งงานของนักศึกษา (Submission) โดยเน้นความปลอดภัย ความถูกต้องของข้อมูล (Data Integrity) และการแยกหน้าที่อย่างชัดเจนระหว่างโมดูล (Decoupling)

* **Team 06 เป็นเจ้าของ**: โมดูลการส่งงาน (`submissions`) และไฟล์การส่งงานใน Supabase Storage
* **Team 05 เป็นเจ้าของ**: ข้อมูลรายวิชา (`courses`), งานที่มอบหมาย (`assignments`), และความสัมพันธ์ระหว่างผู้เรียนกับวิชา (`student_courses`)

## 1.1 Authentication and Storage setup

ระบบสมัครสมาชิกใช้ Supabase Auth ผ่านหน้า `/signup` โดยไม่ต้องเพิ่มตารางผู้ใช้เอง
เพราะบัญชีจะถูกจัดเก็บใน `auth.users` ของ Supabase การสมัครอาจต้องยืนยันอีเมล
ก่อนเข้าสู่ระบบ ขึ้นอยู่กับค่า Email Confirmation ใน Supabase Auth settings

ให้รัน migration
`supabase/migrations/20260920000000_create_submissions_schema.sql`
ใน Supabase SQL Editor ก่อนใช้งานอัปโหลดไฟล์ เพื่อสร้าง bucket `submissions`
และ policies สำหรับผู้ใช้ที่ล็อกอินแล้ว

Bucket นี้รองรับไฟล์รูปภาพ เช่น PNG, JPG, JPEG, GIF และ WEBP รวมถึงไฟล์เอกสาร
โดยจำกัดขนาดไฟล์ 20 MB และเก็บเป็น private object เปิดดูผ่าน session ของเจ้าของไฟล์

---

## 2. Table Specifications: `public.submissions`

### Columns & Data Types
| Column Name | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `submission_id` | `UUID` | **NOT NULL** | `gen_random_uuid()` | Primary Key ระบุเอกลักษณ์ของแต่ละ Submission |
| `assignment_id` | `TEXT` | **NOT NULL** | - | รหัสอ้างอิง Assignment ของ Team 05 (ไม่มี Local Foreign Key) |
| `student_id` | `UUID` | **NOT NULL** | - | รหัสประจำตัวนักศึกษา อ้างอิงจาก `auth.users(id)` |
| `submission_type` | `TEXT` | **NOT NULL** | - | ประเภทการส่ง: `'FILE'` หรือ `'LINK'` |
| `file_name` | `TEXT` | `NULL` | - | ชื่อไฟล์ต้นฉบับ (ต้องมีเมื่อ `submission_type = 'FILE'`) |
| `file_path` | `TEXT` | `NULL` | - | Path จัดเก็บใน Supabase Storage (ต้องมีเมื่อ `submission_type = 'FILE'`) |
| `external_link` | `TEXT` | `NULL` | - | ลิงก์ภายนอก เช่น Google Drive, GitHub (ต้องมีเมื่อ `submission_type = 'LINK'`) |
| `submitted_at` | `TIMESTAMPTZ` | **NOT NULL** | `now()` | เวลาที่ทำการส่งงาน (UTC) |
| `cancelled_at` | `TIMESTAMPTZ` | `NULL` | - | เวลาที่ยกเลิกการส่ง (ถ้าเป็น `NULL` หมายถึงเป็น Active Submission) |
| `status` | `TEXT` | **NOT NULL** | - | สถานะตรงเวลา: `'ON_TIME'` หรือ `'LATE'` เท่านั้น |
| `client_request_id` | `TEXT` | `NULL` | - | Token สำหรับป้องกันการส่งซ้ำจาก Client (Idempotency Token) |

---

## 3. Business Rules & Constraints

### 3.1 Primary Key
* `submission_id` เป็น UUID สร้างอัตโนมัติด้วย `gen_random_uuid()`

### 3.2 Constraints
1. **`submissions_type_check`**:
   `CHECK (submission_type IN ('FILE', 'LINK'))`
2. **`submissions_status_check`**:
   `CHECK (status IN ('ON_TIME', 'LATE'))`
   * **สำคัญ**: ไม่มีสถานะ `'CANCELLED'` เพราะการยกเลิกการส่งงานถือเป็น Lifecycle State โดยบันทึกผ่านฟิลด์ `cancelled_at`
3. **`submissions_payload_check` (ความสอดคล้องระหว่าง File และ Link)**:
   * หาก `submission_type = 'FILE'` → ฟิลด์ `file_name` และ `file_path` ต้องไม่เป็น `NULL` และ `external_link` ต้องเป็น `NULL`
   * หาก `submission_type = 'LINK'` → ฟิลด์ `external_link` ต้องไม่เป็น `NULL` และ `file_name` กับ `file_path` ต้องเป็น `NULL`

### 3.3 Active vs Cancelled Submissions
* **Active Submission (การส่งที่ใช้งานอยู่)**: `cancelled_at IS NULL`
* **Cancelled Submission (การส่งที่ถูกยกเลิกแล้ว)**: `cancelled_at IS NOT NULL`
* นักศึกษาสามารถส่งงานซ้ำ (Resubmit) งานเดิมได้ไม่จำกัดจำนวนครั้ง โดยบันทึกประวัติเดิมไว้เพื่อ Traceability และกำหนดการส่งก่อนหน้าให้ `cancelled_at = now()`

---

## 4. Indexes & Performance Optimization

1. **`submissions_student_id_idx`**: `ON public.submissions (student_id)`
   * สำหรับดึงประวัติการส่งงานทั้งหมดของนักศึกษา
2. **`submissions_assignment_id_idx`**: `ON public.submissions (assignment_id)`
   * สำหรับการดึงรายการส่งงานทั้งหมดใน Assignment นั้น ๆ ของผู้สอน
3. **`submissions_student_assignment_idx`**: `ON public.submissions (student_id, assignment_id)`
   * สำหรับค้นหาการส่งงานของนักศึกษาใน Assignment ที่ระบุ
4. **`submissions_submitted_at_idx`**: `ON public.submissions (submitted_at DESC)`
   * สำหรับจัดเรียงตามลำดับเวลาล่าสุด
5. **`submissions_active_lookup_idx`** (Partial Index):
   `ON public.submissions (student_id, assignment_id) WHERE cancelled_at IS NULL`
   * เพิ่มความเร็วสูงสุดในการค้นหา "Active Submission ปัจจุบันของนักศึกษาในงานชิ้นนี้"
6. **`submissions_student_client_request_idx`** (Unique Partial Index):
   `ON public.submissions (student_id, client_request_id) WHERE client_request_id IS NOT NULL`
   * ป้องกันการส่งซ้ำ (Idempotency) จากการกดปุ่มซ้ำหรือเน็ตเวิร์กรีทราย โดยไม่กระทบสิทธิ์การส่งงานใหม่ (เพราะการส่งใหม่จะมี Request ID ใหม่)

---

## 5. Security & Row Level Security (RLS)

เปิดใช้งาน RLS (`ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;`)

* **Policy 1: SELECT**:
  * `Students can view own submissions`
  * เงื่อนไข: `USING (auth.uid() = student_id)`
  * นักศึกษาเห็นเฉพาะงานของตนเอง ไม่สามารถสอดแนมงานของผู้อื่นได้
* **Policy 2: INSERT**:
  * `Students can insert own submissions`
  * เงื่อนไข: `WITH CHECK (auth.uid() = student_id)`
  * นักศึกษาส่งงานได้เฉพาะในนามของตนเองเท่านั้น
* **Policy 3: UPDATE**:
  * `Students can update own submissions`
  * เงื่อนไข: `USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id)`
  * ใช้อนุญาตให้นักศึกษายกเลิกงานของตนเอง (ตั้งค่า `cancelled_at`)
* **Admin / Instructor Authorization**:
  * ตามข้อกำหนด RLS จะไม่อนุญาตแบบเหวี่ยงแหให้ผู้ใช้ทุกคนดูข้อมูลได้ สิทธิ์ของผู้สอน/แอดมินถือเป็น Dependency ภายนอกที่จะผูกผ่าน Custom Claims (`auth.jwt() ->> 'role' = 'admin'`) หรือ Role Service เมื่อสิทธิ์ได้รับการรับรองอย่างเป็นทางการ

---

## 6. ความสัมพันธ์กับ Team 05 & เหตุผลที่ไม่สร้าง Assignment Table ซ้ำ

```
Supabase Auth (Users)
        │
        │ student_id
        ▼
   submissions (Team 06)
        │
        │ assignment_id (TEXT, No local FK)
        ▼
Team 05 Assignment Service / Interface
        ├── assignment_id
        ├── title
        ├── description
        └── deadline
```

### เหตุผลที่ไม่สร้างตาราง `assignments` หรือ `courses` ในระบบ Team 06:
1. **Single Source of Truth**: Team 05 มีหน้าที่รับผิดชอบข้อมูล Course และ Assignment โดยตรง การสร้างตารางซ้ำจะนำไปสู่ปัญหา Data Inconsistency (เช่น การแก้ Deadline ใน Team 05 แต่ Team 06 ไม่ได้รับการอัปเดต)
2. **Loose Coupling**: ตาราง `submissions` ใช้เพียง `assignment_id` เป็น Reference Key ทำให้ทั้งสองระบบสามารถทำงานและพัฒนาแยกจากกันได้อย่างอิสระ
3. **Status Determination**: สถานะ `ON_TIME` หรือ `LATE` คำนวณจากการเปรียบเทียบ `submitted_at` กับ Deadline ของ Team 05 ในชั้น Business Logic เมื่อการส่งงานเสร็จสมบูรณ์ โดยไม่ต้องคัดลอก Deadline เข้ามาเก็บในตาราง `submissions`

---

## 7. Storage

* ไฟล์จริงของนักศึกษาจัดเก็บใน Supabase Storage Bucket ชื่อ `submissions`
* ตาราง `submissions` จัดเก็บเฉพาะ Metadata ได้แก่ `file_name` และ `file_path`
* Storage RLS บังคับให้นักศึกษาเข้าถึงและอัปโหลดได้เฉพาะในโฟลเดอร์รหัสนักศึกษาตนเอง: `submissions/{student_id}/*`
