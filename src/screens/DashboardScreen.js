import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
// import * as Notifications from 'expo-notifications';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const { width: SW } = Dimensions.get('window');

const fmtMoney = (v) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtTime  = (d) => { if (!d) return ''; const dt=new Date(d); return isNaN(dt)?'':dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); };
const todayISO = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const fmtPct   = (a,b) => b>0 ? Math.round((a/b)*100)+'%' : '—';

const STATUS_COLOR = { scheduled:'#f59e0b', confirmed:'#6366f1', completed:'#10b981', cancelled:'#ef4444', 'no-show':'#94a3b8' };
const STATUS_LABEL = { scheduled:'Agendado', confirmed:'Confirmado', completed:'Realizado', cancelled:'Cancelado', 'no-show':'Faltou' };
const WDAY   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MON_S  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const today     = todayISO();
      const now       = new Date();
      const [y, m]    = today.split('-').map(Number);
      const futureEnd = new Date(Date.now()+30*86400000).toISOString().split('T')[0]+'T23:59:59';
      const mStart    = `${y}-${String(m).padStart(2,'0')}-01`;
      const mEnd      = `${y}-${String(m).padStart(2,'0')}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
      const prevM     = m===1?12:m-1; const prevY = m===1?y-1:y;
      const pmStart   = `${prevY}-${String(prevM).padStart(2,'0')}-01`;
      const pmEnd     = `${prevY}-${String(prevM).padStart(2,'0')}-${String(new Date(prevY,prevM,0).getDate()).padStart(2,'0')}`;

      const [patients, apts, monthApts, prevMonthApts, summary, prevSummary, records] = await Promise.allSettled([
        api.get('/patients'),
        api.get(`/appointments?start=${today}&end=${futureEnd}`),
        api.get(`/appointments?start=${mStart}&end=${mEnd}`),
        api.get(`/appointments?start=${pmStart}&end=${pmEnd}`),
        api.get(`/finance/summary?month=${m}&year=${y}`),
        api.get(`/finance/summary?month=${prevM}&year=${prevY}`),
        api.get('/medical-records/stats').catch(()=>null),
      ]);

      const allApts    = apts.status==='fulfilled'        ? (apts.value?.appointments||apts.value||[])             : [];
      const allMonth   = monthApts.status==='fulfilled'   ? (monthApts.value?.appointments||monthApts.value||[])   : [];
      const allPrevM   = prevMonthApts.status==='fulfilled'? (prevMonthApts.value?.appointments||prevMonthApts.value||[]) : [];
      const getS       = (a) => a.start_time||a.start||'';

      const todayApts = allApts
        .filter(a => getS(a).startsWith(today))
        .sort((a,b) => new Date(getS(a))-new Date(getS(b)));

      const allUpcoming = allApts
        .filter(a => { const s=getS(a); if(!s) return false; const d=new Date(s); return !isNaN(d)&&d>now&&!s.startsWith(today); })
        .sort((a,b) => new Date(getS(a))-new Date(getS(b)));

      const patsArr   = patients.status==='fulfilled' ? (patients.value?.patients||patients.value||[]) : [];
      const patsCount = Array.isArray(patsArr) ? patsArr.length : (patsArr?.total||0);
      const activePats= Array.isArray(patsArr) ? patsArr.filter(p=>p.status==='active').length : 0;
      const newPats   = Array.isArray(patsArr) ? patsArr.filter(p => {
        const c = p.created_at||p.createdAt; if(!c) return false;
        const d = new Date(c); return d.getFullYear()===y && (d.getMonth()+1)===m;
      }).length : 0;

      const completedToday  = todayApts.filter(a=>a.status==='completed').length;
      const completedMonth  = allMonth.filter(a=>a.status==='completed').length;
      const completedPrevM  = allPrevM.filter(a=>a.status==='completed').length;
      const pendingPayment  = allMonth.filter(a=>a.status==='scheduled'||a.status==='confirmed').length;
      const sumObj          = summary.status==='fulfilled' ? summary.value : null;
      const prevSumObj      = prevSummary.status==='fulfilled' ? prevSummary.value : null;
      const income          = sumObj?.income||0;
      const prevIncome      = prevSumObj?.income||0;
      const expenses        = sumObj?.expenses||0;
      const recStats        = records.status==='fulfilled' ? records.value : null;

      setData({
        patsCount, activePats, newPats,
        todayApts, upcomingApts: allUpcoming.slice(0,8),
        totalUpcoming: allUpcoming.length,
        monthApts: allMonth.length, completedMonth, completedPrevM,
        completedToday, pendingPayment,
        income, prevIncome, expenses,
        profit: income - expenses,
        sumObj, recStats,
      });

      // ─── Agendar Notificações (60min antes) - Rodando em background para não travar a tela ───
      // DESATIVADO: Temporariamente desativado porque a biblioteca falha/trava completamente 
      // no Expo Go no Android (precisa de um Development Build com client próprio).
      /*
      (async () => {
        try {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status === 'granted') {
            await Notifications.cancelAllScheduledNotificationsAsync();
            for (const apt of [...todayApts, ...allUpcoming]) {
              if (apt.status === 'cancelled' || apt.status === 'completed') continue;
              const startStr = apt.start_time || apt.start;
              if (!startStr) continue;
              
              const aptTime = new Date(startStr).getTime();
              const triggerTime = aptTime - (60 * 60 * 1000); // 1 hora antes
              
              if (triggerTime > Date.now()) {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: 'Sessão em Breve ⏰',
                    body: `Você tem sessão com ${(apt.patient_name||apt.title||'Paciente').split(' ')[0]} em 1 hora, às ${fmtTime(startStr)}.`,
                    sound: true,
                  },
                  trigger: { date: new Date(triggerTime) },
                });
              }
            }
          }
        } catch (notifyErr) {
          console.log('Erro silencioso ao agendar notificações:', notifyErr);
        }
      })();
      */

    } catch(e) { console.log(e); }
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#6366f1"/>
      <Text style={{color:'#64748b',marginTop:12,fontSize:13,fontWeight:'600'}}>Carregando…</Text>
    </View>
  );

  const hour      = new Date().getHours();
  const greeting  = hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
  const firstName = (user?.name||'Profissional').split(' ')[0];
  const now       = new Date();
  const dayName   = WDAY[now.getDay()];
  const dayNum    = now.getDate();
  const monthName = MONTHS[now.getMonth()];
  const nextApt   = data.todayApts.length>0 ? data.todayApts[0] : data.upcomingApts[0];

  const navTo   = (tab, nested=null) => nested ? navigation.navigate(tab,{screen:nested}) : navigation.navigate(tab);
  const navTool = (nested=null) => nested ? navigation.navigate('Ferramentas',{screen:nested}) : navigation.navigate('Ferramentas');

  const incomeGrowth = data.prevIncome>0 ? Math.round(((data.income-data.prevIncome)/data.prevIncome)*100) : null;
  const sessionGrowth= data.completedPrevM>0 ? Math.round(((data.completedMonth-data.completedPrevM)/data.completedPrevM)*100) : null;

  return (
    <ScrollView style={s.root} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor="#6366f1"/>}>

      {/* ══ HERO ══ */}
      <View style={s.hero}>
        <View style={s.heroDeco1}/><View style={s.heroDeco2}/><View style={s.heroDeco3}/>

        <View style={s.heroTop}>
          <View>
            <Text style={s.heroGreet}>{greeting},</Text>
            <Text style={s.heroName}>{firstName}</Text>
          </View>
          <View style={s.heroDayBox}>
            <Text style={s.heroDayNum}>{dayNum}</Text>
            <Text style={s.heroDayMonth}>{MON_S[now.getMonth()].toUpperCase()}</Text>
            <Text style={s.heroDayName}>{dayName.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={s.heroSub}>{monthName} · {now.getFullYear()}</Text>

        {/* Métricas hero */}
        <View style={s.heroMetrics}>
          <MetricChip label="Hoje" value={data.todayApts.length} sub={`${data.completedToday} realizados`} color="#3b82f6"/>
          <View style={s.heroMetricDiv}/>
          <MetricChip label="No mês" value={data.monthApts} sub={`${data.completedMonth} realizados`} color="#10b981"/>
          <View style={s.heroMetricDiv}/>
          <MetricChip label="Próximos" value={data.totalUpcoming} sub="agendados" color="#a78bfa"/>
          <View style={s.heroMetricDiv}/>
          <MetricChip label="Pacientes" value={data.patsCount} sub={`${data.activePats} ativos`} color="#f59e0b"/>
        </View>

        {/* Botões */}
        <View style={s.heroBtns}>
          <TouchableOpacity style={s.heroBtnOutline} onPress={()=>navTo('Agenda')} activeOpacity={0.8}>
            <Text style={s.heroBtnOutlineTxt}>Ver Agenda</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.heroBtnFill} onPress={()=>navTo('Pacientes')} activeOpacity={0.8}>
            <Text style={s.heroBtnFillTxt}>+ Novo Paciente</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ HOJE ══ */}
      {data.todayApts.length > 0 && (
        <View style={s.section}>
          <SectionTitle
            dot="#3b82f6"
            title={`Agenda de hoje · ${data.todayApts.length} sessão${data.todayApts.length!==1?'ões':''}`}
            badge={`${data.completedToday}/${data.todayApts.length} realizadas`}
            badgeColor="#10b981"
            onPress={()=>navTo('Agenda')}
          />
          {/* Barra de progresso do dia */}
          {data.todayApts.length > 0 && (
            <View style={s.progressWrap}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, {width:`${Math.round((data.completedToday/data.todayApts.length)*100)}%`}]}/>
              </View>
              <Text style={s.progressPct}>{fmtPct(data.completedToday, data.todayApts.length)}</Text>
            </View>
          )}
          <View style={s.aptList}>
            {data.todayApts.map((apt, idx) => (
              <AptRow key={apt.id||idx} apt={apt} isToday idx={idx} total={data.todayApts.length}/>
            ))}
          </View>
        </View>
      )}

      {/* ══ PRÓXIMO ATENDIMENTO ══ */}
      {nextApt && (
        <View style={s.section}>
          <SectionTitle dot="#10b981" title="Próximo atendimento" onPress={()=>navTo('Agenda')}/>
          <NextCard apt={nextApt} isToday={data.todayApts.length>0}/>
        </View>
      )}

      {/* ══ STATS CARDS ══ */}
      <View style={s.section}>
        <SectionTitle dot="#6366f1" title="Resumo do período"/>
        <View style={s.statsGrid}>
          <StatCard
            label="Sessões realizadas"
            value={data.completedMonth}
            sub={`Meta: ${data.monthApts} agendadas`}
            pct={data.monthApts>0 ? Math.round((data.completedMonth/data.monthApts)*100) : 0}
            pctColor="#6366f1"
            trend={sessionGrowth}
          />
          <StatCard
            label="Receita do mês"
            value={fmtMoney(data.income)}
            sub={`Despesas: ${fmtMoney(data.expenses)}`}
            pct={data.income>0 ? Math.round(((data.income-data.expenses)/data.income)*100) : 0}
            pctColor="#10b981"
            trend={incomeGrowth}
            isMoney
          />
          <StatCard
            label="Pacientes novos"
            value={data.newPats}
            sub={`${data.activePats} ativos no total`}
            pct={data.patsCount>0 ? Math.round((data.activePats/data.patsCount)*100) : 0}
            pctColor="#f59e0b"
            trend={null}
          />
          <StatCard
            label="Pendente pagto."
            value={data.pendingPayment}
            sub="sessões sem comanda"
            pct={data.monthApts>0 ? Math.round(((data.monthApts-data.pendingPayment)/data.monthApts)*100) : 100}
            pctColor={data.pendingPayment>0 ? '#ef4444' : '#10b981'}
            trend={null}
            alert={data.pendingPayment>0}
          />
        </View>
      </View>

      {/* ══ FINANCEIRO ══ */}
      {data.sumObj && (
        <View style={s.section}>
          <SectionTitle dot="#10b981" title={`Financeiro · ${MON_S[now.getMonth()]}/${now.getFullYear()}`} action="Detalhes" onPress={()=>navTool('Financeiro')}/>
          <View style={s.finBigCard}>
            <View style={s.finBigRow}>
              <View style={s.finBigItem}>
                <View style={[s.finBigDot,{backgroundColor:'#10b981'}]}/>
                <Text style={s.finBigLbl}>Receita</Text>
                <Text style={[s.finBigVal,{color:'#10b981'}]}>{fmtMoney(data.income)}</Text>
                {incomeGrowth!==null && (
                  <TrendBadge value={incomeGrowth}/>
                )}
              </View>
              <View style={s.finBigItem}>
                <View style={[s.finBigDot,{backgroundColor:'#ef4444'}]}/>
                <Text style={s.finBigLbl}>Despesas</Text>
                <Text style={[s.finBigVal,{color:'#ef4444'}]}>{fmtMoney(data.expenses)}</Text>
              </View>
              <View style={s.finBigItem}>
                <View style={[s.finBigDot,{backgroundColor:'#6366f1'}]}/>
                <Text style={s.finBigLbl}>Lucro líquido</Text>
                <Text style={[s.finBigVal,{color:'#6366f1'}]}>{fmtMoney(data.profit)}</Text>
              </View>
            </View>
            {/* Barra receita vs despesa */}
            {data.income > 0 && (
              <View style={s.finBarWrap}>
                <View style={s.finBarTrack}>
                  <View style={[s.finBarIncome,{flex: data.income}]}/>
                  <View style={[s.finBarExpense,{flex: Math.min(data.expenses, data.income)}]}/>
                </View>
                <Text style={s.finBarLbl}>Margem: {data.income>0?Math.round(((data.income-data.expenses)/data.income)*100):0}%</Text>
              </View>
            )}
          </View>
          {data.pendingPayment > 0 && (
            <View style={s.alertBanner}>
              <Text style={s.alertIcon}>⚠</Text>
              <Text style={s.alertTxt}>{data.pendingPayment} sessão{data.pendingPayment!==1?'ões':''} sem pagamento registrado este mês</Text>
            </View>
          )}
        </View>
      )}

      {/* ══ PRONTUÁRIOS ══ */}
      {data.recStats && (
        <View style={s.section}>
          <SectionTitle dot="#8b5cf6" title="Prontuários" action="Ver todos" onPress={()=>navTo('Prontuarios')}/>
          <View style={s.recRow}>
            {[
              {label:'Total',    value: data.recStats.total||0,    color:'#6366f1'},
              {label:'Rascunhos',value: data.recStats.drafts||0,   color:'#f59e0b'},
              {label:'Aprovados',value: data.recStats.approved||0, color:'#10b981'},
              {label:'Este mês', value: data.recStats.thisMonth||0,color:'#3b82f6'},
            ].map(r=>(
              <View key={r.label} style={[s.recCard,{borderTopColor:r.color}]}>
                <Text style={[s.recVal,{color:r.color}]}>{r.value}</Text>
                <Text style={s.recLbl}>{r.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ══ PRÓXIMOS ATENDIMENTOS ══ */}
      <View style={s.section}>
        <SectionTitle dot="#f59e0b" title="Próximos atendimentos"
          badge={data.totalUpcoming>0?`${data.totalUpcoming} agendados`:null}
          badgeColor="#f59e0b"
          action={data.totalUpcoming>8?`+${data.totalUpcoming-8} mais`:''}
          onPress={()=>navTo('Agenda')}/>

        {data.upcomingApts.length > 0 ? (
          <View style={s.aptList}>
            {data.upcomingApts.map((apt, idx) => (
              <AptRow key={apt.id||idx} apt={apt} idx={idx} total={data.upcomingApts.length}/>
            ))}
            {data.totalUpcoming>8&&(
              <TouchableOpacity style={s.showMoreBtn} onPress={()=>navTo('Agenda')}>
                <Text style={s.showMoreTxt}>Ver todos os {data.totalUpcoming} atendimentos →</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>📭</Text>
            <Text style={s.emptyTitle}>Agenda livre</Text>
            <Text style={s.emptyTxt}>Nenhum atendimento nos próximos 30 dias.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={()=>navTo('Agenda')}>
              <Text style={s.emptyBtnTxt}>Agendar sessão</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ══ ACESSO RÁPIDO ══ */}
      <View style={s.section}>
        <SectionTitle dot="#ec4899" title="Acesso rápido"/>
        <View style={s.quickGrid}>
          {[
            {label:'Pacientes',   tab:'Pacientes',   nested:null,          color:'#6366f1', bg:'#f5f3ff', icon:'👥'},
            {label:'Prontuários', tab:'Prontuarios', nested:null,          color:'#3b82f6', bg:'#eff6ff', icon:'📋'},
            {label:'Financeiro',  tab:'Ferramentas', nested:'Financeiro',  color:'#10b981', bg:'#f0fdf4', icon:'💰'},
            {label:'Documentos',  tab:'Ferramentas', nested:'Documentos',  color:'#ec4899', bg:'#fdf2f8', icon:'📁'},
            {label:'Mensagens',   tab:'Ferramentas', nested:'Mensagens',   color:'#14b8a6', bg:'#f0fdfa', icon:'💬'},
            {label:'Sala Virtual',tab:'Ferramentas', nested:'SalaVirtual', color:'#8b5cf6', bg:'#faf5ff', icon:'🎥'},
          ].map(item=>(
            <TouchableOpacity key={item.label} style={[s.qItem,{backgroundColor:item.bg}]}
              onPress={()=>navTo(item.tab, item.nested)} activeOpacity={0.75}>
              <View style={[s.qIconWrap,{backgroundColor:item.color+'22'}]}>
                <Text style={s.qIconTxt}>{item.icon}</Text>
              </View>
              <Text style={[s.qLabel,{color:item.color}]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{height:50}}/>
    </ScrollView>
  );
}

/* ─── MetricChip ─── */
function MetricChip({ label, value, sub, color }) {
  return (
    <View style={mc.wrap}>
      <Text style={[mc.val,{color}]}>{value}</Text>
      <Text style={mc.label}>{label}</Text>
      {sub&&<Text style={mc.sub}>{sub}</Text>}
    </View>
  );
}
const mc = StyleSheet.create({
  wrap:  {flex:1, alignItems:'center', gap:2, paddingVertical:4},
  val:   {fontSize:22, fontWeight:'900', lineHeight:26},
  label: {fontSize:9,  fontWeight:'800', color:'#93c5fd', textTransform:'uppercase', letterSpacing:0.5},
  sub:   {fontSize:9,  fontWeight:'500', color:'rgba(255,255,255,0.45)', textAlign:'center'},
});

/* ─── SectionTitle ─── */
function SectionTitle({dot, title, badge, badgeColor, action, onPress}) {
  return (
    <View style={st.row}>
      <View style={st.left}>
        <View style={[st.dot,{backgroundColor:dot}]}/>
        <Text style={st.title}>{title}</Text>
        {badge&&<View style={[st.badge,{backgroundColor:badgeColor+'22'}]}>
          <Text style={[st.badgeTxt,{color:badgeColor}]}>{badge}</Text>
        </View>}
      </View>
      {action&&onPress&&(
        <TouchableOpacity onPress={onPress} style={st.pill}>
          <Text style={st.pillTxt}>{action} →</Text>
        </TouchableOpacity>
      )}
      {!action&&onPress&&(
        <TouchableOpacity onPress={onPress} style={st.pill}>
          <Text style={st.pillTxt}>Ver tudo →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const st = StyleSheet.create({
  row:     {flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12},
  left:    {flexDirection:'row', alignItems:'center', gap:8, flex:1},
  dot:     {width:8, height:8, borderRadius:4},
  title:   {fontSize:15, fontWeight:'900', color:'#0f172a'},
  badge:   {paddingHorizontal:8, paddingVertical:3, borderRadius:10},
  badgeTxt:{fontSize:10, fontWeight:'800'},
  pill:    {backgroundColor:'#f1f5f9', paddingHorizontal:12, paddingVertical:5, borderRadius:20},
  pillTxt: {fontSize:11, fontWeight:'700', color:'#6366f1'},
});

/* ─── TrendBadge ─── */
function TrendBadge({ value }) {
  const up = value >= 0;
  return (
    <View style={[tb.wrap,{backgroundColor: up?'#f0fdf4':'#fef2f2'}]}>
      <Text style={[tb.txt,{color: up?'#10b981':'#ef4444'}]}>{up?'↑':'↓'} {Math.abs(value)}%</Text>
    </View>
  );
}
const tb = StyleSheet.create({
  wrap: {paddingHorizontal:7, paddingVertical:3, borderRadius:8, marginTop:3},
  txt:  {fontSize:10, fontWeight:'800'},
});

/* ─── StatCard ─── */
function StatCard({ label, value, sub, pct, pctColor, trend, alert, isMoney }) {
  return (
    <View style={[sc.card, alert&&sc.cardAlert]}>
      <Text style={sc.label}>{label}</Text>
      <Text style={[sc.value, isMoney&&{fontSize:15}]}>{value}</Text>
      {trend!==null&&trend!==undefined&&<TrendBadge value={trend}/>}
      <View style={sc.track}>
        <View style={[sc.fill, {width:`${Math.min(pct,100)}%`, backgroundColor:pctColor}]}/>
      </View>
      <Text style={sc.sub}>{sub}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card:      {width:(SW-42)/2, backgroundColor:'#fff', borderRadius:16, padding:14, gap:3, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:10, elevation:3},
  cardAlert: {borderWidth:1, borderColor:'#fecaca'},
  label:     {fontSize:10, fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.4},
  value:     {fontSize:22, fontWeight:'900', color:'#0f172a', lineHeight:28},
  track:     {height:4, backgroundColor:'#f1f5f9', borderRadius:2, marginTop:4, overflow:'hidden'},
  fill:      {height:4, borderRadius:2},
  sub:       {fontSize:10, color:'#94a3b8', fontWeight:'500', marginTop:2},
});

/* ─── NextCard ─── */
function NextCard({ apt, isToday }) {
  const startRaw  = apt.start_time||apt.start;
  const startDate = startRaw ? new Date(startRaw) : null;
  const valid     = startDate && !isNaN(startDate);
  const color     = STATUS_COLOR[apt.status]||'#94a3b8';

  return (
    <View style={nc.card}>
      <View style={[nc.accent,{backgroundColor:color}]}/>
      <View style={nc.body}>
        <View style={nc.row}>
          <Text style={nc.name} numberOfLines={1}>{apt.patient_name||apt.title||'Paciente'}</Text>
          <View style={[nc.statusPill,{backgroundColor:color+'22'}]}>
            <View style={[nc.statusDot,{backgroundColor:color}]}/>
            <Text style={[nc.statusTxt,{color}]}>{STATUS_LABEL[apt.status]||apt.status}</Text>
          </View>
        </View>
        {apt.service_name&&<Text style={nc.service}>{apt.service_name}</Text>}
        <View style={nc.metaRow}>
          {isToday ? (
            <View style={nc.timePill}>
              <Text style={nc.timeLbl}>HOJE · {fmtTime(startRaw)}</Text>
            </View>
          ) : valid ? (
            <View style={nc.timePill}>
              <Text style={nc.timeLbl}>{WDAY[startDate.getDay()]}, {String(startDate.getDate()).padStart(2,'0')} {MON_S[startDate.getMonth()]} · {fmtTime(startRaw)}</Text>
            </View>
          ) : null}
          {apt.modality&&(
            <Text style={nc.modality}>{apt.modality==='online'?'Online':'Presencial'}</Text>
          )}
        </View>
      </View>
    </View>
  );
}
const nc = StyleSheet.create({
  card:      {flexDirection:'row', backgroundColor:'#fff', borderRadius:16, overflow:'hidden', shadowColor:'#6366f1', shadowOffset:{width:0,height:4}, shadowOpacity:0.1, shadowRadius:12, elevation:4},
  accent:    {width:5},
  body:      {flex:1, padding:16, gap:6},
  row:       {flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:8},
  name:      {fontSize:18, fontWeight:'900', color:'#0f172a', flex:1},
  service:   {fontSize:12, color:'#64748b', fontWeight:'600'},
  metaRow:   {flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap'},
  statusPill:{flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:9, paddingVertical:4, borderRadius:20},
  statusDot: {width:6, height:6, borderRadius:3},
  statusTxt: {fontSize:11, fontWeight:'800'},
  timePill:  {backgroundColor:'#f0f4ff', paddingHorizontal:10, paddingVertical:5, borderRadius:10},
  timeLbl:   {fontSize:11, fontWeight:'800', color:'#6366f1'},
  modality:  {fontSize:11, color:'#94a3b8', fontWeight:'600'},
});

/* ─── AptRow ─── */
function AptRow({ apt, isToday, idx, total }) {
  const startRaw  = apt.start_time||apt.start;
  const startDate = startRaw ? new Date(startRaw) : null;
  const valid     = startDate && !isNaN(startDate);
  const color     = STATUS_COLOR[apt.status]||'#94a3b8';
  const isLast    = idx === total-1;
  const completed = apt.status==='completed';

  return (
    <View style={[ar.row, !isLast&&ar.rowBorder, completed&&ar.rowCompleted]}>
      <View style={ar.timeCol}>
        {isToday ? (
          <Text style={ar.time}>{fmtTime(startRaw)}</Text>
        ) : valid ? (
          <>
            <Text style={ar.day}>{String(startDate.getDate()).padStart(2,'0')}</Text>
            <Text style={ar.mon}>{MON_S[startDate.getMonth()]}</Text>
            <Text style={ar.time}>{fmtTime(startRaw)}</Text>
          </>
        ) : <Text style={ar.time}>—</Text>}
      </View>
      <View style={[ar.bar,{backgroundColor:color}]}/>
      <View style={ar.info}>
        <Text style={[ar.name, completed&&{color:'#94a3b8'}]} numberOfLines={1}>
          {apt.patient_name||apt.title||'Paciente'}
        </Text>
        <View style={ar.tags}>
          {apt.service_name&&<Text style={ar.tag}>{apt.service_name}</Text>}
          {apt.modality&&<Text style={ar.tag}>{apt.modality==='online'?'Online':'Presencial'}</Text>}
        </View>
      </View>
      <View style={[ar.badge,{backgroundColor:color+'18'}]}>
        <Text style={[ar.badgeTxt,{color}]}>{STATUS_LABEL[apt.status]||apt.status}</Text>
      </View>
    </View>
  );
}
const ar = StyleSheet.create({
  row:          {flexDirection:'row', alignItems:'center', paddingVertical:12, gap:10},
  rowBorder:    {borderBottomWidth:1, borderBottomColor:'#f8fafc'},
  rowCompleted: {opacity:0.65},
  timeCol:      {width:42, alignItems:'center'},
  time:         {fontSize:11, fontWeight:'800', color:'#6366f1', marginTop:1},
  day:          {fontSize:16, fontWeight:'900', color:'#0f172a', lineHeight:20},
  mon:          {fontSize:9,  fontWeight:'700', color:'#64748b', textTransform:'uppercase'},
  bar:          {width:3, height:38, borderRadius:2},
  info:         {flex:1, gap:3},
  name:         {fontSize:14, fontWeight:'800', color:'#0f172a'},
  tags:         {flexDirection:'row', gap:6, flexWrap:'wrap'},
  tag:          {fontSize:10, color:'#94a3b8', fontWeight:'600'},
  badge:        {paddingHorizontal:8, paddingVertical:4, borderRadius:8},
  badgeTxt:     {fontSize:9, fontWeight:'800', textTransform:'uppercase'},
});

/* ─── Styles ─── */
const s = StyleSheet.create({
  root:   {flex:1, backgroundColor:'#f1f5f9'},
  center: {flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#f1f5f9'},

  /* Hero */
  hero:         {backgroundColor:'#0f2744', paddingHorizontal:20, paddingTop:20, paddingBottom:26, overflow:'hidden'},
  heroDeco1:    {position:'absolute', width:300, height:300, borderRadius:150, backgroundColor:'rgba(99,102,241,0.15)',  top:-140, right:-80},
  heroDeco2:    {position:'absolute', width:180, height:180, borderRadius:90,  backgroundColor:'rgba(59,130,246,0.1)', bottom:-80, left:-40},
  heroDeco3:    {position:'absolute', width:100, height:100, borderRadius:50,  backgroundColor:'rgba(16,185,129,0.08)',  top:20, left:SW/2 - 20},
  heroTop:      {flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6},
  heroGreet:    {fontSize:14, fontWeight:'600', color:'#93c5fd', marginBottom:2, letterSpacing:0.3},
  heroName:     {fontSize:30, fontWeight:'900', color:'#fff', letterSpacing:-0.5},
  heroSub:      {fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:20, fontWeight:'600', textTransform:'uppercase', letterSpacing:0.5},
  heroDayBox:   {alignItems:'center', backgroundColor:'rgba(255,255,255,0.08)', borderRadius:12, paddingHorizontal:14, paddingVertical:8, borderWidth:1, borderColor:'rgba(255,255,255,0.12)', shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.2, shadowRadius:8, elevation:5},
  heroDayNum:   {fontSize:26, fontWeight:'900', color:'#fff', lineHeight:30},
  heroDayMonth: {fontSize:10, fontWeight:'800', color:'#93c5fd', letterSpacing:0.8},
  heroDayName:  {fontSize:9,  fontWeight:'800', color:'rgba(255,255,255,0.5)', letterSpacing:0.5},

  heroMetrics:  {flexDirection:'row', backgroundColor:'rgba(255,255,255,0.07)', borderRadius:16, paddingVertical:14, marginBottom:20, borderWidth:1, borderColor:'rgba(255,255,255,0.08)'},
  heroMetricDiv:{width:1, backgroundColor:'rgba(255,255,255,0.1)', marginVertical:6},

  heroBtns:         {flexDirection:'row', gap:10},
  heroBtnOutline:   {flex:1, borderWidth:1.5, borderColor:'rgba(255,255,255,0.22)', borderRadius:12, paddingVertical:13, alignItems:'center'},
  heroBtnOutlineTxt:{color:'#fff', fontWeight:'700', fontSize:13},
  heroBtnFill:      {flex:1, backgroundColor:'#6366f1', borderRadius:12, paddingVertical:13, alignItems:'center', shadowColor:'#6366f1', shadowOffset:{width:0,height:4}, shadowOpacity:0.45, shadowRadius:8, elevation:6},
  heroBtnFillTxt:   {color:'#fff', fontWeight:'800', fontSize:13},

  /* Section */
  section: {marginHorizontal:16, marginTop:22},

  /* Progress */
  progressWrap:  {flexDirection:'row', alignItems:'center', gap:10, marginBottom:10},
  progressTrack: {flex:1, height:5, backgroundColor:'#e2e8f0', borderRadius:3, overflow:'hidden'},
  progressFill:  {height:5, backgroundColor:'#10b981', borderRadius:3},
  progressPct:   {fontSize:11, fontWeight:'800', color:'#10b981', width:34},

  /* Apt list */
  aptList:   {backgroundColor:'#fff', borderRadius:16, paddingHorizontal:14, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.05, shadowRadius:10, elevation:3},
  showMoreBtn:{paddingVertical:14, alignItems:'center', borderTopWidth:1, borderTopColor:'#f1f5f9'},
  showMoreTxt:{fontSize:13, fontWeight:'800', color:'#6366f1'},

  /* Stats grid */
  statsGrid: {flexDirection:'row', flexWrap:'wrap', gap:10},

  /* Financeiro */
  finBigCard:  {backgroundColor:'#fff', borderRadius:16, padding:18, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.05, shadowRadius:10, elevation:3},
  finBigRow:   {flexDirection:'row', gap:4},
  finBigItem:  {flex:1, alignItems:'center', gap:3, paddingVertical:4},
  finBigDot:   {width:28, height:4, borderRadius:2, marginBottom:4},
  finBigLbl:   {fontSize:9, fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.4, textAlign:'center'},
  finBigVal:   {fontSize:14, fontWeight:'900', textAlign:'center'},
  finBarWrap:  {marginTop:16, gap:6},
  finBarTrack: {height:8, flexDirection:'row', borderRadius:4, overflow:'hidden', backgroundColor:'#f1f5f9'},
  finBarIncome:{backgroundColor:'#10b981', borderRadius:4},
  finBarExpense:{backgroundColor:'#ef4444', borderRadius:4},
  finBarLbl:   {fontSize:10, fontWeight:'700', color:'#64748b', textAlign:'right'},

  /* Alert */
  alertBanner:{flexDirection:'row', alignItems:'center', gap:8, marginTop:10, backgroundColor:'#fffbeb', borderRadius:12, paddingHorizontal:14, paddingVertical:10, borderWidth:1, borderColor:'#fde68a'},
  alertIcon:  {fontSize:14},
  alertTxt:   {flex:1, fontSize:12, fontWeight:'700', color:'#92400e'},

  /* Records */
  recRow:  {flexDirection:'row', gap:8},
  recCard: {flex:1, backgroundColor:'#fff', borderRadius:14, padding:12, borderTopWidth:3, alignItems:'center', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.04, shadowRadius:6, elevation:2},
  recVal:  {fontSize:22, fontWeight:'900'},
  recLbl:  {fontSize:9, fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.4, textAlign:'center'},

  /* Empty */
  emptyCard:  {backgroundColor:'#fff', borderRadius:18, padding:32, alignItems:'center', gap:6, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.04, shadowRadius:8, elevation:2},
  emptyIcon:  {fontSize:40},
  emptyTitle: {fontSize:16, fontWeight:'900', color:'#1e293b'},
  emptyTxt:   {fontSize:13, color:'#94a3b8', textAlign:'center'},
  emptyBtn:   {marginTop:14, backgroundColor:'#6366f1', paddingHorizontal:26, paddingVertical:12, borderRadius:12},
  emptyBtnTxt:{color:'#fff', fontWeight:'800', fontSize:13},

  /* Quick */
  quickGrid: {flexDirection:'row', flexWrap:'wrap', gap:10},
  qItem:     {width:(SW-54)/3, borderRadius:18, paddingVertical:18, alignItems:'center', gap:8, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.04, shadowRadius:4, elevation:2},
  qIconWrap: {width:48, height:48, borderRadius:14, alignItems:'center', justifyContent:'center'},
  qIconTxt:  {fontSize:24},
  qLabel:    {fontSize:11, fontWeight:'800', textAlign:'center'},
});
