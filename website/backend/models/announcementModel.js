import supabase from '../config/supabase.js';

const LIST_COLUMNS =
  'announcement_id, admin_id, title, body, target_audience, sent_at, created_at';

const TARGET_AUDIENCES = new Set(['all_users', 'parents_only', 'therapists_only']);

export function normalizeTargetAudience(value) {
  const raw = String(value || '').trim().toLowerCase();
  const map = {
    all: 'all_users',
    'all users': 'all_users',
    all_users: 'all_users',
    parents: 'parents_only',
    'parents only': 'parents_only',
    parents_only: 'parents_only',
    therapists: 'therapists_only',
    'therapists only': 'therapists_only',
    therapists_only: 'therapists_only',
  };
  return map[raw] || null;
}

export function targetAudienceLabel(audience) {
  switch (audience) {
    case 'all_users':
      return 'All Users';
    case 'parents_only':
      return 'Parents Only';
    case 'therapists_only':
      return 'Therapists Only';
    default:
      return audience || '—';
  }
}

export const listAnnouncements = async () => {
  const { data, error } = await supabase
    .from('announcements')
    .select(LIST_COLUMNS)
    .order('sent_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createAnnouncement = async ({ admin_id, title, body, target_audience }) => {
  const audience = normalizeTargetAudience(target_audience);
  if (!TARGET_AUDIENCES.has(audience)) {
    throw new Error('Invalid target_audience.');
  }

  const titleText = String(title || '').trim();
  const bodyText = String(body || '').trim();
  if (!titleText) throw new Error('Title is required.');
  if (!bodyText) throw new Error('Body is required.');
  if (!admin_id) throw new Error('admin_id is required.');

  const stamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      admin_id,
      title: titleText,
      body: bodyText,
      target_audience: audience,
      sent_at: stamp,
      created_at: stamp,
    })
    .select(LIST_COLUMNS)
    .single();

  if (error) throw error;
  return data;
};

export const deleteAnnouncementById = async (announcementId) => {
  const { data, error } = await supabase
    .from('announcements')
    .delete()
    .eq('announcement_id', announcementId)
    .select('announcement_id')
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
};
