import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// SERVICE ROLE: justified because this client bypasses RLS for admin operations,
// auth.admin user management, moderation cascades, and other server-only tasks.
// Parent-facing routes must use createUserSupabase() via getParentSupabase(req).
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!process.env.SUPABASE_URL || !serviceKey) {
  console.warn(
    '[supabase] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) must be set for storage and DB.'
  );
}

const supabase = createClient(process.env.SUPABASE_URL || '', serviceKey || '');

export default supabase;