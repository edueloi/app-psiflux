import 'react-native-gesture-handler';
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Dimensions,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// NOTIFICATIONS-WORKAROUND: Desativado temporariamente para não travar o Expo Go
// import * as Notifications from 'expo-notifications';
// Notifications.setNotificationHandler({ ... });

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen        from './src/screens/LoginScreen';
import DashboardScreen    from './src/screens/DashboardScreen';
import PatientsScreen     from './src/screens/PatientsScreen';
import AgendaScreen       from './src/screens/AgendaScreen';
import RecordsScreen      from './src/screens/RecordsScreen';
import FinanceScreen      from './src/screens/FinanceScreen';
import MessagesScreen     from './src/screens/MessagesScreen';
import DocumentsScreen    from './src/screens/DocumentsScreen';
import VirtualRoomsScreen from './src/screens/VirtualRoomsScreen';
import ProfileScreen      from './src/screens/ProfileScreen';
import LivroCaixaScreen   from './src/screens/LivroCaixaScreen';
import DrawerMenu         from './src/components/DrawerMenu';

export const navigationRef = createNavigationContainerRef();

const { width: SW } = Dimensions.get('window');
const Stack   = createNativeStackNavigator();
const Tab     = createBottomTabNavigator();
const MoreNav = createNativeStackNavigator();

const BRAND  = '#1a3a5c';
const ACCENT = '#6366f1';

const HEADER = {
  headerStyle: { backgroundColor: BRAND },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '800', fontSize: 17 },
  headerShadowVisible: false,
};

function HamburgerBtn({ onPress }) {
  return (
    <TouchableOpacity onPress={onPress}
      style={{ paddingLeft:16, paddingRight:12, paddingVertical:10, justifyContent:'center' }}
      hitSlop={{ top:15, bottom:15, left:15, right:15 }}
      activeOpacity={0.7}>
      <View style={{ width:24, height:22, justifyContent:'space-between' }}>
        <View style={{ width:22, height:3, borderRadius:4, backgroundColor:'#fff' }}/>
        <View style={{ width:16, height:3, borderRadius:4, backgroundColor:'rgba(255,255,255,0.7)' }}/>
        <View style={{ width:20, height:3, borderRadius:4, backgroundColor:'#fff' }}/>
      </View>
    </TouchableOpacity>
  );
}

/* ══════════════════════════════════════════════════════════
   CAIXA DE FERRAMENTAS — tela home do stack "Mais"
══════════════════════════════════════════════════════════ */
function FerramentasHomeScreen({ navigation }) {
  const { user, logout } = useAuth();

  const initials = (name = '') =>
    name.split(' ').slice(0,2).map(n => n[0]||'').join('').toUpperCase() || '?';

  const TOOLS = [
    {
      label:'Financeiro',   screen:'Financeiro',
      emoji:'💰', color:'#10b981', bg:'#f0fdf4',
      desc:'Receitas, despesas e saldo mensal',
    },
    {
      label:'Livro Caixa',  screen:'LivroCaixa',
      emoji:'📒', color:'#3b82f6', bg:'#eff6ff',
      desc:'Histórico de entradas e saídas',
    },
    {
      label:'Documentos',   screen:'Documentos',
      emoji:'📁', color:'#ec4899', bg:'#fdf2f8',
      desc:'Arquivos, uploads e anexos',
    },
    {
      label:'Sala Virtual', screen:'SalaVirtual',
      emoji:'🎥', color:'#8b5cf6', bg:'#faf5ff',
      desc:'Videochamadas e salas online',
    },
    {
      label:'Mensagens',    screen:'Mensagens',
      emoji:'💬', color:'#14b8a6', bg:'#f0fdfa',
      desc:'Templates de mensagens automáticas',
    },
    {
      label:'Meu Perfil',   screen:'Perfil',
      emoji:'👤', color:'#f59e0b', bg:'#fffbeb',
      desc:'Dados pessoais e configurações',
    },
  ];

  return (
    <ScrollView style={ft.root} showsVerticalScrollIndicator={false}>

      {/* ── Perfil do usuário ── */}
      <View style={ft.profileCard}>
        <View style={ft.profileDecor}/>
        <View style={ft.avatarWrap}>
          <View style={ft.avatar}>
            <Text style={ft.avatarTxt}>{initials(user?.name)}</Text>
          </View>
          <View style={ft.onlineDot}/>
        </View>
        <View style={{flex:1}}>
          <Text style={ft.profileName} numberOfLines={1}>{user?.name||'Usuário'}</Text>
          <Text style={ft.profileEmail} numberOfLines={1}>{user?.email||''}</Text>
          <View style={ft.rolePill}>
            <Text style={ft.roleTxt}>{(user?.role||'profissional').toUpperCase()}</Text>
          </View>
        </View>
        <TouchableOpacity style={ft.editBtn} onPress={()=>navigation.navigate('Perfil')} activeOpacity={0.8}>
          <Text style={ft.editBtnTxt}>✏️</Text>
        </TouchableOpacity>
      </View>

      {/* ── Título seção ── */}
      <View style={ft.sectionHead}>
        <Text style={ft.sectionTitle}>🧰  Caixa de Ferramentas</Text>
        <Text style={ft.sectionSub}>Acesse os módulos do sistema</Text>
      </View>

      {/* ── Grid de ferramentas ── */}
      <View style={ft.grid}>
        {TOOLS.map(item => (
          <TouchableOpacity
            key={item.screen}
            style={[ft.toolCard,{backgroundColor:item.bg, borderLeftColor:item.color}]}
            onPress={()=>navigation.navigate(item.screen)}
            activeOpacity={0.78}>
            <View style={[ft.toolIcon,{backgroundColor:item.color+'22'}]}>
              <Text style={{fontSize:26}}>{item.emoji}</Text>
            </View>
            <View style={ft.toolInfo}>
              <Text style={[ft.toolLabel,{color:item.color}]}>{item.label}</Text>
              <Text style={ft.toolDesc} numberOfLines={1}>{item.desc}</Text>
            </View>
            <Text style={[ft.toolArrow,{color:item.color}]}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity style={ft.logoutBtn} onPress={logout} activeOpacity={0.85}>
        <Text style={ft.logoutTxt}>🚪  Encerrar sessão</Text>
      </TouchableOpacity>

      <View style={{height:40}}/>
    </ScrollView>
  );
}

const ft = StyleSheet.create({
  root:        { flex:1, backgroundColor:'#f1f5f9' },

  /* profile */
  profileCard: { backgroundColor:BRAND, flexDirection:'row', alignItems:'center',
                  gap:14, padding:20, paddingBottom:24, overflow:'hidden' },
  profileDecor:{ position:'absolute', width:200, height:200, borderRadius:100,
                  backgroundColor:'rgba(99,102,241,0.15)', top:-80, right:-50 },
  avatarWrap:  { position:'relative' },
  avatar:      { width:58, height:58, borderRadius:29, backgroundColor:'#2d6da8',
                  alignItems:'center', justifyContent:'center',
                  borderWidth:2.5, borderColor:'#90c4e8' },
  avatarTxt:   { color:'#fff', fontWeight:'900', fontSize:22 },
  onlineDot:   { position:'absolute', bottom:1, right:1, width:13, height:13,
                  borderRadius:7, backgroundColor:'#10b981',
                  borderWidth:2, borderColor:BRAND },
  profileName: { fontSize:17, fontWeight:'900', color:'#fff' },
  profileEmail:{ fontSize:12, color:'#90c4e8', marginTop:2 },
  rolePill:    { alignSelf:'flex-start', backgroundColor:'rgba(255,255,255,0.12)',
                  paddingHorizontal:8, paddingVertical:3, borderRadius:8, marginTop:5 },
  roleTxt:     { fontSize:9, fontWeight:'800', color:'#93c5fd', letterSpacing:1 },
  editBtn:     { width:36, height:36, borderRadius:12, backgroundColor:'rgba(255,255,255,0.12)',
                  alignItems:'center', justifyContent:'center' },
  editBtnTxt:  { fontSize:16 },

  /* section */
  sectionHead: { paddingHorizontal:16, paddingTop:18, paddingBottom:8 },
  sectionTitle:{ fontSize:16, fontWeight:'900', color:'#0f172a' },
  sectionSub:  { fontSize:12, color:'#64748b', marginTop:2 },

  /* grid */
  grid:        { paddingHorizontal:16, gap:10 },
  toolCard:    { flexDirection:'row', alignItems:'center', backgroundColor:'#fff',
                  borderRadius:16, padding:14, gap:14, borderLeftWidth:4,
                  shadowColor:'#000', shadowOffset:{width:0,height:2},
                  shadowOpacity:0.05, shadowRadius:8, elevation:3 },
  toolIcon:    { width:52, height:52, borderRadius:16, alignItems:'center', justifyContent:'center' },
  toolInfo:    { flex:1 },
  toolLabel:   { fontSize:15, fontWeight:'900' },
  toolDesc:    { fontSize:12, color:'#64748b', marginTop:2 },
  toolArrow:   { fontSize:26, fontWeight:'300', marginRight:2 },

  /* logout */
  logoutBtn:   { margin:16, marginTop:16, backgroundColor:'#fef2f2',
                  borderRadius:16, padding:16, alignItems:'center',
                  borderWidth:1, borderColor:'#fecaca',
                  shadowColor:'#ef4444', shadowOffset:{width:0,height:2},
                  shadowOpacity:0.08, shadowRadius:6, elevation:2 },
  logoutTxt:   { color:'#ef4444', fontWeight:'800', fontSize:15 },
});

/* ══════════════════════════════════════════════════════════
   STACK de "Ferramentas"
══════════════════════════════════════════════════════════ */
function FerramentasStack({ openDrawer }) {
  const hamburger = () => <HamburgerBtn onPress={openDrawer}/>;
  return (
    <MoreNav.Navigator screenOptions={{ ...HEADER, headerLeft: hamburger }}>
      <MoreNav.Screen name="MoreHome" options={{ title:'Caixa de Ferramentas' }}>
        {(props) => <FerramentasHomeScreen {...props} openDrawer={openDrawer}/>}
      </MoreNav.Screen>
      <MoreNav.Screen name="Financeiro"  component={FinanceScreen}      options={{ title:'Financeiro' }}/>
      <MoreNav.Screen name="LivroCaixa"  component={LivroCaixaScreen}   options={{ title:'Livro Caixa' }}/>
      <MoreNav.Screen name="Documentos"  component={DocumentsScreen}    options={{ title:'Documentos' }}/>
      <MoreNav.Screen name="SalaVirtual" component={VirtualRoomsScreen} options={{ title:'Sala Virtual' }}/>
      <MoreNav.Screen name="Mensagens"   component={MessagesScreen}     options={{ title:'Mensagens' }}/>
      <MoreNav.Screen name="Perfil"      component={ProfileScreen}      options={{ title:'Meu Perfil' }}/>
    </MoreNav.Navigator>
  );
}

/* ══════════════════════════════════════════════════════════
   CUSTOM TAB BAR — bottom navigation premium
══════════════════════════════════════════════════════════ */
const TABS = [
  { name:'Dashboard',   label:'Início',       emoji:'🏠' },
  { name:'Agenda',      label:'Agenda',       emoji:'📅' },
  { name:'Pacientes',   label:'Pacientes',    emoji:'👥' },
  { name:'Prontuarios', label:'Prontuários',  emoji:'📋' },
  { name:'Ferramentas', label:'Ferramentas',  emoji:'🧰' },
];

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[tb.bar, { paddingBottom: insets.bottom + 6 }]}>
      {state.routes.map((route, idx) => {
        const isFocused = state.index === idx;
        const tab = TABS.find(t => t.name === route.name) || {};
        const onPress = () => {
          const evt = navigation.emit({ type:'tabPress', target:route.key, canPreventDefault:true });
          if (!isFocused && !evt.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <TouchableOpacity
            key={route.key}
            style={tb.btn}
            onPress={onPress}
            activeOpacity={0.7}>
            <View style={[tb.iconWrap, isFocused && tb.iconWrapActive]}>
              <Text style={[tb.emoji, { opacity: isFocused ? 1 : 0.4 }]}>{tab.emoji}</Text>
            </View>
            <Text style={[tb.label, isFocused && tb.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tb = StyleSheet.create({
  bar: {
    flexDirection:'row', backgroundColor:'#fff',
    borderTopWidth:1, borderTopColor:'#f1f5f9',
    paddingTop:10,
    shadowColor:'#1a3a5c', shadowOffset:{ width:0, height:-8 },
    shadowOpacity:0.1, shadowRadius:16, elevation:20,
  },
  btn:           { flex:1, alignItems:'center', gap:4 },
  iconWrap:      { width:44, height:34, borderRadius:16, alignItems:'center', justifyContent:'center' },
  iconWrapActive:{ backgroundColor:'#f5f3ff', shadowColor:'#6366f1', shadowOffset:{width:0,height:2}, shadowOpacity:0.12, shadowRadius:4 },
  emoji:         { fontSize:22 },
  label:         { fontSize:10, fontWeight:'700', color:'#94a3b8', marginTop:1 },
  labelActive:   { color:ACCENT, fontWeight:'900' },
});

/* ══════════════════════════════════════════════════════════
   TABS PRINCIPAIS
══════════════════════════════════════════════════════════ */
function MainTabs() {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer  = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);
  const hamburger   = () => <HamburgerBtn onPress={openDrawer}/>;

  const handleNav = (tab, nested) => {
    if (navigationRef.isReady()) {
      if (nested) navigationRef.navigate(tab, { screen: nested });
      else        navigationRef.navigate(tab);
    }
  };

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props}/>}
        screenOptions={({ route }) => ({
          ...HEADER,
          headerLeft: hamburger,
        })}>
        <Tab.Screen name="Dashboard"   component={DashboardScreen} options={{ title:'Início' }}/>
        <Tab.Screen name="Agenda"      component={AgendaScreen}    options={{ title:'Agenda' }}/>
        <Tab.Screen name="Pacientes"   component={PatientsScreen}  options={{ title:'Pacientes' }}/>
        <Tab.Screen name="Prontuarios" component={RecordsScreen}   options={{ title:'Prontuários' }}/>
        <Tab.Screen name="Ferramentas" options={{ title:'Ferramentas', headerShown:false }}>
          {() => <FerramentasStack openDrawer={openDrawer}/>}
        </Tab.Screen>
      </Tab.Navigator>

      <DrawerMenu
        visible={drawerOpen}
        onClose={closeDrawer}
        onNavigate={handleNav}
        onLogout={logout}
        user={user}
      />
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   ROOT NAV + APP
══════════════════════════════════════════════════════════ */
function RootNav() {
  const { user, loading } = useAuth();

  if (loading) return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#0b1f35' }}>
      <ActivityIndicator size="large" color="#90c4e8"/>
      <Text style={{ color:'#90c4e8', marginTop:14, fontSize:13 }}>Carregando...</Text>
    </View>
  );

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown:false }}>
        {user
          ? <Stack.Screen name="Main"  component={MainTabs}/>
          : <Stack.Screen name="Login" component={LoginScreen}/>
        }
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light"/>
        <RootNav/>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
