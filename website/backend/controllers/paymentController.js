import { getAdminId, getParentUserId, getTherapistId } from '../utils/authContext.js';
import { sendErrorResponse } from '../utils/errorFeedback.js';
import {
  getPaymentByAppointmentId,
  listPaymentsAdmin,
  listPaymentsForParent,
  listPaymentsForTherapist,
  markAppointmentPaidByParent,
  SESSION_FEE_USD,
  updatePaymentStatusByAdmin,
} from '../services/paymentService.js';
import supabase from '../config/supabase.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getParentPaymentForAppointment(req, res) {
  try {
    const parentUserId = getParentUserId(req);
    const { appointmentId } = req.params;
    if (!appointmentId || !UUID_RE.test(appointmentId)) {
      return res.status(400).json({ message: 'Invalid appointment id.' });
    }

    const { data: appt, error: apptErr } = await supabase
      .from('appointments')
      .select('appointments_id')
      .eq('appointments_id', appointmentId)
      .eq('user_id', parentUserId)
      .maybeSingle();
    if (apptErr) throw apptErr;
    if (!appt) return res.status(404).json({ message: 'Appointment not found.' });

    const payment = await getPaymentByAppointmentId(appointmentId);
    return res.json({
      payment,
      session_fee_usd: SESSION_FEE_USD,
      is_paid: payment?.status === 'paid' || payment?.status === 'waived',
    });
  } catch (err) {
    return sendErrorResponse(res, err, err.status || 500);
  }
}

export async function payParentSession(req, res) {
  try {
    const parentUserId = getParentUserId(req);
    const { appointmentId } = req.params;
    if (!appointmentId || !UUID_RE.test(appointmentId)) {
      return res.status(400).json({ message: 'Invalid appointment id.' });
    }

    const { amount } = req.body || {};
    const payment = await markAppointmentPaidByParent(appointmentId, parentUserId, { amount });
    return res.json({ ok: true, payment });
  } catch (err) {
    return sendErrorResponse(res, err, err.status || 500);
  }
}

export async function listParentPayments(req, res) {
  try {
    const parentUserId = getParentUserId(req);
    const payments = await listPaymentsForParent(parentUserId);
    return res.json(payments);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
}

export async function listTherapistPayments(req, res) {
  try {
    const therapistId = getTherapistId(req);
    const payments = await listPaymentsForTherapist(therapistId);
    return res.json(payments);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
}

export async function listAdminPayments(req, res) {
  try {
    const status = req.query.status ? String(req.query.status).toLowerCase() : undefined;
    const therapistId = req.query.therapistId
      ? String(req.query.therapistId)
      : undefined;
    const limit = req.query.limit;
    const payments = await listPaymentsAdmin({ status, therapistId, limit });
    return res.json(payments);
  } catch (err) {
    return sendErrorResponse(res, err, 500);
  }
}

export async function patchAdminPayment(req, res) {
  try {
    const adminId = getAdminId(req);
    const { paymentId } = req.params;
    if (!paymentId || !UUID_RE.test(paymentId)) {
      return res.status(400).json({ message: 'Invalid payment id.' });
    }

    const { status, notes } = req.body || {};
    if (!status) {
      return res.status(400).json({ message: 'status is required.' });
    }

    const payment = await updatePaymentStatusByAdmin(paymentId, {
      status,
      adminId,
      notes,
    });
    return res.json({ ok: true, payment });
  } catch (err) {
    return sendErrorResponse(res, err, err.status || 500);
  }
}
