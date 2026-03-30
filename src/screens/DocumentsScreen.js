import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { api, API_BASE_URL } from '../services/api';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtSize = (b) => b ? (b / 1024 / 1024).toFixed(2) + ' MB' : '—';

const FILE_EMOJI = (type = '') => {
  if (type.includes('pdf')) return '📄';
  if (type.includes('image') || type.includes('png') || type.includes('jpg')) return '🖼️';
  if (type.includes('word') || type.includes('doc')) return '📝';
  if (type.includes('sheet') || type.includes('xls')) return '📊';
  if (type.includes('video') || type.includes('mp4')) return '🎬';
  if (type.includes('audio') || type.includes('mp3')) return '🎵';
  return '📁';
};

export default function DocumentsScreen() {
  const [docs, setDocs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.get('/uploads');
      setDocs(Array.isArray(data) ? data : (data.uploads || data.files || []));
    } catch (e) { Alert.alert('Erro', e.message); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openFile = async (doc) => {
    const url = doc.file_url
      ? (doc.file_url.startsWith('http') ? doc.file_url : `${API_BASE_URL}${doc.file_url}`)
      : null;
    if (!url) { Alert.alert('Erro', 'URL do arquivo não disponível.'); return; }
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
    else Alert.alert('Erro', 'Não foi possível abrir o arquivo.');
  };

  const deleteDoc = (id, name) => Alert.alert('Excluir', `Excluir "${name}"?`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: async () => {
      try { await api.delete(`/uploads/${id}`); load(); }
      catch (e) { Alert.alert('Erro', e.message); }
    }},
  ]);

  const displayed = search
    ? docs.filter(d => (d.file_name || d.title || '').toLowerCase().includes(search.toLowerCase()))
    : docs;

  const renderDoc = ({ item: d }) => (
    <TouchableOpacity style={s.card} onPress={() => openFile(d)} activeOpacity={0.8}>
      <View style={s.fileIcon}>
        <Text style={{ fontSize: 28 }}>{FILE_EMOJI(d.file_type || d.mime_type || '')}</Text>
      </View>
      <View style={s.fileInfo}>
        <Text style={s.fileName} numberOfLines={1}>{d.file_name || d.title || 'Sem nome'}</Text>
        <Text style={s.fileMeta}>
          {fmtDate(d.created_at)}{d.file_size ? ` · ${fmtSize(d.file_size)}` : ''}
          {d.patient_name ? ` · ${d.patient_name}` : ''}
        </Text>
        {d.category && (
          <View style={s.catBadge}><Text style={s.catText}>{d.category}</Text></View>
        )}
      </View>
      <TouchableOpacity onPress={() => deleteDoc(d.id, d.file_name || 'arquivo')} style={s.deleteBtn}>
        <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '700' }}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a3a5c" /></View>;

  return (
    <View style={s.container}>
      <FlatList
        data={displayed}
        keyExtractor={i => String(i.id)}
        renderItem={renderDoc}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <Text style={s.count}>{displayed.length} arquivo{displayed.length !== 1 ? 's' : ''}</Text>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📁</Text>
            <Text style={s.emptyText}>Nenhum documento encontrado</Text>
            <Text style={{ color: '#cbd5e1', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
              Faça upload de documentos pelo painel web
            </Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  count: { fontSize: 12, color: '#94a3b8', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  fileIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  fileMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  catBadge: { alignSelf: 'flex-start', backgroundColor: '#eff6ff', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 5 },
  catText: { fontSize: 10, fontWeight: '700', color: '#3b82f6' },
  deleteBtn: { padding: 8 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
});
