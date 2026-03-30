import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL = 'https://psiflux.com.br/api';

const request = async (method, endpoint, body = null) => {
  const token = await AsyncStorage.getItem('psi_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE_URL}${endpoint}`, options);

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    if (endpoint !== '/auth/login') {
      await AsyncStorage.removeItem('psi_token');
      await AsyncStorage.removeItem('psi_user');
    }
    throw new Error(data.error || data.message || 'Email ou senha inválidos');
  }

  if (!res.ok) throw new Error(data.error || data.message || 'Erro na requisição');
  return data;
};

export const api = {
  get: (endpoint) => request('GET', endpoint),
  post: (endpoint, body) => request('POST', endpoint, body),
  put: (endpoint, body) => request('PUT', endpoint, body),
  patch: (endpoint, body) => request('PATCH', endpoint, body),
  delete: (endpoint) => request('DELETE', endpoint),
};
