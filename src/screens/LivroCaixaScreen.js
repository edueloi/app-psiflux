import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { api } from '../services/api';

const fmtMoney = (v) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate  = (d) => { if(!d) return '—'; const dt=new Date(d); return isNaN(dt.getTime())?'—':dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}); };

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function LivroCaixaScreen() {
  const now  = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());
  const [transactions, setTransactions] = useState([]);
  const [summary,      setSummary]      = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [tab, setTab] = useState('all'); // 'all' | 'income' | 'expense'

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
        contentContainerStyle={{padding:14, paddingBottom:40}}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{fontSize:44,marginBottom:10}}>📒</Text>
            <Text style={s.emptyText}>Nenhuma transação neste mês</Text>
          </View>
        }
        renderItem={({item:t})=>{
          const isIncome = t.type==='income'||t.type==='receita';
          const amount   = Number(t.amount||t.value||0);
          return (
            <View style={s.txCard}>
              <View style={[s.txType,{backgroundColor:isIncome?'#dcfce7':'#fee2e2'}]}>
                <Text style={{fontSize:14}}>{isIncome?'↑':'↓'}</Text>
              </View>
              <View style={s.txInfo}>
                <Text style={s.txDesc} numberOfLines={1}>{t.description||t.category||'Sem descrição'}</Text>
                <Text style={s.txMeta}>
                  {fmtDate(t.date||t.created_at)}
                  {t.patient_name?` · ${t.patient_name}`:''}
                  {t.payment_method?` · ${t.payment_method}`:''}
                </Text>
                {t.category&&<View style={s.catBadge}><Text style={s.catText}>{t.category}</Text></View>}
              </View>
              <Text style={[s.txAmount,{color:isIncome?'#10b981':'#ef4444'}]}>
                {isIncome?'+':'-'}{fmtMoney(amount)}
              </Text>
            </View>
          );
        }}
      />
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
});
