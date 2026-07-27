import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import chatService from '../services/chatService';
import feedbackService from '../services/feedbackService';
import userService from '../services/userService';
import { useAuth } from '../context/AuthContext';
import {
  PLAN_LABEL,
  MOCK_ERROR_TRACE,
  getInitials,
  getAvatarColor,
  formatTenure,
  canWriteChat,
  canAssignChat,
} from '../config/chat';
import { canReadInvoices } from '../config/invoices';
import { getSlaState, formatSlaDuration } from '../utils/sla';
import { colors, radius, space, font } from '../theme';

const formatCurrency = (v) => `₺${Number(v || 0).toLocaleString('tr-TR')}`;

function StatTile({ icon, label, value, caption }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileLabelRow}>
        <Ionicons name={icon} size={13} color={colors.textMuted} />
        <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
      </View>
      {value != null && <Text style={styles.tileValue}>{value}</Text>}
      {!!caption && <Text style={styles.tileCaption}>{caption}</Text>}
    </View>
  );
}

function Section({ label, icon, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelRow}>
        {!!icon && <Ionicons name={icon} size={14} color={colors.textFaint} />}
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

export default function CustomerProfileScreen({ route, navigation }) {
  const { session } = useAuth();
  const canAssign = canAssignChat(session?.role);
  // Bug ticket = Feedback kaydı; oluşturma yetkisi feedbacks.write ile aynı
  // (super_admin/staff). support sohbete yazabilir ama ticket açamaz.
  const canCreateTicket = ['super_admin', 'staff'].includes(session?.role);
  const canSeeInvoices = canReadInvoices(session?.role);

  const { avgResponseMinutes } = route.params;
  const [conversation, setConversation] = useState(route.params.conversation);
  const customer = conversation?.customer;

  const [showReassign, setShowReassign] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [convertingBug, setConvertingBug] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Müşteri Profili' });
  }, [navigation]);

  const loadCandidates = async () => {
    setLoadingCandidates(true);
    try {
      const res = await userService.getAll({ status: 'approved' });
      const list = res.data.data || res.data || [];
      setCandidates(list.filter((u) => canWriteChat(u.role)));
    } catch {
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleAssign = async (userId) => {
    try {
      const res = await chatService.assign(conversation._id, userId);
      setConversation((prev) => ({ ...prev, assignedTo: res.data.data.assignedTo }));
      setShowReassign(false);
    } catch (err) {
      Alert.alert('Atanamadı', err.response?.data?.error || 'Bir hata oluştu.');
    }
  };

  const handleConvertToBugTicket = async () => {
    if (!customer?._id) return;
    setConvertingBug(true);
    try {
      await feedbackService.create({
        title: `Hata günlüğü — ${customer.company || customer.name}`,
        description: MOCK_ERROR_TRACE,
        type: 'bug',
        customer: customer._id,
      });
      Alert.alert('Oluşturuldu', 'Hata kaydı bir bug ticket olarak açıldı.');
    } catch (err) {
      Alert.alert('Oluşturulamadı', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setConvertingBug(false);
    }
  };

  const sla = getSlaState(conversation);
  const showSlaBanner = sla.state !== 'ok' && sla.minutesRemaining !== null;
  const isBreached = sla.state === 'breached';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Kimlik */}
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(customer?._id) }]}>
          <Text style={styles.avatarText}>{getInitials(customer?.company || customer?.name)}</Text>
        </View>
        <Text style={styles.name}>{customer?.name}</Text>
        <View style={styles.planBadge}>
          <Text style={styles.planText}>
            {(PLAN_LABEL[customer?.plan] || customer?.plan || '').toUpperCase()}
          </Text>
        </View>
        {!!customer?.company && <Text style={styles.company}>{customer.company}</Text>}
        {!!customer?.email && (
          <View style={styles.emailRow}>
            <Ionicons name="mail-outline" size={14} color={colors.textMuted} />
            <Text style={styles.email}>{customer.email}</Text>
          </View>
        )}
      </View>

      {showSlaBanner && (
        <View style={[styles.slaBanner, isBreached ? styles.slaBannerBreached : styles.slaBannerWarning]}>
          <Ionicons name="warning-outline" size={18} color={isBreached ? colors.danger : '#B45309'} />
          <Text style={[styles.slaBannerText, { color: isBreached ? colors.danger : '#B45309' }]}>
            {isBreached
              ? `SLA aşıldı · ${formatSlaDuration(Math.abs(sla.minutesRemaining))} gecikme`
              : `SLA riski · ${formatSlaDuration(sla.minutesRemaining)} kaldı`}
          </Text>
        </View>
      )}

      <Section label="BU MÜŞTERİ">
        <View style={styles.grid}>
          <StatTile
            icon="time-outline"
            label="Ort. Yanıt Süresi"
            value={avgResponseMinutes !== null ? `${avgResponseMinutes}dk` : '—'}
            caption={avgResponseMinutes === null ? 'Yeterli veri yok' : undefined}
          />
          <StatTile
            icon="alert-circle-outline"
            label="Açık Talep"
            value={String(conversation.openFeedbackCount ?? 0)}
            caption={
              conversation.totalFeedbackCount > 0
                ? `${conversation.totalFeedbackCount - (conversation.openFeedbackCount || 0)} çözülmüş`
                : 'Hiç talep yok'
            }
          />
          <StatTile
            icon="calendar-outline"
            label="Aylık Gelir"
            value={formatCurrency(customer?.mrr)}
            caption={`Müşteri: ${formatTenure(customer?.createdAt)}`}
          />
          <StatTile
            icon="star-outline"
            label="Memnuniyet"
            value={conversation.satisfactionCount > 0 ? `${conversation.satisfactionAvg}/5` : undefined}
            caption={
              conversation.satisfactionCount > 0
                ? `${conversation.satisfactionCount} değerlendirme`
                : 'Henüz değerlendirme yok'
            }
          />
        </View>
      </Section>

      {/* Atama — backend'de yalnız super_admin'e açık */}
      {canAssign && (
        <Section label="ATAMA">
          <View style={styles.assignRow}>
            <View style={styles.assignInfo}>
              <View style={[styles.assignAvatar, { backgroundColor: getAvatarColor(conversation.assignedTo?._id) }]}>
                <Text style={styles.assignAvatarText}>
                  {conversation.assignedTo?.name ? getInitials(conversation.assignedTo.name) : '?'}
                </Text>
              </View>
              <Text style={styles.assignName} numberOfLines={1}>
                {conversation.assignedTo?.name || 'Atanmamış'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={() => {
                if (!showReassign) loadCandidates();
                setShowReassign((v) => !v);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.changeBtnText}>Değiştir</Text>
            </TouchableOpacity>
          </View>

          {showReassign && (
            <View style={styles.pickerBox}>
              {loadingCandidates ? (
                <ActivityIndicator color={colors.primary} style={{ paddingVertical: space.md }} />
              ) : (
                <>
                  {!!session?._id && conversation.assignedTo?._id !== session._id && (
                    <TouchableOpacity style={styles.pickerRow} onPress={() => handleAssign(session._id)}>
                      <Text style={styles.pickerTextPrimary}>Bana ata</Text>
                    </TouchableOpacity>
                  )}
                  {candidates
                    .filter((c) => c._id !== session?._id && c._id !== conversation.assignedTo?._id)
                    .map((c) => (
                      <TouchableOpacity key={c._id} style={styles.pickerRow} onPress={() => handleAssign(c._id)}>
                        <Text style={styles.pickerText}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  {!!conversation.assignedTo && (
                    <TouchableOpacity style={styles.pickerRow} onPress={() => handleAssign(null)}>
                      <Text style={styles.pickerTextDanger}>Atamayı kaldır</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}
        </Section>
      )}

      {/* Hata günlüğü — gösterim örnek veridir, ticket'a çevirme gerçektir */}
      <Section label="TANILAMA" icon="code-slash-outline">
        <View style={styles.traceBox}>
          <Text style={styles.traceText}>{MOCK_ERROR_TRACE}</Text>
        </View>
        {canCreateTicket && (
          <TouchableOpacity
            style={[styles.bugBtn, convertingBug && styles.btnDisabled]}
            onPress={handleConvertToBugTicket}
            disabled={convertingBug}
            activeOpacity={0.85}
          >
            {convertingBug ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Text style={styles.bugBtnText}>Bug Ticket'a Çevir</Text>
            )}
          </TouchableOpacity>
        )}
      </Section>

      <Section label="HIZLI BAĞLANTILAR">
        {/* Talepler — Geri Bildirimler ekranı bu müşteriye daraltılmış açılır. */}
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() =>
            navigation.navigate('Feedbacks', {
              customerId: customer?._id,
              customerName: customer?.name,
            })
          }
          activeOpacity={0.7}
        >
          <Ionicons name="ticket-outline" size={18} color={colors.primary} />
          <Text style={styles.linkText}>Bu Müşterinin Taleplerini Gör</Text>
          {conversation.openFeedbackCount > 0 && (
            <View style={styles.linkBadge}>
              <Text style={styles.linkBadgeText}>{conversation.openFeedbackCount}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </TouchableOpacity>

        {/* Faturalar — invoices.read yetkisi olmayan rollerde backend 403
            döneceği için bağlantı hiç gösterilmez (bkz. config/invoices.js). */}
        {canSeeInvoices && (
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() =>
              navigation.navigate('CustomerInvoices', {
                customerId: customer?._id,
                customerName: customer?.name,
              })
            }
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={styles.linkText}>Fatura Geçmişini Gör</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        )}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },

  identity: { alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: font.xl, fontWeight: '800' },
  name: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginTop: space.sm },
  planBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.primarySoft, marginTop: 6 },
  planText: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.3 },
  company: { fontSize: font.sm, color: colors.textMuted, marginTop: 6 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  email: { fontSize: font.sm, color: colors.textMuted },

  slaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderRadius: radius.md, padding: space.md, marginTop: space.lg,
  },
  slaBannerWarning: { backgroundColor: colors.warnSoft },
  slaBannerBreached: { backgroundColor: colors.dangerSoft },
  slaBannerText: { flex: 1, fontSize: font.sm, fontWeight: '700' },

  section: { marginTop: space.xl },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: space.sm },
  sectionLabel: { fontSize: font.xs, fontWeight: '800', color: colors.textFaint, letterSpacing: 0.6 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexGrow: 1, flexBasis: '46%',
    backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
  },
  tileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileLabel: { flex: 1, fontSize: font.xs, fontWeight: '600', color: colors.textMuted },
  tileValue: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginTop: 4 },
  tileCaption: { fontSize: font.xs, color: colors.textFaint, marginTop: 2 },

  assignRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
  },
  assignInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  assignAvatar: { width: 30, height: 30, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  assignAvatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  assignName: { flex: 1, fontSize: font.sm, fontWeight: '600', color: colors.text },
  changeBtn: { paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  changeBtnText: { fontSize: font.sm, fontWeight: '700', color: colors.primary },

  pickerBox: {
    marginTop: space.sm, backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  pickerRow: { paddingHorizontal: space.md, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerText: { fontSize: font.md, color: colors.text },
  pickerTextPrimary: { fontSize: font.md, fontWeight: '700', color: colors.primary },
  pickerTextDanger: { fontSize: font.md, fontWeight: '700', color: colors.danger },

  traceBox: {
    backgroundColor: '#1B2130', borderRadius: radius.md, padding: space.md,
  },
  traceText: {
    color: '#FCA5A5', fontSize: 11, lineHeight: 17,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  bugBtn: {
    alignItems: 'center', justifyContent: 'center', height: 44, marginTop: space.sm,
    borderRadius: radius.md, backgroundColor: colors.dangerSoft,
  },
  bugBtnText: { color: colors.danger, fontSize: font.sm, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },

  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: space.sm,
  },
  linkText: { flex: 1, fontSize: font.sm, fontWeight: '600', color: colors.text },
  linkBadge: {
    minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: radius.full,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  linkBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
