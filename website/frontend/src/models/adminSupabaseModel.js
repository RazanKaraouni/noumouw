import api from '../services/axios.js';
import { fromTable, runSupabaseQuery } from '../services/adminSupabaseQuery.js';

/**
 * Supabase-js data access for admin dashboard tables.
 * Falls back to authenticated REST API when RLS blocks direct client access.
 */
async function withApiFallback(supabaseFn, apiFn) {
  try {
    return await runSupabaseQuery(supabaseFn);
  } catch {
    const { data } = await apiFn();
    return data;
  }
}

export const adminSupabaseModel = {
  milestones: {
    list: () =>
      withApiFallback(
        () => fromTable('milestones').select('*').order('milestones_id', { ascending: true }),
        () => api.get('/milestones'),
      ),
    create: (payload) =>
      withApiFallback(
        () => fromTable('milestones').insert(payload).select('*').single(),
        () => api.post('/milestones', payload),
      ),
    update: (id, payload) =>
      withApiFallback(
        () =>
          fromTable('milestones').update(payload).eq('milestones_id', id).select('*').single(),
        () => api.put(`/milestones/${id}`, payload),
      ),
    remove: (id) =>
      withApiFallback(
        () => fromTable('milestones').delete().eq('milestones_id', id),
        () => api.delete(`/milestones/${id}`),
      ),
  },
  activities: {
    list: (params) =>
      withApiFallback(
        () => {
          let q = fromTable('activity_library').select('*').order('created_at', { ascending: false });
          if (params?.domain) q = q.eq('domain', params.domain);
          return q;
        },
        () => api.get('/activities', { params }),
      ),
    create: (payload) =>
      withApiFallback(
        () => fromTable('activity_library').insert(payload).select('*').single(),
        () => api.post('/activities', payload),
      ),
    update: (id, payload) =>
      withApiFallback(
        () =>
          fromTable('activity_library').update(payload).eq('activity_id', id).select('*').single(),
        () => api.put(`/activities/${id}`, payload),
      ),
    remove: (id) =>
      withApiFallback(
        () => fromTable('activity_library').delete().eq('activity_id', id),
        () => api.delete(`/activities/${id}`),
      ),
  },
  autismQuestions: {
    list: () =>
      withApiFallback(
        () =>
          fromTable('autism_questions')
            .select('*')
            .order('question_number', { ascending: true }),
        () => api.get('/autism/questions'),
      ),
    create: (payload) =>
      withApiFallback(
        () => fromTable('autism_questions').insert(payload).select('*').single(),
        () => api.post('/autism/questions', payload),
      ),
    update: (id, payload) =>
      withApiFallback(
        () =>
          fromTable('autism_questions')
            .update(payload)
            .eq('autism_qs_id', id)
            .select('*')
            .single(),
        () => api.put(`/autism/questions/${id}`, payload),
      ),
    remove: (id) =>
      withApiFallback(
        () => fromTable('autism_questions').delete().eq('autism_qs_id', id),
        () => api.delete(`/autism/questions/${id}`),
      ),
  },
  announcements: {
    list: () =>
      withApiFallback(
        () =>
          fromTable('announcements')
            .select('announcement_id, admin_id, title, body, target_audience, sent_at, created_at')
            .order('sent_at', { ascending: false }),
        () => api.get('/admin/announcements'),
      ),
    create: (payload) => api.post('/admin/announcements', payload).then((r) => r.data),
    remove: (id) => api.delete(`/admin/announcements/${id}`).then((r) => r.data),
  },
  resources: {
    list: () =>
      withApiFallback(
        () =>
          fromTable('resources')
            .select(
              'resources_id, title, content_type, body_text, media_url, domain, age_range, is_public, created_at, therapist_id, publisher',
            )
            .order('created_at', { ascending: false }),
        () => api.get('/admin/resources'),
      ),
  },
};
