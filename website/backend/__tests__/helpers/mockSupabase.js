/**
 * Minimal Supabase client mock for authorization integration tests.
 * Returns empty results unless a table-specific override is configured.
 */

/**
 * @param {Record<string, (filters: [string, unknown][]) => { data: unknown, error: null }>} [overrides]
 */
export function createAuthzTestSupabase(overrides = {}) {
  function resolve(table, filters) {
    if (overrides[table]) {
      return overrides[table](filters);
    }
    if (table === 'therapists') {
      return { data: { is_suspended: false }, error: null };
    }
    if (table === 'parents') {
      return { data: { is_suspended: false }, error: null };
    }
    if (table === 'email_blocklist') {
      return { data: null, error: null };
    }
    if (table === 'audit_log') {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }

  function from(table) {
    const state = { table, filters: [] };

    const builder = {
      select() {
        return builder;
      },
      eq(column, value) {
        state.filters.push([column, value]);
        return builder;
      },
      in() {
        return builder;
      },
      limit() {
        return builder;
      },
      order() {
        return builder;
      },
      maybeSingle() {
        return Promise.resolve(resolve(state.table, state.filters));
      },
      single() {
        return builder.maybeSingle();
      },
      insert() {
        return Promise.resolve({ error: null });
      },
      then(onFulfilled, onRejected) {
        const listResult =
          state.table === 'appointments'
            ? { data: [], error: null }
            : resolve(state.table, state.filters);
        return Promise.resolve(listResult).then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  return {
    from,
    auth: {
      getUser: async () => ({ data: { user: null }, error: new Error('not configured') }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/file' } }),
      }),
    },
  };
}
