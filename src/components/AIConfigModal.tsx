import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';
import { AI_PROVIDER_PRESETS, UserAIConfig, getPreset } from '../services/ai/userAIConfig';
import { createUserKeyProvider, providerErrorMessage } from '../services/ai/byokAIService';

interface Props {
  visible: boolean;
  config: UserAIConfig | null;
  onClose: () => void;
  onSave: (config: UserAIConfig) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function AIConfigModal(props: Props) {
  if (!props.visible) return null;
  return <AIConfigModalForm {...props} />;
}

function AIConfigModalForm({ visible, config, onClose, onSave, onDelete }: Props) {
  const [providerId, setProviderId] = useState(config?.providerId ?? 'openai');
  const [apiKey, setApiKey] = useState('');
  const [storedKey, setStoredKey] = useState(config?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(() => config?.baseUrl ?? getPreset(config?.providerId ?? 'openai').baseUrl);
  const [model, setModel] = useState(() => config?.model ?? getPreset(config?.providerId ?? 'openai').model);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const preset = useMemo(() => getPreset(providerId), [providerId]);

  const selectProvider = (id: string) => {
    const next = getPreset(id);
    if (id !== providerId) {
      setApiKey('');
      setStoredKey('');
    }
    setProviderId(id);
    setBaseUrl(next.baseUrl);
    setModel(next.model);
    setMessage(null);
  };

  const save = async () => {
    const key = apiKey.trim() || storedKey;
    if (!key || !baseUrl.trim() || !model.trim()) { setMessage('أكمل المفتاح والرابط واسم النموذج أولًا.'); return; }
    const nextConfig: UserAIConfig = { providerId, providerName: preset.name, kind: preset.kind, apiKey: key, baseUrl: baseUrl.trim(), model: model.trim(), apiUrl: preset.apiUrl };
    setSaving(true);
    setMessage('جارٍ اختبار اتصال قصير بالمزوّد...');
    try {
      await createUserKeyProvider(nextConfig).sendMessage([{ role: 'user', content: 'Reply with exactly OK.' }]);
    } catch (error) {
      setMessage(providerErrorMessage(error));
      setSaving(false);
      return;
    }
    try {
      await onSave(nextConfig);
      onClose();
    } catch {
      setMessage('نجح اختبار الاتصال، لكن تعذّر حفظ المفتاح بأمان على هذا الجهاز.');
    } finally {
      setSaving(false);
    }
  };

  const openApiPage = () => { if (preset.apiUrl) Linking.openURL(preset.apiUrl); };
  const openDocs = () => Linking.openURL(preset.docsUrl);

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><View style={styles.screen}><View style={styles.header}><View><Text style={styles.eyebrow}>PRIVATE BYOK</Text><Text style={styles.title}>ربط مفتاحك الخاص</Text></View><Pressable onPress={onClose} style={styles.close}><Ionicons name="close" size={21} color={colors.ink} /></Pressable></View><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={20} color={colors.tealDark} /><Text style={styles.noticeText}>يُحفظ المفتاح محليًا في SecureStore ولا يُرفع إلى GitHub أو Manus. الاتصال مباشر من جهازك، ومزود الخدمة يستقبل رسائلك عند الإرسال.</Text></View><Text style={styles.sectionTitle}>اختر المزود ({AI_PROVIDER_PRESETS.length} خيارات)</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providerRow}>{AI_PROVIDER_PRESETS.map((item) => <Pressable key={item.id} onPress={() => selectProvider(item.id)} style={[styles.providerChip, providerId === item.id && styles.providerChipActive]}><Text style={[styles.providerText, providerId === item.id && styles.providerTextActive]}>{item.name}</Text></Pressable>)}</ScrollView><Text style={styles.label}>مفتاح API</Text><TextInput value={apiKey} onChangeText={setApiKey} placeholder={storedKey ? 'المفتاح محفوظ؛ اكتب مفتاحًا جديدًا لتغييره' : 'الصق المفتاح هنا'} placeholderTextColor={colors.inkFaint} secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.input} /><Text style={styles.help}>لا ترسل المفتاح في المحادثة ولا تضعه في ملفات المشروع. اختبار الاتصال يرسل طلبًا قصيرًا وقد يستهلك قدرًا بسيطًا من رصيد المزوّد.</Text><View style={styles.linkRow}><Pressable onPress={openApiPage} style={styles.linkButton}><Ionicons name="key-outline" size={16} color={colors.tealDark} /><Text style={styles.linkText}>فتح صفحة إنشاء المفتاح</Text></Pressable><Pressable onPress={openDocs} style={styles.linkButton}><Ionicons name="book-outline" size={16} color={colors.tealDark} /><Text style={styles.linkText}>وثائق API</Text></Pressable></View><Text style={styles.label}>Base URL</Text><TextInput value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" autoCorrect={false} style={styles.input} /><Text style={styles.label}>اسم النموذج</Text><TextInput value={model} onChangeText={setModel} autoCapitalize="none" autoCorrect={false} style={styles.input} /><Text style={styles.help}>المزودات ذات صيغة OpenAI-compatible تستخدم /chat/completions. Google Gemini يستخدم محوله الرسمي. للمزود غير الموجود اختر «مزود مخصص» وعدّل الرابط والنموذج.</Text><View style={styles.steps}><Text style={styles.stepsTitle}>طريقة الحصول على مفتاح رسمي</Text><Text style={styles.step}>1. افتح صفحة إنشاء المفتاح الرسمية للمزود.</Text><Text style={styles.step}>2. سجّل الدخول وأنشئ API key جديدًا من لوحة API.</Text><Text style={styles.step}>3. انسخه والصقه هنا، ثم اضغط حفظ.</Text><Text style={styles.step}>4. لا تشارك المفتاح مع أي شخص، ويمكنك حذفه من هنا في أي وقت.</Text></View>{message ? <Text style={styles.error}>{message}</Text> : null}<Pressable onPress={save} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}><Text style={styles.saveText}>{saving ? 'جارٍ اختبار المفتاح...' : 'اختبار المفتاح وحفظه'}</Text></Pressable>{config ? <Pressable onPress={onDelete} disabled={saving} style={styles.deleteButton}><Text style={styles.deleteText}>حذف المفتاح من الجهاز</Text></Pressable> : null}</ScrollView></View></Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg, paddingTop: 54 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, eyebrow: { ...typography.label, color: colors.tealDark, letterSpacing: 1 }, title: { ...typography.h1, color: colors.ink, marginTop: 3 }, close: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }, content: { paddingVertical: spacing.lg, paddingBottom: spacing.xxl }, notice: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.tealSoft, borderRadius: radii.md, padding: spacing.md }, noticeText: { flex: 1, ...typography.body, color: colors.inkMuted, fontSize: 12 }, sectionTitle: { ...typography.label, color: colors.ink, marginTop: spacing.lg }, providerRow: { gap: spacing.xs, paddingVertical: spacing.sm }, providerChip: { paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, providerChipActive: { backgroundColor: colors.ink, borderColor: colors.ink }, providerText: { ...typography.label, color: colors.inkMuted, fontSize: 11 }, providerTextActive: { color: colors.paper }, label: { ...typography.label, color: colors.ink, marginTop: spacing.md, marginBottom: spacing.xs }, input: { minHeight: 46, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, color: colors.ink, paddingHorizontal: spacing.md, ...typography.body }, help: { ...typography.body, color: colors.inkMuted, fontSize: 11, marginTop: 5 }, linkRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }, linkButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 }, linkText: { ...typography.label, color: colors.tealDark, fontSize: 11 }, steps: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg }, stepsTitle: { ...typography.label, color: colors.ink, marginBottom: spacing.xs }, step: { ...typography.body, color: colors.inkMuted, fontSize: 12, marginTop: 4 }, error: { ...typography.body, color: colors.danger, fontSize: 12, marginTop: spacing.sm }, saveButton: { height: 48, borderRadius: radii.md, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg }, saveText: { ...typography.label, color: colors.paper }, deleteButton: { alignItems: 'center', padding: spacing.md }, deleteText: { ...typography.label, color: colors.danger, fontSize: 12 }, disabled: { opacity: 0.5 },
});
