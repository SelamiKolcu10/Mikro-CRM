import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useConversation } from '../hooks/useConversation';
import { useSlaClock } from '../hooks/useSlaClock';
import { getSlaState } from '../utils/sla';
import chatService from '../services/chatService';
import feedbackService from '../services/feedbackService';
import ConnectionStatus from '../components/chat/ConnectionStatus';
import MessageBubble from '../components/chat/MessageBubble';
import MessageInput from '../components/chat/MessageInput';
import SlaCountdownChip from '../components/chat/SlaCountdownChip';
import SlaSummary from '../components/chat/SlaSummary';
import PermissionGate from '../components/auth/PermissionGate';
import toast from 'react-hot-toast';
import {
  HiOutlineChatAlt2,
  HiOutlineCalendar,
  HiOutlineExclamationCircle,
  HiOutlineUserCircle,
  HiOutlineSearch,
  HiOutlineClock,
  HiOutlineCode,
  HiOutlineLightningBolt,
  HiOutlineMail,
  HiOutlineArrowLeft,
} from 'react-icons/hi';

const formatCurrency = (value) => `₺${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}`;

const formatTenure = (createdAt, t) => {
  if (!createdAt) return '—';
  const months = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years > 0) return `${years} ${t('chat.years')} ${remMonths > 0 ? `${remMonths} ${t('chat.months')}` : ''}`.trim();
  return `${months} ${t('chat.months')}`;
};

const relativeTime = (iso) => {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins}dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa`;
  return `${Math.floor(hours / 24)}g`;
};

// Company/customer name → up to 2 initials, for the list avatar circle.
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Deterministic per-customer hue so the same company always gets the same
// avatar color across renders/sessions, without needing a stored color field.
const getAvatarColor = (id) => {
  const str = String(id || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 55%, 45%)`;
};

// SLA tier is derived from plan — there's no separate contract/SLA record in
// the data model, so we present a meaningful label rather than a fabricated one.
const isPriorityPlan = (plan) => plan === 'premium' || plan === 'vip';

// Coarse "avg response time" — average gap between an incoming customer
// message and the next outgoing reply, computed from the messages already
// loaded for this conversation (no separate backend metric exists for this).
const computeAvgResponseMinutes = (messages) => {
  if (!messages || messages.length < 2) return null;
  const gaps = [];
  let pendingCustomerAt = null;
  for (const m of messages) {
    if (m.senderType !== 'internal') {
      if (pendingCustomerAt === null) pendingCustomerAt = new Date(m.createdAt).getTime();
    } else if (pendingCustomerAt !== null) {
      gaps.push((new Date(m.createdAt).getTime() - pendingCustomerAt) / 60000);
      pendingCustomerAt = null;
    }
  }
  if (gaps.length === 0) return null;
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
};

// Static example — there is no crash-reporting pipeline wired up yet, so this
// widget demonstrates the layout only. "Convert to Bug Ticket" below is real.
const MOCK_ERROR_TRACE = `CRITICAL: InvoicesV2.jsx:42
Cannot read properties of undefined (reading 'vatRate')
  at calculateLineTotal (InvoicesV2.jsx:42:18)
  at InvoicesV2 (InvoicesV2.jsx:97:24)`;

const PLAN_FILTERS = ['', 'vip', 'premium', 'starter', 'free'];

// Conversations with real activity first (newest reply first), customers who
// haven't been messaged yet sorted alphabetically after — mirrors the
// backend's own ordering in chatController.getConversations.
const compareConversations = (a, b) => {
  if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
  if (a.lastMessageAt) return -1;
  if (b.lastMessageAt) return 1;
  return (a.customer?.name || '').localeCompare(b.customer?.name || '');
};

// An unread reply is the most actionable "something just happened" signal —
// it outranks even SLA severity (an unread breach and a read-but-still-
// breached conversation both need attention, but the one nobody has even
// looked at yet gets first billing, same priority treatment as the
// escalation banner gives SLA risk). Ties within a rank keep
// compareConversations' recency order.
const SLA_SORT_RANK = { breached: 0, critical: 0, warning: 1, ok: 2 };

const priorityRank = (c, now) => (c.unreadByInternal > 0 ? -1 : SLA_SORT_RANK[getSlaState(c, now).state]);

const compareBySlaAndRecency = (a, b, now) => {
  const rankDiff = priorityRank(a, now) - priorityRank(b, now);
  return rankDiff !== 0 ? rankDiff : compareConversations(a, b);
};

const ChatDashboard = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState(() => searchParams.get('sla') === 'risk');
  const [convertingBug, setConvertingBug] = useState(false);
  const slaClockTick = useSlaClock(); // eslint-disable-line no-unused-vars -- forces periodic re-render so chips/rail/sort stay live
  // Mobile-only WhatsApp-style screen stack ('list' | 'chat' | 'profile').
  // Deliberately kept separate from selectedCustomerId — that way resizing
  // back to desktop just reverts to the classic split-pane view without
  // losing the open conversation, and desktop never reads this at all (the
  // CSS that switches on it only exists inside the <768px media query).
  const [mobileView, setMobileView] = useState('list');
  const scrollRef = useRef(null);

  const selected = conversations.find((c) => c.customer?._id === selectedCustomerId) || null;
  // Customers with no Conversation yet have `_id: null` until the first
  // select/message lazily creates one (see handleSelectCustomer below).
  const selectedId = selected?._id || null;

  const fetchConversations = useCallback(async () => {
    try {
      const res = await chatService.getConversations();
      setConversations(res.data.data);
    } catch (err) {
      toast.error(t('common.loadError'));
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Live-update the inbox list (reorder, new preview, unread badge) even for
  // conversations that aren't the one currently open.
  useEffect(() => {
    if (!socket) return undefined;
    const handleUpdated = ({ conversationId, lastMessageAt, lastMessagePreview }) => {
      setConversations((prev) => {
        const next = prev.map((c) =>
          c._id === conversationId
            ? {
                ...c,
                lastMessageAt,
                lastMessagePreview,
                unreadByInternal: c.customer?._id === selectedCustomerId ? c.unreadByInternal : c.unreadByInternal + 1,
              }
            : c
        );
        return next.sort(compareConversations);
      });
    };
    socket.on('conversation:updated', handleUpdated);
    return () => socket.off('conversation:updated', handleUpdated);
  }, [socket, selectedCustomerId]);

  // A conversation crossing into 'escalated' is a distinct, one-time event
  // (unlike the 30s tick, which just re-evaluates existing data) — update its
  // row locally and fire exactly one toast per breach, never a repeat.
  useEffect(() => {
    if (!socket) return undefined;
    const handleEscalated = ({ conversationId, customerName }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversationId
            ? { ...c, status: 'escalated', escalatedAt: new Date().toISOString(), assignedTo: null }
            : c
        )
      );
      toast.error(`${t('chat.sla.toastEscalated')}: ${customerName}`);
    };
    socket.on('conversation:escalated', handleEscalated);
    return () => socket.off('conversation:escalated', handleEscalated);
  }, [socket, t]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    return conversations
      .filter((c) => {
        const matchesPlan = !planFilter || c.customer?.plan === planFilter;
        const matchesQuery =
          !q ||
          c.customer?.name?.toLowerCase().includes(q) ||
          c.customer?.company?.toLowerCase().includes(q);
        const matchesSla = !slaFilter || getSlaState(c, now).state !== 'ok';
        return matchesPlan && matchesQuery && matchesSla;
      })
      .sort((a, b) => compareBySlaAndRecency(a, b, now));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slaClockTick intentionally re-triggers this on the 30s tick
  }, [conversations, searchQuery, planFilter, slaFilter, slaClockTick]);

  const slaCounts = useMemo(() => {
    const now = Date.now();
    let critical = 0;
    let warning = 0;
    for (const c of conversations) {
      const { state } = getSlaState(c, now);
      if (state === 'critical' || state === 'breached') critical += 1;
      else if (state === 'warning') warning += 1;
    }
    return { critical, warning };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, slaClockTick]);

  const { messages, loading: loadingMessages, connected, send, retry } = useConversation({
    conversationId: selectedId,
    viewerType: 'internal',
    fetchMessages: useCallback(() => chatService.getMessages(selectedId), [selectedId]),
    sendMessage: useCallback((body, clientId) => chatService.sendMessage(selectedId, body, clientId), [selectedId]),
    markRead: useCallback(() => chatService.markRead(selectedId), [selectedId]),
  });

  const avgResponseMinutes = useMemo(() => computeAvgResponseMinutes(messages), [messages]);

  const setSlaFilterAndUrl = useCallback((value) => {
    setSlaFilter(value);
    setSearchParams(value ? { sla: 'risk' } : {});
  }, [setSearchParams]);

  const hasActiveFilters = Boolean(searchQuery || planFilter || slaFilter);
  const clearAllFilters = () => {
    setSearchQuery('');
    setPlanFilter('');
    setSlaFilterAndUrl(false);
  };

  useEffect(() => {
    if (selectedId) {
      setConversations((prev) => prev.map((c) => (c._id === selectedId ? { ...c, unreadByInternal: 0 } : c)));
    }
  }, [selectedId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, mobileView]);

  // Defensive: if the mobile view ever ends up on 'chat'/'profile' without a
  // selected conversation (e.g. the conversation list changes out from under
  // it), fall back to the list instead of showing an empty pane.
  useEffect(() => {
    if (!selected && mobileView !== 'list') setMobileView('list');
  }, [selected, mobileView]);

  // Clicking a customer with no conversation yet lazily creates one (staff
  // equivalent of the portal's own lazy-create-on-open behavior), so the
  // thread exists as soon as there's something to assign/reply to.
  const handleSelectCustomer = async (row) => {
    setSelectedCustomerId(row.customer._id);
    setMobileView('chat');
    if (row._id) return;
    try {
      const res = await chatService.startConversation(row.customer._id);
      const conv = res.data.data;
      setConversations((prev) =>
        prev.map((c) => (c.customer?._id === row.customer._id ? { ...c, _id: conv._id, assignedTo: conv.assignedTo } : c))
      );
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleAssign = async (userId) => {
    try {
      const res = await chatService.assign(selectedId, userId);
      setConversations((prev) => prev.map((c) => (c._id === selectedId ? { ...c, assignedTo: res.data.data.assignedTo } : c)));
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleConvertToBugTicket = async () => {
    if (!selected?.customer?._id) return;
    setConvertingBug(true);
    try {
      await feedbackService.create({
        title: `${t('chat.errorLogTitle')} — ${selected.customer.company || selected.customer.name}`,
        description: MOCK_ERROR_TRACE,
        type: 'bug',
        customer: selected.customer._id,
      });
      toast.success(t('chat.bugTicketCreated'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setConvertingBug(false);
    }
  };

  if (loadingList) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('chat.title')}</h1>
          <p>{t('chat.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <SlaSummary
            criticalCount={slaCounts.critical}
            warningCount={slaCounts.warning}
            onFilterClick={() => setSlaFilterAndUrl(true)}
          />
          <ConnectionStatus />
        </div>
      </div>

      <div className={`table-container chat-layout chat-layout-mobile-${mobileView}`}>
        {/* Column 1 — Customer queue */}
        <div className="chat-pane chat-pane-list" style={{ borderRight: '1px solid var(--border-color)' }}>
          <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <div className="search-bar">
              <HiOutlineSearch className="search-icon" />
              <input
                type="text"
                placeholder={t('chat.searchCustomers')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select className="form-select compact" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              {PLAN_FILTERS.map((plan) => (
                <option key={plan || 'all'} value={plan}>
                  {plan ? t(`customers.plans.${plan}`) : t('customers.allPlans')}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`filter-chip ${slaFilter ? 'active' : ''}`}
                onClick={() => setSlaFilterAndUrl(!slaFilter)}
              >
                {t('chat.sla.filterChip')}
              </button>
              {hasActiveFilters && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearAllFilters}>
                  {t('chat.clearFilters')}
                </button>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredConversations.length === 0 ? (
              <div className="table-empty">
                <p>{t('chat.noConversations')}</p>
                {hasActiveFilters && (
                  <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-sm)' }} onClick={clearAllFilters}>
                    {t('chat.clearFilters')}
                  </button>
                )}
              </div>
            ) : (
              filteredConversations.map((c) => {
                const slaState = getSlaState(c);
                const railClass =
                  slaState.state === 'critical' || slaState.state === 'breached'
                    ? 'sla-rail--critical'
                    : slaState.state === 'warning'
                      ? 'sla-rail--warning'
                      : '';
                return (
                  <div
                    key={c.customer?._id}
                    onClick={() => handleSelectCustomer(c)}
                    className={railClass}
                    style={{
                      padding: 'var(--space-md)',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 'var(--space-sm)',
                      borderBottom: '1px solid var(--border-color)',
                      background: c.customer?._id === selectedCustomerId ? 'var(--glass-bg-hover)' : 'transparent',
                    }}
                  >
                    <div className="user-avatar" style={{ background: getAvatarColor(c.customer?._id), backgroundImage: 'none' }}>
                      {getInitials(c.customer?.company || c.customer?.name)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <strong style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.customer?.name || '—'}
                        </strong>
                        {c.unreadByInternal > 0 && <span className="nav-badge">{c.unreadByInternal}</span>}
                      </div>
                      <span className={`badge badge-${c.customer?.plan}`} style={{ marginTop: 2 }}>
                        {t(`customers.plans.${c.customer?.plan}`)}
                      </span>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.lastMessagePreview || t('chat.noThreadYet')}
                      </div>
                      {slaState.state === 'ok' ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {c.lastMessageAt ? relativeTime(c.lastMessageAt) : ''}
                        </div>
                      ) : (
                        <div style={{ marginTop: 4 }}>
                          <SlaCountdownChip slaState={slaState} plan={c.customer?.plan} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2 — Real-time chat feed */}
        <div className="chat-pane chat-pane-chat" style={{ borderRight: '1px solid var(--border-color)' }}>
          {!selected ? (
            <div className="table-empty" style={{ margin: 'auto' }}>
              <div className="table-empty-icon"><HiOutlineChatAlt2 /></div>
              <p>{t('chat.selectConversation')}</p>
            </div>
          ) : (
            <>
              <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="chat-pane-back-btn"
                    onClick={() => setMobileView('list')}
                    aria-label={t('chat.backToList')}
                  >
                    <HiOutlineArrowLeft />
                  </button>
                  <span className={`status-pulse-dot ${connected ? 'is-online' : 'is-offline'}`} title={connected ? t('chat.connected') : t('chat.disconnected')} />
                  <div
                    onClick={() => setMobileView('profile')}
                    style={{ cursor: 'pointer' }}
                    title={t('chat.viewProfile')}
                  >
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{selected.customer?.name}</div>
                    <span className={`badge badge-${selected.customer?.plan}`}>{t(`customers.plans.${selected.customer?.plan}`)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <SlaCountdownChip slaState={getSlaState(selected)} plan={selected.customer?.plan} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: '11px' }}>
                    <HiOutlineClock />
                    {t('chat.avgResponseTime')}: {avgResponseMinutes !== null ? `${avgResponseMinutes} dk` : t('chat.noResponseData')}
                  </div>
                </div>
              </div>

              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
                {!loadingMessages && messages.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>{t('chat.noMessages')}</p>
                )}
                {messages.map((m) => (
                  <MessageBubble key={m._id} message={m} isMine={m.senderType === 'internal'} onRetry={retry} />
                ))}
              </div>
              <PermissionGate resource="chat" action="write">
                <MessageInput onSend={send} disabled={!selectedId} />
              </PermissionGate>
            </>
          )}
        </div>

        {/* Column 3 — Customer analytics cockpit */}
        {selected ? (
          <div className="chat-pane chat-pane-profile" style={{ padding: 'var(--space-md)', overflowY: 'auto', gap: 'var(--space-lg)' }}>
            <div className="chat-pane-profile-header">
              <button
                type="button"
                className="chat-pane-back-btn"
                onClick={() => setMobileView('chat')}
                aria-label={t('chat.backToChat')}
              >
                <HiOutlineArrowLeft />
              </button>
              <span>{selected.customer?.name}</span>
            </div>
            <div>
              <h3 style={{ marginBottom: 'var(--space-sm)' }}>{t('chat.customerAnalytics')}</h3>
              <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ color: 'var(--text-secondary)' }}>{selected.customer?.company}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                  <HiOutlineMail /> {selected.customer?.email}
                </div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase' }}>
                <HiOutlineExclamationCircle /> {t('chat.openTickets')}
              </div>
              <div style={{ fontSize: '13px', marginTop: 2 }}>
                {selected.totalFeedbackCount > 0
                  ? t('chat.ticketsSummary')
                      .replace('{open}', selected.openFeedbackCount)
                      .replace('{resolved}', selected.totalFeedbackCount - selected.openFeedbackCount)
                  : t('chat.noOpenTickets')}
              </div>
            </div>

            <PermissionGate resource="chat" action="assign">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase' }}>
                  <HiOutlineUserCircle /> {t('chat.assignedTo')}
                </div>
                <div style={{ fontSize: '13px', marginTop: 2 }}>{selected.assignedTo?.name || t('chat.unassigned')}</div>
                {selected.assignedTo?._id === user?._id ? (
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={() => handleAssign(null)}>
                    {t('chat.unassign')}
                  </button>
                ) : (
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={() => handleAssign(user._id)}>
                    {t('chat.assignToMe')}
                  </button>
                )}
              </div>
            </PermissionGate>

            {/* Financial profile */}
            <div className="stat-card" style={{ padding: 'var(--space-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase' }}>
                {t('chat.financialProfile')}
              </div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginTop: 4 }}>
                {formatCurrency(selected.customer?.mrr)}<span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>{t('common.perMonth')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '12px', marginTop: 6 }}>
                <HiOutlineCalendar /> {t('chat.customerSince')}: {formatTenure(selected.customer?.createdAt, t)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <HiOutlineLightningBolt style={{ color: isPriorityPlan(selected.customer?.plan) ? 'var(--color-warning)' : 'var(--text-tertiary)' }} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                  {isPriorityPlan(selected.customer?.plan) ? t('chat.slaPriority') : t('chat.slaStandard')}
                </span>
              </div>
            </div>

            {/* Error-log diagnostics — mock display, real ticket conversion */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', marginBottom: 6 }}>
                <HiOutlineCode /> {t('chat.errorLogTitle')}
              </div>
              <pre
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-sm)',
                  fontSize: '11px',
                  color: 'var(--color-danger)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                }}
              >
                {MOCK_ERROR_TRACE}
              </pre>
              <button
                className="btn btn-danger btn-sm"
                style={{ marginTop: 8, width: '100%' }}
                onClick={handleConvertToBugTicket}
                disabled={convertingBug}
              >
                {convertingBug ? t('common.loading') : t('chat.convertToBugTicket')}
              </button>
            </div>

            {/* Quick links */}
            <div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', marginBottom: 6 }}>
                {t('chat.quickLinks')}
              </div>
              <Link
                to={`/feedbacks?customer=${selected.customer._id}`}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start', gap: 6 }}
              >
                <HiOutlineExclamationCircle /> {t('chat.viewCustomerTickets')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="chat-pane chat-pane-profile" />
        )}
      </div>
    </>
  );
};

export default ChatDashboard;
