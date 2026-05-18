import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
  Dimensions, Switch, Share,
} from 'react-native';
import { api } from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');
const BRAND = '#1a3a5c';
const ACCENT = '#6366f1';

/* ── Constantes ──────────────────────────────────────────── */
const TYPE_META = {
  Evolucao:      { label:'Evolução Clínica',   emoji:'📋', color:'#4F46E5', desc: 'Registro da sessão e evolução' },
  Anamnese:      { label:'Enviar Anamnese',    emoji:'✉️', color:'#7C3AED', desc: 'Enviar formulário remoto ao paciente' },
  Avaliacao:     { label:'Avaliação Clínica',   emoji:'🔍', color:'#0891B2', desc: 'Escalas e instrumentos aplicados' },
  Plano:         { label:'Plano Terapêutico',   emoji:'🗺️', color:'#059669', desc: 'Metas e planejamento do caso' },
  Relatorio:     { label:'Relatório / Laudo',   emoji:'📄', color:'#2563EB', desc: 'Documento técnico ou laudo' },
  Encaminhamento:{ label:'Encaminhamento',      emoji:'🔄', color:'#D97706', desc: 'Encaminhamento profissional' },
  Atestado:      { label:'Atestado',            emoji:'🏥', color:'#E11D48', desc: 'Declarações e atestados' },
};
const STATUS_META = {
  Rascunho:   { color:'#f59e0b' },
  Organizado: { color:'#6366f1' },
  Revisado:   { color:'#8b5cf6' },
  Aprovado:   { color:'#10b981' },
  Finalizado: { color:'#1a3a5c' },
};
const TYPES   = Object.keys(TYPE_META);
const STATUSES = Object.keys(STATUS_META);

/* Campos que a IA organiza (Evolução) */
const ORGANIZED_FIELDS = [
  { key:'motivo_consulta',         label:'Motivo da Consulta',        emoji:'🎯' },
  { key:'contexto_relevante',      label:'Contexto Relevante',        emoji:'📌' },
  { key:'observacoes_clinicas',    label:'Observações Clínicas',      emoji:'🔍' },
  { key:'intervencoes_realizadas', label:'Intervenções Realizadas',   emoji:'🛠️' },
  { key:'evolucao_resposta',       label:'Evolução / Resposta',       emoji:'📈' },
  { key:'plano_terapeutico',       label:'Plano — próxima sessão',    emoji:'🗺️' },
  { key:'encaminhamentos',         label:'Encaminhamentos',           emoji:'↗️'  },
  { key:'observacao_complementar', label:'Observação Complementar',   emoji:'📝' },
];

/* ── Campos por tipo ─────────────────────────────────────── */
const TYPE_FIELDS = {
  Anamnese: [
    { section:'Motivo da Busca' },
    { key:'motivo_busca',         label:'O que motivou a busca por atendimento?', emoji:'🎯', multiline:true,  rows:3, required:true },
    { key:'queixa_principal',     label:'Principal dificuldade ou sofrimento',    emoji:'💬', multiline:true,  rows:3 },
    { key:'tempo_sofrimento',     label:'Há quanto tempo?',                       emoji:'⏱️', multiline:false },
    { key:'tentativas_anteriores',label:'Tentativas anteriores de lidar',         emoji:'🔄', multiline:true,  rows:2 },
    { section:'Histórico de Saúde' },
    { key:'historico_tratamentos',label:'Já fez acompanhamento psicológico?',     emoji:'🏥', multiline:false },
    { key:'medicamentos',         label:'Faz uso de medicamentos?',               emoji:'💊', multiline:false },
    { key:'historico_saude',      label:'Condições de saúde relevantes',          emoji:'❤️', multiline:true,  rows:2 },
    { key:'historico_familiar',   label:'Histórico familiar de saúde mental',     emoji:'👨‍👩‍👧', multiline:false },
    { section:'História de Vida' },
    { key:'infancia',             label:'Infância e adolescência',                emoji:'🌱', multiline:true,  rows:3 },
    { key:'eventos_traumaticos',  label:'Eventos difíceis ou traumáticos',        emoji:'⚡', multiline:true,  rows:2 },
    { key:'pontos_fortes',        label:'Pontos fortes e qualidades',             emoji:'⭐', multiline:false },
    { section:'Vida Atual' },
    { key:'sono',                 label:'Qualidade do sono',                      emoji:'😴', multiline:false, hint:'Ex: dorme bem, insônia...' },
    { key:'trabalho_estudo',      label:'Situação de trabalho / estudo',          emoji:'💼', multiline:false },
    { key:'lazer',                label:'Atividades de lazer',                    emoji:'🎯', multiline:false },
    { section:'Saúde Emocional' },
    { key:'humor_geral',          label:'Humor geral (0–10)',                     emoji:'😊', multiline:false, hint:'0 = péssimo, 10 = excelente' },
    { key:'ansiedade',            label:'Frequência de ansiedade',                emoji:'😰', multiline:false, hint:'Raramente / Às vezes / Frequentemente' },
    { key:'autoestima',           label:'Autoestima (0–10)',                      emoji:'💪', multiline:false },
    { key:'bem_estar_geral',      label:'Bem-estar geral (0–10)',                 emoji:'🌟', multiline:false },
    { key:'apoio_social',         label:'Rede de apoio social (0–10)',            emoji:'🤝', multiline:false },
  ],
  Avaliacao: [
    { key:'instrumento_aplicado',  label:'Instrumento / Escala Aplicado',   emoji:'📊', multiline:false, required:true, hint:'Ex: PHQ-9, GAD-7, DASS-21...' },
    { key:'resultado_obtido',      label:'Resultado Obtido',                emoji:'📈', multiline:true,  rows:3 },
    { key:'interpretacao_clinica', label:'Interpretação Clínica',           emoji:'🔍', multiline:true,  rows:4 },
    { key:'recomendacoes',         label:'Recomendações',                   emoji:'✅', multiline:true,  rows:2 },
    { key:'proxima_avaliacao',     label:'Previsão de reavaliação',         emoji:'📅', multiline:false },
  ],
  Plano: [
    { key:'abordagem_utilizada',        label:'Abordagem Terapêutica',       emoji:'🧠', multiline:false, hint:'Ex: TCC, Psicanálise, ACT...' },
    { key:'necessidades_identificadas', label:'Necessidades Identificadas',  emoji:'🎯', multiline:true,  rows:3, required:true },
    { key:'objetivos_terapeuticos',     label:'Objetivos Terapêuticos',      emoji:'🏁', multiline:true,  rows:3 },
    { key:'intervencoes_planejadas',    label:'Intervenções Planejadas',     emoji:'🛠️', multiline:true,  rows:3 },
    { key:'metas_curto_prazo',          label:'Metas de Curto Prazo',       emoji:'⚡', multiline:true,  rows:2 },
    { key:'metas_longo_prazo',          label:'Metas de Longo Prazo',       emoji:'🌟', multiline:true,  rows:2 },
    { key:'frequencia_sessoes',         label:'Frequência das Sessões',      emoji:'📅', multiline:false, hint:'Ex: 1x por semana' },
    { key:'previsao_duracao',           label:'Previsão de Duração',         emoji:'⏱️', multiline:false, hint:'Ex: 3 meses' },
  ],
  Relatorio: [
    { key:'objetivo_laudo',         label:'Objetivo do Relatório / Laudo',  emoji:'📋', multiline:false, required:true, hint:'Ex: Para fins de afastamento...' },
    { key:'destinatario',           label:'Destinatário',                   emoji:'👤', multiline:false, hint:'Ex: Empresa, CRP, Médico...' },
    { key:'historico_clinico',      label:'Histórico Clínico',              emoji:'📚', multiline:true,  rows:4 },
    { key:'instrumentos_utilizados',label:'Instrumentos Utilizados',        emoji:'🔧', multiline:false, hint:'Ex: Entrevista clínica, PHQ-9...' },
    { key:'resultados_analise',     label:'Resultados e Análise',           emoji:'📊', multiline:true,  rows:4 },
    { key:'conclusao',              label:'Conclusão',                      emoji:'✅', multiline:true,  rows:3 },
    { key:'recomendacoes',          label:'Recomendações',                  emoji:'💡', multiline:true,  rows:2 },
  ],
  Encaminhamento: [
    { key:'motivo_encaminhamento',  label:'Motivo do Encaminhamento',           emoji:'📋', multiline:true,  rows:3, required:true },
    { key:'especialidade_destino',  label:'Especialidade / Serviço de Destino', emoji:'🏥', multiline:false, hint:'Ex: Psiquiatria, Neurologia...' },
    { key:'profissional_indicado',  label:'Profissional Indicado',              emoji:'👨‍⚕️', multiline:false },
    { key:'hipotese_diagnostica',   label:'Hipótese Diagnóstica (CID)',         emoji:'🔍', multiline:false, hint:'Ex: F41.1' },
    { key:'informacoes_clinicas',   label:'Informações Clínicas Relevantes',    emoji:'📌', multiline:true,  rows:3 },
    { key:'urgencia',               label:'Urgência',                           emoji:'⚡', multiline:false, hint:'Baixa / Média / Alta' },
  ],
  Atestado: [
    { key:'tipo_atestado', label:'Tipo de Atestado',          emoji:'📋', multiline:false, required:true, hint:'Comparecimento / Afastamento / Aptidão' },
    { key:'periodo',       label:'Período (se afastamento)',  emoji:'📅', multiline:false, hint:'Ex: 3 dias a partir de hoje' },
    { key:'cid',           label:'CID (opcional)',             emoji:'🏥', multiline:false },
    { key:'descricao',     label:'Descrição',                 emoji:'📝', multiline:true,  rows:4 },
    { key:'destinatario',  label:'Destinatário',              emoji:'👤', multiline:false, hint:'Ex: Empresa, Escola...' },
  ],
};

/* ── Helpers ─────────────────────────────────────────────── */
const strip    = (h) => (h||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
const todayStr = ()  => new Date().toISOString().split('T')[0];
const monthKey = (d) => { const dt=new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`; };
const lastNMonths = (n) => {
  const months=[]; const now=new Date();
  for(let i=n-1;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return months;
};
const MONTH_NAMES   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const ACTION_LABELS = {
  created:'Criado', updated:'Atualizado', viewed:'Visualizado',
  approved:'Aprovado', deleted:'Excluído', ai_organized:'IA Organizado',
  restricted_accessed:'Restrito acessado', exported:'Exportado',
};

/* ═══════════════════════════════════════════════════════════ */
export default function RecordsScreen() {
  /* ── Data ─────────────────────────────────────────────── */
  const [records,       setRecords]       = useState([]);
  const [patients,      setPatients]      = useState([]);
  const [apiStats,      setApiStats]      = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  /* ── Filters ──────────────────────────────────────────── */
  const [search,        setSearch]        = useState('');
  const [filterType,    setFilterType]    = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');

  /* ── Modals ───────────────────────────────────────────── */
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSendAnamnesisModal, setShowSendAnamnesisModal] = useState(false);
  const [showSourceSelector, setShowSourceSelector] = useState(false);

  /* ── Form ─────────────────────────────────────────────── */
  const emptyForm = (type='Evolucao') => ({
    patient_id:'', record_type:type,
    title:`${TYPE_META[type]?.label||type} — ${new Date().toLocaleDateString('pt-BR')}`,
    draft_content:'', typed_content:{}, restricted_content:'',
    tags:'', session_date:todayStr(), start_time:'', end_time:'',
    appointment_type:'individual',
    linkedSources: []
  });
  const [form,      setForm]      = useState(emptyForm());
  const [formMode,  setFormMode]  = useState('create'); // 'create'|'edit'
  const [formStep,  setFormStep]  = useState('input');  // 'input'|'ai_result'
  const [editId,    setEditId]    = useState(null);
  const [organized, setOrganized] = useState(null);
  const [reviewPts, setReviewPts] = useState([]);
  const [patSearch, setPatSearch] = useState('');
  const [saving,    setSaving]    = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  /* ── Anamnesis Send Flow ──────────────────────────────── */
  const [anamnesisData, setAnamnesisData] = useState({
    title: '',
    welcomeMessage: '',
    version: 'full',
    allowResume: true,
    allowEditAfterSubmit: false,
    expiresHours: 168, // 7 dias (padrão web)
    reminderHours: 48,  // 2 dias (padrão web)
    approach: ''
  });

  const [sources, setSources] = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  /* ── View ─────────────────────────────────────────────── */
  const [viewRecord,         setViewRecord]         = useState(null);
  const [viewLoading,        setViewLoading]        = useState(false);
  const [auditTrail,         setAuditTrail]         = useState([]);
  const [showAudit,          setShowAudit]          = useState(false);
  const [restrictedContent,  setRestrictedContent]  = useState(null);

  /* ── Password modal ───────────────────────────────────── */
  const [pwModal,   setPwModal]   = useState(null); // {action:'approve'|'restrict', recordId}
  const [password,  setPassword]  = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  /* ── Stats ────────────────────────────────────────────── */
  const stats = useMemo(() => {
    if (apiStats) {
      const byTypeObj = {};
      TYPES.forEach(t=>{ byTypeObj[t]=0; });
      (apiStats.byType||[]).forEach(({record_type,count})=>{
        if (record_type in byTypeObj) byTypeObj[record_type] = count;
      });
      const months = lastNMonths(6);
      const byMonthMap = {};
      (apiStats.byMonth||[]).forEach(({month,count})=>{ byMonthMap[month]=count; });
      return {
        total:          apiStats.total||0,
        thisMonthCount: apiStats.thisMonth||0,
        approved:       apiStats.approved||0,
        drafts:         apiStats.drafts||0,
        byType:  byTypeObj,
        byMonth: months.map(m=>({m, count:byMonthMap[m]||0})),
      };
    }
    const months   = lastNMonths(6);
    const thisMonth = monthKey(new Date());
    const byType   = {};
    TYPES.forEach(t=>{ byType[t]=records.filter(r=>r.record_type===t).length; });
    return {
      total:          records.length,
      thisMonthCount: records.filter(r=>monthKey(r.created_at)===thisMonth).length,
      approved:       records.filter(r=>r.status==='Aprovado').length,
      drafts:         records.filter(r=>r.status==='Rascunho').length,
      byType,
      byMonth: months.map(m=>({m, count:records.filter(r=>monthKey(r.created_at)===m).length})),
    };
  }, [apiStats, records]);

  /* ── Load ─────────────────────────────────────────────── */
  const load = useCallback(async () => {
    try {
      const [recs, pats, sts] = await Promise.allSettled([
        api.get('/medical-records'),
        api.get('/patients'),
        api.get('/medical-records/stats'),
      ]);
      setRecords(recs.status==='fulfilled'?(recs.value?.records||recs.value||[]):[]);
      setPatients(pats.status==='fulfilled'?(Array.isArray(pats.value)?pats.value:(pats.value?.patients||[])):[] );
      if (sts.status==='fulfilled') setApiStats(sts.value);
    } catch {}
    setLoading(false); setRefreshing(false);
  }, []);
  useEffect(()=>{ load(); },[load]);

  /* ── Filter ───────────────────────────────────────────── */
  const displayed = records.filter(r=>{
    if (filterType   && r.record_type!==filterType)   return false;
    if (filterStatus && r.status!==filterStatus)       return false;
    const q=search.toLowerCase();
    return !q||(r.title||'').toLowerCase().includes(q)||(r.patient_name||'').toLowerCase().includes(q);
  });
  const filteredPats = patients
    .filter(p=>(p.name||p.full_name||'').toLowerCase().includes(patSearch.toLowerCase()))
    .slice(0,6);

  /* ── Open new ─────────────────────────────────────────── */
  const openNew = (type) => {
    if (type === 'Anamnese') {
      const pat = form.patient_id ? { id: form.patient_id, name: patSearch } : null;
      setAnamnesisData(prev => ({
        ...prev,
        title: pat ? `Anamnese — ${pat.name}` : `Anamnese — ${new Date().toLocaleDateString('pt-BR')}`
      }));
      setShowTypeModal(false);
      setShowSendAnamnesisModal(true);
      return;
    }
    setForm(emptyForm(type)); setPatSearch('');
    setFormMode('create'); setFormStep('input'); setEditId(null);
    setOrganized(null); setReviewPts([]);
    if (type === 'Avaliacao') {
      fetchSources();
    }
    setShowTypeModal(false); setShowFormModal(true);
  };

  const fetchSources = async () => {
    if (!form.patient_id) return;
    setSourcesLoading(true);
    try {
      const pid = form.patient_id;
      const [anamnesis, clinical, formResponses] = await Promise.all([
        api.get(`/anamnesis-send?patient_id=${pid}`).catch(() => []),
        api.get(`/clinical-tools/patient/${pid}`).catch(() => []),
        api.get(`/forms/responses?patient_id=${pid}`).catch(() => []),
      ]);

      const unified = [
        ...anamnesis.filter(s => s.status === 'answered').map(s => ({
          id: `anam-${s.id}`, rawId: s.id, name: s.title || 'Anamnese Clínica',
          category: 'Anamnese', date: s.completed_at || s.created_at, type: 'anamnese'
        })),
        ...clinical.map(c => ({
          id: `tool-${c.id}`, rawId: c.id, name: c.tool_type,
          category: 'Ferramenta Clínica', date: c.created_at, type: 'clinical'
        })),
        ...formResponses.map(fr => ({
          id: `form-${fr.id}`, rawId: fr.id, name: fr.form_title || 'Formulário',
          category: fr.form_category || 'Escala', date: fr.created_at, type: 'form'
        }))
      ];
      setSources(unified.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (error) {
      console.error('Error fetching sources:', error);
    } finally {
      setSourcesLoading(false);
    }
  };

  const handleSendAnamnesis = async () => {
    if (!form.patient_id) { Alert.alert('Atenção','Selecione um paciente primeiro.'); return; }
    setSaving(true);
    try {
      const response = await api.post('/anamnesis-send', {
        patient_id: form.patient_id,
        title: anamnesisData.title,
        custom_message: anamnesisData.welcomeMessage,
        template_type: anamnesisData.version,
        allow_resume: anamnesisData.allowResume,
        allow_edit: anamnesisData.allowEditAfterSubmit,
        expires_hours: anamnesisData.expiresHours,
        reminder_hours: anamnesisData.reminderHours,
        approach: anamnesisData.approach
      });
      setShowSendAnamnesisModal(false);
      Alert.alert(
        'Sucesso', 
        'Anamnese gerada com sucesso!',
        [
          { 
            text: 'Compartilhar Link', 
            onPress: () => Share.share({ 
              message: `Olá! Por favor, preencha sua anamnese clínica através deste link seguro: ${response.public_link || response.link}` 
            }) 
          },
          { text: 'OK' }
        ]
      );
      load();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar a anamnese.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Open edit ────────────────────────────────────────── */
  const openEdit = (record) => {
    let typedContent = {};
    try { typedContent = JSON.parse(record.content||'{}'); } catch {}
    setForm({
      patient_id:       String(record.patient_id||''),
      record_type:      record.record_type||'Evolucao',
      title:            record.title||'',
      draft_content:    strip(record.draft_content||record.content||''),
      typed_content:    typedContent,
      restricted_content: strip(record.restricted_content||''),
      tags:             Array.isArray(record.tags)?record.tags.join(', '):(record.tags||''),
      session_date:     (record.created_at||'').split('T')[0]||todayStr(),
      start_time:       record.start_time||'',
      end_time:         record.end_time||'',
      appointment_type: record.appointment_type||'individual',
    });
    const pat = patients.find(p=>String(p.id)===String(record.patient_id));
    setPatSearch(pat?.name||pat?.full_name||record.patient_name||'');
    setFormMode('edit'); setEditId(record.id);
    if (record.ai_organized_content) {
      try {
        const org = typeof record.ai_organized_content==='string'
          ? JSON.parse(record.ai_organized_content)
          : record.ai_organized_content;
        setOrganized(org); setReviewPts(org.pontos_revisao||[]);
        setFormStep('ai_result');
      } catch { setOrganized(null); setReviewPts([]); setFormStep('input'); }
    } else {
      setOrganized(null); setReviewPts([]); setFormStep('input');
    }
    setShowViewModal(false); setShowFormModal(true);
  };

  /* ── AI organize ──────────────────────────────────────── */
  const organizeWithAI = async () => {
    const isEvo  = form.record_type==='Evolucao';
    const content = isEvo ? form.draft_content : JSON.stringify(form.typed_content);
    if (!content?.trim()||content==='{}') {
      Alert.alert('Atenção','Adicione conteúdo antes de organizar com IA.'); return;
    }
    setAiLoading(true);
    try {
      const endpoint = editId
        ? `/medical-records/${editId}/organize-ai`
        : '/medical-records/organize-ai';
      const resp = await api.post(endpoint, {
        draft_content: content,
        patient_id:    form.patient_id||undefined,
      });
      const org = resp.organized||{};
      setOrganized(org);
      setReviewPts(org.pontos_revisao||[]);
      setFormStep('ai_result');
    } catch(e) { Alert.alert('Erro IA', e.message||'Serviço de IA indisponível.'); }
    setAiLoading(false);
  };

  /* ── Save ─────────────────────────────────────────────── */
  const save = async () => {
    if (!form.patient_id) { Alert.alert('Atenção','Selecione um paciente.'); return; }
    const isEvo = form.record_type==='Evolucao';
    const hasAI = formStep==='ai_result' && organized;

    if (!isEvo) {
      const req = TYPE_FIELDS[form.record_type]?.find(f=>f.required&&f.key);
      if (req && !form.typed_content[req.key]?.trim()) {
        Alert.alert('Atenção',`Campo obrigatório: ${req.label}`); return;
      }
    } else if (!hasAI && !form.draft_content?.trim()) {
      Alert.alert('Atenção','Adicione o conteúdo da sessão.'); return;
    }

    setSaving(true);
    try {
      const tags = form.tags.split(',').map(t=>t.trim()).filter(Boolean);
      let contentVal, draftVal, aiOrgVal, aiStatus, statusVal;

      if (isEvo && hasAI) {
        contentVal = ORGANIZED_FIELDS.map(f=>organized[f.key]||'').filter(Boolean).join('\n\n');
        draftVal   = form.draft_content;
        aiOrgVal   = JSON.stringify(organized);
        aiStatus   = 'organized';
        statusVal  = 'Organizado';
      } else if (isEvo) {
        contentVal = form.draft_content;
        draftVal   = form.draft_content;
        aiOrgVal   = null;
        aiStatus   = 'pending';
        statusVal  = 'Rascunho';
      } else {
        contentVal = JSON.stringify(form.typed_content);
        draftVal   = JSON.stringify(form.typed_content);
        aiOrgVal   = null;
        aiStatus   = 'pending';
        statusVal  = 'Rascunho';
      }

      const payload = {
        patient_id:          form.patient_id,
        record_type:         form.record_type,
        title:               form.title,
        content:             contentVal,
        draft_content:       draftVal,
        restricted_content:  form.restricted_content||null,
        ai_organized_content:aiOrgVal,
        ai_status:           aiStatus,
        status:              statusVal,
        tags,
        start_time:          form.start_time||null,
        end_time:            form.end_time||null,
        appointment_type:    form.appointment_type,
      };

      if (formMode==='edit' && editId) {
        await api.put(`/medical-records/${editId}`, payload);
      } else {
        await api.post('/medical-records', payload);
      }
      setShowFormModal(false); load();
    } catch(e) { Alert.alert('Erro',e.message); }
    setSaving(false);
  };

  /* ── Open view ────────────────────────────────────────── */
  const openView = async (record) => {
    setViewRecord(record); setRestrictedContent(null);
    setShowAudit(false); setAuditTrail([]);
    setShowViewModal(true); setViewLoading(true);
    try {
      const full = await api.get(`/medical-records/${record.id}`);
      setViewRecord(full);
    } catch {}
    try {
      const aud = await api.get(`/medical-records/${record.id}/audit`);
      setAuditTrail(Array.isArray(aud)?aud:[]);
    } catch {}
    setViewLoading(false);
  };

  /* ── AI organizar existente ───────────────────────────── */
  const organizeExisting = async () => {
    if (!viewRecord) return;
    setAiLoading(true);
    try {
      const content = strip(viewRecord.draft_content||viewRecord.content||'');
      const resp = await api.post(`/medical-records/${viewRecord.id}/organize-ai`,{
        draft_content: content, patient_id: viewRecord.patient_id,
      });
      setViewRecord(v=>({...v,
        ai_organized_content: JSON.stringify(resp.organized),
        ai_status:'organized', status:'Organizado',
      }));
      load();
    } catch(e) { Alert.alert('Erro na IA',e.message); }
    setAiLoading(false);
  };

  /* ── Confirm password (approve | restrict) ────────────── */
  const confirmPassword = async () => {
    if (!password) return;
    setPwLoading(true);
    try {
      if (pwModal.action==='approve') {
        await api.post(`/medical-records/${pwModal.recordId}/approve`,{password});
        setViewRecord(r=>r?({...r,status:'Aprovado',approved_at:new Date().toISOString()}):null);
        Alert.alert('✅','Registro aprovado com sucesso!');
        load();
      } else {
        const res = await api.post(`/medical-records/${pwModal.recordId}/restricted`,{password});
        setRestrictedContent(res.restricted_content||res.ai_restricted||'Nenhuma anotação restrita encontrada.');
      }
      setPwModal(null); setPassword('');
    } catch {
      Alert.alert(
        pwModal.action==='approve'?'Senha incorreta':'Acesso negado',
        'Verifique sua senha e tente novamente.'
      );
    }
    setPwLoading(false);
  };

  /* ── Delete ───────────────────────────────────────────── */
  const deleteRecord = (id) => Alert.alert('Excluir registro','Esta ação não pode ser desfeita.',[
    {text:'Cancelar',style:'cancel'},
    {text:'Excluir',style:'destructive',onPress:async()=>{
      try {
        await api.delete(`/medical-records/${id}`);
        setShowViewModal(false); setViewRecord(null); load();
      } catch(e){ Alert.alert('Erro',e.message); }
    }},
  ]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={BRAND}/></View>;

  const maxMonth = Math.max(...stats.byMonth.map(m=>m.count),1);
  const maxType  = Math.max(...Object.values(stats.byType),1);

  /* ─────────────── RENDER ──────────────────────────────── */
  return (
    <View style={s.container}>
      <ScrollView stickyHeaderIndices={[2]} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor={ACCENT}/>}>

        {/* ── Stats ─────────────────────────────────────── */}
        <View style={s.statsRow}>
          {[
            {val:stats.total,         lbl:'Total',     color:BRAND},
            {val:stats.thisMonthCount,lbl:'Este mês',  color:ACCENT},
            {val:stats.approved,      lbl:'Aprovados', color:'#10b981'},
            {val:stats.drafts,        lbl:'Rascunhos', color:'#f59e0b'},
          ].map((st,i)=>(
            <View key={i} style={s.statBox}>
              <Text style={[s.statVal,{color:st.color}]}>{st.val}</Text>
              <Text style={s.statLbl}>{st.lbl}</Text>
            </View>
          ))}
        </View>

        {/* ── Charts ────────────────────────────────────── */}
        <View style={s.chartsRow}>
          <View style={[s.chartCard,{flex:1}]}>
            <Text style={s.chartTitle}>Tendência (6 meses)</Text>
            <View style={s.monthBars}>
              {stats.byMonth.map((m,i)=>{
                const pct=m.count/maxMonth;
                const mk=m.m.split('-');
                return (
                  <View key={i} style={s.monthBar}>
                    <Text style={s.monthBarCount}>{m.count||''}</Text>
                    <View style={s.monthBarTrack}>
                      <View style={[s.monthBarFill,{height:`${Math.max(pct*100,4)}%`,backgroundColor:ACCENT}]}/>
                    </View>
                    <Text style={s.monthBarLabel}>{MONTH_NAMES[parseInt(mk[1])-1]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <View style={[s.chartCard,{flex:1.1}]}>
            <Text style={s.chartTitle}>Por tipo</Text>
            {TYPES.filter(t=>stats.byType[t]>0).slice(0,5).map(t=>{
              const meta=TYPE_META[t];
              const pct=(stats.byType[t]/maxType)*100;
              return (
                <View key={t} style={s.typeBarRow}>
                  <Text style={s.typeBarEmoji}>{meta.emoji}</Text>
                  <View style={{flex:1}}>
                    <Text style={s.typeBarLabel} numberOfLines={1}>{meta.label}</Text>
                    <View style={s.typeBarTrack}>
                      <View style={[s.typeBarFill,{width:`${Math.max(pct,4)}%`,backgroundColor:meta.color}]}/>
                    </View>
                  </View>
                  <Text style={[s.typeBarCount,{color:meta.color}]}>{stats.byType[t]}</Text>
                </View>
              );
            })}
            {TYPES.every(t=>stats.byType[t]===0)&&(
              <Text style={{color:'#94a3b8',fontSize:12,marginTop:8}}>Nenhum registro ainda</Text>
            )}
          </View>
        </View>

        {/* ── Filtros (sticky) ──────────────────────────── */}
        <View style={s.controls}>
          <TextInput style={s.searchInput} value={search} onChangeText={setSearch}
            placeholder="Buscar por título ou paciente..." placeholderTextColor="#94a3b8"
            clearButtonMode="while-editing"/>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{gap:8,paddingHorizontal:14,paddingBottom:6}}>
            <TouchableOpacity style={[s.chip,!filterStatus&&s.chipActive]} onPress={()=>setFilterStatus('')}>
              <Text style={[s.chipTxt,!filterStatus&&s.chipTxtActive]}>Todos status</Text>
            </TouchableOpacity>
            {STATUSES.map(st=>(
              <TouchableOpacity key={st} style={[s.chip,filterStatus===st&&s.chipActive]}
                onPress={()=>setFilterStatus(filterStatus===st?'':st)}>
                <Text style={[s.chipTxt,filterStatus===st&&s.chipTxtActive]}>{st}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{gap:8,paddingHorizontal:14,paddingBottom:10}}>
            <TouchableOpacity style={[s.chip,!filterType&&s.chipActive]} onPress={()=>setFilterType('')}>
              <Text style={[s.chipTxt,!filterType&&s.chipTxtActive]}>Todos tipos</Text>
            </TouchableOpacity>
            {TYPES.map(t=>(
              <TouchableOpacity key={t} style={[s.chip,filterType===t&&s.chipActive]}
                onPress={()=>setFilterType(filterType===t?'':t)}>
                <Text style={[s.chipTxt,filterType===t&&s.chipTxtActive]}>{TYPE_META[t].emoji} {TYPE_META[t].label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Lista ─────────────────────────────────────── */}
        {displayed.length===0 ? (
          <View style={s.empty}>
            <Text style={{fontSize:44,marginBottom:12}}>🔍</Text>
            <Text style={s.emptyTxt}>Nenhum registro encontrado</Text>
          </View>
        ) : displayed.map(r=>{
          const meta = TYPE_META[r.record_type]||{label:r.record_type,emoji:'📄',color:'#94a3b8'};
          const sc   = STATUS_META[r.status]||{color:'#94a3b8'};
          return (
            <TouchableOpacity key={r.id} style={s.card} onPress={()=>openView(r)} activeOpacity={0.8}>
              <View style={[s.cardAccent,{backgroundColor:meta.color}]}/>
              <View style={{flex:1,padding:14}}>
                <View style={s.cardTop}>
                  <Text style={{fontSize:15}}>{meta.emoji}</Text>
                  <View style={[s.badge,{backgroundColor:meta.color+'18'}]}>
                    <Text style={[s.badgeTxt,{color:meta.color}]}>{meta.label}</Text>
                  </View>
                  {r.ai_status==='organized'&&(
                    <View style={s.aiTag}><Text style={s.aiTagTxt}>✨ IA</Text></View>
                  )}
                  <View style={[s.badge,{backgroundColor:sc.color+'18',marginLeft:'auto'}]}>
                    <Text style={[s.badgeTxt,{color:sc.color}]}>{r.status}</Text>
                  </View>
                </View>
                <Text style={s.cardTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={s.cardMeta}>👤 {r.patient_name||'—'}  ·  📅 {fmtDate(r.created_at)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{height:100}}/>
      </ScrollView>

      {/* ── FAB ─────────────────────────────────────────── */}
      <TouchableOpacity style={s.fab} onPress={()=>setShowTypeModal(true)}>
        <Text style={s.fabTxt}>+</Text>
      </TouchableOpacity>

      {/* ══ Modal: Tipo ════════════════════════════════════ */}
      <Modal visible={showTypeModal} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={()=>setShowTypeModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.sheetHandle}/>
            <Text style={s.sheetTitle}>NOVO REGISTRO</Text>
            <Text style={s.sheetSub}>Selecione o tipo de prontuário</Text>
            <View style={s.typeGrid}>
              {TYPES.map(t=>{
                const meta=TYPE_META[t];
                return (
                  <TouchableOpacity key={t} style={s.typeGridItem} onPress={()=>openNew(t)}>
                    <View style={[s.typeGridIcon,{backgroundColor:meta.color+'15'}]}>
                      <Text style={{fontSize:24}}>{meta.emoji}</Text>
                    </View>
                    <View style={s.typeGridText}>
                      <Text style={[s.typeGridLabel,{color:meta.color}]}>{meta.label}</Text>
                      <Text style={s.typeGridDesc}>{meta.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ══ Modal: Criar / Editar ══════════════════════════ */}
      <Modal visible={showFormModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>

          <View style={s.modalHeader}>
            <View style={{width:36}}/>
            <View style={{alignItems:'center'}}>
              <Text style={s.modalTitle}>
                {TYPE_META[form.record_type]?.emoji} {TYPE_META[form.record_type]?.label}
              </Text>
              {formMode==='edit'&&(
                <Text style={{fontSize:10,color:'#94a3b8',marginTop:1}}>Editando registro</Text>
              )}
            </View>
            <TouchableOpacity style={s.modalCloseBtn} onPress={()=>setShowFormModal(false)}>
              <Text style={s.modalCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Step bar — só Evolução */}
          {form.record_type==='Evolucao'&&(
            <View style={s.stepBar}>
              {[['input','1. Redigir'],['ai_result','2. Revisar IA']].map(([st,lb])=>(
                <TouchableOpacity key={st}
                  style={[s.stepItem, formStep===st&&s.stepItemActive]}
                  onPress={()=>{ if(st==='ai_result'&&!organized) return; setFormStep(st); }}>
                  <Text style={[s.stepTxt, formStep===st&&s.stepTxtActive]}>{lb}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <ScrollView style={{padding:20}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Paciente */}
            <Text style={s.fieldLabel}>PACIENTE *</Text>
            {form.patient_id ? (
              <TouchableOpacity style={[s.fieldInput,{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}]}
                onPress={()=>{setForm(f=>({...f,patient_id:''}));setPatSearch('');}}>
                <Text style={{color:BRAND,fontWeight:'700',fontSize:15}}>{patSearch}</Text>
                <Text style={{color:'#94a3b8',fontSize:12}}>trocar ✕</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput style={s.fieldInput} value={patSearch} onChangeText={setPatSearch}
                  placeholder="Digite o nome do paciente..." placeholderTextColor="#94a3b8"/>
                {patSearch.length>0&&(
                  <View style={s.dropdown}>
                    {filteredPats.length===0
                      ? <Text style={{color:'#94a3b8',padding:10,fontSize:13}}>Nenhum encontrado</Text>
                      : filteredPats.map(p=>(
                        <TouchableOpacity key={p.id} style={s.dropItem}
                          onPress={()=>{setForm(f=>({...f,patient_id:String(p.id)}));setPatSearch(p.name||p.full_name||'');}}>
                          <Text style={s.dropTitle}>{p.name||p.full_name}</Text>
                          {(p.phone||p.email)&&<Text style={s.dropSub}>{p.phone||p.email}</Text>}
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </>
            )}

            {/* Título */}
            <Text style={s.fieldLabel}>TÍTULO</Text>
            <TextInput style={s.fieldInput} value={form.title}
              onChangeText={v=>setForm(f=>({...f,title:v}))}
              placeholder="Título do registro..." placeholderTextColor="#94a3b8"/>

            {/* Data + Horário */}
            <View style={{flexDirection:'row',gap:8}}>
              <View style={{flex:2}}>
                <Text style={s.fieldLabel}>DATA</Text>
                <TextInput style={s.fieldInput} value={form.session_date}
                  onChangeText={v=>setForm(f=>({...f,session_date:v}))}
                  placeholder="AAAA-MM-DD" placeholderTextColor="#94a3b8"/>
              </View>
              <View style={{flex:1}}>
                <Text style={s.fieldLabel}>INÍCIO</Text>
                <TextInput style={s.fieldInput} value={form.start_time}
                  onChangeText={v=>setForm(f=>({...f,start_time:v}))}
                  placeholder="09:00" placeholderTextColor="#94a3b8"
                  keyboardType="numbers-and-punctuation"/>
              </View>
              <View style={{flex:1}}>
                <Text style={s.fieldLabel}>FIM</Text>
                <TextInput style={s.fieldInput} value={form.end_time}
                  onChangeText={v=>setForm(f=>({...f,end_time:v}))}
                  placeholder="10:00" placeholderTextColor="#94a3b8"
                  keyboardType="numbers-and-punctuation"/>
              </View>
            </View>

            {/* ── EVOLUÇÃO: rascunho livre ───────────────── */}
            {form.record_type==='Evolucao' && formStep==='input' && (
              <>
                <Text style={s.fieldLabel}>NOTAS DA SESSÃO</Text>
                <Text style={s.fieldHint}>
                  Redija livremente. A IA irá estruturar o conteúdo nos campos clínicos.
                </Text>
                <TextInput
                  style={[s.fieldInput,{height:220,textAlignVertical:'top'}]}
                  value={form.draft_content}
                  onChangeText={v=>setForm(f=>({...f,draft_content:v}))}
                  placeholder="Descreva o que aconteceu na sessão: relatos do paciente, observações clínicas, intervenções realizadas, como o paciente respondeu, planos para a próxima sessão..."
                  placeholderTextColor="#94a3b8"
                  multiline
                />
                <TouchableOpacity style={[s.aiOrgBtn,aiLoading&&{opacity:0.6}]}
                  onPress={organizeWithAI} disabled={aiLoading}>
                  {aiLoading
                    ? <><ActivityIndicator color="#fff" size="small" style={{marginRight:8}}/><Text style={s.aiOrgBtnTxt}>Organizando...</Text></>
                    : <Text style={s.aiOrgBtnTxt}>✨ Organizar com IA</Text>
                  }
                </TouchableOpacity>
              </>
            )}

            {/* ── EVOLUÇÃO: resultado da IA ──────────────── */}
            {form.record_type==='Evolucao' && formStep==='ai_result' && organized && (
              <>
                <View style={s.aiResultBanner}>
                  <Text style={s.aiResultBannerTxt}>
                    ✨ Conteúdo organizado pela IA — revise e edite se necessário
                  </Text>
                </View>
                {ORGANIZED_FIELDS.map(f=>(
                  <View key={f.key}>
                    <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:6}}>
                      <Text style={{fontSize:13}}>{f.emoji}</Text>
                      <Text style={[s.fieldLabel,{marginBottom:0,color:ACCENT}]}>
                        {f.label.toUpperCase()}
                      </Text>
                    </View>
                    <TextInput
                      style={[s.fieldInput,{height:80,textAlignVertical:'top'}]}
                      value={organized[f.key]||''}
                      onChangeText={v=>setOrganized(o=>({...o,[f.key]:v}))}
                      placeholder={`${f.label}...`}
                      placeholderTextColor="#94a3b8"
                      multiline
                    />
                  </View>
                ))}
                {reviewPts.length>0&&(
                  <View style={s.reviewBox}>
                    <Text style={s.reviewTitle}>⚠️ Pontos de revisão</Text>
                    {reviewPts.map((pt,i)=><Text key={i} style={s.reviewPt}>· {pt}</Text>)}
                  </View>
                )}
                <TouchableOpacity style={s.backBtn} onPress={()=>setFormStep('input')}>
                  <Text style={s.backBtnTxt}>← Voltar ao rascunho</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── AVALIAÇÃO: vincular fontes ────────────────── */}
            {form.record_type==='Avaliacao' && (
              <View style={s.sourceLinkBox}>
                <Text style={s.fieldLabel}>FONTES PIN-CLÍNICO</Text>
                <TouchableOpacity 
                  style={s.linkSourceBtn}
                  onPress={() => setShowSourceSelector(true)}
                >
                  <Text style={{fontSize:18}}>🔗</Text>
                  <Text style={s.linkSourceTxt}>
                    {form.linkedSources.length > 0 
                      ? `${form.linkedSources.length} Fontes vinculadas` 
                      : "Vincular testes e anamneses"}
                  </Text>
                  <Text style={{fontSize:18, color:ACCENT}}>❯</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── OUTROS TIPOS: campos estruturados ─────── */}
            {form.record_type!=='Evolucao' && (
              (TYPE_FIELDS[form.record_type]||[]).map((field,idx)=>{
                if (field.section) return (
                  <View key={`sec-${idx}`} style={s.sectionDivider}>
                    <View style={s.sectionLine}/>
                    <Text style={s.sectionLabel}>{field.section}</Text>
                    <View style={s.sectionLine}/>
                  </View>
                );
                return (
                  <View key={field.key}>
                    <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:6}}>
                      {field.emoji&&<Text style={{fontSize:13}}>{field.emoji}</Text>}
                      <Text style={[s.fieldLabel,{marginBottom:0}]}>
                        {field.label.toUpperCase()}{field.required?' *':''}
                      </Text>
                    </View>
                    <TextInput
                      style={[s.fieldInput,field.multiline&&{height:(field.rows||3)*42,textAlignVertical:'top'}]}
                      value={form.typed_content[field.key]||''}
                      onChangeText={v=>setForm(f=>({...f,typed_content:{...f.typed_content,[field.key]:v}}))}
                      placeholder={field.hint||''}
                      placeholderTextColor="#94a3b8"
                      multiline={field.multiline}
                    />
                  </View>
                );
              })
            )}

            {/* Tags */}
            <Text style={[s.fieldLabel,{marginTop:4}]}>TAGS</Text>
            <TextInput style={s.fieldInput} value={form.tags}
              onChangeText={v=>setForm(f=>({...f,tags:v}))}
              placeholder="Ex: ansiedade, TCC, evolução (separadas por vírgula)"
              placeholderTextColor="#94a3b8"/>

            {/* Campo Restrito */}
            <View style={s.restrictedFieldBox}>
              <Text style={s.restrictedFieldLabel}>🔒 CAMPO RESTRITO (sigiloso)</Text>
              <TextInput
                style={[s.fieldInput,{height:80,textAlignVertical:'top',
                  backgroundColor:'#fff5f5',borderColor:'#fecaca',marginBottom:0}]}
                value={form.restricted_content}
                onChangeText={v=>setForm(f=>({...f,restricted_content:v}))}
                placeholder="Anotações sigilosas — visíveis apenas com senha"
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>
            <View style={{height:20}}/>
          </ScrollView>

          {/* Rodapé */}
          <View style={s.modalFooter}>
            <TouchableOpacity style={s.modalCancelBtn} onPress={()=>setShowFormModal(false)}>
              <Text style={s.modalCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            {form.record_type==='Evolucao' && formStep==='input' && (
              <TouchableOpacity style={[s.aiSmallBtn,aiLoading&&{opacity:0.6}]}
                onPress={organizeWithAI} disabled={aiLoading}>
                {aiLoading
                  ? <ActivityIndicator color="#fff" size="small"/>
                  : <Text style={s.aiSmallBtnTxt}>✨ IA</Text>
                }
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.modalSaveBtn,{backgroundColor:TYPE_META[form.record_type]?.color||ACCENT}]}
              onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small"/>
                : <Text style={s.modalSaveTxt}>{formMode==='edit'?'Atualizar':'Salvar'}</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══ Modal: Ver registro ════════════════════════════ */}
      <Modal visible={showViewModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalHeader}>
          <TouchableOpacity style={s.modalCloseBtn} onPress={()=>setShowViewModal(false)}>
            <Text style={s.modalCloseTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={s.modalTitle}>Prontuário</Text>
          {viewRecord&&(
            <TouchableOpacity style={[s.modalCloseBtn,{backgroundColor:'#f0f4ff'}]}
              onPress={()=>openEdit(viewRecord)}>
              <Text style={{fontSize:14,color:ACCENT}}>✏️</Text>
            </TouchableOpacity>
          )}
        </View>

        {viewLoading ? (
          <View style={s.center}><ActivityIndicator size="large" color={ACCENT}/></View>
        ) : viewRecord&&(()=>{
          const meta = TYPE_META[viewRecord.record_type]||{label:viewRecord.record_type,emoji:'📄',color:'#94a3b8'};
          const sc   = STATUS_META[viewRecord.status]||{color:'#94a3b8'};
          let orgData=null;
          if (viewRecord.ai_organized_content) {
            try {
              orgData = typeof viewRecord.ai_organized_content==='string'
                ? JSON.parse(viewRecord.ai_organized_content)
                : viewRecord.ai_organized_content;
            } catch {}
          }
          let typedData=null;
          if (!orgData && viewRecord.content) {
            try { typedData=JSON.parse(viewRecord.content); } catch {}
          }
          const typeFields = viewRecord.record_type!=='Evolucao'
            ? (TYPE_FIELDS[viewRecord.record_type]||[])
            : [];
          const tags = Array.isArray(viewRecord.tags)
            ? viewRecord.tags
            : (viewRecord.tags||'').split(',').map(t=>t.trim()).filter(Boolean);

          return (
            <ScrollView contentContainerStyle={{padding:20,paddingBottom:60}}
              showsVerticalScrollIndicator={false}>

              {/* Badges */}
              <View style={{flexDirection:'row',gap:8,flexWrap:'wrap',marginBottom:16}}>
                <View style={[s.badge,{backgroundColor:meta.color+'18'}]}>
                  <Text style={[s.badgeTxt,{color:meta.color}]}>{meta.emoji} {meta.label}</Text>
                </View>
                <View style={[s.badge,{backgroundColor:sc.color+'18'}]}>
                  <Text style={[s.badgeTxt,{color:sc.color}]}>{viewRecord.status}</Text>
                </View>
                {viewRecord.ai_status==='organized'&&(
                  <View style={s.aiTag}><Text style={s.aiTagTxt}>✨ IA</Text></View>
                )}
                {viewRecord.approved_at&&(
                  <View style={[s.badge,{backgroundColor:'#dcfce7'}]}>
                    <Text style={[s.badgeTxt,{color:'#10b981'}]}>
                      ✓ Aprovado {fmtDate(viewRecord.approved_at)}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={s.viewTitle}>{viewRecord.title}</Text>

              {/* Meta */}
              <View style={s.metaCard}>
                {[
                  {icon:'👤', lbl:'PACIENTE',    val:viewRecord.patient_name||'—'},
                  {icon:'⚕️', lbl:'PROFISSIONAL', val:viewRecord.professional_name||'—'},
                  {icon:'📅', lbl:'DATA',         val:fmtDate(viewRecord.created_at)},
                  ...(viewRecord.start_time ? [{
                    icon:'⏱️', lbl:'HORÁRIO',
                    val:`${viewRecord.start_time}${viewRecord.end_time?' – '+viewRecord.end_time:''}`
                  }] : []),
                ].map((m,i)=>(
                  <View key={i} style={s.metaRow}>
                    <Text style={s.metaIcon}>{m.icon}</Text>
                    <View>
                      <Text style={s.metaLbl}>{m.lbl}</Text>
                      <Text style={s.metaVal}>{m.val}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Tags */}
              {tags.length>0&&(
                <View style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:16}}>
                  {tags.map((t,i)=>(
                    <View key={i} style={s.tagChip}>
                      <Text style={s.tagChipTxt}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Conteúdo organizado por IA (Evolução) */}
              {orgData && viewRecord.record_type==='Evolucao' && (
                <View style={{gap:12}}>
                  {ORGANIZED_FIELDS.filter(f=>orgData[f.key]?.trim()).map(f=>(
                    <View key={f.key} style={s.organizedField}>
                      <Text style={[s.organizedFieldLabel,{color:meta.color}]}>
                        {f.emoji} {f.label.toUpperCase()}
                      </Text>
                      <Text style={s.organizedFieldTxt}>{orgData[f.key]}</Text>
                    </View>
                  ))}
                  {orgData.pontos_revisao?.length>0&&(
                    <View style={s.reviewBox}>
                      <Text style={s.reviewTitle}>⚠️ Pontos de revisão</Text>
                      {orgData.pontos_revisao.map((pt,i)=>(
                        <Text key={i} style={s.reviewPt}>· {pt}</Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Conteúdo tipado (outros tipos) */}
              {typedData && typeFields.filter(f=>f.key&&typedData[f.key]).length>0 && (
                <View style={{gap:12}}>
                  {typeFields.filter(f=>f.key&&typedData[f.key]).map(f=>(
                    <View key={f.key} style={s.organizedField}>
                      <Text style={[s.organizedFieldLabel,{color:meta.color}]}>
                        {f.emoji||''} {f.label.toUpperCase()}
                      </Text>
                      <Text style={s.organizedFieldTxt}>{typedData[f.key]}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Raw fallback */}
              {!orgData && (!typedData || !typeFields.filter(f=>f.key).length) && (
                <View style={s.rawBox}>
                  <Text style={s.rawLbl}>CONTEÚDO</Text>
                  <Text style={s.rawTxt}>
                    {strip(viewRecord.draft_content||viewRecord.content||'Sem conteúdo.')}
                  </Text>
                </View>
              )}

              {/* Campo Restrito */}
              <View style={s.restrictedBox}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                  <Text style={s.restrictedTitle}>🔒 CAMPO RESTRITO</Text>
                  {!restrictedContent&&(
                    <TouchableOpacity style={s.unlockBtn}
                      onPress={()=>{setPwModal({action:'restrict',recordId:viewRecord.id});setPassword('');}}>
                      <Text style={s.unlockTxt}>DESBLOQUEAR</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {restrictedContent
                  ? <Text style={s.restrictedTxt}>{restrictedContent}</Text>
                  : <Text style={s.restrictedHint}>Conteúdo sigiloso protegido por senha</Text>
                }
              </View>

              {/* Auditoria */}
              {auditTrail.length>0&&(
                <TouchableOpacity style={s.auditToggle} onPress={()=>setShowAudit(v=>!v)}>
                  <Text style={s.auditToggleTxt}>
                    {showAudit?'▾':'▸'} Histórico ({auditTrail.length} eventos)
                  </Text>
                </TouchableOpacity>
              )}
              {showAudit&&(
                <View style={s.auditList}>
                  {auditTrail.map((a,i)=>(
                    <View key={i} style={s.auditItem}>
                      <View style={[s.auditDot,{
                        backgroundColor: a.action==='approved'?'#10b981'
                          : a.action==='ai_organized'?'#7c3aed'
                          : '#94a3b8'
                      }]}/>
                      <View style={{flex:1}}>
                        <Text style={s.auditAction}>{ACTION_LABELS[a.action]||a.action}</Text>
                        <Text style={s.auditMeta}>{a.user_name||'Sistema'} · {fmtDate(a.created_at)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Ações */}
              <View style={s.detailActions}>
                {viewRecord.ai_status!=='organized' && viewRecord.record_type==='Evolucao' && (
                  <TouchableOpacity style={s.aiBtn} onPress={organizeExisting} disabled={aiLoading}>
                    {aiLoading
                      ? <ActivityIndicator color="#fff"/>
                      : <Text style={s.aiBtnTxt}>✨ Organizar com IA</Text>
                    }
                  </TouchableOpacity>
                )}
                {['Rascunho','Organizado','Revisado'].includes(viewRecord.status)&&(
                  <TouchableOpacity style={s.approveBtn}
                    onPress={()=>{setPwModal({action:'approve',recordId:viewRecord.id});setPassword('');}}>
                    <Text style={s.approveTxt}>✓ Aprovar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.deleteBtn} onPress={()=>deleteRecord(viewRecord.id)}>
                  <Text style={s.deleteTxt}>🗑️ Excluir</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          );
        })()}
      </Modal>

      {/* ══ Modal: Senha ═══════════════════════════════════ */}
      <Modal visible={!!pwModal} transparent animationType="fade">
        <View style={s.gateOverlay}>
          <View style={s.gateBox}>
            <Text style={s.gateTitle}>
              {pwModal?.action==='approve'?'🔐 Aprovar Registro':'🔒 Campo Restrito'}
            </Text>
            <Text style={s.gateDesc}>
              {pwModal?.action==='approve'
                ? 'Confirme sua senha para aprovar e assinar este registro.'
                : 'Digite sua senha para acessar as anotações sigilosas.'}
            </Text>
            <TextInput style={s.gateInput} value={password} onChangeText={setPassword}
              secureTextEntry placeholder="Senha..." autoFocus placeholderTextColor="#94a3b8"/>
            <View style={s.gateFooter}>
              <TouchableOpacity style={s.gateCancel}
                onPress={()=>{setPwModal(null);setPassword('');}}>
                <Text style={s.gateCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.gateConfirm,{
                  backgroundColor: pwModal?.action==='approve'?'#10b981':BRAND
                }]}
                onPress={confirmPassword} disabled={pwLoading}>
                {pwLoading
                  ? <ActivityIndicator color="#fff"/>
                  : <Text style={s.gateConfirmTxt}>
                      {pwModal?.action==='approve'?'Aprovar':'Desbloquear'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* ══ Modal: Enviar Anamnese ════════════════════════ */}
      <Modal visible={showSendAnamnesisModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalHeader}>
           <Text style={s.modalTitle}>ENVIAR ANAMNESE</Text>
           <TouchableOpacity style={s.modalCloseBtn} onPress={()=>setShowSendAnamnesisModal(false)}>
              <Text style={s.modalCloseTxt}>✕</Text>
           </TouchableOpacity>
        </View>
        <ScrollView style={{padding:20}} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>TÍTULO DO FORMULÁRIO *</Text>
            <TextInput 
              style={s.fieldInput} 
              value={anamnesisData.title}
              onChangeText={v => setAnamnesisData({...anamnesisData, title: v})}
              placeholder="Ex: Anamnese Inicial"
            />

            <Text style={s.fieldLabel}>MENSAGEM DE BOAS-VINDAS (OPCIONAL)</Text>
            <TextInput 
              style={[s.fieldInput, {height: 100, textAlignVertical: 'top'}]}
              value={anamnesisData.welcomeMessage}
              onChangeText={v => setAnamnesisData({...anamnesisData, welcomeMessage: v})}
              placeholder="Ex: Olá! Por favor, preencha este formulário..."
              multiline
            />

            <Text style={s.fieldLabel}>VERSÃO</Text>
            <View style={{flexDirection:'row', gap:10, marginBottom:16}}>
               {[['full','Completa','~15min'],['short','Rápida','~5min']].map(([v,l,t]) => (
                 <TouchableOpacity 
                   key={v} 
                   style={[s.versionCard, anamnesisData.version === v && s.versionCardActive]}
                   onPress={() => setAnamnesisData({...anamnesisData, version: v})}
                 >
                    <Text style={[s.versionLabel, anamnesisData.version === v && {color: ACCENT}]}>{l}</Text>
                    <Text style={s.versionTime}>{t}</Text>
                 </TouchableOpacity>
               ))}
            </View>

            <Text style={s.fieldLabel}>CONFIGURAÇÕES</Text>
            {[
              { label: 'Continuar em etapas', sub: 'Salva o progresso', val: anamnesisData.allowResume, key: 'allowResume' },
              { label: 'Editar após envio', sub: 'Permite correções', val: anamnesisData.allowEditAfterSubmit, key: 'allowEditAfterSubmit' },
            ].map(opt => (
              <TouchableOpacity 
                key={opt.key}
                style={[s.optionItem, opt.val && {borderColor: ACCENT, backgroundColor: ACCENT+'05'}]}
                onPress={() => setAnamnesisData({...anamnesisData, [opt.key]: !opt.val})}
              >
                 <View style={{flex:1}}>
                    <Text style={s.optionTitle}>{opt.label}</Text>
                    <Text style={s.optionSub}>{opt.sub}</Text>
                 </View>
                 <Switch value={opt.val} onValueChange={v => setAnamnesisData({...anamnesisData, [opt.key]: v})} trackColor={{ true: ACCENT }} />
              </TouchableOpacity>
            ))}

            <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
              <View style={{flex: 1}}>
                <Text style={s.fieldLabel}>EXPIRA EM</Text>
                <TouchableOpacity 
                   style={s.fieldInput}
                   onPress={() => {
                     const opts = [
                       { label: 'Sem expiração', val: null },
                       { label: '24 Horas', val: 24 },
                       { label: '48 Horas', val: 48 },
                       { label: '7 Dias', val: 168 },
                       { label: '30 Dias', val: 720 },
                     ];
                     Alert.alert('Expiração', 'Selecione em quanto tempo o link expira:', 
                       opts.map(o => ({ text: o.label, onPress: () => setAnamnesisData({...anamnesisData, expiresHours: o.val}) }))
                     );
                   }}
                >
                  <Text style={{color: BRAND, fontWeight: '700', fontSize: 14}}>
                    {anamnesisData.expiresHours ? `${anamnesisData.expiresHours < 168 ? anamnesisData.expiresHours + 'h' : Math.floor(anamnesisData.expiresHours/24) + ' d'}` : 'Sem expiração'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{flex: 1}}>
                <Text style={s.fieldLabel}>LEMBRAR EM</Text>
                <TouchableOpacity 
                   style={s.fieldInput}
                   onPress={() => {
                     const opts = [
                       { label: 'Sem lembrete', val: null },
                       { label: '24 Horas', val: 24 },
                       { label: '48 Horas', val: 48 },
                       { label: '3 Dias', val: 72 },
                       { label: '7 Dias', val: 168 },
                     ];
                     Alert.alert('Lembrete Automático', 'Se o paciente não responder, enviar um lembrete em:', 
                       opts.map(o => ({ text: o.label, onPress: () => setAnamnesisData({...anamnesisData, reminderHours: o.val}) }))
                     );
                   }}
                >
                  <Text style={{color: BRAND, fontWeight: '700', fontSize: 14}}>
                    {anamnesisData.reminderHours ? `${anamnesisData.reminderHours < 72 ? anamnesisData.reminderHours + 'h' : Math.floor(anamnesisData.reminderHours/24) + ' d'}` : 'Sem lembrete'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[s.fieldLabel, {marginTop: 16}]}>ABORDAGEM (PARA GUIA IA)</Text>
            <TouchableOpacity 
               style={s.fieldInput}
               onPress={() => {
                 const opts = [
                   { label: 'Não especificar', val: '' },
                   { label: 'TCC — Terapia Cognitivo-Comportamental', val: 'tcc' },
                   { label: 'Psicanálise', val: 'psicanalise' },
                   { label: 'Humanista / Rogersiana', val: 'humanista' },
                   { label: 'ACT — Terapia de Aceitação e Compromisso', val: 'act' },
                   { label: 'Sistêmica / Familiar', val: 'sistemica' },
                   { label: 'Integrativa', val: 'integrativa' },
                 ];
                 Alert.alert('Abordagem Clínica', 'A Aurora IA usará esta abordagem para organizar as respostas do paciente:', 
                   opts.map(o => ({ text: o.label, onPress: () => setAnamnesisData({...anamnesisData, approach: o.val}) }))
                 );
               }}
            >
              <Text style={{color: BRAND, fontWeight: '700', fontSize: 14}}>
                {anamnesisData.approach ? anamnesisData.approach.toUpperCase() : 'Não especificar'}
              </Text>
            </TouchableOpacity>
            <Text style={s.fieldHint}>A IA usará esta abordagem para organizar as respostas.</Text>

            <View style={s.infoBox}>
               <Text style={{fontSize:18}}>💡</Text>
               <Text style={s.infoText}>
                 As respostas do paciente não vão direto para o prontuário. Você precisará revisar e aprovar antes.
               </Text>
            </View>

            <TouchableOpacity style={s.aiOrgBtn} onPress={handleSendAnamnesis} disabled={saving}>
               {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.aiOrgBtnTxt}>Gerar e Enviar Link</Text>}
            </TouchableOpacity>
            <View style={{height:40}} />
        </ScrollView>
      </Modal>

      {/* ══ Modal: Selecionar Fontes ════════════════════════ */}
      <Modal visible={showSourceSelector} transparent animationType="slide">
        <View style={s.overlay}>
           <View style={[s.sheet, {height: '80%'}]}>
              <View style={s.sheetHandle}/>
              <Text style={s.sheetTitle}>VINCULAR FONTES</Text>
              <Text style={s.sheetSub}>Selecione anamneses e testes realizados</Text>
              
              {sourcesLoading ? (
                <ActivityIndicator color={ACCENT} style={{marginTop: 50}} />
              ) : (
                <ScrollView style={{flex:1}}>
                   {sources.length === 0 ? (
                     <Text style={{textAlign:'center', color:'#94a3b8', marginTop:40}}>Sem fontes disponíveis para este paciente.</Text>
                   ) : sources.map(item => (
                     <TouchableOpacity 
                       key={item.id} 
                       style={[s.sourceItem, form.linkedSources.includes(item.id) && s.sourceItemActive]}
                       onPress={() => {
                         const exists = form.linkedSources.includes(item.id);
                         setForm(f => ({
                           ...f, 
                           linkedSources: exists 
                             ? f.linkedSources.filter(id => id !== item.id) 
                             : [...f.linkedSources, item.id]
                         }));
                       }}
                     >
                        <View style={{flex:1}}>
                           <Text style={s.sourceCat}>{item.category}</Text>
                           <Text style={s.sourceName}>{item.name}</Text>
                           <Text style={s.sourceDate}>{fmtDate(item.date)}</Text>
                        </View>
                        {form.linkedSources.includes(item.id) && <Text style={{fontSize:20}}>✅</Text>}
                     </TouchableOpacity>
                   ))}
                </ScrollView>
              )}
              <TouchableOpacity style={s.saveBtn} onPress={() => setShowSourceSelector(false)}>
                 <Text style={s.saveBtnTxt}>Concluir Seleção ({form.linkedSources.length})</Text>
              </TouchableOpacity>
           </View>
        </View>
      </Modal>
    </View>
  );
}

/* ══ Estilos ═══════════════════════════════════════════════ */
const s = StyleSheet.create({
  container: {flex:1, backgroundColor:'#f8fafc'},
  center:    {flex:1, justifyContent:'center', alignItems:'center'},

  /* Stats */
  statsRow: {flexDirection:'row', backgroundColor:'#fff', paddingVertical:14, paddingHorizontal:8, borderBottomWidth:1, borderBottomColor:'#f1f5f9'},
  statBox:  {flex:1, alignItems:'center'},
  statVal:  {fontSize:20, fontWeight:'900'},
  statLbl:  {fontSize:10, color:'#94a3b8', fontWeight:'700', marginTop:2},

  /* Charts */
  chartsRow:    {flexDirection:'row', gap:10, padding:14, paddingTop:12},
  chartCard:    {backgroundColor:'#fff', borderRadius:16, padding:14, borderWidth:1, borderColor:'#f1f5f9', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4, elevation:2},
  chartTitle:   {fontSize:11, fontWeight:'800', color:'#64748b', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12},
  monthBars:    {flexDirection:'row', alignItems:'flex-end', gap:6, height:60},
  monthBar:     {flex:1, alignItems:'center', gap:2},
  monthBarCount:{fontSize:9, fontWeight:'700', color:'#64748b', minHeight:12},
  monthBarTrack:{flex:1, width:14, backgroundColor:'#f1f5f9', borderRadius:4, overflow:'hidden', justifyContent:'flex-end'},
  monthBarFill: {width:'100%', borderRadius:4},
  monthBarLabel:{fontSize:9, fontWeight:'700', color:'#94a3b8'},
  typeBarRow:   {flexDirection:'row', alignItems:'center', gap:6, marginBottom:8},
  typeBarEmoji: {fontSize:12},
  typeBarLabel: {fontSize:10, fontWeight:'700', color:'#475569', marginBottom:2},
  typeBarTrack: {height:5, backgroundColor:'#f1f5f9', borderRadius:3, overflow:'hidden'},
  typeBarFill:  {height:'100%', borderRadius:3},
  typeBarCount: {fontSize:11, fontWeight:'900', minWidth:18, textAlign:'right'},

  /* Controls sticky */
  controls:   {backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#e2e8f0'},
  searchInput:{backgroundColor:'#f1f5f9', borderRadius:14, paddingHorizontal:16, paddingVertical:12, fontSize:15, color:BRAND, margin:14, marginBottom:10},
  chip:       {paddingHorizontal:14, paddingVertical:7, borderRadius:20, backgroundColor:'#f1f5f9'},
  chipActive: {backgroundColor:BRAND},
  chipTxt:    {fontSize:12, fontWeight:'700', color:'#64748b'},
  chipTxtActive:{color:'#fff'},

  /* Card */
  card:      {backgroundColor:'#fff', borderRadius:16, marginHorizontal:12, marginBottom:10, flexDirection:'row', overflow:'hidden', shadowColor:'#1a3a5c', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:6, elevation:2, borderWidth:1, borderColor:'#f1f5f9'},
  cardAccent:{width:5},
  cardTop:   {flexDirection:'row', gap:6, marginBottom:8, alignItems:'center'},
  badge:     {paddingHorizontal:9, paddingVertical:3, borderRadius:8},
  badgeTxt:  {fontSize:10, fontWeight:'900', textTransform:'uppercase'},
  aiTag:     {backgroundColor:'#f5f3ff', paddingHorizontal:8, paddingVertical:3, borderRadius:8},
  aiTagTxt:  {fontSize:10, fontWeight:'800', color:'#7c3aed'},
  cardTitle: {fontSize:15, fontWeight:'800', color:BRAND, marginBottom:6},
  cardMeta:  {fontSize:12, color:'#64748b', fontWeight:'600'},
  empty:     {alignItems:'center', paddingTop:80},
  emptyTxt:  {color:'#94a3b8', fontSize:15, fontWeight:'600'},

  /* FAB */
  fab:    {position:'absolute', right:22, bottom:24, width:60, height:60, borderRadius:30, backgroundColor:BRAND, alignItems:'center', justifyContent:'center', shadowColor:BRAND, shadowOffset:{width:0,height:4}, shadowOpacity:0.4, shadowRadius:10, elevation:10},
  fabTxt: {color:'#fff', fontSize:34, fontWeight:'300', marginTop:-3},

  /* Sheet */
  overlay:       {flex:1, backgroundColor:'rgba(15,23,42,0.55)', justifyContent:'flex-end'},
  sheet:         {backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:40},
  sheetHandle:   {width:40, height:4, borderRadius:2, backgroundColor:'#e2e8f0', alignSelf:'center', marginBottom:18},
  sheetTitle:    {fontSize:16, fontWeight:'900', color:BRAND, textAlign:'center'},
  sheetSub:      {fontSize:13, color:'#94a3b8', textAlign:'center', marginTop:4, marginBottom:20},
  typeGrid:      {flexDirection:'column', gap:10, paddingBottom: 20},
  typeGridItem:  {flexDirection:'row', alignItems:'center', gap:14, padding:12, borderRadius:16, backgroundColor:'#f8fafc', borderWidth:1, borderColor:'#f1f5f9'},
  typeGridIcon:  {width:56, height:56, borderRadius:16, alignItems:'center', justifyContent:'center'},
  typeGridText:  {flex:1},
  typeGridLabel: {fontSize:14, fontWeight:'900', textTransform:'uppercase'},
  typeGridDesc:  {fontSize:11, color:'#94a3b8', marginTop:2, fontWeight:'500'},

  /* Modal */
  modalHeader:   {flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#f1f5f9', backgroundColor:'#fff'},
  modalTitle:    {fontSize:16, fontWeight:'900', color:BRAND, flex:1, textAlign:'center'},
  modalCloseBtn: {width:34, height:34, borderRadius:17, backgroundColor:'#f1f5f9', alignItems:'center', justifyContent:'center'},
  modalCloseTxt: {fontSize:13, fontWeight:'900', color:'#64748b'},
  modalFooter:   {flexDirection:'row', alignItems:'center', justifyContent:'flex-end', gap:8, paddingHorizontal:20, paddingVertical:12, paddingBottom:28, borderTopWidth:1, borderTopColor:'#f1f5f9', backgroundColor:'#fff'},
  modalCancelBtn:{paddingVertical:9, paddingHorizontal:16, borderRadius:10, borderWidth:1, borderColor:'#e2e8f0'},
  modalCancelTxt:{fontSize:13, fontWeight:'600', color:'#94a3b8'},
  modalSaveBtn:  {paddingVertical:9, paddingHorizontal:20, borderRadius:10, alignItems:'center', shadowOffset:{width:0,height:2}, shadowOpacity:0.2, shadowRadius:4, elevation:3},
  modalSaveTxt:  {fontSize:13, fontWeight:'700', color:'#fff'},

  /* Step bar */
  stepBar:       {flexDirection:'row', backgroundColor:'#f8fafc', borderBottomWidth:1, borderBottomColor:'#e2e8f0'},
  stepItem:      {flex:1, paddingVertical:10, alignItems:'center'},
  stepItemActive:{borderBottomWidth:2, borderBottomColor:ACCENT},
  stepTxt:       {fontSize:12, fontWeight:'700', color:'#94a3b8'},
  stepTxtActive: {color:ACCENT},

  /* Fields */
  fieldLabel:  {fontSize:10, fontWeight:'900', color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5, marginTop:8},
  fieldHint:   {fontSize:12, color:'#94a3b8', marginBottom:8, lineHeight:18},
  fieldInput:  {borderWidth:1.5, borderColor:'#e2e8f0', borderRadius:12, paddingHorizontal:14, paddingVertical:12, fontSize:15, color:BRAND, backgroundColor:'#f8fafc', marginBottom:12},
  dropdown:    {backgroundColor:'#fff', borderRadius:12, marginBottom:10, borderWidth:1, borderColor:'#e2e8f0', overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.07, shadowRadius:6, elevation:4},
  dropItem:    {padding:13, borderBottomWidth:1, borderBottomColor:'#f1f5f9'},
  dropTitle:   {fontWeight:'700', color:BRAND},
  dropSub:     {fontSize:12, color:'#64748b', marginTop:2},

  sectionDivider:{flexDirection:'row', alignItems:'center', gap:10, marginVertical:14},
  sectionLine:   {flex:1, height:1, backgroundColor:'#e2e8f0'},
  sectionLabel:  {fontSize:11, fontWeight:'900', color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5},

  restrictedFieldBox:  {backgroundColor:'#fff5f5', borderRadius:14, padding:14, marginBottom:14, borderWidth:1, borderColor:'#fecaca'},
  restrictedFieldLabel:{fontSize:10, fontWeight:'900', color:'#ef4444', marginBottom:8, textTransform:'uppercase', letterSpacing:0.5},

  /* AI */
  aiOrgBtn:      {flexDirection:'row', alignItems:'center', justifyContent:'center', backgroundColor:'#7c3aed', borderRadius:14, paddingVertical:13, marginBottom:14, gap:8},
  aiOrgBtnTxt:   {color:'#fff', fontWeight:'800', fontSize:14},
  aiSmallBtn:    {paddingVertical:9, paddingHorizontal:14, borderRadius:10, backgroundColor:'#7c3aed', alignItems:'center'},
  aiSmallBtnTxt: {fontSize:12, fontWeight:'800', color:'#fff'},
  aiResultBanner:{backgroundColor:'#f5f3ff', borderRadius:12, padding:12, marginBottom:16, borderWidth:1, borderColor:'#ddd6fe'},
  aiResultBannerTxt:{fontSize:13, color:'#7c3aed', fontWeight:'700'},

  reviewBox:  {backgroundColor:'#fffbeb', borderRadius:12, padding:12, marginBottom:12, borderWidth:1, borderColor:'#fde68a'},
  reviewTitle:{fontSize:12, fontWeight:'800', color:'#92400e', marginBottom:6},
  reviewPt:   {fontSize:13, color:'#78350f', lineHeight:20},

  backBtn:    {paddingVertical:10, alignItems:'center', marginBottom:8},
  backBtnTxt: {fontSize:13, color:'#94a3b8', fontWeight:'600'},

  /* View */
  viewTitle: {fontSize:20, fontWeight:'900', color:BRAND, marginBottom:16},
  metaCard:  {backgroundColor:'#f8fafc', borderRadius:14, padding:14, marginBottom:16, gap:12, borderWidth:1, borderColor:'#e2e8f0'},
  metaRow:   {flexDirection:'row', alignItems:'center', gap:10},
  metaIcon:  {fontSize:18},
  metaLbl:   {fontSize:9, fontWeight:'900', color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5},
  metaVal:   {fontSize:14, fontWeight:'700', color:BRAND},

  tagChip:    {backgroundColor:'#f1f5f9', borderRadius:20, paddingHorizontal:10, paddingVertical:4},
  tagChipTxt: {fontSize:12, color:'#475569', fontWeight:'600'},

  organizedField:      {backgroundColor:'#fff', borderRadius:14, padding:14, borderWidth:1, borderColor:'#e2e8f0', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.04, shadowRadius:4, elevation:1},
  organizedFieldLabel: {fontSize:10, fontWeight:'900', marginBottom:8, textTransform:'uppercase', letterSpacing:0.5},
  organizedFieldTxt:   {fontSize:14, color:'#334155', lineHeight:22},

  rawBox: {backgroundColor:'#f8fafc', borderRadius:14, padding:14, marginBottom:12, borderWidth:1, borderColor:'#e2e8f0'},
  rawLbl: {fontSize:10, fontWeight:'900', color:'#94a3b8', marginBottom:8, textTransform:'uppercase', letterSpacing:0.5},
  rawTxt: {fontSize:14, color:'#334155', lineHeight:22},

  restrictedBox:  {backgroundColor:'#fff5f5', borderRadius:14, padding:14, marginTop:16, borderWidth:1, borderColor:'#fecaca'},
  restrictedTitle:{fontSize:12, fontWeight:'900', color:'#ef4444'},
  restrictedHint: {fontSize:13, color:'#94a3b8', marginTop:6},
  restrictedTxt:  {fontSize:13, color:'#334155', marginTop:6, lineHeight:20},
  unlockBtn:      {backgroundColor:'#ef4444', paddingHorizontal:12, paddingVertical:6, borderRadius:8},
  unlockTxt:      {color:'#fff', fontSize:11, fontWeight:'900'},

  auditToggle:   {paddingVertical:12, alignItems:'center', marginTop:16},
  auditToggleTxt:{fontSize:13, color:'#6366f1', fontWeight:'700'},
  auditList:     {backgroundColor:'#f8fafc', borderRadius:12, padding:12, gap:10, borderWidth:1, borderColor:'#e2e8f0'},
  auditItem:     {flexDirection:'row', alignItems:'flex-start', gap:10},
  auditDot:      {width:8, height:8, borderRadius:4, marginTop:5},
  auditAction:   {fontSize:13, fontWeight:'700', color:BRAND},
  auditMeta:     {fontSize:11, color:'#94a3b8', marginTop:2},

  detailActions: {flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:20},
  aiBtn:         {flex:1, backgroundColor:'#7c3aed', paddingVertical:12, borderRadius:14, alignItems:'center'},
  aiBtnTxt:      {color:'#fff', fontWeight:'800', fontSize:13},
  approveBtn:    {flex:1, backgroundColor:'#10b981', paddingVertical:12, borderRadius:14, alignItems:'center'},
  approveTxt:    {color:'#fff', fontWeight:'800', fontSize:13},
  deleteBtn:     {paddingVertical:12, paddingHorizontal:16, borderRadius:14, borderWidth:1.5, borderColor:'#fecaca', alignItems:'center'},
  deleteTxt:     {color:'#ef4444', fontWeight:'700', fontSize:13},

  /* Password gate */
  gateOverlay:  {flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', padding:30},
  gateBox:      {backgroundColor:'#fff', borderRadius:20, padding:24},
  gateTitle:    {fontSize:17, fontWeight:'900', color:BRAND, marginBottom:8},
  gateDesc:     {fontSize:13, color:'#64748b', marginBottom:16, lineHeight:20},
  gateInput:    {borderWidth:1.5, borderColor:'#e2e8f0', borderRadius:12, padding:14, fontSize:15, color:BRAND, backgroundColor:'#f8fafc', marginBottom:16},
  gateFooter:   {flexDirection:'row', gap:10, justifyContent:'flex-end'},
  gateCancel:   {paddingVertical:10, paddingHorizontal:18, borderRadius:10, borderWidth:1, borderColor:'#e2e8f0'},
  gateCancelTxt:{fontSize:13, fontWeight:'600', color:'#64748b'},
  gateConfirm:  {paddingVertical:10, paddingHorizontal:20, borderRadius:10},
  gateConfirmTxt:{fontSize:13, fontWeight:'700', color:'#fff'},

  /* New Modals Extras */
  versionCard: {flex:1, padding:14, borderRadius:16, backgroundColor:'#f8fafc', borderWidth:1.5, borderColor:'#e2e8f0', alignItems:'center'},
  versionCardActive: {borderColor:ACCENT, backgroundColor:ACCENT+'05'},
  versionLabel: {fontSize:13, fontWeight:'800', textTransform:'uppercase', color:'#64748b', textAlign:'center'},
  versionTime: {fontSize:10, color:'#94a3b8', marginTop:2, fontWeight:'600'},
  
  optionItem: {flexDirection:'row', alignItems:'center', padding:14, borderRadius:16, borderWidth:1.5, borderColor:'#e2e8f0', marginBottom:10},
  optionTitle: {fontSize:14, fontWeight:'700', color:BRAND},
  optionSub: {fontSize:11, color:'#94a3b8', marginTop:2},
  
  infoBox: {flexDirection:'row', gap:12, backgroundColor:'#fffbeb', padding:14, borderRadius:16, borderStyle:'dashed', borderWidth:1, borderColor:'#fde68a', marginVertical:16},
  infoText: {flex:1, fontSize:12, color:'#92400e', lineHeight:18, fontWeight:'500'},

  sourceLinkBox: {marginBottom:16},
  linkSourceBtn: {flexDirection:'row', alignItems:'center', gap:12, padding:14, backgroundColor:ACCENT+'08', borderRadius:16, borderWidth:1, borderStyle:'dashed', borderColor:ACCENT},
  linkSourceTxt: {flex:1, fontSize:14, fontWeight:'700', color:ACCENT},

  sourceItem: {flexDirection:'row', alignItems:'center', padding:16, backgroundColor:'#f8fafc', borderRadius:16, borderWidth:1.5, borderColor:'#e2e8f0', marginBottom:10},
  sourceItemActive: {borderColor:ACCENT, backgroundColor:ACCENT+'05'},
  sourceCat: {fontSize:9, fontWeight:'900', color:'#94a3b8', textTransform:'uppercase', marginBottom:2},
  sourceName: {fontSize:14, fontWeight:'700', color:BRAND},
  sourceDate: {fontSize:11, color:'#94a3b8', marginTop:2},

  saveBtn: {marginTop:16, backgroundColor:BRAND, paddingVertical:14, borderRadius:16, alignItems:'center'},
  saveBtnTxt: {color:'#fff', fontSize:14, fontWeight:'900', textTransform:'uppercase'},
});
