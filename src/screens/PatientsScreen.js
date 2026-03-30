import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { api } from '../services/api';

const { width: SW } = Dimensions.get('window');

/* ─── Helpers ─────────────────────────────────────────── */
const getName  = (p) => p?.name || p?.full_name || '';
const initials = (p) => {
  const n = getName(p); if (!n) return '?';
  return n.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
};
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('pt-BR');
};
const AVATAR_COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6'];
const avatarColor = (name) => AVATAR_COLORS[(name||'A').charCodeAt(0) % AVATAR_COLORS.length];

const STATUS_CONFIG = {
  active:   { label:'Ativo',      color:'#10b981', bg:'#f0fdf4', icon:'●' },
  waiting:  { label:'Em espera',  color:'#f59e0b', bg:'#fffbeb', icon:'◐' },
  inactive: { label:'Inativo',    color:'#94a3b8', bg:'#f8fafc', icon:'○' },
};
const getStatus = (s) => STATUS_CONFIG[s] || STATUS_CONFIG.inactive;

/* ─── Máscaras ────────────────────────────────────────── */
const maskCPF = v =>
  v.replace(/\D/g,'').slice(0,11)
   .replace(/(\d{3})(\d)/,'$1.$2')
   .replace(/(\d{3})\.(\d{3})(\d)/,'$1.$2.$3')
   .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})$/,'$1.$2.$3-$4');

const maskRG = v =>
  v.replace(/\D/g,'').slice(0,9)
   .replace(/(\d{2})(\d)/,'$1.$2')
   .replace(/(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
   .replace(/(\d{2})\.(\d{3})\.(\d{3})(\d)$/,'$1.$2.$3-$4');

const maskPhone = v => {
  const d = v.replace(/\D/g,'').slice(0,11);
  if (d.length<=10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})$/,(_,a,b,c)=>`(${a}) ${b}${c?'-'+c:''}`);
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})$/,(_,a,b,c)=>`(${a}) ${b}${c?'-'+c:''}`);
};

const maskCEP = v =>
  v.replace(/\D/g,'').slice(0,8)
   .replace(/^(\d{5})(\d{0,3})$/,(_,a,b)=>b?`${a}-${b}`:a);

const maskDate = v =>
  v.replace(/\D/g,'').slice(0,8)
   .replace(/^(\d{2})(\d)/,'$1/$2')
   .replace(/^(\d{2})\/(\d{2})(\d)/,'$1/$2/$3');

/* ─── ViaCEP ──────────────────────────────────────────── */
const fetchCEP = async (cep) => {
  const c = cep.replace(/\D/g,'');
  if (c.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
    const d = await r.json();
    return d.erro ? null : d;
  } catch { return null; }
};

/* ─── Form ────────────────────────────────────────────── */
const EMPTY = {
  name:'', email:'', phone:'', phone_country:'BR', phone2:'', phone2_country:'BR',
  cpf:'', rg:'', birth_date:'', gender:'', marital_status:'',
  education:'', profession:'', nationality:'', naturality:'',
  has_children: false, children_count:'0', minor_children_count:'0', spouse_name:'',
  family_contact:'', emergency_contact:'',
  responsible_name:'', responsible_phone:'',
  health_plan:'', diagnosis:'',
  zip_code:'', address:'', city:'', state:'',
  notes:'', status:'active',
  is_payer: true, payer_name:'', payer_cpf:'', payer_phone:'',
};

const toForm = (p) => {
  const bdate = p.birth_date
    ? (() => { const d=new Date(p.birth_date); return isNaN(d)?'':`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })()
    : '';
  return {
    name: getName(p), email: p.email||'',
    phone: p.phone||'', phone_country: p.phone_country||'BR',
    phone2: p.phone2||'', phone2_country: p.phone2_country||'BR',
    cpf: p.cpf||'', rg: p.rg||'',
    birth_date: bdate, gender: p.gender||'',
    marital_status: p.marital_status||'', education: p.education||'',
    profession: p.profession||'', nationality: p.nationality||'',
    naturality: p.naturality||'',
    has_children: !!p.has_children,
    children_count: String(p.children_count||0),
    minor_children_count: String(p.minor_children_count||0),
    spouse_name: p.spouse_name||'',
    family_contact: p.family_contact||'',
    emergency_contact: p.emergency_contact||'',
    responsible_name: p.responsible_name||'',
    responsible_phone: p.responsible_phone||'',
    health_plan: p.health_plan||'', diagnosis: p.diagnosis||'',
    zip_code: p.zip_code||'', address: p.address||'',
    city: p.city||'', state: p.state||'',
    notes: p.notes||'', status: p.status||'active',
    is_payer: p.is_payer!==false,
    payer_name: p.payer_name||'', payer_cpf: p.payer_cpf||'', payer_phone: p.payer_phone||'',
  };
};

const STATUS_FILTERS = [
  { key:'all',      label:'Todos',     color:'#6366f1' },
  { key:'active',   label:'Ativos',    color:'#10b981' },
  { key:'waiting',  label:'Em espera', color:'#f59e0b' },
  { key:'inactive', label:'Inativos',  color:'#94a3b8' },
];

/* ═══════════════════════════════════════════════════════ */
export default function PatientsScreen() {
  const [patients,   setPatients]   = useState([]);
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [showEdit,   setShowEdit]   = useState(false);
  const [form,       setForm]       = useState(EMPTY);
  const [editId,     setEditId]     = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/patients');
      const list = Array.isArray(data) ? data : (data.patients||[]);
      setPatients(list);
    } catch(e) { Alert.alert('Erro', e.message); }
    setLoading(false); setRefreshing(false);
  },[]);

  useEffect(()=>{ load(); },[load]);

  /* ── Filtro combinado (status + busca) ─── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return patients.filter(p => {
      const matchStatus = statusFilter === 'all' || (p.status||'active') === statusFilter;
      const matchSearch = !q ||
        getName(p).toLowerCase().includes(q) ||
        (p.email||'').toLowerCase().includes(q) ||
        (p.phone||'').includes(q) ||
        (p.cpf||'').includes(q);
      return matchStatus && matchSearch;
    });
  }, [search, statusFilter, patients]);

  /* ── Contadores por status ─── */
  const counts = useMemo(() => ({
    all:      patients.length,
    active:   patients.filter(p=>(p.status||'active')==='active').length,
    waiting:  patients.filter(p=>p.status==='waiting').length,
    inactive: patients.filter(p=>p.status==='inactive').length,
  }), [patients]);

  /* ── CEP ─── */
  const handleCEP = async (v) => {
    const m = maskCEP(v);
    setForm(f=>({...f,zip_code:m}));
    if (m.replace(/\D/g,'').length===8) {
      setCepLoading(true);
      const d = await fetchCEP(m);
      if (d) setForm(f=>({...f,
        address: [d.logradouro,d.bairro].filter(Boolean).join(', ')||f.address,
        city: d.localidade||f.city, state: d.uf||f.state,
      }));
      setCepLoading(false);
    }
  };

  const openDetail = (p) => setSelected(p);
  const closeDetail = () => setSelected(null);

  const openEdit = (p) => {
    setForm(toForm(p)); setEditId(p.id);
    setSelected(null); setShowEdit(true);
  };
  const openNew = () => { setForm(EMPTY); setEditId(null); setShowEdit(true); };

  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Atenção','Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        birth_date: form.birth_date ? form.birth_date.split('/').reverse().join('-') : '',
        children_count: parseInt(form.children_count)||0,
        minor_children_count: parseInt(form.minor_children_count)||0,
      };
      if (editId) await api.put(`/patients/${editId}`, payload);
      else        await api.post('/patients', payload);
      setShowEdit(false); load();
    } catch(e) { Alert.alert('Erro', e.message); }
    setSaving(false);
  };

  const deletePatient = (id, name) => Alert.alert('Excluir paciente',`Deseja excluir ${name}?`,[
    {text:'Cancelar',style:'cancel'},
    {text:'Excluir',style:'destructive', onPress: async()=>{
      try { await api.delete(`/patients/${id}`); setSelected(null); load(); }
      catch(e){ Alert.alert('Erro',e.message); }
    }},
  ]);

  /* ─── Card de paciente ─── */
  const renderItem = ({item:p}) => {
    const name   = getName(p);
    const color  = avatarColor(name);
    const status = getStatus(p.status||'active');
    return (
      <TouchableOpacity style={s.card} onPress={()=>openDetail(p)} activeOpacity={0.75}>
        {/* Avatar */}
        <View style={[s.avatar,{backgroundColor:color}]}>
          <Text style={s.avatarTxt}>{initials(p)}</Text>
          <View style={[s.avatarStatusRing,{borderColor:status.color}]}/>
        </View>

        {/* Info */}
        <View style={s.cardInfo}>
          <View style={s.cardTopRow}>
            <Text style={s.cardName} numberOfLines={1}>{name||'Sem nome'}</Text>
            <View style={[s.statusPill,{backgroundColor:status.bg}]}>
              <Text style={[s.statusPillTxt,{color:status.color}]}>{status.icon} {status.label}</Text>
            </View>
          </View>
          {(p.phone||p.email) && (
            <Text style={s.cardMeta} numberOfLines={1}>
              📞 {p.phone||p.email}
            </Text>
          )}
          {(p.profession||p.city) && (
            <Text style={s.cardSub} numberOfLines={1}>
              {[p.profession, p.city].filter(Boolean).join('  ·  ')}
            </Text>
          )}
        </View>

        <Text style={s.cardChevron}>›</Text>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#6366f1"/>
      <Text style={{color:'#64748b',marginTop:12,fontSize:13,fontWeight:'600'}}>Carregando pacientes…</Text>
    </View>
  );

  return (
    <View style={s.container}>

      {/* ── Barra de busca ── */}
      <View style={s.searchBar}>
        <Text style={{fontSize:15}}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome, CPF, telefone..."
          placeholderTextColor="#94a3b8"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={()=>setSearch('')} style={s.clearBtn}>
            <Text style={s.clearBtnTxt}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filtros de status ── */}
      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
          {STATUS_FILTERS.map(f => {
            const active = statusFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[s.filterChip, active && {backgroundColor:f.color, borderColor:f.color}]}
                onPress={()=>setStatusFilter(f.key)}
                activeOpacity={0.75}>
                <Text style={[s.filterChipTxt, active && {color:'#fff'}]}>{f.label}</Text>
                <View style={[s.filterBadge, active && {backgroundColor:'rgba(255,255,255,0.25)'}]}>
                  <Text style={[s.filterBadgeTxt, active && {color:'#fff'}]}>{counts[f.key]}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Lista ── */}
      <FlatList
        data={filtered}
        keyExtractor={i=>String(i.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor="#6366f1"/>}
        contentContainerStyle={{padding:12, paddingBottom:90}}
        ListHeaderComponent={
          <View style={s.listHeader}>
            <Text style={s.listCount}>
              {filtered.length} paciente{filtered.length!==1?'s':''}
              {statusFilter!=='all' ? ` · ${STATUS_FILTERS.find(f=>f.key===statusFilter)?.label}` : ''}
              {search ? ` · "${search}"` : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{fontSize:52, marginBottom:12}}>👥</Text>
            <Text style={s.emptyTitle}>
              {search ? 'Nenhum resultado' : 'Nenhum paciente'}
            </Text>
            <Text style={s.emptyTxt}>
              {search
                ? `"${search}" não encontrado`
                : statusFilter!=='all'
                  ? `Sem pacientes ${STATUS_FILTERS.find(f=>f.key===statusFilter)?.label.toLowerCase()}`
                  : 'Adicione seu primeiro paciente'}
            </Text>
            {(search||statusFilter!=='all') && (
              <TouchableOpacity style={s.emptyReset} onPress={()=>{setSearch('');setStatusFilter('all');}}>
                <Text style={s.emptyResetTxt}>Limpar filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* ── FAB ── */}
      <TouchableOpacity style={s.fab} onPress={openNew} activeOpacity={0.85}>
        <Text style={s.fabTxt}>+</Text>
      </TouchableOpacity>

      {/* ══ MODAL DETALHE ══ */}
      {selected && (
        <Modal visible animationType="slide" presentationStyle="pageSheet">
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={closeDetail}><Text style={s.modalCancel}>Fechar</Text></TouchableOpacity>
            <Text style={s.modalTitle}>Paciente</Text>
            <TouchableOpacity onPress={()=>openEdit(selected)}><Text style={s.modalSave}>Editar</Text></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:50}}>
            {/* Hero */}
            <View style={[s.detailHero,{backgroundColor:avatarColor(getName(selected))}]}>
              <View style={s.detailDecor}/>
              <View style={s.detailAvatarRing}>
                <View style={s.detailAvatar}>
                  <Text style={s.detailAvatarTxt}>{initials(selected)}</Text>
                </View>
              </View>
              <Text style={s.detailName}>{getName(selected)||'Sem nome'}</Text>
              {(selected.profession||selected.city) && (
                <Text style={s.detailSub}>{[selected.profession,selected.city].filter(Boolean).join(' · ')}</Text>
              )}
              {/* Status badge */}
              {(() => {
                const st = getStatus(selected.status||'active');
                return (
                  <View style={[s.detailStatusBadge,{backgroundColor:'rgba(255,255,255,0.18)',borderColor:'rgba(255,255,255,0.3)'}]}>
                    <View style={[s.detailStatusDot,{backgroundColor:'#fff'}]}/>
                    <Text style={s.detailStatusTxt}>{st.label.toUpperCase()}</Text>
                  </View>
                );
              })()}
              {/* Quick stats */}
              <View style={s.heroStats}>
                {selected.phone && (
                  <View style={s.heroStat}>
                    <Text style={s.heroStatIcon}>📞</Text>
                    <Text style={s.heroStatVal} numberOfLines={1}>{selected.phone}</Text>
                  </View>
                )}
                {selected.email && (
                  <View style={s.heroStat}>
                    <Text style={s.heroStatIcon}>✉️</Text>
                    <Text style={s.heroStatVal} numberOfLines={1}>{selected.email}</Text>
                  </View>
                )}
                {selected.birth_date && (
                  <View style={s.heroStat}>
                    <Text style={s.heroStatIcon}>🎂</Text>
                    <Text style={s.heroStatVal}>{fmtDate(selected.birth_date)}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{padding:16,gap:12}}>
              <InfoSection title="📋 Dados pessoais" items={[
                {label:'CPF',          value:selected.cpf},
                {label:'RG',           value:selected.rg},
                {label:'Nascimento',   value:fmtDate(selected.birth_date)},
                {label:'Gênero',       value:selected.gender},
                {label:'Estado civil', value:selected.marital_status},
                {label:'Escolaridade', value:selected.education},
                {label:'Profissão',    value:selected.profession},
                {label:'Nacionalidade',value:selected.nationality},
                {label:'Naturalidade', value:selected.naturality},
              ]}/>

              <InfoSection title="📞 Contato" items={[
                {label:'Telefone',   value:selected.phone},
                {label:'Telefone 2', value:selected.phone2},
                {label:'E-mail',     value:selected.email},
              ]}/>

              {(selected.zip_code||selected.address||selected.city) && (
                <InfoSection title="📍 Endereço" items={[
                  {label:'CEP',     value:selected.zip_code},
                  {label:'Endereço',value:selected.address},
                  {label:'Cidade',  value:[selected.city,selected.state].filter(Boolean).join(' — ')},
                ]}/>
              )}

              {(selected.health_plan||selected.diagnosis) && (
                <InfoSection title="🏥 Dados clínicos" items={[
                  {label:'Plano de saúde',  value:selected.health_plan},
                  {label:'Diagnóstico/CID', value:selected.diagnosis},
                ]}/>
              )}

              {!!(selected.spouse_name||selected.family_contact||selected.has_children) && (
                <InfoSection title="👨‍👩‍👧 Família" items={[
                  {label:'Cônjuge',          value:selected.spouse_name},
                  {label:'Tem filhos',       value:selected.has_children?`Sim (${selected.children_count||0})`:null},
                  {label:'Contato familiar', value:selected.family_contact},
                ]}/>
              )}

              {(selected.emergency_contact||selected.responsible_name) && (
                <InfoSection title="🚨 Emergência e responsável" items={[
                  {label:'Contato de emergência', value:selected.emergency_contact},
                  {label:'Responsável',           value:selected.responsible_name},
                  {label:'Tel. responsável',      value:selected.responsible_phone},
                ]}/>
              )}

              {(!selected.is_payer||selected.payer_name) && (
                <InfoSection title="💳 Responsável financeiro" items={[
                  {label:'Paga próprio', value:selected.is_payer?'Sim':'Não'},
                  {label:'Responsável',  value:selected.payer_name},
                  {label:'CPF resp.',    value:selected.payer_cpf},
                  {label:'Tel. resp.',   value:selected.payer_phone},
                ]}/>
              )}

              {selected.notes && (
                <View style={s.infoSection}>
                  <Text style={s.infoSectionTitle}>📝 Observações</Text>
                  <Text style={{fontSize:14,color:'#334155',lineHeight:22}}>{selected.notes}</Text>
                </View>
              )}

              {/* Ações */}
              <View style={{flexDirection:'row',gap:10}}>
                <TouchableOpacity style={[s.detailAction,{backgroundColor:'#f5f3ff',flex:1}]} onPress={()=>openEdit(selected)}>
                  <Text style={[s.detailActionTxt,{color:'#6366f1'}]}>✏️  Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.detailAction,{backgroundColor:'#fef2f2'}]} onPress={()=>deletePatient(selected.id,getName(selected))}>
                  <Text style={[s.detailActionTxt,{color:'#ef4444'}]}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </Modal>
      )}

      {/* ══ MODAL EDIÇÃO / CRIAÇÃO ══ */}
      <Modal visible={showEdit} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={()=>setShowEdit(false)}><Text style={s.modalCancel}>Cancelar</Text></TouchableOpacity>
            <Text style={s.modalTitle}>{editId?'Editar Paciente':'Novo Paciente'}</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              {saving?<ActivityIndicator color="#6366f1"/>:<Text style={s.modalSave}>Salvar</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{padding:20}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* STATUS — no topo para visibilidade imediata */}
            <View style={s.statusEditBox}>
              <Text style={s.fieldLabel}>Status do paciente</Text>
              <View style={{flexDirection:'row',gap:8}}>
                {[['active','✅ Ativo'],['waiting','⏳ Em espera'],['inactive','⛔ Inativo']].map(([v,l])=>(
                  <TouchableOpacity key={v} style={[s.statusEditChip,{flex:1},form.status===v&&{backgroundColor:getStatus(v).color,borderColor:getStatus(v).color}]}
                    onPress={()=>setForm(f=>({...f,status:v}))}>
                    <Text style={[s.statusEditChipTxt,{fontSize:10},form.status===v&&{color:'#fff'}]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── DADOS PESSOAIS ── */}
            <SectionHeader title="📋 Dados pessoais"/>
            <F label="Nome completo *" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} autoCapitalize="words"/>

            <Row>
              <F half label="CPF" value={form.cpf} onChange={v=>setForm(f=>({...f,cpf:maskCPF(v)}))} keyboard="numeric" placeholder="000.000.000-00"/>
              <F half label="RG"  value={form.rg}  onChange={v=>setForm(f=>({...f,rg:maskRG(v)}))}  keyboard="numeric" placeholder="00.000.000-0"/>
            </Row>

            <Row>
              <F half label="Nascimento" value={form.birth_date} onChange={v=>setForm(f=>({...f,birth_date:maskDate(v)}))} keyboard="numeric" placeholder="DD/MM/AAAA"/>
              <View style={{flex:1}}>
                <Text style={s.fieldLabel}>Gênero</Text>
                <View style={{flexDirection:'row',gap:5,flexWrap:'wrap'}}>
                  {[['M','Masc.'],['F','Fem.'],['O','Outro'],['NB','N-Bin.']].map(([v,l])=>(
                    <TouchableOpacity key={v} style={[s.chip,form.gender===v&&s.chipOn]} onPress={()=>setForm(f=>({...f,gender:v}))}>
                      <Text style={[s.chipTxt,form.gender===v&&s.chipTxtOn]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Row>

            <View style={{marginBottom:14}}>
              <Text style={s.fieldLabel}>Estado civil</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6}}>
                {[['solteiro','Solteiro'],['casado','Casado'],['divorciado','Divorciado'],['viuvo','Viúvo'],['uniao_estavel','União estável'],['separado','Separado']].map(([v,l])=>(
                  <TouchableOpacity key={v} style={[s.chip,form.marital_status===v&&s.chipOn]} onPress={()=>setForm(f=>({...f,marital_status:v}))}>
                    <Text style={[s.chipTxt,form.marital_status===v&&s.chipTxtOn]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <F label="Profissão"    value={form.profession}  onChange={v=>setForm(f=>({...f,profession:v}))}  autoCapitalize="words"/>
            <F label="Escolaridade" value={form.education}   onChange={v=>setForm(f=>({...f,education:v}))}   autoCapitalize="words"/>
            <F label="Nacionalidade"value={form.nationality} onChange={v=>setForm(f=>({...f,nationality:v}))} autoCapitalize="words"/>
            <F label="Naturalidade" value={form.naturality}  onChange={v=>setForm(f=>({...f,naturality:v}))}  autoCapitalize="words"/>

            {/* ── CONTATO ── */}
            <SectionHeader title="📞 Contato"/>
            <F label="Telefone / WhatsApp" value={form.phone}  onChange={v=>setForm(f=>({...f,phone:maskPhone(v)}))}  keyboard="phone-pad" placeholder="(11) 99999-9999"/>
            <F label="Telefone 2 (opcional)" value={form.phone2} onChange={v=>setForm(f=>({...f,phone2:maskPhone(v)}))} keyboard="phone-pad" placeholder="(11) 99999-9999"/>
            <F label="E-mail" value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} keyboard="email-address" autoCapitalize="none"/>

            {/* ── ENDEREÇO ── */}
            <SectionHeader title="📍 Endereço"/>
            <View style={{marginBottom:14}}>
              <Text style={s.fieldLabel}>CEP{cepLoading?' (buscando...)':''}</Text>
              <View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
                <TextInput style={[s.fieldInput,{flex:1}]} value={form.zip_code} onChangeText={handleCEP}
                  placeholder="00000-000" placeholderTextColor="#94a3b8" keyboardType="numeric"/>
                {cepLoading&&<ActivityIndicator color="#6366f1"/>}
              </View>
            </View>
            <F label="Endereço completo" value={form.address} onChange={v=>setForm(f=>({...f,address:v}))} autoCapitalize="words" placeholder="Rua, número, bairro..."/>
            <Row>
              <F half label="Cidade" value={form.city}  onChange={v=>setForm(f=>({...f,city:v}))} autoCapitalize="words"/>
              <F style={{flex:0.3}} label="UF" value={form.state} onChange={v=>setForm(f=>({...f,state:v.toUpperCase()}))} autoCapitalize="characters" maxLength={2}/>
            </Row>

            {/* ── DADOS CLÍNICOS ── */}
            <SectionHeader title="🏥 Dados clínicos"/>
            <F label="Plano de saúde / Convênio" value={form.health_plan} onChange={v=>setForm(f=>({...f,health_plan:v}))} autoCapitalize="words"/>
            <View style={{marginBottom:14}}>
              <Text style={s.fieldLabel}>Diagnóstico / CID</Text>
              <TextInput style={[s.fieldInput,{height:70,textAlignVertical:'top'}]} value={form.diagnosis}
                onChangeText={v=>setForm(f=>({...f,diagnosis:v}))} placeholder="CID, diagnóstico, hipóteses..." placeholderTextColor="#94a3b8" multiline/>
            </View>

            {/* ── FAMÍLIA ── */}
            <SectionHeader title="👨‍👩‍👧 Família"/>
            <View style={{marginBottom:14}}>
              <Text style={s.fieldLabel}>Tem filhos?</Text>
              <View style={{flexDirection:'row',gap:10}}>
                {[[true,'Sim'],[false,'Não']].map(([v,l])=>(
                  <TouchableOpacity key={l} style={[s.chip,{flex:1},form.has_children===v&&s.chipOn]} onPress={()=>setForm(f=>({...f,has_children:v}))}>
                    <Text style={[s.chipTxt,form.has_children===v&&s.chipTxtOn]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {form.has_children&&(
              <Row>
                <F half label="Nº de filhos"   value={form.children_count}       onChange={v=>setForm(f=>({...f,children_count:v}))} keyboard="numeric"/>
                <F half label="Filhos menores" value={form.minor_children_count} onChange={v=>setForm(f=>({...f,minor_children_count:v}))} keyboard="numeric"/>
              </Row>
            )}
            <F label="Nome do cônjuge"  value={form.spouse_name}    onChange={v=>setForm(f=>({...f,spouse_name:v}))}    autoCapitalize="words"/>
            <F label="Contato familiar" value={form.family_contact} onChange={v=>setForm(f=>({...f,family_contact:v}))} placeholder="Nome e telefone..."/>

            {/* ── EMERGÊNCIA ── */}
            <SectionHeader title="🚨 Contato de emergência"/>
            <F label="Nome e telefone"            value={form.emergency_contact} onChange={v=>setForm(f=>({...f,emergency_contact:v}))} placeholder="Ex: Maria — (11) 99999-0000"/>
            <F label="Responsável legal (nome)"   value={form.responsible_name}  onChange={v=>setForm(f=>({...f,responsible_name:v}))}  autoCapitalize="words"/>
            <F label="Telefone do responsável"    value={form.responsible_phone} onChange={v=>setForm(f=>({...f,responsible_phone:maskPhone(v)}))} keyboard="phone-pad"/>

            {/* ── PAGAMENTO ── */}
            <SectionHeader title="💳 Responsável financeiro"/>
            <View style={{marginBottom:14}}>
              <Text style={s.fieldLabel}>Quem paga as sessões?</Text>
              <View style={{flexDirection:'row',gap:10}}>
                {[[true,'O próprio paciente'],[false,'Outra pessoa']].map(([v,l])=>(
                  <TouchableOpacity key={l} style={[s.chip,{flex:1},form.is_payer===v&&s.chipOn]} onPress={()=>setForm(f=>({...f,is_payer:v}))}>
                    <Text style={[s.chipTxt,form.is_payer===v&&s.chipTxtOn]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {!form.is_payer&&(<>
              <F label="Nome do responsável" value={form.payer_name}  onChange={v=>setForm(f=>({...f,payer_name:v}))}  autoCapitalize="words"/>
              <F label="CPF do responsável"  value={form.payer_cpf}   onChange={v=>setForm(f=>({...f,payer_cpf:maskCPF(v)}))}  keyboard="numeric" placeholder="000.000.000-00"/>
              <F label="Tel. do responsável" value={form.payer_phone} onChange={v=>setForm(f=>({...f,payer_phone:maskPhone(v)}))} keyboard="phone-pad"/>
            </>)}

            {/* ── OBSERVAÇÕES ── */}
            <SectionHeader title="📝 Observações"/>
            <View style={{marginBottom:14}}>
              <TextInput style={[s.fieldInput,{height:90,textAlignVertical:'top'}]} value={form.notes}
                onChangeText={v=>setForm(f=>({...f,notes:v}))} placeholder="Anotações gerais sobre o paciente..."
                placeholderTextColor="#94a3b8" multiline/>
            </View>

            {editId&&(
              <TouchableOpacity style={s.deleteBtn} onPress={()=>{setShowEdit(false);setTimeout(()=>deletePatient(editId,form.name),300);}}>
                <Text style={s.deleteBtnTxt}>🗑️  Excluir paciente</Text>
              </TouchableOpacity>
            )}
            <View style={{height:40}}/>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* ─── Sub-componentes ─────────────────────────────────── */
function SectionHeader({title}) {
  return (
    <View style={s.sectionHeaderWrap}>
      <View style={s.sectionHeaderLine}/>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function Row({children}) {
  return <View style={{flexDirection:'row',gap:10}}>{children}</View>;
}

function F({label,value,onChange,keyboard,placeholder,half,style,...props}) {
  return (
    <View style={[{marginBottom:14},half&&{flex:1},style]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.fieldInput} value={value} onChangeText={onChange}
        placeholder={placeholder||label} placeholderTextColor="#94a3b8"
        keyboardType={keyboard||'default'} {...props}/>
    </View>
  );
}

function InfoSection({title, items}) {
  const visible = items.filter(i=>i.value&&String(i.value).trim());
  if (!visible.length) return null;
  return (
    <View style={s.infoSection}>
      <Text style={s.infoSectionTitle}>{title}</Text>
      {visible.map(i=>(
        <View key={i.label} style={s.infoRow}>
          <Text style={s.infoLabel}>{i.label}</Text>
          <Text style={s.infoValue}>{i.value}</Text>
        </View>
      ))}
    </View>
  );
}

/* ─── Estilos ─────────────────────────────────────────── */
const s = StyleSheet.create({
  container: {flex:1, backgroundColor:'#f1f5f9'},
  center:    {flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#f1f5f9'},

  /* Search */
  searchBar:   {backgroundColor:'#fff', flexDirection:'row', alignItems:'center',
                 paddingHorizontal:14, paddingVertical:10, gap:10,
                 borderBottomWidth:1, borderBottomColor:'#e2e8f0'},
  searchInput: {flex:1, fontSize:15, color:'#1e293b'},
  clearBtn:    {width:24, height:24, borderRadius:12, backgroundColor:'#f1f5f9',
                 alignItems:'center', justifyContent:'center'},
  clearBtnTxt: {fontSize:11, color:'#94a3b8', fontWeight:'700'},

  /* Filter bar */
  filterBar:    {backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#e2e8f0'},
  filterScroll: {paddingHorizontal:14, paddingVertical:10, gap:8},
  filterChip:   {flexDirection:'row', alignItems:'center', gap:6,
                  paddingHorizontal:12, paddingVertical:6, borderRadius:20,
                  borderWidth:1.5, borderColor:'#e2e8f0', backgroundColor:'#f8fafc'},
  filterChipTxt:{fontSize:12, fontWeight:'700', color:'#64748b'},
  filterBadge:  {backgroundColor:'#f1f5f9', paddingHorizontal:6, paddingVertical:1, borderRadius:10},
  filterBadgeTxt:{fontSize:10, fontWeight:'800', color:'#94a3b8'},

  /* List header */
  listHeader: {marginBottom:8},
  listCount:  {fontSize:11, color:'#94a3b8', fontWeight:'800', textTransform:'uppercase', letterSpacing:0.5},

  /* Card */
  card:      {backgroundColor:'#fff', borderRadius:16, padding:14, marginBottom:8,
               flexDirection:'row', alignItems:'center', gap:12,
               shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4, elevation:2},
  avatar:    {width:48, height:48, borderRadius:24, alignItems:'center', justifyContent:'center', position:'relative'},
  avatarTxt: {color:'#fff', fontWeight:'900', fontSize:16},
  avatarStatusRing:{position:'absolute', bottom:-1, right:-1, width:14, height:14,
                     borderRadius:7, borderWidth:2.5, borderColor:'#fff', backgroundColor:'transparent'},
  cardTopRow:{flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:4},
  cardInfo:  {flex:1},
  cardName:  {fontSize:15, fontWeight:'800', color:'#0f172a', flex:1, marginRight:8},
  cardMeta:  {fontSize:12, color:'#64748b', marginTop:1},
  cardSub:   {fontSize:11, color:'#94a3b8', marginTop:2},
  cardChevron:{color:'#cbd5e1', fontSize:22, paddingLeft:4},

  statusPill:   {flexDirection:'row', alignItems:'center', paddingHorizontal:8, paddingVertical:3, borderRadius:20},
  statusPillTxt:{fontSize:10, fontWeight:'800'},

  /* Empty */
  empty:      {alignItems:'center', paddingTop:60, gap:6},
  emptyTitle: {fontSize:17, fontWeight:'900', color:'#1e293b'},
  emptyTxt:   {fontSize:13, color:'#94a3b8'},
  emptyReset: {marginTop:12, backgroundColor:'#f5f3ff', paddingHorizontal:20, paddingVertical:10, borderRadius:12},
  emptyResetTxt:{fontSize:13, fontWeight:'800', color:'#6366f1'},

  /* FAB */
  fab:    {position:'absolute', right:20, bottom:24, width:58, height:58, borderRadius:29,
            backgroundColor:'#6366f1', alignItems:'center', justifyContent:'center',
            shadowColor:'#6366f1', shadowOffset:{width:0,height:6}, shadowOpacity:0.4, shadowRadius:12, elevation:12},
  fabTxt: {color:'#fff', fontSize:32, fontWeight:'300', marginTop:-2},

  /* Modal header */
  modalHeader: {flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                 padding:16, borderBottomWidth:1, borderBottomColor:'#e2e8f0', backgroundColor:'#fff'},
  modalCancel: {color:'#ef4444', fontSize:15, fontWeight:'700'},
  modalTitle:  {fontSize:17, fontWeight:'900', color:'#0f172a'},
  modalSave:   {color:'#6366f1', fontSize:15, fontWeight:'800'},

  /* Detail hero */
  detailHero:      {padding:28, alignItems:'center', paddingBottom:22, overflow:'hidden'},
  detailDecor:     {position:'absolute', width:250, height:250, borderRadius:125,
                     backgroundColor:'rgba(255,255,255,0.08)', top:-80, right:-80},
  detailAvatarRing:{width:92, height:92, borderRadius:46, borderWidth:3,
                     borderColor:'rgba(255,255,255,0.35)', alignItems:'center', justifyContent:'center', marginBottom:12},
  detailAvatar:    {width:80, height:80, borderRadius:40, backgroundColor:'rgba(255,255,255,0.25)',
                     alignItems:'center', justifyContent:'center'},
  detailAvatarTxt: {color:'#fff', fontWeight:'900', fontSize:30},
  detailName:      {fontSize:22, fontWeight:'900', color:'#fff', textAlign:'center', marginBottom:4},
  detailSub:       {fontSize:13, color:'rgba(255,255,255,0.75)', marginBottom:10},
  detailStatusBadge:{flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:14, paddingVertical:5,
                      borderRadius:20, borderWidth:1, marginBottom:14},
  detailStatusDot: {width:6, height:6, borderRadius:3},
  detailStatusTxt: {color:'#fff', fontWeight:'800', fontSize:10, letterSpacing:0.8},
  heroStats:       {flexDirection:'row', flexWrap:'wrap', justifyContent:'center', gap:10, marginTop:4},
  heroStat:        {flexDirection:'row', alignItems:'center', gap:5,
                     backgroundColor:'rgba(255,255,255,0.12)', paddingHorizontal:10, paddingVertical:5, borderRadius:12},
  heroStatIcon:    {fontSize:12},
  heroStatVal:     {fontSize:11, fontWeight:'700', color:'#fff', maxWidth:120},

  /* Detail actions */
  detailAction:    {paddingVertical:14, borderRadius:14, alignItems:'center', paddingHorizontal:20},
  detailActionTxt: {fontSize:14, fontWeight:'800'},

  /* Info sections */
  infoSection:      {backgroundColor:'#fff', borderRadius:16, padding:16,
                      shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4, elevation:2},
  infoSectionTitle: {fontSize:13, fontWeight:'900', color:'#1a3a5c', marginBottom:10},
  infoRow:          {flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start',
                      paddingVertical:7, borderBottomWidth:1, borderBottomColor:'#f8fafc'},
  infoLabel:        {fontSize:12, fontWeight:'700', color:'#94a3b8', flex:1},
  infoValue:        {fontSize:13, fontWeight:'600', color:'#1e293b', flex:2, textAlign:'right'},

  /* Form */
  statusEditBox:    {backgroundColor:'#f8fafc', borderRadius:14, padding:14, marginBottom:16,
                      borderWidth:1, borderColor:'#e2e8f0'},
  statusEditChip:   {paddingVertical:9, borderRadius:10, borderWidth:1.5,
                      borderColor:'#e2e8f0', backgroundColor:'#fff', alignItems:'center'},
  statusEditChipTxt:{fontWeight:'800', color:'#64748b'},

  sectionHeaderWrap:{flexDirection:'row', alignItems:'center', gap:10, marginTop:16, marginBottom:12},
  sectionHeaderLine:{height:2, width:4, backgroundColor:'#6366f1', borderRadius:2},
  sectionTitle:     {fontSize:13, fontWeight:'900', color:'#1a3a5c'},

  fieldLabel:  {fontSize:11, fontWeight:'800', color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5},
  fieldInput:  {borderWidth:1.5, borderColor:'#e2e8f0', borderRadius:12, paddingHorizontal:14,
                 paddingVertical:11, fontSize:15, color:'#0f172a', backgroundColor:'#f8fafc'},

  chip:      {paddingHorizontal:12, paddingVertical:7, borderRadius:10, borderWidth:1.5, borderColor:'#e2e8f0', backgroundColor:'#f8fafc', alignItems:'center'},
  chipOn:    {backgroundColor:'#6366f1', borderColor:'#6366f1'},
  chipTxt:   {fontSize:12, fontWeight:'700', color:'#64748b'},
  chipTxtOn: {color:'#fff'},

  deleteBtn:    {backgroundColor:'#fef2f2', borderRadius:12, padding:14, alignItems:'center', marginTop:14, borderWidth:1, borderColor:'#fecaca'},
  deleteBtnTxt: {color:'#ef4444', fontWeight:'800', fontSize:14},
});
