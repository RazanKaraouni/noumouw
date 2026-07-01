import supabase from '../config/supabase.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';

export const listProfiles = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('parents')
      .select('parent_id, user_id, full_name, email, gender, age, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    sendErrorResponse(res, err, 500);
  }
};
