import supabase from '../config/supabase.js';
import { getTherapistId } from '../utils/authContext.js';
import { userFacingErrorMessage, sendErrorResponse } from '../utils/errorFeedback.js';
import { updateZoomMeeting } from '../services/zoom.service.js';
import {
  formatSlotDate,
  formatSlotHm,
  slotStartAfterNow,
  toStorageIso,
  validateSlotAgainstExisting,
  validateSlotDate,
  validateSlotTimeRange,
} from '../utils/slotTime.js';

const SLOT_COLUMNS = 'availability_id, therapist_id, start_time, end_time, is_booked, created_at';

function normalizeTime(raw) {
  const t = String(raw ?? '').trim();
  if (t.length === 5 && t.includes(':')) return `${t}:00`;
  return t;
}

function durationMinutesFromSlot(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  return diffMs > 0 ? Math.floor(diffMs / 60000) : 60;
}

async function syncZoomForBookedAppointmentsOnSlot(slotId, slot) {
  const { data: appts, error } = await supabase
    .from('appointments')
    .select('appointments_id, zoom_meeting_id, notes, status')
    .eq('availability_id', slotId)
    .eq('status', 'confirmed')
    .not('zoom_meeting_id', 'is', null);
  if (error) throw error;
  const timezone = process.env.ZOOM_TIMEZONE || 'Asia/Beirut';
  for (const appt of appts || []) {
    try {
      await updateZoomMeeting(appt.zoom_meeting_id, {
        topic: appt.notes || 'Therapy Session',
        startTime: new Date(slot.start_time).toISOString(),
        duration: durationMinutesFromSlot(slot.start_time, slot.end_time),
        timezone,
      });
    } catch (zoomErr) {
      console.warn(
        `⚠️  Zoom updateZoomMeeting failed for appointment ${appt.appointments_id}:`,
        zoomErr?.message || zoomErr,
      );
    }
  }
}

export async function createAvailabilitySlot(req, res) {
  try {
    const therapistId = getTherapistId(req);
    let { slot_date, start_time, end_time } = req.body || {};

    if (!slot_date || !start_time || !end_time) {
      return res
        .status(400)
        .json({ message: 'slot_date, start_time, and end_time are required.' });
    }

    start_time = normalizeTime(start_time);
    end_time = normalizeTime(end_time);
    if (!start_time || !end_time) {
      return res.status(400).json({ message: 'Invalid start_time/end_time.' });
    }

    const dateCheck = validateSlotDate(slot_date);
    if (!dateCheck.ok) {
      return res.status(400).json({ message: dateCheck.message });
    }
    slot_date = dateCheck.dateStr;

    const timeCheck = validateSlotTimeRange(start_time, end_time);
    if (!timeCheck.ok) {
      return res.status(400).json({ message: timeCheck.message });
    }
    if (!slotStartAfterNow(slot_date, start_time)) {
      return res.status(400).json({ message: 'Start time must be later than the current time.' });
    }

    const { data: sameDaySlots, error: listErr } = await supabase
      .from('availability')
      .select('availability_id, start_time, end_time')
      .eq('therapist_id', therapistId)
      .gte('start_time', `${slot_date}T00:00:00`)
      .lte('start_time', `${slot_date}T23:59:59`);
    if (listErr) throw listErr;
    const conflictCheck = validateSlotAgainstExisting(
      sameDaySlots || [],
      slot_date,
      start_time,
      end_time,
    );
    if (!conflictCheck.ok) {
      return res.status(409).json({ message: conflictCheck.message });
    }

    const { data, error } = await supabase
      .from('availability')
      .insert({
        therapist_id: therapistId,
        start_time: toStorageIso(slot_date, start_time),
        end_time: toStorageIso(slot_date, end_time),
        is_booked: false,
      })
      .select(SLOT_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'That slot already exists for this therapist.' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    sendErrorResponse(res, err, 500);
  }
}

export async function listMyAvailability(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const { data, error } = await supabase
      .from('availability')
      .select(SLOT_COLUMNS)
      .eq('therapist_id', therapistId)
      .order('start_time', { ascending: true })
      .limit(200);

    if (error) throw error;
    const mapped = (data || []).map((r) => {
      const startHm = formatSlotHm(r.start_time);
      const endHm = formatSlotHm(r.end_time);
      return {
        ...r,
        slot_date: formatSlotDate(r.start_time),
        start_time: startHm ? `${startHm}:00` : '',
        end_time: endHm ? `${endHm}:00` : '',
      };
    });
    res.json(mapped);
  } catch (err) {
    console.error(err);
    sendErrorResponse(res, err, 500);
  }
}

export async function updateAvailabilitySlot(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const slotId = req.params.availability_id || req.params.id;
    let { slot_date, start_time, end_time } = req.body || {};
    if (!slot_date || !start_time || !end_time) {
      return res
        .status(400)
        .json({ message: 'slot_date, start_time, and end_time are required.' });
    }

    start_time = normalizeTime(start_time);
    end_time = normalizeTime(end_time);
    const dateCheck = validateSlotDate(slot_date);
    if (!dateCheck.ok) {
      return res.status(400).json({ message: dateCheck.message });
    }
    slot_date = dateCheck.dateStr;

    const timeCheck = validateSlotTimeRange(start_time, end_time);
    if (!timeCheck.ok) {
      return res.status(400).json({ message: timeCheck.message });
    }
    if (!slotStartAfterNow(slot_date, start_time)) {
      return res.status(400).json({ message: 'Start time must be later than the current time.' });
    }

    const { data: sameDaySlots, error: listErr } = await supabase
      .from('availability')
      .select('availability_id, start_time, end_time')
      .eq('therapist_id', therapistId)
      .gte('start_time', `${slot_date}T00:00:00`)
      .lte('start_time', `${slot_date}T23:59:59`);
    if (listErr) throw listErr;
    const conflictCheck = validateSlotAgainstExisting(
      sameDaySlots || [],
      slot_date,
      start_time,
      end_time,
      slotId,
    );
    if (!conflictCheck.ok) {
      return res.status(409).json({ message: conflictCheck.message });
    }

    const check = await supabase
      .from('availability')
      .select('availability_id, is_booked')
      .eq('availability_id', slotId)
      .eq('therapist_id', therapistId)
      .maybeSingle();
    if (check.error) throw check.error;
    if (!check.data) return res.status(404).json({ message: 'Slot not found.' });

    const upd = await supabase
      .from('availability')
      .update({
        start_time: toStorageIso(slot_date, start_time),
        end_time: toStorageIso(slot_date, end_time),
      })
      .eq('availability_id', slotId)
      .eq('therapist_id', therapistId)
      .select(SLOT_COLUMNS)
      .single();
    if (upd.error) throw upd.error;

    try {
      await syncZoomForBookedAppointmentsOnSlot(slotId, upd.data);
    } catch (zoomSyncErr) {
      console.warn('⚠️  Zoom sync after slot update failed:', zoomSyncErr?.message || zoomSyncErr);
    }

    return res.json(upd.data);
  } catch (err) {
    console.error(err);
    return sendErrorResponse(res, err, 500);
  }
}

export async function deleteAvailabilitySlot(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const slotId = req.params.availability_id || req.params.id;
    const check = await supabase
      .from('availability')
      .select('availability_id, is_booked')
      .eq('availability_id', slotId)
      .eq('therapist_id', therapistId)
      .maybeSingle();
    if (check.error) throw check.error;
    if (!check.data) return res.status(404).json({ message: 'Slot not found.' });

    const del = await supabase
      .from('availability')
      .delete()
      .eq('availability_id', slotId)
      .eq('therapist_id', therapistId);
    if (del.error) throw del.error;
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return sendErrorResponse(res, err, 500);
  }
}
