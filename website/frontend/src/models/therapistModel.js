import { apiFetch } from './httpClient.js';

export const therapistModel = {
  children: {
    list: () => apiFetch('/api/therapists/children/mine'),
    profile: (childId) => apiFetch(`/api/therapists/children/${childId}/profile`),
    createAssignment: (childId, body) =>
      apiFetch(`/api/therapists/children/${childId}/assignments`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    createNote: (childId, body) =>
      apiFetch(`/api/therapists/children/${childId}/private-notes`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
  assignments: {
    list: () => apiFetch('/api/therapists/assignments/mine'),
    update: (id, body) =>
      apiFetch(`/api/therapists/assignments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id) => apiFetch(`/api/therapists/assignments/${id}`, { method: 'DELETE' }),
  },
  notes: {
    update: (id, body) =>
      apiFetch(`/api/therapists/private-notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id) => apiFetch(`/api/therapists/private-notes/${id}`, { method: 'DELETE' }),
  },
  appointments: {
    list: () =>
      apiFetch('/api/therapists/appointments/mine', { timeoutMs: 90_000 }),
    childPreview: (id) => apiFetch(`/api/therapists/appointments/${id}/child-preview`),
    decision: (id, action) =>
      apiFetch(`/api/therapists/appointments/${id}/decision`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
        timeoutMs: 90_000,
      }),
    complete: (id) =>
      apiFetch(`/api/therapists/appointments/${id}/complete`, { method: 'PATCH' }),
    start: (id) =>
      apiFetch(`/api/therapists/appointments/${id}/start`, { method: 'PATCH' }),
    remove: (id) => apiFetch(`/api/therapists/appointments/${id}`, { method: 'DELETE' }),
  },
  payments: {
    list: () => apiFetch('/api/therapists/payments/mine'),
  },
  chat: {
    ensureRoom: (parentUserId) =>
      apiFetch('/api/chat/rooms/ensure-with-parent', {
        method: 'POST',
        body: JSON.stringify({ parent_user_id: parentUserId }),
      }),
  },
  activities: {
    list: (params = {}) => {
      const search = new URLSearchParams();
      if (params.domain) search.set('domain', params.domain);
      if (Number.isFinite(params.child_age_months)) {
        search.set('child_age_months', String(Math.floor(params.child_age_months)));
      }
      const qs = search.toString();
      return apiFetch(`/api/activities${qs ? `?${qs}` : ''}`);
    },
    create: (body) =>
      apiFetch('/api/activities', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
  availability: {
    list: () => apiFetch('/api/therapists/availability/mine'),
    create: (body) =>
      apiFetch('/api/therapists/availability', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id, body) =>
      apiFetch(`/api/therapists/availability/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    remove: (id) => apiFetch(`/api/therapists/availability/${id}`, { method: 'DELETE' }),
  },
  notifications: {
    list: () => apiFetch('/api/notifications'),
    markRead: (id) => apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => apiFetch('/api/notifications/read-all', { method: 'PATCH' }),
  },
  dashboard: {
    overview: () => apiFetch('/api/admin/therapist/overview'),
  },
  account: {
    getProfile: () => apiFetch('/api/therapists/account/profile'),
    updateProfile: (body) =>
      apiFetch('/api/therapists/account/profile', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    sendPasswordChangeOtp: (body) =>
      apiFetch('/api/therapists/account/change-password/send-otp', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    resendPasswordChangeOtp: () =>
      apiFetch('/api/therapists/account/change-password/resend-otp', {
        method: 'POST',
      }),
    changePassword: (body) =>
      apiFetch('/api/therapists/account/change-password', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  },
};

/** @deprecated Use therapistModel — kept for gradual migration. */
export const therapistApi = therapistModel;

export { getAuthToken as getToken } from './httpClient.js';
