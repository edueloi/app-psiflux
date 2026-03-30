import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Linking, Modal,
  TextInput, ScrollView, KeyboardAvoidingView, Platform, Clipboard,
} from 'react-native';
import { api } from '../services/api';

const fmtDateTime = (d) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const EMPTY_FORM = {
  title: '', patient_id: '', scheduled_start: '', scheduled_end: '', provider: 'jitsi', link: '',
};

export default function VirtualRoomsScreen() {
  const [rooms, setRooms]         = useState([]);
  const [patients, setPatients]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [patSearch, setPatSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const [roomsRes, patsRes] = await Promise.allSettled([
        api.get('/virtual-rooms'),
        api.get('/patients'),
      ]);
      setRooms(roomsRes.status === 'fulfilled'
        ? (roomsRes.value?.rooms || roomsRes.value || []) : []);
      setPatients(patsRes.status === 'fulfilled'
        ? (Array.isArray(patsRes.value) ? patsRes.value : (patsRes.value?.patients || [])) : []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.title.trim()) { Alert.alert('Atenção', 'Título é obrigatório.'); return; }
    setSaving(true);
    try {
      await api.post('/virtual-rooms', form);
      setShowModal(false);
      load();
    } catch (e) { Alert.alert('Erro', e.message); }
    setSaving(false);
  };

  const deleteRoom = (id, title) => Alert.alert('Excluir sala', `Excluir "${title}"?`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: async () => {
      try { await api.delete(`/virtual-rooms/${id}`); load(); }
      catch (e) { Alert.alert('Erro', e.message); }
    }},
  ]);

  const joinRoom = async (room) => {
    let url = room.link;
    if (!url && room.code) {
      url = `https://meet.jit.si/${room.code}`;
    }
    if (!url) { Alert.alert('Sem link', 'Esta sala não tem link configurado.'); return; }
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
    else Alert.alert('Erro', 'Não foi possível abrir o link.');
  };

  const copyCode = (code) => {
    if (Clipboard?.setString) Clipboard.setString(code);
    Alert.alert('Copiado!', `Código: ${code}`);
  };

  const filteredPats = patients
    .filter(p => (p.name || '').toLowerCase().includes(patSearch.toLowerCase()))
    .slice(0, 6);

  const isUpcoming = (room) => {
    if (!room.scheduled_start) return false;
    return new Date(room.scheduled_start) > new Date();
  };

  const upcoming = rooms.filter(isUpcoming).sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start));
  const others   = rooms.filter(r => !isUpcoming(r));

  const renderRoom = ({ item: r }) => (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.roomIcon}><Text style={{ fontSize: 22 }}>🎥</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.roomTitle}>{r.title}</Text>
          {r.patient_name && <Text style={s.roomMeta}>👤 {r.patient_name}</Text>}
          {r.scheduled_start && (
            <Text style={s.roomMeta}>🕐 {fmtDateTime(r.scheduled_start)}</Text>
          )}
          {r.code && (
            <TouchableOpacity onPress={() => copyCode(r.code)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Text style={s.codeText}>#{r.code}</Text>
              <Text style={{ fontSize: 10, color: '#6366f1' }}>copiar</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => deleteRoom(r.id, r.title)} style={s.deleteBtn}>
          <Text style={{ color: '#ef4444', fontWeight: '700' }}>✕</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={s.joinBtn} onPress={() => joinRoom(r)}>
        <Text style={s.joinBtnText}>▶  Entrar na sala</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a3a5c" /></View>;

  return (
    <View style={s.container}>
      <FlatList
        data={[...upcoming, ...others]}
        keyExtractor={i => String(i.id)}
        renderItem={renderRoom}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          upcoming.length > 0 ? (
            <View style={s.sectionLabel}>
              <Text style={s.sectionLabelText}>🔜 PRÓXIMAS · {upcoming.length}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🎥</Text>
            <Text style={s.emptyText}>Nenhuma sala virtual</Text>
          </View>
        }
      />

      <TouchableOpacity style={s.fab} onPress={() => { setForm(EMPTY_FORM); setPatSearch(''); setShowModal(true); }}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modal nova sala */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#1e293b' }}>Nova Sala Virtual</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#1a3a5c" /> : <Text style={{ color: '#1a3a5c', fontSize: 16, fontWeight: '800' }}>Criar</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>Título</Text>
            <TextInput style={s.fieldInput} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} placeholder="Ex: Sessão — Karen Gomes" placeholderTextColor="#94a3b8" />

            <Text style={s.fieldLabel}>Paciente</Text>
            <TextInput style={s.fieldInput} value={patSearch} onChangeText={setPatSearch} placeholder="Buscar paciente..." placeholderTextColor="#94a3b8" />
            {patSearch.length > 0 && filteredPats.map(p => (
              <TouchableOpacity key={p.id} style={s.patOpt} onPress={() => { setForm(f => ({ ...f, patient_id: String(p.id) })); setPatSearch(p.name); }}>
                <Text style={{ fontWeight: '700', color: '#1e293b' }}>{p.name}</Text>
              </TouchableOpacity>
            ))}

            <Text style={[s.fieldLabel, { marginTop: 14 }]}>Início (AAAA-MM-DDTHH:MM)</Text>
            <TextInput style={s.fieldInput} value={form.scheduled_start} onChangeText={v => setForm(f => ({ ...f, scheduled_start: v }))} placeholder="2026-03-28T14:00" placeholderTextColor="#94a3b8" autoCapitalize="none" />

            <Text style={s.fieldLabel}>Fim (AAAA-MM-DDTHH:MM)</Text>
            <TextInput style={s.fieldInput} value={form.scheduled_end} onChangeText={v => setForm(f => ({ ...f, scheduled_end: v }))} placeholder="2026-03-28T15:00" placeholderTextColor="#94a3b8" autoCapitalize="none" />

            <Text style={s.fieldLabel}>Plataforma</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {['jitsi', 'zoom', 'teams', 'outro'].map(p => (
                <TouchableOpacity key={p} style={[s.chip, form.provider === p && s.chipActive]} onPress={() => setForm(f => ({ ...f, provider: p }))}>
                  <Text style={[s.chipText, form.provider === p && s.chipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.provider !== 'jitsi' && (
              <>
                <Text style={s.fieldLabel}>Link da reunião</Text>
                <TextInput style={s.fieldInput} value={form.link} onChangeText={v => setForm(f => ({ ...f, link: v }))} placeholder="https://..." placeholderTextColor="#94a3b8" autoCapitalize="none" />
              </>
            )}

            <View style={s.jitsiInfo}>
              <Text style={{ fontSize: 13, color: '#6366f1', fontWeight: '600' }}>
                💡 Para Jitsi, um código único é gerado automaticamente pelo sistema.
              </Text>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionLabel: { marginBottom: 8 },
  sectionLabelText: { fontSize: 11, fontWeight: '800', color: '#6366f1', letterSpacing: 0.5 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  roomIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  roomTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  roomMeta: { fontSize: 12, color: '#64748b', marginTop: 3 },
  codeText: { fontSize: 12, fontWeight: '800', color: '#6366f1', backgroundColor: '#f5f3ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  deleteBtn: { padding: 6 },
  joinBtn: { backgroundColor: '#1a3a5c', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  joinBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabText: { color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -2 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  fieldInput: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#1e293b', backgroundColor: '#f8fafc', marginBottom: 14 },
  patOpt: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  chipTextActive: { color: '#fff' },
  jitsiInfo: { backgroundColor: '#f5f3ff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#ddd6fe' },
});
