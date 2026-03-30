import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_W * 0.84, 320);

const BRAND   = '#0f2744';
const ACCENT  = '#6366f1';

const MENU = [
  {
    section: 'PRINCIPAL',
    color: '#6366f1',
    items: [
      { label: 'Início',      emoji: '🏠', tab: 'Dashboard',    nested: null,           color: '#6366f1' },
      { label: 'Pacientes',   emoji: '👥', tab: 'Pacientes',    nested: null,           color: '#3b82f6' },
      { label: 'Prontuários', emoji: '📋', tab: 'Prontuarios',  nested: null,           color: '#8b5cf6' },
      { label: 'Agenda',      emoji: '📅', tab: 'Agenda',       nested: null,           color: '#10b981' },
    ],
  },
  {
    section: 'DOCUMENTOS',
    color: '#ec4899',
    items: [
      { label: 'Documentos',      emoji: '📁', tab: 'Ferramentas', nested: 'Documentos',  color: '#ec4899' },
      { label: 'Encaminhamentos', emoji: '📤', soon: true,                                 color: '#f43f5e' },
      { label: 'Termos',          emoji: '📜', soon: true,                                 color: '#f43f5e' },
    ],
  },
  {
    section: 'GESTÃO',
    color: '#14b8a6',
    items: [
      { label: 'Sala Virtual',     emoji: '🎥', tab: 'Ferramentas', nested: 'SalaVirtual',  color: '#8b5cf6' },
      { label: 'Mensagens',        emoji: '💬', tab: 'Ferramentas', nested: 'Mensagens',    color: '#14b8a6' },
      { label: 'Profissionais',    emoji: '👤', soon: true,                                  color: '#64748b' },
      { label: 'Serviços/Pacotes', emoji: '🛍️', soon: true,                                  color: '#64748b' },
      { label: 'Produtos',         emoji: '📦', soon: true,                                  color: '#64748b' },
      { label: 'Comandas',         emoji: '🧾', soon: true,                                  color: '#64748b' },
    ],
  },
  {
    section: 'FINANCEIRO',
    color: '#10b981',
    items: [
      { label: 'Livro Caixa',       emoji: '📒', tab: 'Ferramentas', nested: 'LivroCaixa', color: '#3b82f6' },
      { label: 'Financeiro',        emoji: '💰', tab: 'Ferramentas', nested: 'Financeiro', color: '#10b981' },
      { label: 'Melhores Clientes', emoji: '🏆', soon: true,                                color: '#64748b' },
      { label: 'Performance',       emoji: '📊', soon: true,                                color: '#64748b' },
    ],
  },
  {
    section: 'SISTEMA',
    color: '#f59e0b',
    items: [
      { label: 'Meu Perfil',    emoji: '👤', tab: 'Ferramentas', nested: 'Perfil',   color: '#f59e0b' },
      { label: 'Configurações', emoji: '⚙️', soon: true,                              color: '#64748b' },
      { label: 'WhatsApp',      emoji: '💬', soon: true,                              color: '#64748b' },
    ],
  },
];

export default function DrawerMenu({ visible, onClose, onNavigate, onLogout, user }) {
  const slideX   = useRef(new Animated.Value(-DRAWER_W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets   = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideX,   { toValue: 0,         useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(fadeAnim, { toValue: 1,         duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX,   { toValue: -DRAWER_W, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0,         duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const initials = (name = '') =>
    name.split(' ').slice(0,2).map(n => n[0]||'').join('').toUpperCase() || '?';

  const handleItem = (item) => {
    if (item.soon) return;
    onClose();
    onNavigate(item.tab, item.nested || null);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={d.root}>

        {/* Backdrop */}
        <Animated.View style={[d.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={{ flex:1 }} activeOpacity={1} onPress={onClose}/>
        </Animated.View>

        {/* Painel lateral */}
        <Animated.View style={[d.panel, { transform:[{ translateX: slideX }] }]}>

          {/* ── Cabeçalho do usuário ── */}
          <View style={[d.header, { paddingTop: insets.top + 16 }]}>
            <View style={d.headerDecor}/>
            <View style={d.headerDecor2}/>

            {/* Avatar + info + fechar */}
            <View style={d.headerTop}>
              <View style={d.avatarWrap}>
                <View style={d.avatar}>
                  <Text style={d.avatarTxt}>{initials(user?.name)}</Text>
                </View>
                <View style={d.onlineDot}/>
              </View>
              <TouchableOpacity onPress={onClose} style={d.closeBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                <Text style={d.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Nome e info */}
            <Text style={d.userName} numberOfLines={1}>{user?.name || 'Usuário'}</Text>
            <Text style={d.userEmail} numberOfLines={1}>{user?.email || ''}</Text>
            <View style={d.rolePill}>
              <Text style={d.roleTxt}>{(user?.role || 'profissional').toUpperCase()}</Text>
            </View>

            {/* Branding */}
            <View style={d.brandRow}>
              <View style={d.brandDot}/>
              <Text style={d.brandTxt}>PsiFlux</Text>
            </View>
          </View>

          {/* ── Menu items ── */}
          <ScrollView style={d.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {MENU.map((sec) => (
              <View key={sec.section} style={d.section}>
                <View style={d.sectionHead}>
                  <View style={[d.sectionDot, { backgroundColor: sec.color }]}/>
                  <Text style={d.sectionTitle}>{sec.section}</Text>
                </View>

                {sec.items.map((item) => {
                  if (item.soon) {
                    return (
                      <View key={item.label} style={d.itemSoonRow}>
                        <View style={[d.itemIconBox, { backgroundColor: '#f1f5f9' }]}>
                          <Text style={d.itemEmoji}>{item.emoji}</Text>
                        </View>
                        <Text style={d.itemLabelSoon}>{item.label}</Text>
                        <View style={d.soonPill}>
                          <Text style={d.soonTxt}>Em breve</Text>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={d.item}
                      onPress={() => handleItem(item)}
                      activeOpacity={0.72}>
                      <View style={[d.itemIconBox, { backgroundColor: item.color + '18' }]}>
                        <Text style={d.itemEmoji}>{item.emoji}</Text>
                      </View>
                      <Text style={d.itemLabel}>{item.label}</Text>
                      <Text style={[d.itemArrow, { color: item.color }]}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <View style={{ height: 24 }}/>
          </ScrollView>

          {/* ── Logout ── */}
          <View style={[d.logoutArea, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={d.logoutBtn} onPress={() => { onClose(); onLogout(); }} activeOpacity={0.85}>
              <Text style={d.logoutIcon}>🚪</Text>
              <Text style={d.logoutTxt}>Encerrar sessão</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const d = StyleSheet.create({
  root:     { flex:1, flexDirection:'row' },
  backdrop: {
    position:'absolute', top:0, left:0, right:0, bottom:0,
    backgroundColor:'rgba(10,18,35,0.65)',
  },
  panel: {
    width: DRAWER_W, backgroundColor:'#fff', height:'100%', flex:1,
    shadowColor:'#000', shadowOffset:{ width:8, height:0 },
    shadowOpacity:0.3, shadowRadius:20, elevation:24,
  },

  /* Header */
  header: {
    backgroundColor: BRAND, paddingHorizontal:20, paddingBottom:20,
    overflow:'hidden',
  },
  headerDecor:  { position:'absolute', width:180, height:180, borderRadius:90,
                   backgroundColor:'rgba(99,102,241,0.18)', top:-70, right:-50 },
  headerDecor2: { position:'absolute', width:90,  height:90,  borderRadius:45,
                   backgroundColor:'rgba(16,185,129,0.12)', bottom:10, right:20 },

  headerTop:  { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 },
  avatarWrap: { position:'relative' },
  avatar:     {
    width:58, height:58, borderRadius:29, backgroundColor:'#1e4d80',
    alignItems:'center', justifyContent:'center',
    borderWidth:2.5, borderColor:'#3b82f6',
  },
  avatarTxt:  { color:'#fff', fontWeight:'900', fontSize:22 },
  onlineDot:  {
    position:'absolute', bottom:1, right:1,
    width:14, height:14, borderRadius:7,
    backgroundColor:'#10b981', borderWidth:2.5, borderColor:BRAND,
  },
  closeBtn:   {
    width:34, height:34, borderRadius:10,
    backgroundColor:'rgba(255,255,255,0.1)',
    alignItems:'center', justifyContent:'center',
  },
  closeTxt:   { color:'#93c5fd', fontSize:16, fontWeight:'700' },

  userName:   { fontSize:18, fontWeight:'900', color:'#fff', marginBottom:3 },
  userEmail:  { fontSize:12, color:'#93c5fd', marginBottom:8 },
  rolePill:   {
    alignSelf:'flex-start', backgroundColor:'rgba(255,255,255,0.12)',
    paddingHorizontal:10, paddingVertical:4, borderRadius:20,
    borderWidth:1, borderColor:'rgba(255,255,255,0.1)', marginBottom:14,
  },
  roleTxt:    { fontSize:9, fontWeight:'900', color:'#a5b4fc', letterSpacing:1 },

  brandRow:   { flexDirection:'row', alignItems:'center', gap:6 },
  brandDot:   { width:7, height:7, borderRadius:4, backgroundColor:ACCENT },
  brandTxt:   { fontSize:11, fontWeight:'900', color:'#6366f1', letterSpacing:0.5 },

  /* Scroll */
  scroll: { flex:1, backgroundColor:'#f8fafc' },

  /* Section */
  section:     { paddingTop:10, paddingBottom:2 },
  sectionHead: { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:16, paddingBottom:4 },
  sectionDot:  { width:6, height:6, borderRadius:3 },
  sectionTitle:{
    fontSize:9, fontWeight:'900', color:'#94a3b8',
    letterSpacing:1.2, textTransform:'uppercase',
  },

  /* Items */
  item:       {
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:14, paddingVertical:10, gap:12,
    marginHorizontal:10, borderRadius:12, marginBottom:2,
    backgroundColor:'#fff',
  },
  itemSoonRow:{
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:14, paddingVertical:9, gap:12,
    marginHorizontal:10, borderRadius:12, marginBottom:2,
    opacity:0.5,
  },
  itemIconBox:{ width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center' },
  itemEmoji:  { fontSize:17 },
  itemLabel:  { flex:1, fontSize:14, fontWeight:'700', color:'#1e293b' },
  itemLabelSoon:{ flex:1, fontSize:14, fontWeight:'600', color:'#94a3b8' },
  itemArrow:  { fontSize:22, fontWeight:'300' },
  soonPill:   {
    backgroundColor:'#fffbeb', paddingHorizontal:7, paddingVertical:2,
    borderRadius:8, borderWidth:1, borderColor:'#fde68a',
  },
  soonTxt:    { fontSize:9, fontWeight:'800', color:'#f59e0b' },

  /* Logout */
  logoutArea: { borderTopWidth:1, borderTopColor:'#f1f5f9', paddingHorizontal:14, paddingTop:12 },
  logoutBtn:  {
    flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10,
    backgroundColor:'#fef2f2', borderRadius:14, paddingVertical:14,
    borderWidth:1, borderColor:'#fecaca',
  },
  logoutIcon: { fontSize:18 },
  logoutTxt:  { fontSize:14, fontWeight:'800', color:'#ef4444' },
});
