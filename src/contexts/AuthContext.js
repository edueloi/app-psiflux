import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('psi_token');
        const userData = await AsyncStorage.getItem('psi_user');
        if (token && userData) setUser(JSON.parse(userData));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    const token = data.psi_token || data.token;
    if (!token) throw new Error('Token não recebido do servidor');
    await AsyncStorage.setItem('psi_token', token);
    // O backend retorna apenas { token }, então buscamos os dados do usuário separadamente
    const userData = await api.get('/auth/me');
    await AsyncStorage.setItem('psi_user', JSON.stringify(userData));
    setUser(userData);
    return data;
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['psi_token', 'psi_user']);
    setUser(null);
  };

  const updateUser = (newData) => {
    const updated = { ...user, ...newData };
    setUser(updated);
    AsyncStorage.setItem('psi_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
