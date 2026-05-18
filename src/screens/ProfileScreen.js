import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  Image, Switch, Dimensions, Animated
} from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
const getStaticUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `https://psiflux.com.br${path.startsWith('/') ? '' : '/'}${path}`;
};

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [form, setForm] = useState({ 
    name: '', email: '', phone: '', crp: '', specialty: '', 
    companyName: '', address: '', bio: '', public_slug: '',
    public_profile_enabled: false, gender: 'female',
    avatarUrl: '', coverUrl: '', clinicLogoUrl: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); 
  const scrollY = new Animated.Value(0);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get('/profile/me');
        const p = data.user || data;
        setForm({
          name: p.name || '', email: p.email || '', phone: p.phone || '',
          crp: p.crp || '', specialty: p.specialty || '',
          companyName: p.companyName || p.company_name || '',
          address: p.address || '', bio: p.bio || '',
          public_slug: p.public_slug || '',
          public_profile_enabled: !!p.public_profile_enabled,
          gender: p.gender || 'female',
          avatarUrl: p.avatarUrl || p.avatar_url || '',
          coverUrl: p.coverUrl || p.cover_url || '',
          clinicLogoUrl: p.clinicLogoUrl || p.clinic_logo_url || ''
        });
      } catch (e) { console.log('Profile load error:', e); }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/profile/me', {
        name: form.name, email: form.email, phone: form.phone,
        crp: form.crp, specialty: form.specialty,
        company_name: form.companyName, address: form.address,
        bio: form.bio, public_slug: form.public_slug,
        public_profile_enabled: form.public_profile_enabled,
        gender: form.gender, avatar_url: form.avatarUrl,
        cover_url: form.coverUrl, clinic_logo_url: form.clinicLogoUrl
      });
      updateUser({ name: form.name, email: form.email, avatarUrl: form.avatarUrl });
      Alert.alert('Eba! 🎉', 'Suas informações foram salvas com sucesso.');
    } catch (e) {
      Alert.alert('Ops', e.message || 'Erro ao salvar o perfil.');
    }
    setSaving(false);
  };

  const Field = ({ label, field, icon, multiline = false, ...props }) => (
    <View style={s.fieldWrapper}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputContainer, multiline && { height: 120, alignItems: 'flex-start', paddingTop: 14 }]}>
        <Ionicons name={icon} size={20} color="#94A3B8" style={s.inputIcon} />
        <TextInput
          style={[s.input, multiline && s.inputMultiline]}
          value={String(form[field])}
          onChangeText={v => setForm(f => ({ ...f, [field]: v }))}
          placeholderTextColor="#CBD5E1"
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...props}
        />
      </View>
    </View>
  );

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#4F46E5" /></View>;

  const coverImg = getStaticUrl(form.coverUrl);
  const avatarImg = getStaticUrl(form.avatarUrl);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <StatusBar style="light" />
      <Animated.ScrollView 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        
        {/* Cover Section */}
        <Animated.View style={[s.coverContainer, { transform: [{ translateY: scrollY.interpolate({ inputRange: [-100, 0, 100], outputRange: [-50, 0, 0], extrapolate: 'clamp' }) }] }]}>
          {coverImg ? <Image source={{ uri: coverImg }} style={s.coverImage} /> : <View style={s.coverGradient} />}
          <View style={s.coverOverlay} />
        </Animated.View>

        {/* Profile Info Float Card */}
        <View style={s.profileCard}>
          <View style={s.avatarRow}>
            <View style={s.avatarContainer}>
              {avatarImg ? <Image source={{ uri: avatarImg }} style={s.avatarImage} /> : <Text style={s.avatarText}>{initials(form.name)}</Text>}
            </View>
            <TouchableOpacity style={s.logoutCircle} onPress={() => Alert.alert('Sair', 'Deseja encerrar a sessão?', [ {text:'Cancelar',style:'cancel'}, {text:'Sair',style:'destructive',onPress:logout} ])}>
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>
          
          <Text style={s.nameText} numberOfLines={1}>{form.name || 'Seu Nome'}</Text>
          <Text style={s.roleText}>{form.specialty || 'Psicólogo Clínico'}{form.crp ? ` • CRP ${form.crp}` : ''}</Text>

          <View style={s.badgesRow}>
            <View style={s.badge}><View style={s.badgeDot}/><Text style={s.badgeText}>ATIVO</Text></View>
            <View style={s.badgePremium}><Ionicons name="star" size={12} color="#4F46E5"/><Text style={s.badgeTextPremium}>PRO</Text></View>
          </View>
        </View>

        {/* Scrollable Premium Tabs */}
        <View style={s.tabsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsScrollContent}>
            {[
              { id: 'info', icon: 'person', label: 'Dados Pessoais' },
              { id: 'clinic', icon: 'business', label: 'Dados da Clínica' },
              { id: 'external', icon: 'globe', label: 'Sua Vitrine Pública' }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity 
                  key={tab.id} 
                  style={[s.tabPill, isActive ? s.tabPillActive : s.tabPillInactive]} 
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={isActive ? tab.icon : `${tab.icon}-outline`} size={16} color={isActive ? '#fff' : '#64748B'} />
                  <Text style={[s.tabPillText, isActive ? s.tabPillTextActive : s.tabPillTextInactive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Dynamic Forms Area */}
        <View style={s.contentArea}>
          {activeTab === 'info' && (
            <View style={s.formSection}>
              <Field label="Nome Completo" field="name" icon="person-circle" autoCapitalize="words" />
              <Field label="E-mail Profissional" field="email" icon="mail" keyboardType="email-address" autoCapitalize="none" />
              <Field label="Telefone / WhatsApp" field="phone" icon="logo-whatsapp" keyboardType="phone-pad" />
              <Field label="Especialidade" field="specialty" icon="medical" autoCapitalize="words" />
              <Field label="Nº de Registro CRP" field="crp" icon="id-card" />
              <Field label="Resumo / Mini Currículo" field="bio" icon="document-text" multiline />
            </View>
          )}

          {activeTab === 'clinic' && (
            <View style={s.formSection}>
              <View style={s.fieldWrapper}>
                <Text style={s.label}>Logomarca da Clínica</Text>
                <View style={s.logoPreviewBox}>
                  {form.clinicLogoUrl 
                    ? <Image source={{ uri: getStaticUrl(form.clinicLogoUrl) }} style={s.logoImg} resizeMode="contain" />
                    : <View style={s.noLogoView}><Ionicons name="image-outline" size={32} color="#CBD5E1" /><Text style={s.noLogoText}>Edite via Painel Web</Text></View>
                  }
                </View>
              </View>

              <Field label="Nome do Consultório" field="companyName" icon="business" autoCapitalize="words" />
              <Field label="Endereço Físico" field="address" icon="location" multiline style={{minHeight: 80}} />
            </View>
          )}

          {activeTab === 'external' && (
            <View style={s.formSection}>
              <View style={s.switchCard}>
                <View style={s.switchInfo}>
                  <Text style={s.switchTitle}>Ativar Página Pública</Text>
                  <Text style={s.switchDesc}>Visitantes poderão ver seu perfil online.</Text>
                </View>
                <Switch value={form.public_profile_enabled} onValueChange={v => setForm(f => ({...f, public_profile_enabled: v}))} trackColor={{false: '#E2E8F0', true: '#4F46E5'}} thumbColor="#fff"/>
              </View>

              <Field label="URL do Perfil Público" field="public_slug" icon="link" autoCapitalize="none" placeholder="seunome" />
              <Text style={s.linkPreview}>psiflux.com.br/p/{form.public_slug || 'seunome'}</Text>

              <View style={s.genderSection}>
                <Text style={s.label}>Como prefere ser chamado?</Text>
                <View style={s.genderOptions}>
                  <TouchableOpacity style={[s.genderCard, form.gender === 'female' && s.genderCardActive]} onPress={() => setForm(f=>({...f, gender:'female'}))}>
                    <Ionicons name={form.gender === 'female' ? "checkmark-circle" : "ellipse-outline"} size={20} color={form.gender === 'female' ? '#4F46E5' : '#94A3B8'} />
                    <Text style={[s.genderText, form.gender === 'female' && s.genderTextActive]}>Psicóloga (F)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.genderCard, form.gender === 'male' && s.genderCardActive]} onPress={() => setForm(f=>({...f, gender:'male'}))}>
                    <Ionicons name={form.gender === 'male' ? "checkmark-circle" : "ellipse-outline"} size={20} color={form.gender === 'male' ? '#4F46E5' : '#94A3B8'} />
                    <Text style={[s.genderText, form.gender === 'male' && s.genderTextActive]}>Psicólogo (M)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          <View style={{ marginTop: 24, marginBottom: 40 }}>
            <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving} activeOpacity={0.8}>
              {saving 
                ? <ActivityIndicator size="small" color="#fff" /> 
                : <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={s.saveBtnText}>SALVAR PERFIL</Text></>
              }
            </TouchableOpacity>
          </View>
        </View>

      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  /* COVER */
  coverContainer: { width: '100%', height: 260, position: 'absolute', top: 0, left: 0 },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverGradient: { width: '100%', height: '100%', backgroundColor: '#312E81' },
  coverOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.15)' },

  /* MAIN CARD */
  profileCard: { backgroundColor: '#fff', marginTop: 170, marginHorizontal: 20, borderRadius: 32, padding: 24, shadowColor: '#312E81', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.08, shadowRadius: 35, elevation: 10 },
  avatarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: -54 },
  avatarContainer: { width: 104, height: 104, borderRadius: 36, backgroundColor: '#F8FAFC', borderWidth: 5, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width:0, height:10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarText: { fontSize: 36, fontWeight: '900', color: '#4F46E5', letterSpacing: -1 },
  logoutCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  
  nameText: { fontSize: 26, fontWeight: '900', color: '#0F172A', marginTop: 12, letterSpacing: -0.5 },
  roleText: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 4 },
  
  badgesRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', px: 10, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#D1FAE5' },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#059669', letterSpacing: 0.5 },
  badgePremium: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF2FF', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E0E7FF' },
  badgeTextPremium: { fontSize: 10, fontWeight: '900', color: '#4F46E5', letterSpacing: 0.5 },

  /* PREMIUM TABS */
  tabsWrapper: { marginTop: 24, paddingBottom: 8 },
  tabsScrollContent: { paddingHorizontal: 20, gap: 10 },
  tabPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  tabPillActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  tabPillInactive: { backgroundColor: '#fff', borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 2 },
  tabPillText: { fontSize: 13, fontWeight: '800' },
  tabPillTextActive: { color: '#fff' },
  tabPillTextInactive: { color: '#64748B' },

  /* CONTENT AREA */
  contentArea: { paddingHorizontal: 20, paddingTop: 24 },
  formSection: { gap: 12 },
  
  fieldWrapper: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '800', color: '#475569', marginBottom: 8, paddingLeft: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 56, fontSize: 15, fontWeight: '600', color: '#1E293B' },
  inputMultiline: { flex: 1, paddingRight: 10 },

  logoPreviewBox: { height: 140, backgroundColor: '#fff', borderRadius: 24, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  logoImg: { width: '80%', height: '80%' },
  noLogoView: { alignItems: 'center', opacity: 0.6 },
  noLogoText: { fontSize: 12, fontWeight: '800', color: '#94A3B8', marginTop: 8 },

  switchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 24, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 16 },
  switchInfo: { flex: 1, paddingRight: 16 },
  switchTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  switchDesc: { fontSize: 12, color: '#64748B', marginTop: 4, lineHeight: 18 },
  linkPreview: { fontSize: 12, fontWeight: '700', color: '#4F46E5', marginTop: -4, marginLeft: 20, marginBottom: 20 },

  genderSection: { marginTop: 10 },
  genderOptions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  genderCard: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', paddingVertical: 16, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0' },
  genderCardActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  genderText: { fontSize: 14, fontWeight: '800', color: '#64748B' },
  genderTextActive: { color: '#4F46E5' },

  /* SAVE BUTTON (Agenda Style) */
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#6366f1', paddingVertical: 14, borderRadius: 10, shadowColor: '#6366f1', shadowOffset: {width:0,height:2}, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

});
