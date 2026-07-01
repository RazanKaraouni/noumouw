import supabase from '../config/supabase.js';

const THERAPIST_PUBLIC_COLUMNS =
  'therapist_id, user_id, full_name, email, profession, bio, phone, address, years_of_experience, profile_image_url, created_at';

const THERAPIST_OWN_PROFILE_COLUMNS =
  'therapist_id, user_id, full_name, email, profession, bio, phone, address, years_of_experience, online_consultation, profile_image_url, created_at';

const THERAPIST_ADMIN_COLUMNS =
  'therapist_id, user_id, full_name, email, profession, bio, phone, address, years_of_experience, profile_image_url, is_suspended, suspended_at, online_consultation, is_verified, created_at';

/** Smaller payload for `/api/therapists-directory` (drops internal auth linkage). */
const THERAPIST_DIRECTORY_COLUMNS =
  'therapist_id, full_name, email, profession, bio, phone, address, years_of_experience, profile_image_url, created_at';

const THERAPIST_FULL_COLUMNS =
  'therapist_id, user_id, full_name, email, password, profession, bio, phone, address, years_of_experience, profile_image_url, is_verified, password_setup_token_hash, password_setup_expires_at, is_suspended, suspended_at, online_consultation, created_at';

const THERAPIST_AUTH_COLUMNS =
  'therapist_id, full_name, email, password, password_setup_token_hash, password_setup_expires_at, is_suspended';

export const findTherapistByEmail = async (email) => {
  const { data, error } = await supabase
    .from('therapists')
    .select(THERAPIST_AUTH_COLUMNS)
    .eq('email', email)
    .single();

  if (error) return null;
  return data;
};

export const getTherapistAuthById = async (therapistId) => {
  const { data, error } = await supabase
    .from('therapists')
    .select(THERAPIST_AUTH_COLUMNS)
    .eq('therapist_id', therapistId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getTherapistById = async (therapistId) => {
  const { data, error } = await supabase
    .from('therapists')
    .select(THERAPIST_PUBLIC_COLUMNS)
    .eq('therapist_id', therapistId)
    .single();
  if (error) throw error;
  return data;
};

export const getTherapistOwnProfile = async (therapistId) => {
  const { data, error } = await supabase
    .from('therapists')
    .select(THERAPIST_OWN_PROFILE_COLUMNS)
    .eq('therapist_id', therapistId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const updateTherapistOwnProfile = async (therapistId, updates) => {
  const { data, error } = await supabase
    .from('therapists')
    .update(updates)
    .eq('therapist_id', therapistId)
    .select(THERAPIST_OWN_PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
};

export const getAllTherapists = async () => {
  const { data, error } = await supabase
    .from('therapists')
    .select(THERAPIST_PUBLIC_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const getAllTherapistsAdmin = async () => {
  const { data, error } = await supabase
    .from('therapists')
    .select(THERAPIST_ADMIN_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

/** Public directory for parent app — no password column. */
export const getTherapistsDirectory = async () => {
  const { data, error } = await supabase
    .from('therapists')
    .select(THERAPIST_DIRECTORY_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createTherapist = async (therapist) => {
  const { data, error } = await supabase
    .from('therapists')
    .insert([therapist])
    .select(THERAPIST_ADMIN_COLUMNS)
    .single();

  if (error) throw error;
  return data;
};

export const deleteTherapist = async (therapistId) => {
  const { error } = await supabase
    .from('therapists')
    .delete()
    .eq('therapist_id', therapistId);

  if (error) throw error;
};

export const updateTherapist = async (therapistId, updates) => {
  const { data, error } = await supabase
    .from('therapists')
    .update(updates)
    .eq('therapist_id', therapistId)
    .select(THERAPIST_ADMIN_COLUMNS)
    .single();

  if (error) throw error;
  return data;
};

export const suspendTherapistById = async (therapistId) => {
  const stamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('therapists')
    .update({ is_suspended: true, suspended_at: stamp })
    .eq('therapist_id', therapistId)
    .select(THERAPIST_ADMIN_COLUMNS)
    .single();

  if (error) throw error;
  return data;
};

export const reactivateTherapistById = async (therapistId) => {
  const { data, error } = await supabase
    .from('therapists')
    .update({ is_suspended: false, suspended_at: null })
    .eq('therapist_id', therapistId)
    .select(THERAPIST_ADMIN_COLUMNS)
    .single();

  if (error) throw error;
  return data;
};

export const setTherapistPasswordSetupToken = async (therapistId, tokenHash, expiresAt) => {
  const { data, error } = await supabase
    .from('therapists')
    .update({
      password_setup_token_hash: tokenHash,
      password_setup_expires_at: expiresAt,
    })
    .eq('therapist_id', therapistId)
    .select('therapist_id')
    .single();

  if (error) throw error;
  return data;
};

export const findTherapistByPasswordSetupTokenHash = async (tokenHash) => {
  const { data, error } = await supabase
    .from('therapists')
    .select(THERAPIST_AUTH_COLUMNS)
    .eq('password_setup_token_hash', tokenHash)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const updateTherapistPassword = async (therapistId, passwordHash) => {
  const { data, error } = await supabase
    .from('therapists')
    .update({
      password: passwordHash,
      password_setup_token_hash: null,
      password_setup_expires_at: null,
    })
    .eq('therapist_id', therapistId)
    .select('therapist_id')
    .single();

  if (error) throw error;
  return data;
};

export const getStats = async () => {
  const { count: therapistsCount } = await supabase
    .from('therapists')
    .select('therapist_id', { count: 'exact', head: true });

  const { count: usersCount } = await supabase
    .from('parents')
    .select('parent_id', { count: 'exact', head: true });

  const { count: childrenCount } = await supabase
    .from('children')
    .select('children_id', { count: 'exact', head: true });

  return {
    usersCount: usersCount ?? 0,
    therapistsCount: therapistsCount ?? 0,
    childrenCount: childrenCount ?? 0,
  };
};
