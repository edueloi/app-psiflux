import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, Animated, Dimensions, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_W * 0.84, 340);

const BRAND = '#1E1B4B'; // Deep rich indigo/navy for header
const ACCENT = '#4F46E5'; // Primary bright indigo

const MENU = [
  {
    section: 'Módulos Principais',
    items: [
      { label: 'Início',          icon: 'grid-outline',       tab: 'Dashboard',    nested: null,           color: '#4F46E5' },
      { label: 'Pacientes',       icon: 'people-outline',     tab: 'Pacientes',    nested: null,           color: '#0EA5E9' },
      { label: 'Prontuários',     icon: 'folder-open-outline',tab: 'Prontuarios',  nested: null,           color: '#8B5CF6' },
      { label: 'Agenda Eletrônica',icon: 'calendar-outline',   tab: 'Agenda',       nested: null,           color: '#10B981' },
    ],
  },
  {
    section: 'Documentos e Arquivos',
    items: [
      { label: 'Meus Documentos', icon: 'document-text-outline', tab: 'Ferramentas', nested: 'Documentos',  color: '#EC4899' },
      { label: 'Encaminhamentos', icon: 'paper-plane-outline', soon: true,                                  color: '#F43F5E' },
      { label: 'Modelos de Termos',icon: 'shield-checkmark-outline', soon: true,                             color: '#F43F5E' },
    ],
  },
  {
    section: 'Gestão de Clínica',
    items: [
      { label: 'Sala Virtual',    icon: 'videocam-outline',    tab: 'Ferramentas', nested: 'SalaVirtual',  color: '#8B5CF6' },
      { label: 'Mensagens Auto.', icon: 'chatbubbles-outline', tab: 'Ferramentas', nested: 'Mensagens',    color: '#0D9488' },
      { label: 'Corpo Clínico',   icon: 'medkit-outline',      soon: true,                                  color: '#64748B' },
      { label: 'Serviços/Pacotes',icon: 'pricetags-outline',   soon: true,                                  color: '#64748B' },
      { label: 'Central de Comandas',icon:'receipt-outline',   soon: true,                                  color: '#64748B' },
    ],
  },
  {
    section: 'Controle Financeiro',
    items: [
      { label: 'Livro Caixa',     icon: 'book-outline',        tab: 'Ferramentas', nested: 'LivroCaixa', color: '#3B82F6' },
      { label: 'Visão Geral',     icon: 'pie-chart-outline',   tab: 'Ferramentas', nested: 'Financeiro', color: '#10B981' },
      { label: 'Performance',     icon: 'trending-up-outline', soon: true,                               color: '#64748B' },
    ],
  },
  {
    section: 'Configurações',
    items: [
      { label: 'Meu Perfil',      icon: 'person-circle-outline', tab: 'Ferramentas', nested: 'Perfil',   color: '#F59E0B' },
      { label: 'Ajustes',         icon: 'settings-outline',      soon: true,                              color: '#64748B' },
    ],
  },
];

export default function DrawerMenu({ visible, onClose, onNavigate, onLogout, user }) {
  const slideX = useRef(new Animated.Value(-DRAWER_W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideX, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 220 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX, { toValue: -DRAWER_W, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const initials = (name = '') => name.split(' ').slice(0, 2).map(n => n[0] || '').join('').toUpperCase() || '?';

  const handleItem = (item) => {
    if (item.soon) return;
    onClose();
    onNavigate(item.tab, item.nested || null);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.root}>

        {/* Backdrop Fade */}
        <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* Sliding Panel */}
        <Animated.View style={[s.panel, { transform: [{ translateX: slideX }] }]}>

          {/* Premium Header Profile */}
          <View style={[s.header, { paddingTop: insets.top + 20 }]}>
            <View style={s.headerDecor} />
            <View style={s.headerDecor2} />

            <View style={s.headerTopRow}>
              <View style={s.avatarContainer}>
                {user?.avatarUrl || user?.avatar_url ? (
                  <Image source={{ uri: `https://psiflux.com.br${user.avatarUrl || user.avatar_url}` }} style={s.avatarImage} />
                ) : (
                  <View style={s.avatarInitialsContainer}>
                    <Text style={s.avatarInitialsText}>{initials(user?.name)}</Text>
                  </View>
                )}
                <View style={s.onlineBadge} />
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeCircleBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color="#E0E7FF" />
              </TouchableOpacity>
            </View>

            <View style={s.userInfoWrapper}>
              <Text style={s.userNameText} numberOfLines={1}>{user?.name || 'Visitante'}</Text>
              <Text style={s.userEmailText} numberOfLines={1}>{user?.email || 'Sem e-mail cadastrado'}</Text>
              <View style={s.roleTag}>
                <Ionicons name="shield-checkmark" size={12} color="#818CF8" />
                <Text style={s.roleTagText}>{(user?.role || 'Profissional').toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* Navigation Menu */}
          <ScrollView style={s.scrollArea} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingTop: 10 }}>
            {MENU.map((sec) => (
              <View key={sec.section} style={s.sectionContainer}>
                <Text style={s.sectionHeading}>{sec.section}</Text>

                {sec.items.map((item) => {
                  if (item.soon) {
                    return (
                      <View key={item.label} style={[s.itemRow, s.itemSoonRow]}>
                        <View style={[s.iconBox, { backgroundColor: '#F1F5F9' }]}>
                          <Ionicons name={item.icon} size={20} color="#94A3B8" />
                        </View>
                        <Text style={s.itemTextSoon}>{item.label}</Text>
                        <View style={s.soonBadge}><Text style={s.soonBadgeText}>BREVE</Text></View>
                      </View>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={s.itemRow}
                      onPress={() => handleItem(item)}
                      activeOpacity={0.6}
                    >
                      <View style={[s.iconBox, { backgroundColor: item.color + '18' }]}>
                        <Ionicons name={item.icon} size={20} color={item.color} />
                      </View>
                      <Text style={s.itemText}>{item.label}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={s.itemChevron} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {/* Bottom Logout Area */}
          <View style={[s.footerArea, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity style={s.logoutBtn} onPress={() => { onClose(); onLogout(); }} activeOpacity={0.8}>
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
              <Text style={s.logoutBtnText}>Sair do Sistema</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  backdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)' },
  panel: {
    width: DRAWER_W, backgroundColor: '#F8FAFC', height: '100%', flex: 1,
    shadowColor: '#000', shadowOffset: { width: 10, height: 0 }, shadowOpacity: 0.25, shadowRadius: 30, elevation: 24,
  },

  /* PREMIUM HEADER */
  header: { backgroundColor: BRAND, paddingHorizontal: 24, paddingBottom: 24, overflow: 'hidden' },
  headerDecor: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(79, 70, 229, 0.2)', top: -100, right: -80 },
  headerDecor2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(56, 189, 248, 0.1)', bottom: 20, left: -20 },
  
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  avatarContainer: { position: 'relative' },
  avatarImage: { width: 64, height: 64, borderRadius: 20, borderWidth: 3, borderColor: '#4F46E5', backgroundColor: '#312E81' },
  avatarInitialsContainer: { width: 64, height: 64, borderRadius: 20, borderWidth: 3, borderColor: '#4F46E5', backgroundColor: '#312E81', alignItems: 'center', justifyContent: 'center' },
  avatarInitialsText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  onlineBadge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#10B981', borderWidth: 3, borderColor: BRAND },
  
  closeCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  
  userInfoWrapper: { zIndex: 10 },
  userNameText: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 2, letterSpacing: -0.5 },
  userEmailText: { fontSize: 13, color: '#A5B4FC', marginBottom: 12 },
  roleTag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(129, 140, 248, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.3)', gap: 6 },
  roleTagText: { fontSize: 9, fontWeight: '900', color: '#A5B4FC', letterSpacing: 0.8 },

  /* NAVIGATION LIST */
  scrollArea: { flex: 1, backgroundColor: '#F8FAFC' },
  
  sectionContainer: { marginBottom: 8 },
  sectionHeading: { fontSize: 11, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginHorizontal: 24, marginTop: 16, marginBottom: 8 },
  
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, marginHorizontal: 12, borderRadius: 16, marginBottom: 4, backgroundColor: 'transparent' },
  itemSoonRow: { opacity: 0.6 },
  
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  itemText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1E293B' },
  itemTextSoon: { flex: 1, fontSize: 15, fontWeight: '600', color: '#94A3B8' },
  itemChevron: { opacity: 0.5 },
  
  soonBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  soonBadgeText: { fontSize: 9, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5 },

  /* LOGOUT FOOTER */
  footerArea: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingHorizontal: 20, paddingTop: 16, backgroundColor: '#fff' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FEF2F2', paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#FECACA' },
  logoutBtnText: { fontSize: 15, fontWeight: '900', color: '#EF4444' },
});
