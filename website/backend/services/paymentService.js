import supabase from '../config/supabase.js';

export const SESSION_FEE_USD = 25.0;
export const SESSION_FEE_CURRENCY = 'USD';

const PAYMENT_COLUMNS =
  'payment_id, appointment_id, child_id, therapist_id, parent_user_id, amount, currency, status, paid_at, created_at, updated_at';

async function enrichPaymentRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];

  const appointmentIds = [...new Set(list.map((r) => r.appointment_id).filter(Boolean))];
  const therapistIds = [...new Set(list.map((r) => r.therapist_id).filter(Boolean))];
  const parentIds = [...new Set(list.map((r) => r.parent_user_id).filter(Boolean))];
  const childIds = [...new Set(list.map((r) => r.child_id).filter((id) => id != null))];

  const [appointmentsRes, therapistsRes, parentsRes, childrenRes] = await Promise.all([
    appointmentIds.length
      ? supabase
          .from('appointments')
          .select('appointments_id, appointment_date, status')
          .in('appointments_id', appointmentIds)
      : Promise.resolve({ data: [], error: null }),
    therapistIds.length
      ? supabase
          .from('therapists')
          .select('therapist_id, full_name')
          .in('therapist_id', therapistIds)
      : Promise.resolve({ data: [], error: null }),
    parentIds.length
      ? supabase
          .from('parents')
          .select('user_id, full_name, email')
          .in('user_id', parentIds)
      : Promise.resolve({ data: [], error: null }),
    childIds.length
      ? supabase
          .from('children')
          .select('children_id, full_name')
          .in('children_id', childIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (appointmentsRes.error) throw appointmentsRes.error;
  if (therapistsRes.error) throw therapistsRes.error;
  if (parentsRes.error) throw parentsRes.error;
  if (childrenRes.error) throw childrenRes.error;

  const appointmentById = Object.fromEntries(
    (appointmentsRes.data || []).map((a) => [a.appointments_id, a]),
  );
  const therapistById = Object.fromEntries(
    (therapistsRes.data || []).map((t) => [t.therapist_id, t]),
  );
  const parentById = Object.fromEntries(
    (parentsRes.data || []).map((p) => [p.user_id, p]),
  );
  const childById = Object.fromEntries(
    (childrenRes.data || []).map((c) => [c.children_id, c]),
  );

  return list.map((row) => {
    const appt = appointmentById[row.appointment_id] || {};
    const therapist = therapistById[row.therapist_id] || {};
    const parent = parentById[row.parent_user_id] || {};
    const child = row.child_id != null ? childById[row.child_id] : null;
    return {
      ...row,
      appointment_date: appt.appointment_date ?? null,
      appointment_status: appt.status ?? null,
      therapist_name: (therapist.full_name || '').trim() || null,
      parent_name: (parent.full_name || '').trim() || null,
      parent_email: (parent.email || '').trim() || null,
      child_name: (child?.full_name || '').trim() || null,
    };
  });
}

/**
 * Create or return the pending payment row for a completed appointment.
 * @param {object} appointment — appointments row (needs appointments_id, therapist_id, user_id, child_id)
 */
export async function ensurePendingPaymentForAppointment(appointment) {
  const appointmentId = appointment?.appointments_id;
  if (!appointmentId) return null;

  const { data: existing, error: fetchErr } = await supabase
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (existing) return existing;

  const nowIso = new Date().toISOString();
  const { data: inserted, error: insertErr } = await supabase
    .from('payments')
    .insert({
      appointment_id: appointmentId,
      child_id: appointment.child_id ?? null,
      therapist_id: appointment.therapist_id,
      parent_user_id: appointment.user_id,
      amount: SESSION_FEE_USD,
      currency: SESSION_FEE_CURRENCY,
      status: 'pending',
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select(PAYMENT_COLUMNS)
    .single();
  if (insertErr) throw insertErr;
  return inserted;
}

export async function getPaymentByAppointmentId(appointmentId) {
  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPaymentById(paymentId) {
  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .eq('payment_id', paymentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Parent submits mock card payment — marks row paid (no card data stored).
 */
export async function markAppointmentPaidByParent(appointmentId, parentUserId, { amount } = {}) {
  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .select('appointments_id, user_id, therapist_id, child_id, status')
    .eq('appointments_id', appointmentId)
    .maybeSingle();
  if (apptErr) throw apptErr;
  if (!appt || appt.user_id !== parentUserId) {
    const err = new Error('Appointment not found.');
    err.status = 404;
    throw err;
  }

  let payment = await getPaymentByAppointmentId(appointmentId);
  if (!payment) {
    payment = await ensurePendingPaymentForAppointment(appt);
  }
  if (!payment) {
    const err = new Error('Payment record could not be created.');
    err.status = 500;
    throw err;
  }

  if (payment.status === 'paid') return payment;

  if (amount != null) {
    const expected = Number(payment.amount);
    const submitted = Number(amount);
    if (!Number.isFinite(submitted) || Math.abs(submitted - expected) > 0.001) {
      const err = new Error(`Amount must be exactly $${expected.toFixed(2)}.`);
      err.status = 400;
      throw err;
    }
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      paid_at: nowIso,
      updated_at: nowIso,
    })
    .eq('payment_id', payment.payment_id)
    .eq('parent_user_id', parentUserId)
    .select(PAYMENT_COLUMNS)
    .single();
  if (updateErr) throw updateErr;
  return updated;
}

export async function listPaymentsForParent(parentUserId) {
  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .eq('parent_user_id', parentUserId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return enrichPaymentRows(data || []);
}

export async function listPaymentsForTherapist(therapistId) {
  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .eq('therapist_id', therapistId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return enrichPaymentRows(data || []);
}

export async function listPaymentsAdmin({ status, therapistId, limit = 100 } = {}) {
  let query = supabase
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(limit) || 100, 500));

  if (status) query = query.eq('status', status);
  if (therapistId) query = query.eq('therapist_id', therapistId);

  const { data, error } = await query;
  if (error) throw error;
  return enrichPaymentRows(data || []);
}

export async function updatePaymentStatusByAdmin(paymentId, { status, adminId, notes } = {}) {
  const allowed = new Set(['waived', 'refunded', 'paid', 'pending', 'failed']);
  const next = String(status || '').toLowerCase();
  if (!allowed.has(next)) {
    const err = new Error('Invalid payment status.');
    err.status = 400;
    throw err;
  }

  const patch = {
    status: next,
    updated_at: new Date().toISOString(),
  };
  if (next === 'paid' || next === 'waived') patch.paid_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('payments')
    .update(patch)
    .eq('payment_id', paymentId)
    .select(PAYMENT_COLUMNS)
    .single();
  if (error) throw error;
  if (!data) {
    const err = new Error('Payment not found.');
    err.status = 404;
    throw err;
  }
  return data;
}
