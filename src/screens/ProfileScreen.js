import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const initials = (name) => (name || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', crp: '', specialty: '', companyName: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get('/profile');
        const p = data.user || data;
        setForm({
          name: p.name || '', email: p.email || '', phone: p.phone || '',
          crp: p.crp || '', specialty: p.specialty || '',
          companyName: p.companyName || p.company_name || '',
          address: p.address || '',
        });
      } catch {}
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/profile', form);
      updateUser(form);
      Alert.alert('Sucesso', 'Perfil atualizado!');
    } catch (e) { Alert.alert('Erro', e.message); }
    setSaving(false);
  };

  const Field = ({ label, field, ...props }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={form[field]}
        onChangeText={v => setForm(f => ({ ...f, [field]: v }))}
        placeholderTextColor="#94a3b8"
        {...props}
      />
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1a3a5c" /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Avatar header */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(form.name)}</Text>
          </View>
          <Text style={styles.name}>{form.name}</Text>
          <Text style={styles.role}>{user?.role || 'Profissional'}{form.crp ? ` · CRP ${form.crp}` : ''}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dados Pessoais</Text>
          <Field label="Nome completo" field="name" autoCapitalize="words" />
          <Field label="E-mail" field="email" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Telefone" field="phone" keyboardType="phone-pad" />

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Dados Profissionais</Text>
          <Field label="CRP" field="crp" placeholder="06/000000" />
          <Field label="Especialidade" field="specialty" placeholder="Psicologia Clínica" autoCapitalize="words" />
          <Field label="Nome da Clínica" field="companyName" autoCapitalize="words" />
          <Field label="Endereço da Clínica" field="address" autoCapitalize="sentences" />

          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Salvar alterações</Text>}
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={() => Alert.alert('Sair', 'Deseja encerrar a sessão?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sair', style: 'destructive', onPress: logout },
        ])}>
          <Text style={styles.logoutText}>Encerrar sessão</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarSection: { backgroundColor: '#1a3a5c', alignItems: 'center', paddingVertical: 32, paddingTop: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2d6da8', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 3, borderColor: '#90c4e8' },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: '#fff' },
  role: { fontSize: 13, color: '#90c4e8', marginTop: 4 },
  card: { backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1a3a5c', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#1e293b', backgroundColor: '#f8fafc' },
  saveBtn: { backgroundColor: '#1a3a5c', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  logoutBtn: { margin: 16, marginTop: 0, backgroundColor: '#fef2f2', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#ef4444', fontWeight: '800', fontSize: 15 },
});
