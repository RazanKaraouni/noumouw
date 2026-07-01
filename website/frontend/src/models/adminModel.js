import api from '../services/axios.js';
import { adminSupabaseModel } from './adminSupabaseModel.js';

const wrap = (data) => Promise.resolve({ data });

export const adminModel = {
  overview: (growthRange, trendGroupBy) =>
    api.get('/admin/overview', { params: { growthRange, trendGroupBy } }),
  appointments: {
    list: (params) => api.get('/admin/appointments', { params }),
  },
  payments: {
    list: (params) => api.get('/admin/payments', { params }),
  },
  users: {
    listParents: () => api.get('/users'),
    listParentChildren: (parentId) => api.get(`/users/${parentId}/children`),
    suspend: (parentId) => api.patch(`/users/${parentId}/suspend`),
    reactivate: (parentId) => api.patch(`/users/${parentId}/reactivate`),
    delete: (parentId) => api.delete(`/users/${parentId}`),
  },
  children: {
    list: () => api.get('/children'),
  },
  therapists: {
    list: () => api.get('/therapists'),
    specializations: () => api.get('/therapists/specializations'),
    create: (form) => api.post('/therapists', form),
    update: (therapistId, payload) => api.put(`/therapists/${therapistId}`, payload),
    suspend: (therapistId) => api.patch(`/therapists/${therapistId}/suspend`),
    reactivate: (therapistId) => api.patch(`/therapists/${therapistId}/reactivate`),
    delete: (therapistId) => api.delete(`/therapists/${therapistId}`),
    stats: () => api.get('/therapists/stats'),
  },
  milestones: {
    list: (params) => api.get('/milestones', { params }),
    create: (form) => api.post('/milestones', form),
  },
  activities: {
    list: (params) => api.get('/activities', { params }),
  },
  masterActivities: {
    create: (payload) => api.post('/master-activities', payload),
  },
  resources: {
    listForModeration: () => api.get('/admin/resources'),
  },
  reports: {
    list: (params) => api.get('/reports', { params }),
    listPending: () => api.get('/reports/pending'),
    resolve: (reportId, payload) =>
      api.patch(`/reports/${reportId}/resolve`, payload),
    screeningArchive: (params) => api.get('/reports/admin/screening-archive', { params }),
    milestoneArchive: () => api.get('/reports/admin/milestone-archive'),
  },
  autism: {
    createQuestion: (payload) => api.post('/autism/questions', payload),
  },
  moderation: {
    suspendUser: (userId, reason) =>
      api.post(`/users/${userId}/suspend-account`, { reason }),
  },
  announcements: {
    list: () => wrap(adminSupabaseModel.announcements.list()),
    create: (payload) => api.post('/admin/announcements', payload),
    delete: (announcementId) => api.delete(`/admin/announcements/${announcementId}`),
  },
  logs: {
    moderation: (params) => api.get('/admin/logs/moderation', { params }),
  },
  community: {
    listPosts: (params) => api.get('/admin/community/posts', { params }),
    getPost: (postId) => api.get(`/admin/community/posts/${postId}`),
    deletePost: (postId) => api.delete(`/admin/community/posts/${postId}`),
    deleteComment: (commentId) => api.delete(`/admin/community/comments/${commentId}`),
    warnUser: (userId, payload) =>
      api.post(`/admin/community/users/${userId}/warn`, payload),
    suspendUser: (userId) => api.post(`/admin/community/users/${userId}/suspend`),
  },
};
