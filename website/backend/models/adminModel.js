import supabase from '../config/supabase.js';

export const findAdminByEmail = async (email) => {
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .eq('email', email)
    .single();

  if (error) return null;
  return data;
};

export const findAdminById = async (adminId) => {
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .eq('admin_id', adminId)
    .single();

  if (error) return null;
  return data;
};
