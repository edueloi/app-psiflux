import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { api } from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');

/* ─── Constantes ─────────────────────────── */
const STATUS_COLOR  = { scheduled:'#3b82f6', confirmed:'#10b981', completed:'#6366f1', cancelled:'#ef4444', 'no-show':'#f59e0b', rescheduled:'#8b5cf6' };
const STATUS_LABEL  = { scheduled:'Agendado', confirmed:'Confirmado', completed:'Realizado', cancelled:'Cancelado', 'no-show':'Faltou', rescheduled:'Reagendado' };
const STATUSES      = ['scheduled','confirmed','completed','cancelled','no-show','rescheduled'];
const MONTHS_PT     = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS_SHORT    = ['D','S','T','Q','Q','S','S'];

const RECURRENCE_OPTIONS = [
  { label:'Não Repete',                            freq:'',             interval:1,  count:1  },
  // Semanal
  { label:'Semanal — 4 sessões',                  freq:'WEEKLY',       interval:1,  count:4  },
  { label:'Semanal — 8 sessões',                  freq:'WEEKLY',       interval:1,  count:8  },
  { label:'Semanal — 12 sessões',                 freq:'WEEKLY',       interval:1,  count:12 },
  { label:'Semanal — 16 sessões',                 freq:'WEEKLY',       interval:1,  count:16 },
  { label:'Semanal — 20 sessões',                 freq:'WEEKLY',       interval:1,  count:20 },
  // 2x por semana
  { label:'2x por semana — 8 sessões (4 semanas)',freq:'TWICE_WEEKLY', interval:1,  count:8  },
  { label:'2x por semana — 16 sessões (8 semanas)',freq:'TWICE_WEEKLY',interval:1,  count:16 },
  { label:'2x por semana — 24 sessões (12 semanas)',freq:'TWICE_WEEKLY',interval:1, count:24 },
  // 3x por semana
  { label:'3x por semana — 12 sessões (4 semanas)',freq:'THREE_WEEKLY',interval:1,  count:12 },
  { label:'3x por semana — 24 sessões (8 semanas)',freq:'THREE_WEEKLY',interval:1,  count:24 },
  // Quinzenal
  { label:'Quinzenal — 2 sessões',                freq:'WEEKLY',       interval:2,  count:2  },
  { label:'Quinzenal — 4 sessões',                freq:'WEEKLY',       interval:2,  count:4  },
  { label:'Quinzenal — 8 sessões',                freq:'WEEKLY',       interval:2,  count:8  },
  { label:'Quinzenal — 12 sessões',               freq:'WEEKLY',       interval:2,  count:12 },
  { label:'Quinzenal — 16 sessões',               freq:'WEEKLY',       interval:2,  count:16 },
  { label:'Quinzenal — 24 sessões',               freq:'WEEKLY',       interval:2,  count:24 },
  // A cada 15 dias
  { label:'A cada 15 dias — 4 sessões',           freq:'DAILY',        interval:15, count:4  },
  { label:'A cada 15 dias — 8 sessões',           freq:'DAILY',        interval:15, count:8  },
  // Mensal
  { label:'Mensal — 3 sessões',                   freq:'MONTHLY',      interval:1,  count:3  },
  { label:'Mensal — 6 sessões',                   freq:'MONTHLY',      interval:1,  count:6  },
  { label:'Mensal — 12 sessões',                  freq:'MONTHLY',      interval:1,  count:12 },
  // Personalizado
  { label:'Personalizado...', freq:'CUSTOM', interval:1, count:1 },
];
const FREQ_LABELS = { DAILY:'Diariamente', WEEKLY:'Semanalmente', MONTHLY:'Mensalmente', YEARLY:'Anualmente' };
const FREQ_UNIT   = { DAILY:'Dia(s)', WEEKLY:'Semana(s)', MONTHLY:'Mês(es)', YEARLY:'Ano(s)' };

/* ─── Helpers ────────────────────────────── */
const fmtTime  = (d) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? '' : dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); };
const getTime  = (iso) => { if (!iso) return ''; const t = iso.split('T')[1]; return t ? t.slice(0,5) : ''; };
const calcEnd  = (startISO, durMin) => {
  if (!startISO) return '';
  const d = new Date(startISO.length===5 ? `1970-01-01T${startISO}:00` : startISO.includes(':00:') ? startISO : startISO+':00');
  if (isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() + (parseInt(durMin)||50));
  const datePart = startISO.includes('T') ? startISO.split('T')[0] : new Date().toISOString().split('T')[0];
  return `${datePart}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};
const todayISO = ()  => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
// Usa T12:00:00 para evitar problema de timezone (UTC-3 faz meia-noite virar dia anterior no toISOString)
const toISO    = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays  = (iso, n) => { const d = new Date(iso+'T12:00:00'); d.setDate(d.getDate()+n); return toISO(d); };
const isoToDate= (iso) => new Date(iso+'T12:00:00');
const startOfWeek = (iso) => { const d = isoToDate(iso); d.setDate(d.getDate()-d.getDay()); return toISO(d); };
const startOfMonth= (iso) => { const [y,m] = iso.split('-'); return `${y}-${m}-01`; };

export default function AgendaScreen() {
  /* ── state ─────────────────────────── */
  const [view,         setView]         = useState('week');   // 'week' | 'month'
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [anchor,       setAnchor]       = useState(todayISO()); // week-start ou month-start
  const [appointments, setAppointments] = useState([]);
  const [patients,     setPatients]     = useState([]);
  const [services,     setServices]     = useState([]);
  const [professionals,setProfessionals]= useState([]);
  const [packages,     setPackages]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [showAptModal, setShowAptModal] = useState(false);
  const [showCmdModal, setShowCmdModal] = useState(false);
  const [showCalPicker,    setShowCalPicker]     = useState(false);
  const [calPickerAnchor,  setCalPickerAnchor]   = useState(todayISO());
  const [showRecModal,     setShowRecModal]      = useState(false); // lista de opções
  const [showRecCustom,    setShowRecCustom]     = useState(false); // config personalizado
  const [tempRec, setTempRec] = useState({ freq:'WEEKLY', interval:1, endType:'count', endValue:4 });
  const [showStatus,   setShowStatus]   = useState(null);
  const [showFab,      setShowFab]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [detailApt,    setDetailApt]    = useState(null);
  const [detailComanda,setDetailComanda]= useState(null);
  const [detailCmdLoad,setDetailCmdLoad]= useState(false);
  const [aptType,      setAptType]      = useState('consulta');
  const [patFocused,   setPatFocused]   = useState(false);
  // Comanda do paciente no modal de agendamento
  const [aptPatComandas, setAptPatComandas] = useState([]);
  const [aptPatCmdLoad,  setAptPatCmdLoad]  = useState(false);
  const [aptForm, setAptForm] = useState({
    patient_id:'', title:'', start:'', end:'', modality:'presencial',
    notes:'', status:'scheduled', type:'consulta',
    service_id:'', professional_id:'', package_id:'', duration_minutes:'50', comanda_id:'', meeting_url:'',
    recurrence_freq:'', recurrence_interval:1, recurrence_count:1, recurrence_end_date:''
  });
  const [cmdForm, setCmdForm] = useState({ type:'normal', patient_id:'', professional_id:'', description:'', date:todayISO(), items:[], discount_type:'fixed', discount_value:'0', sessions_total:'1', manual_total:'', package_id:'', status:'open' });
  const [cmdServiceAdd, setCmdServiceAdd] = useState('');
  const [cmdPackageAdd, setCmdPackageAdd] = useState('');
  const [patSearch,  setPatSearch]  = useState('');
  const [patSearch2, setPatSearch2] = useState('');
  const [cmdItem,    setCmdItem]    = useState({ name:'', qty:'1', price:'' });

  /* ── datas da visão ─────────────────── */
  const today = todayISO();

  const weekDays = (() => {
    const ws = view === 'week' ? startOfWeek(anchor) : startOfWeek(selectedDate);
    return Array.from({length:7}, (_,i) => addDays(ws, i));
  })();

  const monthDays = (() => {
    if (view !== 'month') return [];
    const [y,m] = anchor.split('-').map(Number);
    const first = new Date(y, m-1, 1);
    const last  = new Date(y, m, 0);
    const blanks = first.getDay();
    const days = [];
    for (let i=0; i<blanks; i++) days.push(null);
    for (let d=1; d<=last.getDate(); d++) days.push(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    return days;
  })();

  /* ── load ───────────────────────────── */
  const load = useCallback(async () => {
    let rangeStart, rangeEnd;
    if (view === 'week') {
      rangeStart = weekDays[0] + ' 00:00:00';
      rangeEnd   = weekDays[6] + ' 23:59:59';
    } else {
      const [y,m] = anchor.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      rangeStart = `${y}-${String(m).padStart(2,'0')}-01 00:00:00`;
      rangeEnd   = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')} 23:59:59`;
    }
    try {
      const [apts, pats, svcs, pros, pkgs] = await Promise.allSettled([
        api.get(`/appointments?start=${rangeStart}&end=${rangeEnd}`),
        api.get('/patients'),
        api.get('/services'),
        api.get('/users'),
        api.get('/packages').catch(()=>[]),
      ]);
      setAppointments(apts.status==='fulfilled' ? (apts.value?.appointments || apts.value || []) : []);
      setPatients(pats.status==='fulfilled' ? (Array.isArray(pats.value)?pats.value:(pats.value?.patients||[])) : []);
      setServices(svcs.status==='fulfilled' ? (Array.isArray(svcs.value)?svcs.value:(svcs.value?.services||[])) : []);
      const prosVal = pros.status==='fulfilled' ? (Array.isArray(pros.value)?pros.value:(pros.value||[])) : [];
      setProfessionals(prosVal.filter(u=>u.role!=='secretario'));
      setPackages(pkgs.status==='fulfilled' ? (Array.isArray(pkgs.value)?pkgs.value:(pkgs.value?.packages||pkgs.value||[])) : []);
    } catch {}
    setLoading(false); setRefreshing(false);
  }, [anchor, view]);

  useEffect(() => { load(); }, [load]);

  /* ── navegação ──────────────────────── */
  const prev = () => {
    if (view==='week')  setAnchor(a => addDays(a,-7));
    else                setAnchor(a => { const d=isoToDate(a); d.setMonth(d.getMonth()-1); return d.toISOString().split('T')[0]; });
  };
  const next = () => {
    if (view==='week')  setAnchor(a => addDays(a,7));
    else                setAnchor(a => { const d=isoToDate(a); d.setMonth(d.getMonth()+1); return d.toISOString().split('T')[0]; });
  };
  const goToday = () => { setSelectedDate(today); setAnchor(view==='week'?startOfWeek(today):startOfMonth(today)); };

  /* ── dados do dia selecionado ──────── */
  const getStart = (a) => a.start_time || a.start || '';
  const dayApts = appointments
    .filter(a => getStart(a).startsWith(selectedDate))
    .sort((a,b) => new Date(getStart(a))-new Date(getStart(b)));

  /* ── detalhe do agendamento ─────────── */
  const openDetail = async (apt) => {
    setDetailApt(apt);
    setDetailComanda(null);
    if (apt.patient_id) {
      setDetailCmdLoad(true);
      try {
        const res = await api.get(`/finance/comandas/patient/${apt.patient_id}`);
        const list = Array.isArray(res) ? res : (res?.comandas || []);
        const open = list.find(c => c.status === 'open') || list[0] || null;
        setDetailComanda(open);
      } catch { setDetailComanda(null); }
      setDetailCmdLoad(false);
    }
  };

  const closeDetail = () => setDetailApt(null);

  const openCmdFromDetail = () => {
    const apt = detailApt;
    closeDetail();
    const pat = patients.find(p => String(p.id) === String(apt?.patient_id));
    setCmdForm({ patient_id: String(apt?.patient_id||''), description:'', items:[], discount_type:'fixed', discount_value:'0', sessions_total:'1', status:'open' });
    setPatSearch2(pat?.name || '');
    setCmdItem({name:'',qty:'1',price:''}); setCmdServiceAdd(''); setCmdPackageAdd('');
    setShowCmdModal(true);
  };

  const openCmdFromForm = () => {
    const pat = patients.find(p => String(p.id) === String(aptForm.patient_id));
    setCmdForm({ patient_id: String(aptForm.patient_id||''), description:'', items:[], discount_type:'fixed', discount_value:'0', sessions_total:'1', status:'open' });
    setPatSearch2(pat?.name || '');
    setCmdItem({name:'',qty:'1',price:''}); setCmdServiceAdd(''); setCmdPackageAdd('');
    setShowCmdModal(true);
  };

  /* ── busca comanda do paciente (modal agendamento) ─── */
  const fetchAptPatComandas = async (patientId) => {
    if (!patientId) { setAptPatComandas([]); return; }
    setAptPatCmdLoad(true);
    try {
      const res = await api.get(`/finance/comandas/patient/${patientId}`);
      const list = Array.isArray(res) ? res : (res?.comandas || []);
      setAptPatComandas(list.filter(c => c.status === 'open'));
    } catch { setAptPatComandas([]); }
    setAptPatCmdLoad(false);
  };

  /* ── ações de agendamento ──────────── */
  const openAptModal = (type = 'consulta') => {
    setAptType(type);
    setAptForm({
      patient_id:'', title:'', modality:'presencial', notes:'', status:'scheduled', type,
      start:`${selectedDate}T09:00`, end:`${selectedDate}T10:00`,
      service_id:'', professional_id:'', package_id:'', duration_minutes:'50', comanda_id:'', meeting_url:'',
      recurrence_freq:'', recurrence_interval:1, recurrence_count:1, recurrence_end_date:''
    });
    setPatSearch(''); setPatFocused(false);
    setAptPatComandas([]); setShowFab(false); setShowAptModal(true);
  };

  const saveApt = async () => {
    if (!aptForm.patient_id && !aptForm.title) { Alert.alert('Atenção','Selecione um paciente ou informe título.'); return; }
    setSaving(true);
    try {
      const hasRecurrence = !!aptForm.recurrence_freq;
      const payload = {
        patient_id:      aptForm.patient_id||null,
        title:           aptForm.title||null,
        type:            aptForm.type,
        modality:        aptForm.modality,
        status:          aptForm.status,
        notes:           aptForm.notes||null,
        start_time:      aptForm.start,
        end_time:        aptForm.end,
        duration_minutes:parseInt(aptForm.duration_minutes)||50,
        service_id:      aptForm.service_id||null,
        professional_id: aptForm.professional_id||null,
        package_id:      aptForm.package_id||null,
        comanda_id:      aptForm.comanda_id||null,
        meeting_url:     aptForm.meeting_url||null,
        recurrence_freq:     hasRecurrence ? aptForm.recurrence_freq     : null,
        recurrence_interval: hasRecurrence ? aptForm.recurrence_interval  : null,
        recurrence_count:    hasRecurrence ? aptForm.recurrence_count     : null,
        recurrence_rule:     hasRecurrence ? JSON.stringify({
          freq:     aptForm.recurrence_freq,
          interval: aptForm.recurrence_interval,
          count:    aptForm.recurrence_count,
        }) : null,
      };
      await api.post('/appointments', payload);
      setShowAptModal(false); load();
    } catch(e) { Alert.alert('Erro', e.message); }
    setSaving(false);
  };

  const changeStatus = async (id, status) => {
    try { await api.put(`/appointments/${id}/status`, {status}); setShowStatus(null); load(); }
    catch(e) { Alert.alert('Erro', e.message); }
  };

  const deleteApt = (id) => Alert.alert('Excluir','Excluir agendamento?',[
    {text:'Cancelar',style:'cancel'},
    {text:'Excluir',style:'destructive', onPress: async()=>{
      try { await api.delete(`/appointments/${id}`); load(); }
      catch(e){ Alert.alert('Erro',e.message); }
    }},
  ]);

  /* ── ações de comanda ──────────────── */
  const openCmdModal = () => {
    setCmdForm({ type:'normal', patient_id:'', professional_id:'', description:'', date:todayISO(), items:[], discount_type:'fixed', discount_value:'0', sessions_total:'1', manual_total:'', package_id:'', status:'open' });
    setPatSearch2(''); setCmdItem({name:'',qty:'1',price:''}); setCmdServiceAdd(''); setCmdPackageAdd('');
    setShowFab(false); setShowCmdModal(true);
  };

  const addCmdItem = () => {
    if (!cmdItem.name || !cmdItem.price) return;
    setCmdForm(f => ({...f, items:[...f.items, {...cmdItem, qty: parseInt(cmdItem.qty)||1, price: parseFloat(String(cmdItem.price).replace(',','.'))||0}]}));
    setCmdItem({name:'',qty:'1',price:''});
  };

  const removeCmdItem = (i) => setCmdForm(f => ({...f, items: f.items.filter((_,idx)=>idx!==i)}));

  const cmdSubtotal = () => {
    if (cmdForm.type === 'normal') return parseFloat(String(cmdForm.manual_total).replace(',','.'))||0;
    return cmdForm.items.reduce((s,it)=>s+(it.qty*(parseFloat(String(it.price).replace(',','.'))||0)),0);
  };
  const cmdTotal = () => {
    const sub = cmdSubtotal();
    const dv  = parseFloat(String(cmdForm.discount_value).replace(',','.'))||0;
    return cmdForm.discount_type==='percentage' ? sub*(1-dv/100) : sub-dv;
  };

  const saveCmd = async () => {
    if (!cmdForm.patient_id) { Alert.alert('Atenção','Selecione um paciente.'); return; }
    setSaving(true);
    try {
      const payload = {
        ...cmdForm,
        discount_value: parseFloat(String(cmdForm.discount_value).replace(',','.'))||0,
        sessions_total: parseInt(cmdForm.sessions_total)||1,
        total: cmdTotal(),
        professional_id: cmdForm.professional_id||null,
        package_id: cmdForm.package_id||null,
      };
      await api.post('/finance/comandas', payload);
      setShowCmdModal(false); Alert.alert('✅ Comanda criada com sucesso!');
    } catch(e) { Alert.alert('Erro', e.message); }
    setSaving(false);
  };

  /* ── filtros de busca ──────────────── */
  const filtPats  = patients.filter(p=>(p.name||'').toLowerCase().includes(patSearch.toLowerCase())).slice(0,8);
  const filtPats2 = patients.filter(p=>(p.name||'').toLowerCase().includes(patSearch2.toLowerCase())).slice(0,8);
  const showPatList  = (patFocused  || patSearch.length  > 0) && !aptForm.patient_id;

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#6366f1"/></View>;

  /* ── header da visão ─────────────────── */
  const headerTitle = (() => {
    if (view==='month') {
      const [y,m] = anchor.split('-').map(Number);
      return `${MONTHS_PT[m-1]} ${y}`;
    }
    const ws = weekDays[0]; const we = weekDays[6];
    const [,wm,wd]  = ws.split('-').map(Number);
    const [wy,wm2,wd2] = we.split('-').map(Number);
    if (wm===wm2) return `${wd}–${wd2} ${MONTHS_PT[wm-1]} ${wy}`;
    return `${wd} ${MONTHS_PT[wm-1]} – ${wd2} ${MONTHS_PT[wm2-1]} ${wy}`;
  })();

  /* ─────────────────── RENDER ────────────────────── */
  return (
    <View style={s.container}>

      {/* ── Cabeçalho ── */}
      <View style={s.calHeader}>
        {/* View switcher */}
        <View style={s.viewSwitch}>
          {['week','month'].map(v=>(
            <TouchableOpacity key={v} style={[s.viewBtn, view===v&&s.viewBtnActive]} onPress={()=>{setView(v);setAnchor(v==='week'?startOfWeek(selectedDate):startOfMonth(selectedDate));}}>
              <Text style={[s.viewBtnText, view===v&&s.viewBtnTextActive]}>{v==='week'?'Semana':'Mês'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Nav */}
        <View style={s.navRow}>
          <TouchableOpacity onPress={prev} style={s.navBtn}><Text style={s.navArrow}>‹</Text></TouchableOpacity>
          <TouchableOpacity onPress={goToday} style={s.todayBtn}><Text style={s.todayBtnText}>{headerTitle}</Text></TouchableOpacity>
          <TouchableOpacity onPress={next} style={s.navBtn}><Text style={s.navArrow}>›</Text></TouchableOpacity>
        </View>
      </View>

      {/* ── Dias da semana (header fixo) ── */}
      <View style={s.weekDayHeader}>
        {DAYS_SHORT.map((d,i)=>(
          <Text key={i} style={[s.weekDayHdr, i===0||i===6?{color:'#ef4444'}:null]}>{d}</Text>
        ))}
      </View>

      {view==='week' ? (
        /* ════ VISÃO SEMANA ════ */
        <View style={{flex:1}}>
          <View style={s.weekStrip}>
            {weekDays.map(day=>{
              const count = appointments.filter(a=>getStart(a).startsWith(day)).length;
              const isTdy = day===today;
              const isSel = day===selectedDate;
              const d     = isoToDate(day);
              const isWknd= d.getDay()===0||d.getDay()===6;
              return (
                <TouchableOpacity key={day} style={s.weekDayCol} onPress={()=>setSelectedDate(day)} activeOpacity={0.7}>
                  <View style={[s.weekDayCircle, isSel&&s.weekDayCircleActive, isTdy&&!isSel&&s.weekDayCircleToday]}>
                    <Text style={[s.weekDayNum, isSel&&{color:'#fff'}, isTdy&&!isSel&&{color:'#6366f1'}, isWknd&&!isSel&&{color:'#ef4444'}]}>
                      {d.getDate()}
                    </Text>
                  </View>
                  {count>0&&<View style={[s.aptDotRow]}>
                    {Array.from({length:Math.min(count,3)}).map((_,i)=>(
                      <View key={i} style={[s.aptDot, isSel&&{backgroundColor:'#a5b4fc'}]}/>
                    ))}
                  </View>}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Day label */}
          <View style={s.dayLabel}>
            <Text style={s.dayLabelText}>
              {isoToDate(selectedDate).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).replace(/^\w/,c=>c.toUpperCase())}
            </Text>
            <View style={s.dayLabelBadge}>
              <Text style={s.dayLabelBadgeText}>{dayApts.length} sessão{dayApts.length!==1?'ões':''}</Text>
            </View>
          </View>

          {/* Appointments */}
          <ScrollView contentContainerStyle={{padding:14,paddingBottom:90}} showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor="#6366f1"/>}>
            {dayApts.length===0 ? (
              <View style={s.emptyBox}>
                <Text style={{fontSize:44,marginBottom:10}}>📭</Text>
                <Text style={s.emptyTitle}>Nenhuma sessão</Text>
                <Text style={s.emptyText}>Toque em + para agendar</Text>
              </View>
            ) : dayApts.map(apt=>(
              <AptCard key={apt.id} apt={apt} onPress={()=>openDetail(apt)}/>
            ))}
          </ScrollView>
        </View>

      ) : (
        /* ════ VISÃO MÊS ════ */
        <View style={{flex:1}}>
          <ScrollView showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor="#6366f1"/>}>
            <View style={s.monthGrid}>
              {monthDays.map((day,i)=>{
                if (!day) return <View key={`blank-${i}`} style={s.monthCell}/>;
                const count = appointments.filter(a=>getStart(a).startsWith(day)).length;
                const isTdy = day===today;
                const isSel = day===selectedDate;
                const d     = isoToDate(day);
                const isWknd= d.getDay()===0||d.getDay()===6;
                return (
                  <TouchableOpacity key={day} style={[s.monthCell, isSel&&s.monthCellActive]} onPress={()=>setSelectedDate(day)} activeOpacity={0.7}>
                    <View style={[s.monthDayCircle, isTdy&&s.monthDayCircleToday]}>
                      <Text style={[s.monthDayNum, isSel&&{color:'#6366f1',fontWeight:'900'}, isTdy&&{color:'#fff'}, isWknd&&!isTdy&&{color:'#ef4444'}]}>
                        {d.getDate()}
                      </Text>
                    </View>
                    {count>0&&(
                      <View style={s.monthAptDots}>
                        {Array.from({length:Math.min(count,3)}).map((_,j)=>(
                          <View key={j} style={[s.monthDot, {backgroundColor: count>=1?'#6366f1':'#94a3b8'}]}/>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Day appointments below month grid */}
            <View style={{paddingHorizontal:14, paddingBottom:90}}>
              <View style={s.dayLabel}>
                <Text style={s.dayLabelText}>
                  {isoToDate(selectedDate).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).replace(/^\w/,c=>c.toUpperCase())}
                </Text>
                <View style={s.dayLabelBadge}>
                  <Text style={s.dayLabelBadgeText}>{dayApts.length} sessão{dayApts.length!==1?'ões':''}</Text>
                </View>
              </View>
              {dayApts.length===0 ? (
                <View style={[s.emptyBox,{paddingTop:20}]}>
                  <Text style={s.emptyText}>Nenhuma sessão neste dia</Text>
                </View>
              ) : dayApts.map(apt=>(
                <AptCard key={apt.id} apt={apt} onPress={()=>openDetail(apt)}/>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* ── FAB ── */}
      <TouchableOpacity style={s.fab} onPress={()=>setShowFab(v=>!v)} activeOpacity={0.85}>
        <Text style={[s.fabText, showFab&&{transform:[{rotate:'45deg'}]}]}>+</Text>
      </TouchableOpacity>
      {showFab&&(
        <View style={s.fabMenu}>
          <TouchableOpacity style={[s.fabMenuItem,{backgroundColor:'#6366f1'}]} onPress={()=>openAptModal('consulta')}>
            <Text style={s.fabMenuText}>🧑‍⚕️  Nova Sessão</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.fabMenuItem,{backgroundColor:'#ef4444'}]} onPress={()=>openAptModal('bloqueio')}>
            <Text style={s.fabMenuText}>🚫  Bloqueio de Agenda</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.fabMenuItem,{backgroundColor:'#f59e0b'}]} onPress={()=>openAptModal('pessoal')}>
            <Text style={s.fabMenuText}>👤  Evento Pessoal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.fabMenuItem,{backgroundColor:'#10b981'}]} onPress={openCmdModal}>
            <Text style={s.fabMenuText}>🧾  Nova Comanda</Text>
          </TouchableOpacity>
        </View>
      )}
      {showFab&&<TouchableOpacity style={s.fabBackdrop} activeOpacity={1} onPress={()=>setShowFab(false)}/>}

      {/* ── Modal Detalhe Agendamento ── */}
      <Modal visible={!!detailApt} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={closeDetail}>
          <TouchableOpacity activeOpacity={1} style={[s.sheet,{paddingBottom:34}]}>
            <View style={s.sheetHandle}/>
            {detailApt && (() => {
              const st = detailApt.start_time || detailApt.start;
              const en = detailApt.end_time   || detailApt.end;
              const stDate = st ? new Date(st) : null;
              const color  = STATUS_COLOR[detailApt.status] || '#94a3b8';
              const fmtDate= stDate && !isNaN(stDate) ? stDate.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}) : '—';
              return (
                <>
                  {/* Status badge */}
                  <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:14}}>
                    <View style={[s.detailStatusDot,{backgroundColor:color}]}/>
                    <Text style={[s.detailStatusTxt,{color}]}>{STATUS_LABEL[detailApt.status]||detailApt.status}</Text>
                    {detailApt.modality&&<View style={s.detailModalityChip}><Text style={s.detailModalityTxt}>{detailApt.modality==='online'?'💻 Online':'🏢 Presencial'}</Text></View>}
                  </View>

                  {/* Patient name */}
                  <Text style={s.detailName}>{detailApt.patient_name||detailApt.title||'Sem título'}</Text>

                  {/* Date/time */}
                  <View style={s.detailRow}>
                    <Text style={s.detailRowIcon}>📅</Text>
                    <Text style={s.detailRowTxt} numberOfLines={2}>{fmtDate.replace(/^\w/,c=>c.toUpperCase())}</Text>
                  </View>
                  {st&&<View style={s.detailRow}>
                    <Text style={s.detailRowIcon}>🕐</Text>
                    <Text style={s.detailRowTxt}>{fmtTime(st)}{en?` – ${fmtTime(en)}`:''}</Text>
                  </View>}
                  {detailApt.service_name&&<View style={s.detailRow}>
                    <Text style={s.detailRowIcon}>🩺</Text>
                    <Text style={s.detailRowTxt}>{detailApt.service_name}</Text>
                  </View>}
                  {detailApt.notes&&<View style={[s.detailRow,{alignItems:'flex-start'}]}>
                    <Text style={s.detailRowIcon}>📝</Text>
                    <Text style={[s.detailRowTxt,{flex:1}]}>{detailApt.notes}</Text>
                  </View>}

                  {/* Comanda */}
                  <View style={s.detailCmdBox}>
                    <Text style={s.detailCmdTitle}>🧾 Comanda</Text>
                    {detailCmdLoad ? (
                      <ActivityIndicator color="#6366f1" style={{marginTop:8}}/>
                    ) : detailComanda ? (
                      <>
                        <Text style={s.detailCmdDesc}>{detailComanda.description||'Comanda ativa'}</Text>
                        <View style={s.detailCmdStats}>
                          <View style={s.detailCmdStat}>
                            <Text style={s.detailCmdStatVal}>{detailComanda.sessions_used||0}/{detailComanda.sessions_total||1}</Text>
                            <Text style={s.detailCmdStatLbl}>Sessões</Text>
                          </View>
                          <View style={s.detailCmdStat}>
                            <Text style={[s.detailCmdStatVal,{color:'#10b981'}]}>
                              {Number(detailComanda.total||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                            </Text>
                            <Text style={s.detailCmdStatLbl}>Total</Text>
                          </View>
                          <View style={[s.detailCmdStat,{backgroundColor:(detailComanda.status==='open'?'#dcfce7':'#fef2f2'),borderRadius:8,paddingHorizontal:8}]}>
                            <Text style={[s.detailCmdStatVal,{color:detailComanda.status==='open'?'#10b981':'#ef4444',fontSize:12}]}>{detailComanda.status==='open'?'Aberta':'Fechada'}</Text>
                            <Text style={s.detailCmdStatLbl}>Status</Text>
                          </View>
                        </View>
                      </>
                    ) : (
                      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:6}}>
                        <Text style={{color:'#94a3b8',fontSize:13}}>Nenhuma comanda ativa</Text>
                        <TouchableOpacity style={s.detailCmdCreateBtn} onPress={openCmdFromDetail}>
                          <Text style={s.detailCmdCreateTxt}>+ Criar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Action buttons */}
                  <View style={{flexDirection:'row',gap:10,marginTop:14}}>
                    <TouchableOpacity style={[s.detailBtn,{backgroundColor:'#f5f3ff',flex:1}]} onPress={()=>{closeDetail();setShowStatus(detailApt);}}>
                      <Text style={[s.detailBtnTxt,{color:'#6366f1'}]}>Alterar Status</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.detailBtn,{backgroundColor:'#fef2f2'}]} onPress={()=>{closeDetail();deleteApt(detailApt.id);}}>
                      <Text style={[s.detailBtnTxt,{color:'#ef4444'}]}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal Status ── */}
      <Modal visible={!!showStatus} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={()=>setShowStatus(null)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle}/>
            <Text style={s.sheetTitle}>Alterar status</Text>
            <Text style={s.sheetSub}>{showStatus?.patient_name||showStatus?.title||''}</Text>
            {STATUSES.map(st=>(
              <TouchableOpacity key={st} style={s.statusRow} onPress={()=>changeStatus(showStatus?.id, st)}>
                <View style={[s.statusDot,{backgroundColor:STATUS_COLOR[st]}]}/>
                <Text style={s.statusLabel}>{STATUS_LABEL[st]}</Text>
                {showStatus?.status===st&&<Text style={{color:'#10b981',fontWeight:'900',marginLeft:'auto'}}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal Novo Agendamento ── */}
      <Modal visible={showAptModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
          <View style={s.modalHeader}>
            <View style={{width:36}}/>
            <Text style={s.modalTitle}>
              {aptType==='bloqueio'?'🚫 Bloqueio de Agenda':aptType==='pessoal'?'👤 Evento Pessoal':'🧑‍⚕️ Nova Sessão'}
            </Text>
            <TouchableOpacity style={s.modalCloseBtn} onPress={()=>setShowAptModal(false)}>
              <Text style={s.modalCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{padding:20}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Tipo — só mostra no modal se quiser trocar */}
            <View style={{flexDirection:'row',gap:8,marginBottom:16}}>
              {[['consulta','🧑‍⚕️ Sessão'],['bloqueio','🚫 Bloqueio'],['pessoal','👤 Pessoal']].map(([v,l])=>(
                <TouchableOpacity key={v} style={[s.chip,{flex:1},aptType===v&&s.chipActive]}
                  onPress={()=>{setAptType(v);setAptForm(f=>({...f,type:v,patient_id:'',title:'',comanda_id:'',recurrence_freq:'',recurrence_interval:1,recurrence_count:1}));setPatSearch('');setPatFocused(false);setAptPatComandas([]);}}>
                  <Text style={[s.chipText,{fontSize:11},aptType===v&&s.chipTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Paciente — só para sessão */}
            {aptType==='consulta' ? (
              <>
                <Text style={s.fieldLabel}>Paciente *</Text>
                {aptForm.patient_id ? (
                  <TouchableOpacity style={[s.fieldInput,{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}]}
                    onPress={()=>{setAptForm(f=>({...f,patient_id:'',title:'',comanda_id:''}));setPatSearch('');setPatFocused(true);setAptPatComandas([]);}}>
                    <Text style={{color:'#0f172a',fontWeight:'700',fontSize:15}}>{patSearch}</Text>
                    <Text style={{color:'#94a3b8',fontSize:12}}>trocar ✕</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TextInput
                      style={s.fieldInput}
                      value={patSearch}
                      onChangeText={t=>{setPatSearch(t);setAptForm(f=>({...f,patient_id:''}));}}
                      onFocus={()=>setPatFocused(true)}
                      onBlur={()=>setTimeout(()=>setPatFocused(false),200)}
                      placeholder="Digite o nome do paciente..."
                      placeholderTextColor="#94a3b8"
                    />
                    {showPatList&&(
                      <View style={s.patList}>
                        {filtPats.length===0
                          ? <Text style={{color:'#94a3b8',padding:10,fontSize:13}}>Nenhum paciente encontrado</Text>
                          : filtPats.map(p=>(
                          <TouchableOpacity key={p.id} style={s.patOpt}
                            onPress={()=>{
                              setAptForm(f=>({...f,patient_id:String(p.id),title:p.name||'',comanda_id:''}));
                              setPatSearch(p.name||'');
                              setPatFocused(false);
                              fetchAptPatComandas(String(p.id));
                            }}>
                            <Text style={s.patOptName}>{p.name}</Text>
                            {(p.phone||p.email)&&<Text style={s.patOptSub}>{p.phone||p.email}</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}

                {/* ── Comanda — logo abaixo do paciente ── */}
                {aptPatCmdLoad ? (
                  <ActivityIndicator color="#6366f1" style={{marginVertical:10}}/>
                ) : aptForm.patient_id ? (
                  <View style={{marginBottom:14}}>
                    {aptForm.comanda_id ? (
                      /* Comanda vinculada — caixa verde */
                      <View style={s.cmdLinkedBox}>
                        <Text style={s.cmdLinkedHeader}>🧾 COMANDA VINCULADA</Text>
                        <Text style={s.cmdLinkedDesc}>
                          {(aptPatComandas.find(c=>String(c.id)===aptForm.comanda_id)||{}).description||`Comanda #${aptForm.comanda_id}`}
                        </Text>
                        {(()=>{const c=aptPatComandas.find(cc=>String(cc.id)===aptForm.comanda_id);return c?(<Text style={s.cmdLinkedSub}>{c.sessions_used||0}/{c.sessions_total||1} sessões · {Number(c.total||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</Text>):null;})()}
                        <TouchableOpacity style={s.cmdRemoveBtn} onPress={()=>setAptForm(f=>({...f,comanda_id:''}))}>
                          <Text style={s.cmdRemoveTxt}>Remover vínculo</Text>
                        </TouchableOpacity>
                      </View>
                    ) : aptPatComandas.length > 0 ? (
                      /* Comandas abertas — caixa laranja */
                      <View style={s.cmdAvailBox}>
                        <Text style={s.cmdAvailHeader}>⚠️ COMANDA ABERTA DISPONÍVEL</Text>
                        {aptPatComandas.map(c=>(
                          <TouchableOpacity key={c.id} style={s.cmdAvailRow} onPress={()=>{
                              const sv = c.service_id ? services.find(s=>String(s.id)===String(c.service_id)) : null;
                              const dur = sv?.duration_minutes ? String(sv.duration_minutes) : aptForm.duration_minutes;
                              setAptForm(f=>({
                                ...f,
                                comanda_id:String(c.id),
                                service_id: sv ? String(sv.id) : f.service_id,
                                duration_minutes: dur,
                                end: calcEnd(f.start, dur),
                              }));
                            }}>
                            <View style={{flex:1}}>
                              <Text style={s.cmdAvailName}>{c.description||`Comanda #${c.id}`}</Text>
                              <Text style={s.cmdAvailSub}>{c.sessions_used||0}/{c.sessions_total||1} sessões</Text>
                            </View>
                            <Text style={s.cmdAvailLink}>Vincular →</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    {/* Sempre mostra opção de criar nova */}
                    <TouchableOpacity style={[s.cmdCreateBtn,{marginTop: aptPatComandas.length>0&&!aptForm.comanda_id ? 8 : 0}]}
                      onPress={()=>{setShowAptModal(false);openCmdFromForm();}}>
                      <Text style={s.cmdCreateTxt}>+ Criar nova comanda para este paciente</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <Text style={s.fieldLabel}>{aptType==='bloqueio'?'Motivo do bloqueio':'Título do evento'}</Text>
                <TextInput style={s.fieldInput} value={aptForm.title} onChangeText={v=>setAptForm(f=>({...f,title:v}))}
                  placeholder={aptType==='bloqueio'?'Ex: Reunião, Almoço...':'Ex: Consulta médica, Viagem...'} placeholderTextColor="#94a3b8"/>
              </>
            )}

            {/* Data — navegável ◀ ▶ + toque para abrir calendário */}
            {(()=>{
              const formDate = (aptForm.start||'').split('T')[0] || selectedDate;
              const changeDate = (newDate) => {
                const t = getTime(aptForm.start)||'09:00';
                const e = getTime(aptForm.end)||'10:00';
                setAptForm(f=>({...f, start:`${newDate}T${t}`, end:`${newDate}T${e}`}));
              };
              return (
                <View style={s.dateNavRow}>
                  <TouchableOpacity style={s.dateNavBtn} onPress={()=>changeDate(addDays(formDate,-1))}>
                    <Text style={s.dateNavArrow}>‹</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{flex:1,alignItems:'center',paddingVertical:4}} onPress={()=>{
                    setCalPickerAnchor(startOfMonth(formDate));
                    setShowCalPicker(true);
                  }}>
                    <Text style={s.dateNavLabel}>
                      {isoToDate(formDate).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).replace(/^\w/,c=>c.toUpperCase())}
                    </Text>
                    <Text style={{fontSize:9,color:'#a5b4fc',marginTop:1}}>📅 toque para abrir calendário</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.dateNavBtn} onPress={()=>changeDate(addDays(formDate,1))}>
                    <Text style={s.dateNavArrow}>›</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* Hora de início — horários disponíveis em destaque */}
            {(()=>{
              const formDate = (aptForm.start||'').split('T')[0] || selectedDate;
              const takenTimes = new Set(
                appointments
                  .filter(a=>getStart(a).startsWith(formDate))
                  .map(a=>getTime(getStart(a)))
              );
              return (
                <>
                  <Text style={[s.fieldLabel,{marginTop:10}]}>Hora de início</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,marginBottom:10}}>
                    {['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'].map(t=>{
                      const iso = `${formDate}T${t}`;
                      const isActive = getTime(aptForm.start) === t;
                      const isTaken  = takenTimes.has(t);
                      return (
                        <TouchableOpacity key={t}
                          style={[s.timeChip, isActive&&s.timeChipActive, isTaken&&!isActive&&s.timeChipTaken]}
                          onPress={()=>setAptForm(f=>({...f, start:iso, end:calcEnd(iso,f.duration_minutes)}))}>
                          <Text style={[s.timeChipTxt, isActive&&s.timeChipTxtActive, isTaken&&!isActive&&{color:'#ef4444'}]}>{t}</Text>
                          {isTaken&&!isActive&&<View style={s.timeChipDot}/>}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              );
            })()}
            <TextInput
              style={s.fieldInput}
              value={getTime(aptForm.start)}
              onChangeText={t=>{
                const clean = t.replace(/[^0-9:]/g,'');
                const formDate = (aptForm.start||'').split('T')[0] || selectedDate;
                const iso = `${formDate}T${clean}`;
                setAptForm(f=>({...f, start:iso, end: clean.length===5 ? calcEnd(iso,f.duration_minutes) : f.end}));
              }}
              placeholder="09:00"
              placeholderTextColor="#94a3b8"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />

            {/* Duração */}
            <Text style={s.fieldLabel}>Duração</Text>
            <View style={{flexDirection:'row',gap:6,marginBottom:14,flexWrap:'wrap'}}>
              {[['30','30 min'],['45','45 min'],['50','50 min'],['60','1h'],['90','1h30'],['120','2h']].map(([v,l])=>(
                <TouchableOpacity key={v} style={[s.chip,aptForm.duration_minutes===v&&s.chipActive]}
                  onPress={()=>setAptForm(f=>({...f, duration_minutes:v, end:calcEnd(f.start,v)}))}>
                  <Text style={[s.chipText,aptForm.duration_minutes===v&&s.chipTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Hora de fim — calculada, mas editável */}
            <Text style={s.fieldLabel}>Hora de fim</Text>
            <View style={[s.fieldInput,{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14}]}>
              <Text style={{color:'#94a3b8',fontSize:13}}>Calculado automaticamente:</Text>
              <TextInput
                style={{fontSize:16,fontWeight:'800',color:'#0f172a',minWidth:60,textAlign:'right'}}
                value={getTime(aptForm.end)}
                onChangeText={t=>{
                  const clean = t.replace(/[^0-9:]/g,'');
                  const formDate = (aptForm.start||'').split('T')[0] || selectedDate;
                  setAptForm(f=>({...f, end:`${formDate}T${clean}`}));
                }}
                placeholder="10:00"
                placeholderTextColor="#94a3b8"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>

            {aptType==='consulta'&&(
              <>
                {/* Profissional — dropdown com busca */}
                <DropdownField
                  label="Profissional responsável"
                  value={aptForm.professional_id}
                  placeholder="Selecione o profissional..."
                  options={[
                    {value:'', label:'Nenhum'},
                    ...professionals.map(p=>({value:String(p.id), label:p.name||(p.email||'')+(p.role?` · ${p.role}`:'')}))
                  ]}
                  onChange={v=>setAptForm(f=>({...f,professional_id:v}))}
                />

                {/* Serviço — auto-preenche duração */}
                <DropdownField
                  label="Serviço"
                  value={aptForm.service_id}
                  placeholder="Selecione o serviço..."
                  options={[
                    {value:'', label:'Nenhum'},
                    ...services.map(sv=>({value:String(sv.id), label:sv.name+(sv.duration_minutes?` · ${sv.duration_minutes}min`:'')}))
                  ]}
                  onChange={v=>{
                    const sv = services.find(s=>String(s.id)===v);
                    const dur = sv?.duration_minutes ? String(sv.duration_minutes) : aptForm.duration_minutes;
                    setAptForm(f=>({...f, service_id:v, duration_minutes:dur, end:calcEnd(f.start,dur)}));
                  }}
                />

                {/* Modalidade */}
                <Text style={s.fieldLabel}>Modalidade</Text>
                <View style={{flexDirection:'row',gap:10,marginBottom:14}}>
                  {[['presencial','🏢 Presencial'],['online','💻 Online']].map(([val,lbl])=>(
                    <TouchableOpacity key={val} style={[s.chip,{flex:1},aptForm.modality===val&&s.chipActive]} onPress={()=>setAptForm(f=>({...f,modality:val,meeting_url:val==='online'?f.meeting_url:''}))}>
                      <Text style={[s.chipText,aptForm.modality===val&&s.chipTextActive]}>{lbl}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Link da sessão online */}
                {aptForm.modality==='online'&&(
                  <>
                    <Text style={s.fieldLabel}>Link da videochamada</Text>
                    <TextInput style={s.fieldInput} value={aptForm.meeting_url}
                      onChangeText={v=>setAptForm(f=>({...f,meeting_url:v}))}
                      placeholder="https://meet.google.com/..." placeholderTextColor="#94a3b8"
                      autoCapitalize="none" keyboardType="url"/>
                  </>
                )}

                {/* Status — dropdown */}
                <DropdownField
                  label="Status inicial"
                  value={aptForm.status}
                  options={STATUSES.map(st=>({value:st, label:STATUS_LABEL[st], color:STATUS_COLOR[st]}))}
                  onChange={v=>setAptForm(f=>({...f,status:v}))}
                />

              </>
            )}

            {/* Recorrência — só para sessão */}
            {aptType==='consulta'&&(()=>{
              const selOpt = aptForm.recurrence_freq
                ? RECURRENCE_OPTIONS.find(o=>o.freq===aptForm.recurrence_freq&&o.interval===aptForm.recurrence_interval&&o.count===aptForm.recurrence_count)
                : null;
              const recLabel = selOpt ? selOpt.label : aptForm.recurrence_freq ? 'Personalizado' : 'Não Repete';
              return (
                <>
                  <Text style={[s.fieldLabel,{marginTop:4}]}>Repetição Fixa</Text>
                  <TouchableOpacity style={s.recBtn} onPress={()=>setShowRecModal(true)}>
                    <View style={{flex:1}}>
                      <Text style={s.recBtnLabel}>🔁 {recLabel}</Text>
                      {aptForm.recurrence_freq&&(
                        <Text style={s.recBtnSub}>
                          {aptForm.recurrence_count} sessões serão criadas
                        </Text>
                      )}
                    </View>
                    <Text style={s.recBtnArrow}>›</Text>
                  </TouchableOpacity>
                </>
              );
            })()}

            <Text style={s.fieldLabel}>Observações</Text>
            <TextInput style={[s.fieldInput,{height:80,textAlignVertical:'top'}]} value={aptForm.notes}
              onChangeText={v=>setAptForm(f=>({...f,notes:v}))} placeholder="Anotações..." placeholderTextColor="#94a3b8" multiline/>
            <View style={{height:20}}/>
          </ScrollView>
          {/* ── Rodapé com botões ── */}
          <View style={[s.modalFooter,{gap:10}]}>
            <TouchableOpacity style={[s.modalCancelBtn,{flex:1,alignItems:'center'}]} onPress={()=>setShowAptModal(false)}>
              <Text style={s.modalCancelBtnTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalSaveBtn,{flex:2,justifyContent:'center'}]} onPress={saveApt} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small"/>
                : <Text style={s.modalSaveBtnTxt}>
                    {aptType==='bloqueio'?'Salvar Bloqueio':aptType==='pessoal'?'Salvar Evento':'Salvar Sessão'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══ Modal: Lista de recorrências ════════════════════ */}
      <Modal visible={showRecModal} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={()=>setShowRecModal(false)}>
          <TouchableOpacity activeOpacity={1} style={[s.sheet,{paddingBottom:34}]}>
            <View style={s.sheetHandle}/>
            <Text style={s.sheetTitle}>Repetição Fixa</Text>
            <Text style={s.sheetSub}>Escolha uma opção de recorrência</Text>

            {/* Seleção atual */}
            {aptForm.recurrence_freq&&(
              <View style={s.recCurrentBox}>
                <Text style={s.recCurrentLbl}>OPÇÃO ATUAL</Text>
                <Text style={s.recCurrentVal}>
                  {RECURRENCE_OPTIONS.find(o=>o.freq===aptForm.recurrence_freq&&o.interval===aptForm.recurrence_interval&&o.count===aptForm.recurrence_count)?.label||'Personalizado'}
                </Text>
              </View>
            )}
            <Text style={s.recHint}>
              💡 Escolha repetição semanal para que sempre caia no mesmo dia da semana
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{maxHeight:380}}>
              {RECURRENCE_OPTIONS.map((opt,idx)=>{
                const isActive = opt.freq!=='CUSTOM' && opt.freq===aptForm.recurrence_freq
                  && opt.interval===aptForm.recurrence_interval
                  && opt.count===aptForm.recurrence_count;
                const isNone = opt.freq==='' && !aptForm.recurrence_freq;
                return (
                  <TouchableOpacity key={idx} style={[s.recOptionRow, (isActive||isNone)&&s.recOptionRowActive]}
                    onPress={()=>{
                      if (opt.freq==='CUSTOM') {
                        setTempRec({freq:'WEEKLY',interval:1,endType:'count',endValue:4});
                        setShowRecModal(false);
                        setShowRecCustom(true);
                      } else if (opt.freq==='') {
                        setAptForm(f=>({...f,recurrence_freq:'',recurrence_interval:1,recurrence_count:1,recurrence_end_date:''}));
                        setShowRecModal(false);
                      } else {
                        setAptForm(f=>({...f,recurrence_freq:opt.freq,recurrence_interval:opt.interval,recurrence_count:opt.count,recurrence_end_date:''}));
                        setShowRecModal(false);
                      }
                    }}>
                    <Text style={[s.recOptionTxt,(isActive||isNone)&&s.recOptionTxtActive]}>{opt.label}</Text>
                    <Text style={[s.recOptionArrow,(isActive||isNone)&&{color:'#6366f1'}]}>›</Text>
                  </TouchableOpacity>
                );
              })}
              <View style={{height:20}}/>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ══ Modal: Recorrência personalizada ════════════════ */}
      <Modal visible={showRecCustom} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={()=>setShowRecCustom(false)}>
          <TouchableOpacity activeOpacity={1} style={[s.sheet,{paddingBottom:34}]}>
            <View style={s.sheetHandle}/>

            {/* Header */}
            <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:4}}>
              <View style={{width:36,height:36,borderRadius:12,backgroundColor:'#f0f4ff',alignItems:'center',justifyContent:'center'}}>
                <Text style={{fontSize:18}}>🔁</Text>
              </View>
              <View>
                <Text style={s.sheetTitle}>Configurar Repetição</Text>
                <Text style={{fontSize:11,color:'#94a3b8',marginTop:1}}>Defina como as sessões vão se repetir</Text>
              </View>
            </View>

            <View style={s.recCfgCard}>
              {/* Frequência — lista vertical */}
              <Text style={s.recCfgLabel}>FREQUÊNCIA</Text>
              <View style={{gap:6,marginBottom:16}}>
                {Object.entries(FREQ_LABELS).map(([v,l])=>(
                  <TouchableOpacity key={v} style={s.recFreqRow}
                    onPress={()=>setTempRec(r=>({...r,freq:v}))}>
                    <View style={[s.recFreqRadio, tempRec.freq===v&&s.recFreqRadioActive]}>
                      {tempRec.freq===v&&<View style={s.recFreqRadioDot}/>}
                    </View>
                    <Text style={[s.recFreqLabel, tempRec.freq===v&&{color:'#4338ca',fontWeight:'800'}]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Intervalo — stepper */}
              <Text style={s.recCfgLabel}>A CADA</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:16}}>
                <TouchableOpacity style={s.recStepBtn}
                  onPress={()=>setTempRec(r=>({...r,interval:Math.max(1,r.interval-1)}))}>
                  <Text style={s.recStepBtnTxt}>−</Text>
                </TouchableOpacity>
                <View style={s.recStepVal}>
                  <Text style={s.recStepValTxt}>{tempRec.interval}</Text>
                </View>
                <TouchableOpacity style={s.recStepBtn}
                  onPress={()=>setTempRec(r=>({...r,interval:Math.min(99,r.interval+1)}))}>
                  <Text style={s.recStepBtnTxt}>+</Text>
                </TouchableOpacity>
                <Text style={{fontSize:14,color:'#475569',fontWeight:'700',flex:1}}>
                  {FREQ_UNIT[tempRec.freq]||'Semana(s)'}
                </Text>
              </View>
            </View>

            {/* Terminar em */}
            <Text style={[s.recCfgLabel,{marginTop:4}]}>TERMINAR EM</Text>
            <View style={{flexDirection:'row',gap:10,marginBottom:20}}>

              {/* Por vezes */}
              <TouchableOpacity
                style={[s.recEndCard, tempRec.endType==='count'&&s.recEndCardActive]}
                onPress={()=>setTempRec(r=>({...r,endType:'count',endValue:typeof r.endValue==='number'&&r.endValue?r.endValue:4}))}>
                <Text style={[s.recEndCardTitle, tempRec.endType==='count'&&{color:'#6366f1'}]}>
                  🔢 Por vezes
                </Text>
                <View style={[s.recEndCardInput, tempRec.endType==='count'&&{borderColor:'#c7d2fe',backgroundColor:'#f5f3ff'}]}>
                  <TextInput
                    style={{width:38,textAlign:'center',fontWeight:'900',fontSize:18,color:'#1a3a5c'}}
                    value={tempRec.endType==='count'?String(tempRec.endValue||''):''}
                    onChangeText={v=>setTempRec(r=>({...r,endValue:parseInt(v.replace(/\D/g,''))||1,endType:'count'}))}
                    keyboardType="number-pad"
                    maxLength={3}
                    editable={tempRec.endType==='count'}
                  />
                  <Text style={{fontSize:11,color:'#94a3b8',fontWeight:'700'}}>sessões</Text>
                </View>
              </TouchableOpacity>

              {/* Por data */}
              <TouchableOpacity
                style={[s.recEndCard, tempRec.endType==='until'&&s.recEndCardActive]}
                onPress={()=>setTempRec(r=>({...r,endType:'until',endValue:typeof r.endValue==='string'&&r.endValue?r.endValue:''}))}>
                <Text style={[s.recEndCardTitle, tempRec.endType==='until'&&{color:'#6366f1'}]}>
                  📅 Por data
                </Text>
                <View style={[s.recEndCardInput, tempRec.endType==='until'&&{borderColor:'#c7d2fe',backgroundColor:'#f5f3ff'}]}>
                  <TextInput
                    style={{flex:1,fontSize:11,fontWeight:'700',color:'#1a3a5c',textAlign:'center'}}
                    value={tempRec.endType==='until'?String(tempRec.endValue||''):''}
                    onChangeText={v=>setTempRec(r=>({...r,endValue:v,endType:'until'}))}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor="#94a3b8"
                    editable={tempRec.endType==='until'}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* Botões */}
            <View style={{flexDirection:'row',gap:10}}>
              <TouchableOpacity style={[s.modalCancelBtn,{flex:1,alignItems:'center'}]}
                onPress={()=>{setShowRecCustom(false);setShowRecModal(true);}}>
                <Text style={s.modalCancelBtnTxt}>← Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalSaveBtn,{flex:2,justifyContent:'center'}]}
                onPress={()=>{
                  setAptForm(f=>({...f,
                    recurrence_freq:     tempRec.freq,
                    recurrence_interval: tempRec.interval,
                    recurrence_count:    tempRec.endType==='count'?(Number(tempRec.endValue)||1):1,
                    recurrence_end_date: tempRec.endType==='until'?String(tempRec.endValue):'',
                  }));
                  setShowRecCustom(false);
                }}>
                <Text style={s.modalSaveBtnTxt}>Salvar recorrência</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal Calendário (picker de data) ── */}
      <Modal visible={showCalPicker} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={()=>setShowCalPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={s.calPickerBox}>
            {(()=>{
              const [y,m] = calPickerAnchor.split('-').map(Number);
              const first = new Date(y,m-1,1);
              const last  = new Date(y,m,0);
              const blanks= first.getDay();
              const formDate = (aptForm.start||'').split('T')[0] || selectedDate;
              const prevMonth = ()=>{ const d=new Date(y,m-2,1); setCalPickerAnchor(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`); };
              const nextMonth = ()=>{ const d=new Date(y,m,1);   setCalPickerAnchor(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`); };
              return (
                <>
                  <View style={s.calPickerHeader}>
                    <TouchableOpacity onPress={prevMonth} style={s.calPickerNavBtn}><Text style={s.calPickerArrow}>‹</Text></TouchableOpacity>
                    <Text style={s.calPickerMonth}>{MONTHS_PT[m-1]} {y}</Text>
                    <TouchableOpacity onPress={nextMonth} style={s.calPickerNavBtn}><Text style={s.calPickerArrow}>›</Text></TouchableOpacity>
                  </View>
                  <View style={{flexDirection:'row',marginBottom:8}}>
                    {['D','S','T','Q','Q','S','S'].map((d,i)=>(
                      <Text key={i} style={s.calPickerDayHdr}>{d}</Text>
                    ))}
                  </View>
                  <View style={{flexDirection:'row',flexWrap:'wrap'}}>
                    {Array.from({length:blanks},(_,i)=><View key={`b${i}`} style={s.calPickerCell}/>)}
                    {Array.from({length:last.getDate()},(_,i)=>{
                      const day=`${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
                      const isSel=day===formDate; const isTdy=day===today;
                      const hasApts=appointments.some(a=>getStart(a).startsWith(day));
                      return (
                        <TouchableOpacity key={day} style={s.calPickerCell} onPress={()=>{
                          const t=getTime(aptForm.start)||'09:00'; const e=getTime(aptForm.end)||'10:00';
                          setAptForm(f=>({...f,start:`${day}T${t}`,end:`${day}T${e}`}));
                          setShowCalPicker(false);
                        }}>
                          <View style={[s.calPickerDayCircle,isSel&&{backgroundColor:'#6366f1'},isTdy&&!isSel&&{backgroundColor:'#f5f3ff'}]}>
                            <Text style={[s.calPickerDayNum,isSel&&{color:'#fff'},isTdy&&!isSel&&{color:'#6366f1'}]}>{i+1}</Text>
                          </View>
                          {hasApts&&<View style={[s.calPickerDot,isSel&&{backgroundColor:'#a5b4fc'}]}/>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal Nova Comanda ── */}
      <Modal visible={showCmdModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
          <View style={s.modalHeader}>
            <View style={{width:36}}/>
            <Text style={s.modalTitle}>🧾 Nova Comanda</Text>
            <TouchableOpacity style={s.modalCloseBtn} onPress={()=>setShowCmdModal(false)}>
              <Text style={s.modalCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{padding:20}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Tipo: Normal | Pacote */}
            <View style={s.cmdTypeRow}>
              {[['normal','Comanda Normal'],['package','Comanda Pacote']].map(([val,lbl])=>(
                <TouchableOpacity key={val} style={s.cmdTypeBtn} onPress={()=>setCmdForm(f=>({...f,type:val,items:[],package_id:'',manual_total:''}))}>
                  <View style={[s.cmdTypeRadio, cmdForm.type===val&&s.cmdTypeRadioActive]}>
                    {cmdForm.type===val&&<View style={s.cmdTypeRadioDot}/>}
                  </View>
                  <Text style={[s.cmdTypeLbl, cmdForm.type===val&&{color:'#6366f1',fontWeight:'800'}]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Pacote (só em modo Pacote) */}
            {cmdForm.type==='package'&&packages.length>0&&(
              <DropdownField
                label="Pacote"
                value={cmdForm.package_id}
                placeholder="Selecione o pacote..."
                options={[{value:'',label:'Selecionar pacote...'}, ...packages.map(pk=>({value:String(pk.id), label:`${pk.name}${pk.price||pk.totalPrice?' — R$ '+(pk.totalPrice||pk.price):''}${pk.sessions_count?' ('+pk.sessions_count+' sessões)':''}`}))]}
                onChange={v=>{
                  const pk = packages.find(p=>String(p.id)===v);
                  const price = parseFloat(String(pk?.totalPrice||pk?.price||0).replace(',','.'))||0;
                  const sessions = pk?.sessions_count || pk?.sessions_total || 1;
                  const baseItem = (pk && price>0) ? [{name:pk.name, qty:1, price}] : [];
                  setCmdForm(f=>({
                    ...f,
                    package_id: v,
                    sessions_total: String(sessions),
                    items: baseItem,
                  }));
                }}
              />
            )}

            {/* Serviço + Descrição (só em modo Normal) */}
            {cmdForm.type==='normal'&&(
              <>
                {services.length>0&&(
                  <DropdownField
                    label="Serviço (preenche valor automaticamente)"
                    value={cmdForm._service_id||''}
                    placeholder="Selecionar serviço..."
                    options={[{value:'',label:'Selecionar...'}, ...services.map(sv=>({value:String(sv.id), label:`${sv.name}${sv.price||sv.default_price?' — R$ '+(sv.price||sv.default_price):''}`}))]}
                    onChange={v=>{
                      if (!v) return;
                      const sv = services.find(s=>String(s.id)===v);
                      if (!sv) return;
                      const price = parseFloat(String(sv.price||sv.default_price||0).replace(',','.'))||0;
                      setCmdForm(f=>({...f, _service_id:v, description:sv.name, manual_total: price>0 ? String(price.toFixed(2)) : f.manual_total}));
                    }}
                  />
                )}
                <Text style={s.fieldLabel}>Descrição</Text>
                <TextInput style={s.fieldInput} value={cmdForm.description} onChangeText={v=>setCmdForm(f=>({...f,description:v}))} placeholder="Ex: Sessão de Psicologia, Avaliação..." placeholderTextColor="#94a3b8"/>
              </>
            )}

            {/* Cliente */}
            <Text style={s.fieldLabel}>Cliente *</Text>
            {cmdForm.patient_id ? (
              <TouchableOpacity style={[s.fieldInput,{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}]}
                onPress={()=>{setCmdForm(f=>({...f,patient_id:''}));setPatSearch2('');}}>
                <Text style={{color:'#0f172a',fontWeight:'700',fontSize:15}}>{patSearch2}</Text>
                <Text style={{color:'#94a3b8',fontSize:12}}>trocar ✕</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput style={s.fieldInput} value={patSearch2} onChangeText={setPatSearch2} placeholder="Digite o nome..." placeholderTextColor="#94a3b8"/>
                {patSearch2.length>0&&(
                  <View style={s.patList}>
                    {filtPats2.length===0
                      ? <Text style={{color:'#94a3b8',padding:10,fontSize:13}}>Nenhum encontrado</Text>
                      : filtPats2.map(p=>(
                        <TouchableOpacity key={p.id} style={s.patOpt} onPress={()=>{setCmdForm(f=>({...f,patient_id:String(p.id)}));setPatSearch2(p.name||'');}}>
                          <Text style={s.patOptName}>{p.name}</Text>
                          {(p.phone||p.email)&&<Text style={s.patOptSub}>{p.phone||p.email}</Text>}
                        </TouchableOpacity>
                      ))
                    }
                  </View>
                )}
              </>
            )}

            {/* Profissional */}
            <DropdownField
              label="Profissional"
              value={cmdForm.professional_id}
              placeholder="Selecione o profissional..."
              options={[{value:'',label:'Nenhum'}, ...professionals.map(p=>({value:String(p.id), label:p.name}))]}
              onChange={v=>setCmdForm(f=>({...f,professional_id:v}))}
            />

            {/* Modo Normal: valor total manual + nº atendimentos lado a lado */}
            {cmdForm.type==='normal'&&(
              <View style={{flexDirection:'row',gap:10}}>
                <View style={{flex:1}}>
                  <Text style={s.fieldLabel}>Valor Total</Text>
                  <TextInput style={s.fieldInput} value={cmdForm.manual_total} onChangeText={v=>setCmdForm(f=>({...f,manual_total:v}))} placeholder="R$ 0,00" placeholderTextColor="#94a3b8" keyboardType="decimal-pad"/>
                </View>
                <View style={{flex:1}}>
                  <Text style={s.fieldLabel}>Nº de Atendimentos</Text>
                  <TextInput style={s.fieldInput} value={cmdForm.sessions_total} onChangeText={v=>setCmdForm(f=>({...f,sessions_total:v}))} placeholder="1" placeholderTextColor="#94a3b8" keyboardType="number-pad"/>
                </View>
              </View>
            )}

            {/* Modo Pacote: adicionar por serviço e itens manuais */}
            {cmdForm.type==='package'&&(
              <>
                {services.length>0&&(
                  <DropdownField
                    label="Adicionar Serviço"
                    value={cmdServiceAdd}
                    placeholder="Selecionar serviço..."
                    options={[{value:'',label:'Selecionar...'}, ...services.map(sv=>({value:String(sv.id), label:`${sv.name}${sv.price||sv.default_price?' — R$ '+(sv.price||sv.default_price):''}`}))]}
                    onChange={v=>{
                      if (!v) return;
                      const sv = services.find(s=>String(s.id)===v);
                      if (!sv) return;
                      const price = parseFloat(String(sv.price||sv.default_price||0).replace(',','.'))||0;
                      setCmdForm(f=>({...f, items:[...f.items, {name:sv.name, qty:1, price}]}));
                      setCmdServiceAdd('');
                    }}
                  />
                )}
                <Text style={s.fieldLabel}>Item manual</Text>
                <View style={s.itemRow}>
                  <TextInput style={[s.fieldInput,{flex:2,marginBottom:0}]} value={cmdItem.name} onChangeText={v=>setCmdItem(c=>({...c,name:v}))} placeholder="Nome" placeholderTextColor="#94a3b8"/>
                  <TextInput style={[s.fieldInput,{flex:0.5,marginBottom:0,textAlign:'center'}]} value={cmdItem.qty} onChangeText={v=>setCmdItem(c=>({...c,qty:v}))} placeholder="Qtd" placeholderTextColor="#94a3b8" keyboardType="number-pad"/>
                  <TextInput style={[s.fieldInput,{flex:1,marginBottom:0}]} value={cmdItem.price} onChangeText={v=>setCmdItem(c=>({...c,price:v}))} placeholder="Preço" placeholderTextColor="#94a3b8" keyboardType="decimal-pad"/>
                  <TouchableOpacity style={s.addItemBtn} onPress={addCmdItem}><Text style={s.addItemBtnText}>+</Text></TouchableOpacity>
                </View>
                <Text style={[s.fieldLabel,{marginTop:10}]}>Nº de Atendimentos</Text>
                <TextInput style={s.fieldInput} value={cmdForm.sessions_total} onChangeText={v=>setCmdForm(f=>({...f,sessions_total:v}))} placeholder="1" placeholderTextColor="#94a3b8" keyboardType="number-pad"/>
              </>
            )}

            {/* Lista de itens (modo Pacote) */}
            {cmdForm.type==='package'&&cmdForm.items.length>0&&(
              <View style={s.itemsList}>
                {cmdForm.items.map((it,i)=>(
                  <View key={i} style={s.itemLine}>
                    <Text style={s.itemLineName} numberOfLines={1}>{it.qty}× {it.name}</Text>
                    <Text style={s.itemLinePrice}>R$ {(it.qty*(parseFloat(String(it.price).replace(',','.'))||0)).toFixed(2)}</Text>
                    <TouchableOpacity onPress={()=>removeCmdItem(i)}><Text style={{color:'#ef4444',fontWeight:'800',paddingLeft:8}}>✕</Text></TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Totais */}
            <View style={s.cmdTotalsBox}>
              <View style={s.cmdTotalRow}>
                <Text style={s.cmdTotalLbl}>Valor Total</Text>
                <Text style={s.cmdTotalVal}>R$ {cmdSubtotal().toFixed(2)}</Text>
              </View>
              <View style={[s.cmdTotalRow,{alignItems:'center'}]}>
                <Text style={s.cmdTotalLbl}>Desconto</Text>
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                  {[['percentage','%'],['fixed','R$']].map(([val,lbl])=>(
                    <TouchableOpacity key={val} style={[s.discountToggle,cmdForm.discount_type===val&&s.discountToggleActive]} onPress={()=>setCmdForm(f=>({...f,discount_type:val}))}>
                      <Text style={[s.discountToggleTxt,cmdForm.discount_type===val&&{color:'#fff'}]}>{lbl}</Text>
                    </TouchableOpacity>
                  ))}
                  <TextInput style={s.discountInput} value={cmdForm.discount_value} onChangeText={v=>setCmdForm(f=>({...f,discount_value:v}))} placeholder="0,00" placeholderTextColor="#94a3b8" keyboardType="decimal-pad"/>
                </View>
              </View>
              <View style={[s.cmdTotalRow,{borderTopWidth:1,borderTopColor:'#e2e8f0',paddingTop:12,marginTop:4}]}>
                <Text style={{fontSize:14,fontWeight:'900',color:'#0f172a'}}>Total Líquido</Text>
                <Text style={{fontSize:18,fontWeight:'900',color:'#6366f1'}}>R$ {cmdTotal().toFixed(2)}</Text>
              </View>
            </View>
            <View style={{height:20}}/>
          </ScrollView>
          {/* ── Rodapé com botões ── */}
          <View style={[s.modalFooter,{gap:10}]}>
            <TouchableOpacity style={[s.modalCancelBtn,{flex:1,alignItems:'center'}]} onPress={()=>setShowCmdModal(false)}>
              <Text style={s.modalCancelBtnTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalSaveBtn,{flex:2,justifyContent:'center',backgroundColor:'#10b981'}]} onPress={saveCmd} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small"/>
                : <Text style={s.modalSaveBtnTxt}>Criar Comanda</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* ─── Dropdown genérico ─── */
function DropdownField({ label, value, options, onChange, placeholder, style }) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find(o => String(o.value) === String(value));
  return (
    <>
      {label && <Text style={s.fieldLabel}>{label}</Text>}
      <TouchableOpacity
        style={[s.fieldInput, {flexDirection:'row', alignItems:'center', justifyContent:'space-between'}, style]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={{color: selected ? '#0f172a' : '#94a3b8', fontSize:15, fontWeight: selected ? '600' : '400', flex:1}} numberOfLines={1}>
          {selected ? selected.label : (placeholder || 'Selecione...')}
        </Text>
        <Text style={{color:'#94a3b8', fontSize:13, marginLeft:6}}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[s.sheet, {maxHeight:'70%'}]}>
            <View style={s.sheetHandle}/>
            {label && <Text style={s.sheetTitle}>{label}</Text>}
            <ScrollView keyboardShouldPersistTaps="handled">
              {options.map(opt => (
                <TouchableOpacity key={String(opt.value)} style={[s.statusRow, String(value)===String(opt.value)&&{backgroundColor:'#f5f3ff'}]}
                  onPress={() => { onChange(String(opt.value)); setOpen(false); }}>
                  {opt.color && <View style={[s.statusDot,{backgroundColor:opt.color}]}/>}
                  <Text style={[s.statusLabel, String(value)===String(opt.value)&&{color:'#6366f1',fontWeight:'800'}]}>{opt.label}</Text>
                  {String(value)===String(opt.value)&&<Text style={{color:'#10b981',fontWeight:'900',marginLeft:'auto'}}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

/* ─── Componente de card de agendamento ─── */
function AptCard({ apt, onPress }) {
  const st    = apt.start_time || apt.start;
  const en    = apt.end_time   || apt.end;
  const color = STATUS_COLOR[apt.status] || '#94a3b8';
  return (
    <TouchableOpacity style={s.aptCard} onPress={onPress} activeOpacity={0.78}>
      <View style={[s.aptBar,{backgroundColor:color}]}/>
      <View style={s.aptContent}>
        <View style={s.aptTopRow}>
          <Text style={s.aptTime}>{fmtTime(st)}{en?` – ${fmtTime(en)}`:''}</Text>
          <View style={[s.statusChip,{backgroundColor:color+'20'}]}>
            <Text style={[s.statusChipTxt,{color}]}>{STATUS_LABEL[apt.status]||apt.status}</Text>
          </View>
        </View>
        <Text style={s.aptName}>{apt.patient_name||apt.title||'Sem título'}</Text>
        {apt.modality&&<Text style={s.aptMeta}>{apt.modality==='online'?'💻':'🏢'} {apt.modality}{apt.service_name?` · ${apt.service_name}`:''}</Text>}
      </View>
      <Text style={s.aptChevron}>›</Text>
    </TouchableOpacity>
  );
}

/* ─────────────── STYLES ─────────────────── */
const CELL_W = Math.floor(SCREEN_W / 7);

const s = StyleSheet.create({
  container:  {flex:1, backgroundColor:'#f8fafc'},
  center:     {flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#f8fafc'},

  /* Header */
  calHeader:  {backgroundColor:'#1a3a5c', paddingHorizontal:14, paddingTop:12, paddingBottom:10, gap:10},
  viewSwitch: {flexDirection:'row', alignSelf:'center', backgroundColor:'rgba(255,255,255,0.12)', borderRadius:20, padding:3, gap:2},
  viewBtn:    {paddingHorizontal:18, paddingVertical:6, borderRadius:16},
  viewBtnActive:{backgroundColor:'#fff'},
  viewBtnText:{fontSize:13, fontWeight:'700', color:'#93c5fd'},
  viewBtnTextActive:{color:'#1a3a5c'},
  navRow:     {flexDirection:'row', alignItems:'center', justifyContent:'space-between'},
  navBtn:     {padding:8, backgroundColor:'rgba(255,255,255,0.12)', borderRadius:10, width:36, alignItems:'center'},
  navArrow:   {color:'#fff', fontSize:20, fontWeight:'700', lineHeight:22},
  todayBtn:   {flex:1, alignItems:'center', paddingVertical:4},
  todayBtnText:{fontSize:14, fontWeight:'800', color:'#fff'},

  /* Week day header letters */
  weekDayHeader:{flexDirection:'row', backgroundColor:'#1a3a5c', paddingBottom:6},
  weekDayHdr: {width:CELL_W, textAlign:'center', fontSize:11, fontWeight:'800', color:'#93c5fd'},

  /* Week strip */
  weekStrip:  {flexDirection:'row', backgroundColor:'#1a3a5c', paddingBottom:14},
  weekDayCol: {width:CELL_W, alignItems:'center', gap:4},
  weekDayCircle:{width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center'},
  weekDayCircleActive:{backgroundColor:'#6366f1'},
  weekDayCircleToday:{backgroundColor:'rgba(99,102,241,0.2)'},
  weekDayNum: {fontSize:16, fontWeight:'800', color:'#e2e8f0'},
  aptDotRow:  {flexDirection:'row', gap:2},
  aptDot:     {width:4, height:4, borderRadius:2, backgroundColor:'#818cf8'},

  /* Day label */
  dayLabel:   {flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:14, paddingVertical:12, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#f1f5f9'},
  dayLabelText:{fontSize:14, fontWeight:'700', color:'#0f172a'},
  dayLabelBadge:{backgroundColor:'#f5f3ff', paddingHorizontal:10, paddingVertical:4, borderRadius:12},
  dayLabelBadgeText:{fontSize:12, fontWeight:'800', color:'#6366f1'},

  /* Month grid */
  monthGrid:  {flexDirection:'row', flexWrap:'wrap', backgroundColor:'#fff'},
  monthCell:  {width:CELL_W, height:58, alignItems:'center', justifyContent:'center'},
  monthCellActive:{backgroundColor:'#f5f3ff'},
  monthDayCircle:{width:30, height:30, borderRadius:15, alignItems:'center', justifyContent:'center'},
  monthDayCircleToday:{backgroundColor:'#6366f1'},
  monthDayNum:{fontSize:14, fontWeight:'700', color:'#334155'},
  monthAptDots:{flexDirection:'row', gap:2, marginTop:2},
  monthDot:   {width:4, height:4, borderRadius:2},

  /* Empty */
  emptyBox:   {alignItems:'center', paddingTop:50, gap:8},
  emptyTitle: {fontSize:17, fontWeight:'800', color:'#1e293b'},
  emptyText:  {fontSize:13, color:'#94a3b8'},

  /* Apt card */
  aptCard:    {backgroundColor:'#fff', borderRadius:16, marginBottom:10, flexDirection:'row', overflow:'hidden', shadowColor:'#6366f1', shadowOffset:{width:0,height:2}, shadowOpacity:0.08, shadowRadius:8, elevation:3},
  aptBar:     {width:5},
  aptContent: {flex:1, padding:14},
  aptTopRow:  {flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6},
  aptTime:    {fontSize:12, fontWeight:'700', color:'#64748b'},
  aptName:    {fontSize:15, fontWeight:'800', color:'#0f172a'},
  aptMeta:    {fontSize:12, color:'#94a3b8', marginTop:4},
  statusChip: {paddingHorizontal:10, paddingVertical:4, borderRadius:20},
  statusChipTxt:{fontSize:10, fontWeight:'800'},
  aptChevron: {color:'#cbd5e1', fontSize:22, paddingRight:14, alignSelf:'center'},

  /* FAB */
  fab:        {position:'absolute', right:20, bottom:24, width:58, height:58, borderRadius:29, backgroundColor:'#6366f1', alignItems:'center', justifyContent:'center', shadowColor:'#6366f1', shadowOffset:{width:0,height:6}, shadowOpacity:0.4, shadowRadius:12, elevation:12, zIndex:100},
  fabText:    {color:'#fff', fontSize:32, fontWeight:'300', marginTop:-2},
  fabBackdrop:{position:'absolute',top:0,left:0,right:0,bottom:0, zIndex:90},
  fabMenu:    {position:'absolute', right:20, bottom:92, gap:10, zIndex:100},
  fabMenuItem:{paddingHorizontal:18, paddingVertical:13, borderRadius:16, shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.2, shadowRadius:8, elevation:8},
  fabMenuText:{color:'#fff', fontWeight:'800', fontSize:14},

  /* Status sheet */
  overlay:    {flex:1, backgroundColor:'rgba(15,23,42,0.55)', justifyContent:'flex-end'},
  sheet:      {backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:40},
  sheetHandle:{width:40, height:4, borderRadius:2, backgroundColor:'#e2e8f0', alignSelf:'center', marginBottom:18},
  sheetTitle: {fontSize:18, fontWeight:'900', color:'#0f172a', marginBottom:4},
  sheetSub:   {fontSize:13, color:'#64748b', marginBottom:14},
  statusRow:  {flexDirection:'row', alignItems:'center', gap:14, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#f8fafc'},
  statusDot:  {width:12, height:12, borderRadius:6},
  statusLabel:{fontSize:15, fontWeight:'600', color:'#1e293b'},

  /* Modal */
  modalHeader:    {flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#f1f5f9', backgroundColor:'#fff'},
  modalTitle:     {fontSize:17, fontWeight:'900', color:'#0f172a', flex:1, textAlign:'center'},
  modalCloseBtn:  {width:36, height:36, borderRadius:18, backgroundColor:'#f1f5f9', alignItems:'center', justifyContent:'center'},
  modalCloseTxt:  {color:'#64748b', fontSize:14, fontWeight:'900'},
  modalFooter:    {flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:20, paddingVertical:12, paddingBottom:28, borderTopWidth:1, borderTopColor:'#f1f5f9', backgroundColor:'#fff'},
  modalCancelBtn: {paddingVertical:9, paddingHorizontal:18, borderRadius:10, borderWidth:1, borderColor:'#e2e8f0'},
  modalCancelBtnTxt:{fontSize:13, fontWeight:'600', color:'#94a3b8'},
  modalSaveBtn:   {paddingVertical:9, paddingHorizontal:20, borderRadius:10, alignItems:'center', backgroundColor:'#6366f1', shadowColor:'#6366f1', shadowOffset:{width:0,height:2}, shadowOpacity:0.2, shadowRadius:4, elevation:3},
  modalSaveBtnTxt:{fontSize:13, fontWeight:'700', color:'#fff'},

  recurrenceInfo:    {backgroundColor:'#f0f4ff', borderRadius:10, padding:10, marginBottom:14, borderWidth:1, borderColor:'#c7d2fe'},
  recurrenceInfoTxt: {fontSize:13, color:'#4338ca'},

  /* Recurrence button */
  recBtn:        {flexDirection:'row', alignItems:'center', borderWidth:1.5, borderColor:'#e2e8f0', borderRadius:14, padding:14, marginBottom:14, backgroundColor:'#f8fafc'},
  recBtnLabel:   {fontSize:14, fontWeight:'700', color:'#1a3a5c'},
  recBtnSub:     {fontSize:11, color:'#6366f1', marginTop:3, fontWeight:'600'},
  recBtnArrow:   {fontSize:22, color:'#94a3b8', marginLeft:8},

  /* Recurrence modal */
  recCurrentBox: {backgroundColor:'#f0f4ff', borderRadius:12, padding:12, marginBottom:10, borderWidth:1, borderColor:'#ddd6fe'},
  recCurrentLbl: {fontSize:9, fontWeight:'900', color:'#6366f1', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4},
  recCurrentVal: {fontSize:14, fontWeight:'800', color:'#1a3a5c'},
  recHint:       {fontSize:11, color:'#6366f1', fontStyle:'italic', marginBottom:12, lineHeight:16},
  recOptionRow:  {flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:14, paddingHorizontal:4, borderBottomWidth:1, borderBottomColor:'#f1f5f9'},
  recOptionRowActive:{backgroundColor:'#f0f4ff', borderRadius:12, paddingHorizontal:12, marginHorizontal:-8, borderBottomWidth:0},
  recOptionTxt:  {fontSize:13, fontWeight:'700', color:'#334155'},
  recOptionTxtActive:{color:'#4338ca'},
  recOptionArrow:{fontSize:18, color:'#cbd5e1'},

  /* Custom recurrence */
  recCfgLabel:     {fontSize:10, fontWeight:'900', color:'#64748b', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8},
  recCfgCard:      {backgroundColor:'#f8fafc', borderRadius:16, padding:14, marginBottom:14, borderWidth:1, borderColor:'#e2e8f0'},

  recFreqRow:      {flexDirection:'row', alignItems:'center', gap:12, paddingVertical:10, paddingHorizontal:4},
  recFreqRadio:    {width:20, height:20, borderRadius:10, borderWidth:2, borderColor:'#cbd5e1', alignItems:'center', justifyContent:'center'},
  recFreqRadioActive:{borderColor:'#6366f1'},
  recFreqRadioDot: {width:10, height:10, borderRadius:5, backgroundColor:'#6366f1'},
  recFreqLabel:    {fontSize:14, color:'#475569', fontWeight:'600'},

  recStepBtn:      {width:38, height:38, borderRadius:12, backgroundColor:'#fff', borderWidth:1.5, borderColor:'#e2e8f0', alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:2, elevation:1},
  recStepBtnTxt:   {fontSize:20, color:'#6366f1', fontWeight:'700', lineHeight:24},
  recStepVal:      {width:52, height:38, borderRadius:12, backgroundColor:'#fff', borderWidth:1.5, borderColor:'#6366f1', alignItems:'center', justifyContent:'center'},
  recStepValTxt:   {fontSize:18, fontWeight:'900', color:'#1a3a5c'},

  recEndCard:      {flex:1, alignItems:'center', borderWidth:2, borderColor:'#e2e8f0', borderRadius:16, paddingVertical:14, paddingHorizontal:8, gap:10, backgroundColor:'#fff'},
  recEndCardActive:{borderColor:'#6366f1', backgroundColor:'#f5f3ff'},
  recEndCardTitle: {fontSize:12, fontWeight:'800', color:'#64748b'},
  recEndCardInput: {flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'#f8fafc', paddingHorizontal:10, paddingVertical:8, borderRadius:10, borderWidth:1.5, borderColor:'#e2e8f0', width:'100%', justifyContent:'center'},
  fieldLabel: {fontSize:11, fontWeight:'800', color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5},
  fieldInput: {borderWidth:1.5, borderColor:'#e2e8f0', borderRadius:12, paddingHorizontal:14, paddingVertical:12, fontSize:15, color:'#0f172a', backgroundColor:'#f8fafc', marginBottom:14},
  patList:    {backgroundColor:'#fff', borderRadius:12, marginBottom:10, borderWidth:1, borderColor:'#e2e8f0', overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.07, shadowRadius:6, elevation:4},
  patOpt:     {backgroundColor:'#fff', padding:13, borderBottomWidth:1, borderBottomColor:'#f1f5f9'},
  patOptName: {fontWeight:'700', color:'#0f172a'},
  patOptSub:  {fontSize:12, color:'#64748b', marginTop:2},
  chip:       {flex:1, padding:12, borderRadius:12, borderWidth:1.5, borderColor:'#e2e8f0', alignItems:'center', backgroundColor:'#f8fafc'},
  chipActive: {backgroundColor:'#6366f1', borderColor:'#6366f1'},
  chipText:   {fontWeight:'700', color:'#64748b', fontSize:13},
  chipTextActive:{color:'#fff'},

  /* Comanda items */
  itemRow:    {flexDirection:'row', gap:6, marginBottom:10, alignItems:'center'},
  addItemBtn: {width:42, height:42, borderRadius:12, backgroundColor:'#6366f1', alignItems:'center', justifyContent:'center'},
  addItemBtnText:{color:'#fff', fontSize:22, fontWeight:'300', marginTop:-2},
  itemsList:  {backgroundColor:'#f8fafc', borderRadius:12, padding:12, marginBottom:14, borderWidth:1, borderColor:'#e2e8f0'},
  itemLine:   {flexDirection:'row', alignItems:'center', paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#f1f5f9'},
  itemLineName:{flex:1, fontSize:13, fontWeight:'600', color:'#1e293b'},
  itemLinePrice:{fontSize:13, fontWeight:'700', color:'#6366f1'},
  subtotalRow:{flexDirection:'row', justifyContent:'space-between', paddingTop:10},
  subtotalLabel:{fontSize:13, fontWeight:'700', color:'#64748b'},
  subtotalValue:{fontSize:14, fontWeight:'800', color:'#1e293b'},
  totalBox:   {backgroundColor:'#f5f3ff', borderRadius:14, padding:16, flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:4, borderWidth:1, borderColor:'#ddd6fe'},
  totalLabel: {fontSize:14, fontWeight:'700', color:'#6366f1'},
  totalValue: {fontSize:22, fontWeight:'900', color:'#6366f1'},

  /* Detail modal */
  detailStatusDot:  {width:10, height:10, borderRadius:5},
  detailStatusTxt:  {fontSize:13, fontWeight:'800', textTransform:'uppercase', letterSpacing:0.5},
  detailModalityChip:{backgroundColor:'#f1f5f9', paddingHorizontal:10, paddingVertical:3, borderRadius:10, marginLeft:'auto'},
  detailModalityTxt:{fontSize:11, fontWeight:'700', color:'#475569'},
  detailName:  {fontSize:20, fontWeight:'900', color:'#0f172a', marginBottom:14},
  detailRow:   {flexDirection:'row', alignItems:'center', gap:10, marginBottom:8},
  detailRowIcon:{fontSize:15},
  detailRowTxt:{fontSize:14, color:'#334155', fontWeight:'600'},
  detailCmdBox:{backgroundColor:'#f8fafc', borderRadius:14, padding:14, marginTop:14, borderWidth:1, borderColor:'#e2e8f0'},
  detailCmdTitle:{fontSize:13, fontWeight:'900', color:'#1e293b', marginBottom:6},
  detailCmdDesc:{fontSize:13, color:'#64748b', marginBottom:10},
  detailCmdStats:{flexDirection:'row', gap:10},
  detailCmdStat:{flex:1, alignItems:'center'},
  detailCmdStatVal:{fontSize:16, fontWeight:'900', color:'#1e293b'},
  detailCmdStatLbl:{fontSize:10, fontWeight:'700', color:'#94a3b8', marginTop:2},
  detailCmdCreateBtn:{backgroundColor:'#6366f1', paddingHorizontal:14, paddingVertical:7, borderRadius:10},
  detailCmdCreateTxt:{color:'#fff', fontWeight:'800', fontSize:13},
  detailBtn:   {paddingVertical:13, borderRadius:14, alignItems:'center', paddingHorizontal:16},
  detailBtnTxt:{fontSize:14, fontWeight:'800'},

  /* Data/hora no form */
  dateNavRow:     {flexDirection:'row', alignItems:'center', backgroundColor:'#f5f3ff', borderRadius:12, marginBottom:14, borderWidth:1.5, borderColor:'#ddd6fe', overflow:'hidden'},
  dateNavBtn:     {width:44, alignItems:'center', justifyContent:'center', paddingVertical:12, backgroundColor:'rgba(99,102,241,0.1)'},
  dateNavArrow:   {fontSize:22, fontWeight:'900', color:'#6366f1', lineHeight:24},
  dateNavLabel:   {fontSize:13, fontWeight:'800', color:'#4f46e5'},
  timeChip:       {paddingHorizontal:12, paddingVertical:8, borderRadius:10, borderWidth:1.5, borderColor:'#e2e8f0', backgroundColor:'#f8fafc', alignItems:'center'},
  timeChipActive: {backgroundColor:'#6366f1', borderColor:'#6366f1'},
  timeChipTaken:  {borderColor:'#fecaca', backgroundColor:'#fff5f5'},
  timeChipTxt:    {fontSize:13, fontWeight:'700', color:'#64748b'},
  timeChipTxtActive:{color:'#fff'},
  timeChipDot:    {width:4, height:4, borderRadius:2, backgroundColor:'#ef4444', marginTop:2},

  /* Calendário picker */
  calPickerBox:   {backgroundColor:'#fff', borderRadius:20, margin:24, padding:20, shadowColor:'#000', shadowOffset:{width:0,height:8}, shadowOpacity:0.15, shadowRadius:20, elevation:20},
  calPickerHeader:{flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16},
  calPickerNavBtn:{width:36, height:36, borderRadius:18, backgroundColor:'#f5f3ff', alignItems:'center', justifyContent:'center'},
  calPickerArrow: {fontSize:20, fontWeight:'900', color:'#6366f1', lineHeight:22},
  calPickerMonth: {fontSize:16, fontWeight:'900', color:'#0f172a'},
  calPickerDayHdr:{flex:1, textAlign:'center', fontSize:11, fontWeight:'800', color:'#94a3b8'},
  calPickerCell:  {width:'14.28%', alignItems:'center', marginBottom:6},
  calPickerDayCircle:{width:34, height:34, borderRadius:17, alignItems:'center', justifyContent:'center'},
  calPickerDayNum:{fontSize:14, fontWeight:'700', color:'#334155'},
  calPickerDot:   {width:4, height:4, borderRadius:2, backgroundColor:'#6366f1', marginTop:1},

  /* Tipo Normal/Pacote */
  cmdTypeRow:          {flexDirection:'row', gap:16, marginBottom:20, paddingBottom:16, borderBottomWidth:1, borderBottomColor:'#f1f5f9'},
  cmdTypeBtn:          {flexDirection:'row', alignItems:'center', gap:8},
  cmdTypeRadio:        {width:20, height:20, borderRadius:10, borderWidth:2, borderColor:'#cbd5e1', alignItems:'center', justifyContent:'center'},
  cmdTypeRadioActive:  {borderColor:'#6366f1'},
  cmdTypeRadioDot:     {width:10, height:10, borderRadius:5, backgroundColor:'#6366f1'},
  cmdTypeLbl:          {fontSize:14, fontWeight:'600', color:'#64748b'},
  /* Totais comanda */
  cmdTotalsBox:        {backgroundColor:'#f8fafc', borderRadius:14, padding:16, marginTop:14, borderWidth:1, borderColor:'#e2e8f0', gap:12},
  cmdTotalRow:         {flexDirection:'row', justifyContent:'space-between'},
  cmdTotalLbl:         {fontSize:13, color:'#64748b', fontWeight:'600'},
  cmdTotalVal:         {fontSize:13, fontWeight:'700', color:'#1e293b'},
  discountToggle:      {paddingHorizontal:10, paddingVertical:4, borderRadius:8, borderWidth:1, borderColor:'#e2e8f0', backgroundColor:'#fff'},
  discountToggleActive:{backgroundColor:'#6366f1', borderColor:'#6366f1'},
  discountToggleTxt:   {fontSize:12, fontWeight:'800', color:'#64748b'},
  discountInput:       {borderWidth:1, borderColor:'#e2e8f0', borderRadius:8, paddingHorizontal:10, paddingVertical:6, fontSize:13, color:'#0f172a', backgroundColor:'#fff', minWidth:70, textAlign:'right'},

  /* Comanda no form de agendamento */
  cmdLinkedBox:   {backgroundColor:'#f0fdf4', borderRadius:14, padding:14, marginBottom:14, borderWidth:1.5, borderColor:'#bbf7d0'},
  cmdLinkedHeader:{fontSize:10, fontWeight:'900', color:'#16a34a', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5},
  cmdLinkedDesc:  {fontSize:14, fontWeight:'700', color:'#15803d', marginBottom:4},
  cmdLinkedSub:   {fontSize:12, color:'#4ade80', fontWeight:'600', marginBottom:10},
  cmdRemoveBtn:   {alignSelf:'flex-start', backgroundColor:'#dcfce7', borderRadius:10, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:'#86efac'},
  cmdRemoveTxt:   {fontSize:12, fontWeight:'800', color:'#ef4444'},
  cmdAvailBox:    {backgroundColor:'#fff7ed', borderRadius:14, padding:14, marginBottom:14, borderWidth:1.5, borderColor:'#fed7aa'},
  cmdAvailHeader: {fontSize:10, fontWeight:'900', color:'#ea580c', marginBottom:10, textTransform:'uppercase', letterSpacing:0.5},
  cmdAvailRow:    {flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:10, padding:12, marginBottom:8, borderWidth:1, borderColor:'#fed7aa'},
  cmdAvailName:   {fontSize:13, fontWeight:'700', color:'#1e293b'},
  cmdAvailSub:    {fontSize:11, color:'#94a3b8', marginTop:2},
  cmdAvailLink:   {fontSize:12, fontWeight:'800', color:'#ea580c'},
  cmdCreateBtn:   {borderWidth:1.5, borderColor:'#e2e8f0', borderRadius:12, borderStyle:'dashed', padding:14, alignItems:'center', marginBottom:14},
  cmdCreateTxt:   {fontSize:13, fontWeight:'700', color:'#6366f1'},

  /* Quick status bar inline */
  quickStatusRow:{flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:10, marginBottom:4},
  quickStatusBtn:{paddingHorizontal:10, paddingVertical:6, borderRadius:20, borderWidth:1.5},
  quickStatusTxt:{fontSize:10, fontWeight:'800'},

  /* Detail info card */
  detailInfoCard:{backgroundColor:'#f8fafc', borderRadius:14, paddingHorizontal:14,
                   paddingVertical:4, marginBottom:12,
                   borderWidth:1, borderColor:'#e2e8f0'},
});
