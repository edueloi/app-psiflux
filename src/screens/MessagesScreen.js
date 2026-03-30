import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { api } from '../services/api';

const CATS = ['Lembrete', 'Financeiro', 'Aniversário', 'Outros'];

export default function MessagesScreen() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Lembrete', content: '' });
  const [editId, setEditId] = useState(null);
  const [viewItem, setViewItem] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/messages/templates');
      setTemplates(Array.isArray(data) ? data : (data.templates || []));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ name: '', category: 'Lembrete', content: '' }); setEditId(null); setShowModal(true); };
  const openEdit = (t) => { setForm({ name: t.name, category: t.category, content: t.content }); setEditId(t.id); setShowModal(true); };

  const save = async () => {
    if (!form.name || !form.content) { Alert.alert('Atenção', 'Nome e conteúdo são obrigatórios.'); return; }
    setSaving(true);
    try {
      if (editId) await api.put(`/messages/templates/${editId}`, form);
      else await api.post('/messages/templates', form);
      setShowModal(false);
      load();
    } catch (e) { Alert.alert('Erro', e.message); }
    setSaving(false);
  };

  const del = (id, name) => Alert.alert('Excluir template', `Excluir "${name}"?`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: async () => { try { await api.delete(`/messages/templates/${id}`); load(); } catch (e) { Alert.alert('Erro', e.message); } } },
  ]);

  const VARS = ['{{saudacao}}', '{{nome_paciente}}', '{{primeiro_nome}}', '{{data_agendamento}}', '{{horario}}', '{{servico}}', '{{nome_profissional}}', '{{nome_clinica}}'];

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1a3a5c" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={templates}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={<Text style={styles.count}>{templates.length} template{templates.length !== 1 ? 's' : ''}</Text>}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>Nenhum template criado</Text></View>}
        renderItem={({ item: t }) => (
          <TouchableOpacity style={styles.card} onPress={() => setViewItem(t)} activeOpacity={0.8}>
            <View style={styles.cardTop}>
              <View style={styles.catBadge}><Text style={styles.catText}>{t.category}</Text></View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => openEdit(t)}><Text style={{ color: '#3b82f6', fontWeight: '700' }}>Editar</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => del(t.id, t.name)}><Text style={{ color: '#ef4444', fontWeight: '700' }}>✕</Text></TouchableOpacity>
              </View>
            </View>
            <Text style={styles.cardName}>{t.name}</Text>
            <Text style={styles.cardContent} numberOfLines={2}>{t.content}</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={openNew}><Text style={styles.fabText}>+</Text></TouchableOpacity>

      {/* View Modal */}
      <Modal visible={!!viewItem} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setViewItem(null)}><Text style={{ color: '#3b82f6', fontSize: 16, fontWeight: '600' }}>Fechar</Text></TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#1e293b' }}>{viewItem?.name}</Text>
          <TouchableOpacity onPress={() => { setViewItem(null); setTimeout(() => openEdit(viewItem), 300); }}><Text style={{ color: '#1a3a5c', fontSize: 16, fontWeight: '700' }}>Editar</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ padding: 20 }}>
          <Text style={styles.fieldLabel}>Categoria</Text>
          <Text style={{ fontSize: 15, color: '#1e293b', marginBottom: 16 }}>{viewItem?.category}</Text>
          <Text style={styles.fieldLabel}>Conteúdo</Text>
          <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 14, color: '#334155', lineHeight: 22 }}>{viewItem?.content}</Text>
          </View>
        </ScrollView>
      </Modal>

      {/* Form Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}><Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>Cancelar</Text></TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#1e293b' }}>{editId ? 'Editar' : 'Novo'} Template</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#1a3a5c" /> : <Text style={{ color: '#1a3a5c', fontSize: 16, fontWeight: '800' }}>Salvar</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Nome</Text>
            <TextInput style={styles.fieldInput} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="Nome do template" placeholderTextColor="#94a3b8" />

            <Text style={styles.fieldLabel}>Categoria</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {CATS.map(c => (
                <TouchableOpacity key={c} style={[styles.chip, form.category === c && styles.chipActive]} onPress={() => setForm(f => ({ ...f, category: c }))}>
                  <Text style={[styles.chipText, form.category === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Variáveis disponíveis</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {VARS.map(v => (
                <TouchableOpacity key={v} style={[styles.chip, { marginRight: 6, backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                  onPress={() => setForm(f => ({ ...f, content: f.content + v }))}>
                  <Text style={[styles.chipText, { color: '#3b82f6' }]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Conteúdo</Text>
            <TextInput
              style={[styles.fieldInput, { height: 160, textAlignVertical: 'top' }]}
              value={form.content} onChangeText={v => setForm(f => ({ ...f, content: v }))}
              placeholder="Olá {{primeiro_nome}}, lembramos que sua sessão é amanhã às {{horario}}."
              placeholderTextColor="#94a3b8" multiline
            />
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  count: { fontSize: 12, color: '#94a3b8', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  catBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catText: { fontSize: 10, fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase' },
  cardName: { fontSize: 15, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  cardContent: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#94a3b8', fontSize: 15 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabText: { color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -2 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  fieldInput: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#1e293b', backgroundColor: '#f8fafc', marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  chipTextActive: { color: '#fff' },
});
