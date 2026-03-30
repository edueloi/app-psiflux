import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { api } from '../services/api';

const fmtMoney = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';

const INCOME_CATS = ['Sessão Individual', 'Pacote de Sessões', 'Avaliação', 'Supervisão', 'Palestra', 'Outros'];
const EXPENSE_CATS = ['Aluguel', 'Marketing', 'Impostos/CRP', 'Software', 'Educação', 'Materiais', 'Outros'];
const METHODS = ['pix', 'credit', 'debit', 'cash', 'transfer', 'check', 'courtesy'];
const METHOD_LABEL = { pix: 'Pix', credit: 'Crédito', debit: 'Débito', cash: 'Dinheiro', transfer: 'Transferência', check: 'Cheque', courtesy: 'Cortesia' };

export default function FinanceScreen() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all'); // all | income | expense
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'income', amount: '', date: now.toISOString().split('T')[0], category: '', description: '', payment_method: 'pix', status: 'paid' });

  const load = useCallback(async () => {
    try {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end = new Date(year, month, 0).toISOString().split('T')[0];
      const [sum, trans] = await Promise.allSettled([
        api.get(`/finance/summary?month=${month}&year=${year}`),
        api.get(`/finance?start=${start}&end=${end}`),
      ]);
      setSummary(sum.status === 'fulfilled' ? sum.value : null);
      setTransactions(trans.status === 'fulfilled' ? (trans.value?.transactions || trans.value || []) : []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const displayed = tab === 'all' ? transactions : transactions.filter(t => t.type === tab);

  const save = async () => {
    if (!form.amount || !form.category) { Alert.alert('Atenção', 'Valor e categoria são obrigatórios.'); return; }
    setSaving(true);
    try {
      await api.post('/finance', { ...form, amount: parseFloat(form.amount.replace(',', '.')) });
      setShowModal(false);
      load();
    } catch (e) { Alert.alert('Erro', e.message); }
    setSaving(false);
  };

  const monthName = new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const renderTrans = ({ item: t }) => (
    <View style={styles.transCard}>
      <View style={[styles.transIcon, { backgroundColor: t.type === 'income' ? '#f0fdf4' : '#fef2f2' }]}>
        <Text style={{ fontSize: 18 }}>{t.type === 'income' ? '↑' : '↓'}</Text>
      </View>
      <View style={styles.transInfo}>
        <Text style={styles.transDesc}>{t.description || t.category}</Text>
        <Text style={styles.transMeta}>{fmtDate(t.date)} · {t.category} · {METHOD_LABEL[t.payment_method] || t.payment_method}</Text>
      </View>
      <Text style={[styles.transAmount, { color: t.type === 'income' ? '#10b981' : '#ef4444' }]}>
        {t.type === 'income' ? '+' : '-'}{fmtMoney(t.amount)}
      </Text>
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1a3a5c" /></View>;

  const cats = form.type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  return (
    <View style={styles.container}>
      {/* Month nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthName}</Text>
        <TouchableOpacity onPress={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      {summary && (
        <View style={styles.summaryRow}>
          <View style={[styles.sumCard, { backgroundColor: '#f0fdf4' }]}>
            <Text style={styles.sumLabel}>Receita</Text>
            <Text style={[styles.sumVal, { color: '#10b981' }]}>{fmtMoney(summary.income)}</Text>
          </View>
          <View style={[styles.sumCard, { backgroundColor: '#fef2f2' }]}>
            <Text style={styles.sumLabel}>Despesa</Text>
            <Text style={[styles.sumVal, { color: '#ef4444' }]}>{fmtMoney(summary.expense)}</Text>
          </View>
          <View style={[styles.sumCard, { backgroundColor: '#eff6ff' }]}>
            <Text style={styles.sumLabel}>Saldo</Text>
            <Text style={[styles.sumVal, { color: '#3b82f6' }]}>{fmtMoney((summary.income || 0) - (summary.expense || 0))}</Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {[['all', 'Todas'], ['income', 'Receitas'], ['expense', 'Despesas']].map(([k, l]) => (
          <TouchableOpacity key={k} style={[styles.tabBtn, tab === k && styles.tabBtnActive]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={i => String(i.id)}
        renderItem={renderTrans}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>Nenhuma transação</Text></View>}
      />

      <TouchableOpacity style={styles.fab} onPress={() => { setForm({ type: 'income', amount: '', date: new Date().toISOString().split('T')[0], category: '', description: '', payment_method: 'pix', status: 'paid' }); setShowModal(true); }}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* New Transaction Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#1e293b' }}>Nova Transação</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#1a3a5c" /> : <Text style={{ color: '#1a3a5c', fontSize: 16, fontWeight: '800' }}>Salvar</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Type */}
            <Text style={styles.fieldLabel}>Tipo</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              {[['income', 'Receita', '#10b981'], ['expense', 'Despesa', '#ef4444']].map(([k, l, c]) => (
                <TouchableOpacity key={k} style={[styles.typeBtn, form.type === k && { backgroundColor: c, borderColor: c }]}
                  onPress={() => setForm(f => ({ ...f, type: k, category: '' }))}>
                  <Text style={[styles.typeBtnText, form.type === k && { color: '#fff' }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Valor (R$)</Text>
            <TextInput style={styles.fieldInput} value={form.amount} onChangeText={v => setForm(f => ({ ...f, amount: v }))}
              placeholder="0,00" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>Data</Text>
            <TextInput style={styles.fieldInput} value={form.date} onChangeText={v => setForm(f => ({ ...f, date: v }))}
              placeholder="AAAA-MM-DD" placeholderTextColor="#94a3b8" autoCapitalize="none" />

            <Text style={styles.fieldLabel}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {cats.map(c => (
                <TouchableOpacity key={c} style={[styles.chip, form.category === c && styles.chipActive, { marginRight: 8 }]}
                  onPress={() => setForm(f => ({ ...f, category: c }))}>
                  <Text style={[styles.chipText, form.category === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Forma de pagamento</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {METHODS.map(m => (
                <TouchableOpacity key={m} style={[styles.chip, form.payment_method === m && styles.chipActive, { marginRight: 8 }]}
                  onPress={() => setForm(f => ({ ...f, payment_method: m }))}>
                  <Text style={[styles.chipText, form.payment_method === m && styles.chipTextActive]}>{METHOD_LABEL[m]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Descrição</Text>
            <TextInput style={styles.fieldInput} value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))}
              placeholder="Descrição opcional" placeholderTextColor="#94a3b8" />

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
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: '#1a3a5c' },
  navArrow: { fontSize: 28, color: '#90c4e8', paddingHorizontal: 12 },
  monthLabel: { fontSize: 16, fontWeight: '800', color: '#fff', textTransform: 'capitalize' },
  summaryRow: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  sumCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  sumLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  sumVal: { fontSize: 14, fontWeight: '900' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#1a3a5c' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  tabTextActive: { color: '#1a3a5c' },
  transCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  transIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  transInfo: { flex: 1 },
  transDesc: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  transMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  transAmount: { fontSize: 14, fontWeight: '900' },
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
  typeBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center' },
  typeBtnText: { fontWeight: '700', color: '#64748b' },
});
