-- ==============================================================================
-- TEAM 06 — SUBMISSION MODULE DATABASE SCHEMA
-- Target Database: Supabase (PostgreSQL 15+)
-- Module Responsibility: Submission Module only
-- External Dependencies: Team 05 owns Course, Assignment, and Student-Course mappings
-- ==============================================================================

-- 0. User roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_roles_role_check CHECK (role IN ('student', 'admin'))
);

CREATE INDEX IF NOT EXISTS user_roles_email_idx ON public.user_roles (lower(email));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = auth.uid()
    LIMIT 1;
$$;

INSERT INTO public.user_roles (user_id, email)
SELECT id, email
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

UPDATE public.user_roles
SET role = 'admin',
    updated_at = now()
WHERE lower(email) = 'admin@gmail.com';

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_roles (user_id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 1. Create Submissions Table
CREATE TABLE IF NOT EXISTS public.submissions (
    submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id TEXT NOT NULL,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    submission_type TEXT NOT NULL,
    file_name TEXT,
    file_path TEXT,
    external_link TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at TIMESTAMPTZ,
    status TEXT NOT NULL,
    client_request_id TEXT,

    -- Constraint: Allowed submission types
    CONSTRAINT submissions_type_check 
        CHECK (submission_type IN ('FILE', 'LINK')),

    -- Constraint: Allowed statuses (CANCELLED is NOT a status; soft cancellation uses cancelled_at)
    CONSTRAINT submissions_status_check 
        CHECK (status IN ('ON_TIME', 'LATE')),

    -- Constraint: Mutual exclusivity and mandatory fields for FILE vs LINK
    CONSTRAINT submissions_payload_check CHECK (
        (
            submission_type = 'FILE'
            AND file_name IS NOT NULL
            AND file_path IS NOT NULL
            AND external_link IS NULL
        )
        OR
        (
            submission_type = 'LINK'
            AND external_link IS NOT NULL
            AND file_name IS NULL
            AND file_path IS NULL
        )
    )
);

-- Comments on Table & Columns for Documentation and Schema Clarity
COMMENT ON TABLE public.submissions IS 'Team 06 Submission Module: records student assignment submissions';
COMMENT ON COLUMN public.submissions.submission_id IS 'Unique identifier for each submission (UUID)';
COMMENT ON COLUMN public.submissions.assignment_id IS 'Reference ID to Team 05 Assignment (No local FK constraint)';
COMMENT ON COLUMN public.submissions.student_id IS 'Reference to authenticated user (auth.users.id)';
COMMENT ON COLUMN public.submissions.submission_type IS 'Submission format: FILE or LINK';
COMMENT ON COLUMN public.submissions.file_name IS 'Original file name when type is FILE (NULL for LINK)';
COMMENT ON COLUMN public.submissions.file_path IS 'Storage path in Supabase Storage when type is FILE (NULL for LINK)';
COMMENT ON COLUMN public.submissions.external_link IS 'URL link when type is LINK (NULL for FILE)';
COMMENT ON COLUMN public.submissions.submitted_at IS 'Timestamp of submission completion (TIMESTAMPTZ, default now())';
COMMENT ON COLUMN public.submissions.cancelled_at IS 'Timestamp of cancellation (NULL indicates current active submission)';
COMMENT ON COLUMN public.submissions.status IS 'Timing status: ON_TIME or LATE only';
COMMENT ON COLUMN public.submissions.client_request_id IS 'Client idempotency token to prevent duplicate submissions from retries/double-clicks';

-- ==============================================================================
-- 2. Indexes
-- ==============================================================================

-- Index for queries filtering by student
CREATE INDEX IF NOT EXISTS submissions_student_id_idx 
    ON public.submissions (student_id);

-- Index for queries filtering by assignment
CREATE INDEX IF NOT EXISTS submissions_assignment_id_idx 
    ON public.submissions (assignment_id);

-- Composite index for student + assignment lookups
CREATE INDEX IF NOT EXISTS submissions_student_assignment_idx 
    ON public.submissions (student_id, assignment_id);

-- Index for ordering submissions by submission time
CREATE INDEX IF NOT EXISTS submissions_submitted_at_idx 
    ON public.submissions (submitted_at DESC);

-- Partial index for active submissions (cancelled_at IS NULL)
CREATE INDEX IF NOT EXISTS submissions_active_lookup_idx 
    ON public.submissions (student_id, assignment_id) 
    WHERE cancelled_at IS NULL;

-- Idempotency protection: prevents duplicate records from repeated client requests/retries
-- Note: Student CAN still resubmit the same assignment unlimited times with new request IDs
CREATE UNIQUE INDEX IF NOT EXISTS submissions_student_client_request_idx 
    ON public.submissions (student_id, client_request_id) 
    WHERE client_request_id IS NOT NULL;

-- ==============================================================================
-- 3. Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'admin'
    );
$$;

DROP POLICY IF EXISTS "Students can view own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students can insert own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students can update own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.submissions;

-- Student RLS: SELECT own submissions only
CREATE POLICY "Students can view own submissions"
    ON public.submissions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = student_id);

-- Student RLS: INSERT own submissions only
CREATE POLICY "Students can insert own submissions"
    ON public.submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = student_id);

-- Student RLS: UPDATE own submissions only (e.g. to set cancelled_at)
CREATE POLICY "Students can update own submissions"
    ON public.submissions
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Admins can view all submissions"
    ON public.submissions
    FOR SELECT
    TO authenticated
    USING (public.is_admin_user());

-- NOTE ON ADMIN / TEACHING STAFF ACCESS:
-- In accordance with Team 06 PRD specification, Admin/Instructor authorization
-- is an external dependency (Team 05/Auth role mapping).
-- To prevent unauthorized data exposure, no permissive public/authenticated
-- policies are opened. When admin role claims (e.g., custom claims or role table)
-- are finalized, an admin policy can be attached, e.g.:
--   CREATE POLICY "Instructors can view course submissions"
--     ON public.submissions FOR SELECT TO authenticated
--     USING ((auth.jwt() ->> 'role') = 'admin');

-- ==============================================================================
-- 4. Supabase Storage Bucket Configuration (Optional / Infrastructure Support)
-- ==============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'storage' AND table_name = 'buckets'
    ) THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('submissions', 'submissions', false)
        ON CONFLICT (id) DO NOTHING;

        UPDATE storage.buckets
        SET public = false,
            file_size_limit = 20971520,
            allowed_mime_types = NULL
        WHERE id = 'submissions';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'storage' AND table_name = 'objects'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'storage' 
              AND tablename = 'objects' 
              AND policyname = 'Students can upload submission files to own folder'
        ) THEN
            CREATE POLICY "Students can upload submission files to own folder"
                ON storage.objects
                FOR INSERT
                TO authenticated
                WITH CHECK (
                    bucket_id = 'submissions'
                    AND (storage.foldername(name))[1] = auth.uid()::text
                );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'storage' 
              AND tablename = 'objects' 
              AND policyname = 'Students can view own submission files'
        ) THEN
            CREATE POLICY "Students can view own submission files"
                ON storage.objects
                FOR SELECT
                TO authenticated
                USING (
                    bucket_id = 'submissions'
                    AND (storage.foldername(name))[1] = auth.uid()::text
                );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'storage'
              AND tablename = 'objects'
              AND policyname = 'Students can delete own submission files'
        ) THEN
            CREATE POLICY "Students can delete own submission files"
                ON storage.objects
                FOR DELETE
                TO authenticated
                USING (
                    bucket_id = 'submissions'
                    AND (storage.foldername(name))[1] = auth.uid()::text
                );
        END IF;
    END IF;
END $$;
