import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal,
  TextInput, ScrollView, Platform, KeyboardAvoidingView,
} from 'react-native';
import { api } from '../services/api';

const fmtMoney = (v) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate  = (d) => { 
  if(!d) return '—'; 
  const dt = typeof d === 'string' && d.includes('-') ? new Date(d + 'T12:00:00') : new Date(d);
  return isNaN(dt.getTime())?'—':dt.toLocaleDateString('pt-BR'); 
};

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const PAYMENT_METHODS = [
  { value: 'pix',      label: 'PIX' },
  { value: 'credit',   label: 'Cartão de Crédito' },
  { value: 'debit',    label: 'Cartão de Débito' },
  { value: 'cash',     label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'check',    label: 'Cheque' },
  { value: 'courtesy', label: 'Cortesia' },
];

const CATEGORIES_INCOME = ['Geral', 'Sessão Individual', 'Pacote de Sessões', 'Avaliação', 'Supervisão', 'Palestra/Curso', 'Outros'].map(c=>({value:c,label:c}));
const CATEGORIES_EXPENSE = ['Aluguel/Sublocação', 'Marketing/Anúncios', 'Impostos/CRP', 'Software/Sistemas', 'Educação/Livros', 'Material de Escritório', 'Outros'].map(c=>({value:c,label:c}));

const STATUS_OPTIONS = [
  { value: 'paid',      label: 'Pago',      color: '#10b981' },
  { value: 'pending',   label: 'Pendente',  color: '#f59e0b' },
  { value: 'confirmed', label: 'Confirmado',color: '#3b82f6' },
  { value: 'waiting',   label: 'Aguardando',color: '#6366f1' },
  { value: 'cancelled', label: 'Cancelado', color: '#ef4444' },
];

const maskMoney = (v) => {
  const d = v.replace(/\D/g,'');
  if (!d) return '';
  const n = parseInt(d)/100;
  return n.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
};

const parseMoney = (s) => parseFloat(String(s).replace(/\./g,'').replace(',','.')) || 0;

export default function LivroCaixaScreen() {
  const now  = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());
  const [transactions, setTransactions] = useState([]);
  const [summary,      setSummary]      = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [tab, setTab] = useState('all'); // 'all' | 'income' | 'expense'

  // Edit Modal
  const [showEdit, setShowEdit] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState({
    type:'income', description:'', amount:'', date: new Date().toISOString().split('T')[0].split('-').reverse().join('/'),
    category:'Geral', payment_method:'pix', status:'paid', observation:''
  });

  const load = useCallback(async () => {
    try {
      const lastDay = new Date(year, month+1, 0).getDate();
      const start = `${year}-${String(month+1).padStart(2,'0')}-01`;
      const end   = `${year}-${String(month+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      const [txRes, sumRes] = await Promise.allSettled([
        api.get(`/finance?start=${start}&end=${end}`),
        api.get(`/finance/summary?month=${month+1}&year=${year}`),
      ]);
      setTransactions(txRes.status==='fulfilled' ? (Array.isArray(txRes.value)?txRes.value:[]) : []);
      setSummary(sumRes.status==='fulfilled' ? sumRes.value : null);
    } catch {}
    setLoading(false); setRefreshing(false);
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const filtered = transactions.filter(t => {
    if(tab==='income')  return t.type==='income'  || t.type==='receita';
    if(tab==='expense') return t.type==='expense' || t.type==='despesa';
    return true;
  });

  const income  = transactions.filter(t=>t.type==='income' ||t.type==='receita').reduce((s,t)=>s+Number(t.amount||t.value||0),0);
  const expense = transactions.filter(t=>t.type==='expense'||t.type==='despesa').reduce((s,t)=>s+Number(t.amount||t.value||0),0);
  const balance = income - expense;

  const openNew = (type = 'income') => {
    setEditId(null);
    setForm({
      type, description:'', amount:'', 
      date: new Date().toLocaleDateString('pt-BR'),
      category:'Geral', payment_method:'pix', status:'paid', observation:''
    });
    setShowEdit(true);
  };

  const openEdit = (t) => {
    setEditId(t.id);
    setForm({
      type: t.type === 'receita' ? 'income' : t.type === 'despesa' ? 'expense' : t.type,
      description: t.description || '',
      amount: (t.amount || t.value || 0).toLocaleString('pt-BR', {minimumFractionDigits:2}),
      date: fmtDate(t.date || t.created_at),
      category: t.category || 'Geral',
      payment_method: t.payment_method || 'pix',
      status: t.status || 'paid',
      observation: t.observation || t.notes || ''
    });
    setShowEdit(true);
  };

  const save = async () => {
    if (!form.description || !form.amount) { Alert.alert('Atenção','Preencha descrição e valor.'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: parseMoney(form.amount),
        date: form.date.split('/').reverse().join('-'),
      };
      if (editId) await api.put(`/finance/${editId}`, payload);
      else        await api.post('/finance', payload);
      setShowEdit(false); load();
    } catch(e) { Alert.alert('Erro', e.message); }
    setSaving(false);
  };

  const confirmDelete = (id) => Alert.alert('Excluir','Deseja excluir este lançamento?',[
    {text:'Cancelar', style:'cancel'},
    {text:'Excluir', style:'destructive', onPress: async() => {
      try { await api.delete(`/finance/${id}`); load(); }
      catch(e) { Alert.alert('Erro', e.message); }
    }}
  ]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#6366f1"/></View>;

  return (
    <View style={s.container}>
      {/* Navegação de mês */}
      <View style={s.monthNav}>
        <TouchableOpacity style={s.navBtn} onPress={prevMonth}><Text style={s.navArrow}>‹</Text></TouchableOpacity>
        <Text style={s.monthTitle}>{MONTHS_PT[month]} {year}</Text>
        <TouchableOpacity style={s.navBtn} onPress={nextMonth}><Text style={s.navArrow}>›</Text></TouchableOpacity>
      </View>

      {/* Cards de resumo */}
      <View style={s.summaryRow}>
        <View style={[s.sumCard,{backgroundColor:'#f0fdf4'}]}>
          <Text style={s.sumIcon}>↑</Text>
          <Text style={[s.sumValue,{color:'#10b981'}]}>{fmtMoney(income)}</Text>
          <Text style={s.sumLabel}>Receitas</Text>
        </View>
        <View style={[s.sumCard,{backgroundColor:'#fef2f2'}]}>
          <Text style={[s.sumIcon,{color:'#ef4444'}]}>↓</Text>
          <Text style={[s.sumValue,{color:'#ef4444'}]}>{fmtMoney(expense)}</Text>
          <Text style={s.sumLabel}>Despesas</Text>
        </View>
        <View style={[s.sumCard,{backgroundColor: balance>=0?'#f5f3ff':'#fff7ed', flex:1.3}]}>
          <Text style={[s.sumIcon,{color:'#6366f1'}]}>$</Text>
          <Text style={[s.sumValue,{color:balance>=0?'#6366f1':'#f59e0b', fontSize:13}]}>{fmtMoney(balance)}</Text>
          <Text style={s.sumLabel}>Saldo</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {[['all','Todas'],['income','Receitas'],['expense','Despesas']].map(([v,l])=>(
          <TouchableOpacity key={v} style={[s.tab, tab===v&&s.tabActive]} onPress={()=>setTab(v)}>
            <Text style={[s.tabText, tab===v&&s.tabTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      <FlatList
        data={filtered}
        keyExtractor={i=>String(i.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor="#6366f1"/>}
        contentContainerStyle={{padding:14, paddingBottom:100}}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{fontSize:44,marginBottom:10}}>📒</Text>
            <Text style={s.emptyText}>Nenhuma transação neste mês</Text>
          </View>
        }
        renderItem={({item:t})=>{
          const isIncome = t.type==='income'||t.type==='receita';
          const amount   = Number(t.amount||t.value||0);
          const st = STATUS_OPTIONS.find(o=>o.value===(t.status||'paid')) || STATUS_OPTIONS[0];
          return (
            <TouchableOpacity style={s.txCard} onPress={()=>openEdit(t)} activeOpacity={0.7}>
              <View style={[s.txType,{backgroundColor:isIncome?'#dcfce7':'#fee2e2'}]}>
                <Text style={{fontSize:14}}>{isIncome?'↑':'↓'}</Text>
              </View>
              <View style={s.txInfo}>
                <Text style={s.txDesc} numberOfLines={1}>{t.description||t.category||'Sem descrição'}</Text>
                <Text style={s.txMeta}>
                  {fmtDate(t.date||t.created_at)}
                  {t.patient_name?` · ${t.patient_name}`:''}
                </Text>
                <View style={{flexDirection:'row',gap:6,alignItems:'center',marginTop:4}}>
                  <View style={[s.catBadge,{backgroundColor:isIncome?'#f0fdf4':'#fff7ed'}]}>
                    <Text style={[s.catText,{color:isIncome?'#16a34a':'#ea580c'}]}>{t.category||'Geral'}</Text>
                  </View>
                  <View style={[s.catBadge,{backgroundColor:'#f1f5f9'}]}>
                    <Text style={[s.catText,{color:'#64748b'}]}>{st.label.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
              <Text style={[s.txAmount,{color:isIncome?'#10b981':'#ef4444'}]}>
                {isIncome?'+':''}{fmtMoney(amount)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={()=>openNew()}>
        <Text style={s.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Modal de Edição/Criação */}
      <Modal visible={showEdit} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <View style={s.modalHeader}>
                <TouchableOpacity onPress={()=>setShowEdit(false)}><Text style={s.modalClose}>Cancelar</Text></TouchableOpacity>
                <Text style={s.modalTitle}>{editId?'Editar Lançamento':'Novo Lançamento'}</Text>
                <TouchableOpacity onPress={save} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#6366f1"/> : <Text style={s.modalSave}>Salvar</Text>}
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{padding:20}}>
                {/* Tipo Toggle */}
                <View style={[s.typeToggle, form.type==='expense'&&{backgroundColor:'#fef2f2'}]}>
                  {[['income','Receita','#10b981'],['expense','Despesa','#ef4444']].map(([v,l,c])=>(
                    <TouchableOpacity key={v} style={[s.typeBtn, form.type===v&&{backgroundColor:'#fff', shadowColor:'#000', shadowOpacity:0.1, elevation:2}]} onPress={()=>setForm(f=>({...f,type:v}))}>
                      <Text style={[s.typeBtnTxt, form.type===v&&{color:c, fontWeight:'800'}]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <F label="Descrição" value={form.description} onChange={v=>setForm(f=>({...f,description:v}))} placeholder="Ex: Aluguel, Sessão João..."/>
                
                <Row>
                  <View style={{flex:1.5}}>
                    <Text style={s.label}>Valor (R$)</Text>
                    <TextInput style={s.input} value={form.amount} onChangeText={v=>setForm(f=>({...f,amount:maskMoney(v)}))} keyboardType="numeric" placeholder="0,00"/>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={s.label}>Data</Text>
                    <TextInput style={s.input} value={form.date} onChangeText={v=>setForm(f=>({...f,date:v.replace(/\D/g,'').slice(0,8).replace(/^(\d{2})(\d)/,'$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/,'$1/$2/$3')}))} keyboardType="numeric" placeholder="DD/MM/AAAA"/>
                  </View>
                </Row>

                <View style={{marginBottom:15}}>
                  <Text style={s.label}>Categoria</Text>
                  <Select 
                    value={form.category} 
                    options={form.type==='income'?CATEGORIES_INCOME:CATEGORIES_EXPENSE} 
                    onSelect={v=>setForm(f=>({...f,category:v}))}
                  />
                </View>

                <View style={{marginBottom:15}}>
                  <Text style={s.label}>Meio de Pagamento</Text>
                  <Select 
                    value={form.payment_method} 
                    options={PAYMENT_METHODS} 
                    onSelect={v=>setForm(f=>({...f,payment_method:v}))}
                  />
                </View>

                <View style={{marginBottom:15}}>
                  <Text style={s.label}>Status</Text>
                  <Select 
                    value={form.status} 
                    options={STATUS_OPTIONS} 
                    onSelect={v=>setForm(f=>({...f,status:v}))}
                  />
                </View>
                
                <F label="Observações" value={form.observation} onChange={v=>setForm(f=>({...f,observation:v}))} multiline placeholder="Notas adicionais..."/>

                {editId && (
                  <TouchableOpacity style={s.deleteBtn} onPress={()=>confirmDelete(editId)}>
                    <Text style={s.deleteBtnTxt}>Excluir lançamento</Text>
                  </TouchableOpacity>
                )}
                
                <View style={{height:40}}/>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:'#f8fafc'},
  center:{flex:1,justifyContent:'center',alignItems:'center'},
  monthNav:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#1a3a5c',paddingHorizontal:16,paddingVertical:14},
  navBtn:{padding:8,backgroundColor:'rgba(255,255,255,0.12)',borderRadius:10,width:36,alignItems:'center'},
  navArrow:{color:'#fff',fontSize:22,fontWeight:'700',lineHeight:24},
  monthTitle:{fontSize:17,fontWeight:'900',color:'#fff'},
  summaryRow:{flexDirection:'row',gap:10,margin:14},
  sumCard:{flex:1,borderRadius:16,padding:14,alignItems:'center',gap:4},
  sumIcon:{fontSize:18,fontWeight:'900',color:'#10b981'},
  sumValue:{fontSize:14,fontWeight:'900'},
  sumLabel:{fontSize:10,fontWeight:'700',color:'#64748b',textTransform:'uppercase'},
  tabs:{flexDirection:'row',marginHorizontal:14,marginBottom:10,backgroundColor:'#f1f5f9',borderRadius:12,padding:3,gap:2},
  tab:{flex:1,paddingVertical:8,borderRadius:10,alignItems:'center'},
  tabActive:{backgroundColor:'#fff',shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.08,shadowRadius:4,elevation:2},
  tabText:{fontSize:13,fontWeight:'600',color:'#64748b'},
  tabTextActive:{color:'#6366f1',fontWeight:'800'},
  empty:{alignItems:'center',paddingTop:60},
  emptyText:{color:'#94a3b8',fontSize:15,fontWeight:'600'},
  txCard:{backgroundColor:'#fff',borderRadius:16,marginBottom:10,flexDirection:'row',alignItems:'center',gap:12,padding:14,shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.05,shadowRadius:4,elevation:2},
  txType:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center'},
  txInfo:{flex:1},
  txDesc:{fontSize:14,fontWeight:'700',color:'#0f172a'},
  txMeta:{fontSize:12,color:'#64748b',marginTop:2},
  catBadge:{alignSelf:'flex-start',backgroundColor:'#f5f3ff',paddingHorizontal:7,paddingVertical:2,borderRadius:6,marginTop:4},
  catText:{fontSize:10,fontWeight:'700',color:'#6366f1'},
  txAmount:{fontSize:15,fontWeight:'900'},

  fab: { position: 'absolute', bottom: 25, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  fabIcon: { color: '#fff', fontSize: 32, fontWeight: '300', marginTop: -2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalClose: { fontSize: 15, color: '#64748b' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  modalSave: { fontSize: 15, fontWeight: '800', color: '#6366f1' },

  typeToggle: { flexDirection: 'row', backgroundColor: '#f0fdf4', padding: 5, borderRadius: 14, marginBottom: 20 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  typeBtnTxt: { fontSize: 13, fontWeight: '600', color: '#64748b' },

  label: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15, color: '#0f172a', marginBottom: 15 },
  row: { flexDirection: 'row', gap: 12 },

  deleteBtn: { marginTop: 20, padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fee2e2' },
  deleteBtnTxt: { color: '#ef4444', fontWeight: '700', fontSize: 14 },
});

/* ─── Helpers ─────────────────────────────────────────── */
function F({ label, value, onChange, placeholder, ...props }) {
  return (
    <View style={{ marginBottom: 15 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={[s.input, props.multiline && { height: 80, textAlignVertical: 'top' }]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#94a3b8" {...props} />
    </View>
  );
}

function Row({ children }) { return <View style={s.row}>{children}</View>; }

function Select({ value, options, onSelect }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => String(o.value) === String(value));
  return (
    <>
      <TouchableOpacity style={s.input} onPress={() => setOpen(true)}>
        <Text style={{ color: selected ? '#0f172a' : '#94a3b8', fontSize: 15 }}>
          {selected ? selected.label : 'Selecionar...'}
        </Text>
        <Text style={{ position: 'absolute', right: 15, top: 13, color: '#94a3b8' }}>▼</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' }}>
            <ScrollView>
              {options.map(o => (
                <TouchableOpacity key={o.value} style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }} onPress={() => { onSelect(o.value); setOpen(false); }}>
                  <Text style={{ fontSize: 16, color: '#334155', fontWeight: value === o.value ? '800' : '400' }}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
