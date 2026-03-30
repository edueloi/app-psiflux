import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Animated, Dimensions, Keyboard, Image, FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');
const ONBOARDING_KEY = 'psiflux_onboarded_v1';

const SLIDES = [
  {
    id: '1',
    icon: '🗓',
    color: '#3b82f6',
    title: 'Agenda inteligente',
    desc: 'Gerencie agendamentos, sessões e bloqueios em sincronia total com o painel web.',
  },
  {
    id: '2',
    icon: '🧠',
    color: '#8b5cf6',
    title: 'Prontuários com IA',
    desc: 'Organize evoluções clínicas com inteligência artificial. Aprovação rápida e segura.',
  },
  {
    id: '3',
    icon: '💼',
    color: '#10b981',
    title: 'Financeiro organizado',
    desc: 'Crie comandas, gerencie pacotes e acompanhe tudo do seu consultório em tempo real.',
  },
];

/* ─────────────────────────── Onboarding ─────────────────────────── */
function OnboardingScreen({ onDone }) {
  const [page, setPage] = useState(0);
  const flatRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const goNext = () => {
    if (page < SLIDES.length - 1) {
      const next = page + 1;
      setPage(next);
      flatRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      onDone();
    }
  };

  const skip = () => onDone();

  return (
    <Animated.View style={[s.onRoot, { opacity: fadeAnim }]}>
      {/* Skip */}
      <TouchableOpacity style={s.skipBtn} onPress={skip}>
        <Text style={s.skipTxt}>Pular</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <View style={s.slide}>
            {/* Ilustração */}
            <View style={[s.slideIconWrap, { backgroundColor: item.color + '22', borderColor: item.color + '44' }]}>
              <View style={[s.slideIconInner, { backgroundColor: item.color + '33' }]}>
                <Text style={s.slideIcon}>{item.icon}</Text>
              </View>
            </View>
            <Text style={s.slideTitle}>{item.title}</Text>
            <Text style={s.slideDesc}>{item.desc}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.dot, i === page && s.dotActive]}/>
        ))}
      </View>

      {/* Botão */}
      <TouchableOpacity style={s.onBtn} onPress={goNext} activeOpacity={0.88}>
        <Text style={s.onBtnTxt}>
          {page === SLIDES.length - 1 ? 'Começar  →' : 'Próximo  →'}
        </Text>
      </TouchableOpacity>

      <Text style={s.onFooter}>© 2026 PsiFlux</Text>
    </Animated.View>
  );
}

/* ─────────────────────────── Login ─────────────────────────── */
export default function LoginScreen() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPass, setShowPass] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused,  setPassFocused]  = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [ready, setReady] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(v => {
      if (!v) setShowOnboarding(true);
      setReady(true);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 480, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const finishOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnboarding(false);
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError('');
    if (!email || !password) { setError('Preencha e-mail e senha.'); shake(); return; }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e) {
      setError(e.message || 'Credenciais inválidas. Tente novamente.');
      shake();
    } finally {
      setLoading(false);
    }
  };

  if (!ready) return <View style={s.root}/>;
  if (showOnboarding) return <OnboardingScreen onDone={finishOnboarding}/>;

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── Área superior — logo ── */}
      <View style={s.topArea}>
        <View style={s.topDecorCircle}/>
        <Image
          source={require('../../images/logo-psiflux.png')}
          style={s.logoImg}
          resizeMode="contain"
        />
        <Text style={s.tagline}>Onde o seu consultório flui</Text>
      </View>

      {/* ── Card branco inferior ── */}
      <Animated.View style={[
        s.bottomCard,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <Text style={s.cardTitle}>Bem-vindo de volta</Text>
            <Text style={s.cardSub}>Entre com sua conta para continuar</Text>

            {/* E-mail */}
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>E-mail profissional</Text>
              <View style={[s.inputWrap, emailFocused && s.inputFocused]}>
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={v => { setEmail(v); setError(''); }}
                  placeholder="nome@email.com"
                  placeholderTextColor="#b0bec5"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            {/* Senha */}
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Senha</Text>
              <View style={[s.inputWrap, passFocused && s.inputFocused]}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={password}
                  onChangeText={v => { setPassword(v); setError(''); }}
                  placeholder="••••••••"
                  placeholderTextColor="#b0bec5"
                  secureTextEntry={!showPass}
                  onSubmitEditing={handleLogin}
                  returnKeyType="done"
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} style={s.eyeBtn}>
                  <Text style={[s.eyeTxt, passFocused && { color: '#3b82f6' }]}>
                    {showPass ? 'Ocultar' : 'Mostrar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Erro */}
            {!!error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* Botão */}
            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.75 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small"/>
                : <Text style={s.btnText}>Entrar no sistema</Text>
              }
            </TouchableOpacity>

            {/* Nota */}
            <Text style={s.note}>
              Use o mesmo e-mail e senha do painel web.{'\n'}Os dados são sincronizados em tempo real.
            </Text>
          </Animated.View>
        </ScrollView>
      </Animated.View>

    </KeyboardAvoidingView>
  );
}

/* ─── Cores ─── */
const NAVY  = '#0d1f35';
const BLUE  = '#1a3a5c';
const ACC   = '#3b82f6';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },

  /* ── Onboarding ── */
  onRoot:       { flex: 1, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0 },
  skipBtn:      { position: 'absolute', top: 54, right: 24 },
  skipTxt:      { color: '#7bafd4', fontSize: 14, fontWeight: '600' },
  slide:        { width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingTop: 40 },
  slideIconWrap:{ width: 160, height: 160, borderRadius: 80, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 36 },
  slideIconInner:{ width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center' },
  slideIcon:    { fontSize: 52 },
  slideTitle:   { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 16, letterSpacing: -0.3 },
  slideDesc:    { fontSize: 16, color: '#7bafd4', textAlign: 'center', lineHeight: 26, fontWeight: '400' },
  dots:         { flexDirection: 'row', gap: 8, marginTop: 48, marginBottom: 32 },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2a4a6a' },
  dotActive:    { width: 28, backgroundColor: ACC },
  onBtn:        { backgroundColor: ACC, borderRadius: 16, height: 56, width: width - 48, alignItems: 'center', justifyContent: 'center', shadowColor: ACC, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
  onBtnTxt:     { color: '#fff', fontWeight: '800', fontSize: 17, letterSpacing: 0.3 },
  onFooter:     { marginTop: 28, fontSize: 11, color: '#2a4a6a' },

  /* ── Login: topo ── */
  topArea: {
    height: height * 0.38,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative',
  },
  topDecorCircle: {
    position: 'absolute', width: 360, height: 360, borderRadius: 180,
    backgroundColor: '#1a3a5c', top: -200, opacity: 0.7,
  },
  logoImg:  { width: 200, height: 88 },
  tagline:  { fontSize: 13, color: '#7bafd4', marginTop: 10, letterSpacing: 0.8, fontWeight: '500' },

  /* ── Login: card ── */
  bottomCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingTop: 32, paddingHorizontal: 26,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 24,
  },
  cardTitle: { fontSize: 26, fontWeight: '900', color: BLUE, marginBottom: 4 },
  cardSub:   { fontSize: 14, color: '#94a3b8', marginBottom: 28 },

  /* ── Inputs ── */
  fieldGroup:  { marginBottom: 18 },
  fieldLabel:  { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 14, backgroundColor: '#f8fafc',
    height: 54, paddingHorizontal: 16,
  },
  inputFocused: { borderColor: ACC, backgroundColor: '#eff6ff' },
  input:        { flex: 1, fontSize: 15, color: '#1e293b', fontWeight: '500' },
  eyeBtn:       { paddingLeft: 10, paddingVertical: 4 },
  eyeTxt:       { fontSize: 12, fontWeight: '700', color: '#94a3b8' },

  /* ── Erro ── */
  errorBox:  { backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fecaca' },
  errorText: { color: '#b91c1c', fontSize: 13, fontWeight: '600', textAlign: 'center' },

  /* ── Botão ── */
  btn: {
    backgroundColor: BLUE, borderRadius: 16, height: 58,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4, marginBottom: 20,
    shadowColor: BLUE, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 0.4 },

  /* ── Nota ── */
  note: { fontSize: 12, color: '#b0bec5', textAlign: 'center', lineHeight: 20 },
});
