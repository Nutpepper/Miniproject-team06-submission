import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined in your environment.'
  );
}

// Ensure protocol exists for valid HTTP/HTTPS URL format if user supplies plain hostname/placeholder
const normalizedUrl =
  supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')
    ? supabaseUrl
    : `https://${supabaseUrl}`;

export const supabase: SupabaseClient = createClient(normalizedUrl, supabaseAnonKey);
