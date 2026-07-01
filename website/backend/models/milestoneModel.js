import supabase from '../config/supabase.js';

const MILESTONE_LIST_COLUMNS =
  'milestones_id, title, description, domain, age_months_min, age_months_max, age_range';

export const getAllMilestones = async (filters = {}) => {
  let query = supabase
    .from('milestones')
    .select(MILESTONE_LIST_COLUMNS);

  if (filters.domain) {
    query = query.eq('domain', filters.domain.toLowerCase());
  }

  const { data, error } = await query.order('age_months_min', { ascending: true });
  if (error) throw error;
  return data;
};

export const createMilestone = async (milestone) => {
  const { data, error } = await supabase
    .from('milestones')
    .insert([milestone])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateMilestone = async (milestonesId, updates) => {
  const { data, error } = await supabase
    .from('milestones')
    .update(updates)
    .eq('milestones_id', milestonesId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteMilestone = async (milestonesId) => {
  const { error } = await supabase
    .from('milestones')
    .delete()
    .eq('milestones_id', milestonesId);
  if (error) throw error;
};
