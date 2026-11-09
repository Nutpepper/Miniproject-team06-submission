import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns a server-side Supabase client for integration endpoints.
 * Uses SUPABASE_SERVICE_ROLE_KEY so server integrations never depend on a
 * real user's credentials or password.
 */
export async function getIntegrationSupabaseClient(): Promise<SupabaseClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === 'server-only-service-role-key') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing on the server.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
