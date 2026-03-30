import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { api } from '../services/api';

const fmtMoney = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CATS = ['Consulta', 'Avaliação', 'Grupo', 'Supervisão', 'Workshop', 'Online', 'Outro'];
const EMPTY = { name: '', category: 'Consulta', price: '', duration_minutes: '50', description: '', is_active: true };

export default function ServicesScreen() {
  const [services, setServices]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [editId, setEditId]       = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/services');
      setServices(Array.isArray(data) ? data : []);
    } catch (e) { Alert.alert('Erro', e.message); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(EMPTY); setEditId(null); setShowModal(true); };
  const openEdit = (s) => {
    setForm({
      name: s.name || '', category: s.category || 'Consulta',
      price: String(s.price || s.valor || ''), duration_minutes: String(s.duration_minutes || s.duracao || '50'),
      description: s.description || s.descricao || '', is_active: s.is_active !== false,
    });
    setEditId(s.id);
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Atenção', 'Nome é obrigatório.'); return; }
    if (!form.price) { Alert.alert('Atenção', 'Preço é obrigatório.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, price: parseFloat(String(form.price).replace(',', '.')), duration_minutes: parseInt(form.duration_minutes) || 50 };
      if (editId) await api.put(`/services/${editId}`, payload);
      else        await api.post('/services', payload);
      setShowModal(false);
      load();
    } catch (e) { Alert.alert('Erro', e.message); }
    setSaving(false);
  };

  const del = (id, name) => Alert.alert('Excluir', `Excluir "${name}"?`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: async () => {
      try { await api.delete(`/services/${id}`); load(); }
      catch (e) { Alert.alert('Erro', e.message); }
    }},
  ]);

  const renderItem = ({ item: s }) => (
    <TouchableOpacity style={st.card} onPress={() => openEdit(s)} activeOpacity={0.8}>
      <View style={st.cardLeft}>
        <View style={st.iconWrap}><Text style={{ fontSize: 22 }}>🛎️</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={st.name}>{s.name}</Text>
          <Text style={st.meta}>
            {s.category || '—'}{s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}
          </Text>
          {s.description ? <Text style={st.desc} numberOfLines={1}>{s.description}</Text> : null}
        </View>
      </View>
      <View style={st.cardRight}>
        <Text style={st.price}>{fmtMoney(s.price || s.valor)}</Text>
        <View style={[st.statusDot, { backgroundColor: s.is_active !== false ? '#10b981' : '#94a3b8' }]} />
      </View>
    </TouchableOpacity>
  );

  if (loading) return <View style={st.center}><ActivityIndicator size="large" color="#1a3a5c" /></View>;

  return (
    <View style={st.container}>
      <FlatList
        data={services}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={<Text style={st.count}>{services.length} serviço{services.length !== 1 ? 's' : ''}</Text>}
        ListEmptyComponent={<View style={st.empty}><Text style={{ fontSize: 40 }}>🛎️</Text><Text style={st.emptyText}>Nenhum serviço cadastrado</Text></View>}
      />

      <TouchableOpacity style={st.fab} onPress={openNew}><Text style={st.fabText}>+</Text></TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}><Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>Cancelar</Text></TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#1e293b' }}>{editId ? 'Editar' : 'Novo'} Serviço</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#1a3a5c" /> : <Text style={{ color: '#1a3a5c', fontSize: 16, fontWeight: '800' }}>Salvar</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={st.label}>Nome do serviço *</Text>
            <TextInput style={st.input} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="Ex: Sessão individual" placeholderTextColor="#94a3b8" autoCapitalize="words" />

            <Text style={st.label}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {CATS.map(c => (
                <TouchableOpacity key={c} style={[st.chip, form.category === c && st.chipActive, { marginRight: 8 }]} onPress={() => setForm(f => ({ ...f, category: c }))}>
                  <Text style={[st.chipText, form.category === c && st.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={st.label}>Preço (R$) *</Text>
            <TextInput style={st.input} value={form.price} onChangeText={v => setForm(f => ({ ...f, price: v }))} placeholder="150,00" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" />

            <Text style={st.label}>Duração (minutos)</Text>
            <TextInput style={st.input} value={form.duration_minutes} onChangeText={v => setForm(f => ({ ...f, duration_minutes: v }))} placeholder="50" placeholderTextColor="#94a3b8" keyboardType="number-pad" />

            <Text style={st.label}>Descrição</Text>
            <TextInput style={[st.input, { height: 80, textAlignVertical: 'top' }]} value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholder="Descrição opcional do serviço..." placeholderTextColor="#94a3b8" multiline />

            <Text style={st.label}>Status</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              {[[true, 'Ativo'], [false, 'Inativo']].map(([val, label]) => (
                <TouchableOpacity key={String(val)} style={[st.chip, form.is_active === val && st.chipActive]} onPress={() => setForm(f => ({ ...f, is_active: val }))}>
                  <Text style={[st.chipText, form.is_active === val && st.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {editId && (
              <TouchableOpacity style={st.deleteBtn} onPress={() => { setShowModal(false); setTimeout(() => del(editId, form.name), 300); }}>
                <Text style={st.deleteBtnText}>Excluir serviço</Text>
              </TouchableOpacity>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  count: { fontSize: 12, color: '#94a3b8', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  meta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  desc: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  price: { fontSize: 15, fontWeight: '900', color: '#10b981' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { color: '#94a3b8', fontSize: 15 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabText: { color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -2 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#1e293b', backgroundColor: '#f8fafc', marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  chipTextActive: { color: '#fff' },
  deleteBtn: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10 },
  deleteBtnText: { color: '#ef4444', fontWeight: '800', fontSize: 15 },
});
