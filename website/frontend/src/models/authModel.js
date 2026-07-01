import api from '../services/axios.js';

export const authModel = {
  login: (email, password) => api.post('/auth/login', { email, password }),
};
