import { supabase } from '../lib/supabaseClient.js';
import { getErrorMessage } from '../utils/errorMessages.js';

/**
 * Run a Supabase query with consistent error handling for the admin dashboard.
 * @param {() => Promise<{ data: unknown, error: import('@supabase/supabase-js').PostgrestError | null }>} queryFn
 */
export async function runSupabaseQuery(queryFn) {
  try {
    const { data, error } = await queryFn();
    if (error) throw error;
    return data;
  } catch (err) {
    const message = getErrorMessage(err);
    const wrapped = new Error(message);
    wrapped.cause = err;
    throw wrapped;
  }
}

/** @param {string} table */
export function fromTable(table) {
  return supabase.from(table);
}

export { supabase };
