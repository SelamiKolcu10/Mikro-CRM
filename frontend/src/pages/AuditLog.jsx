import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import auditService from '../services/auditService';
import toast from 'react-hot-toast';
import { ROLES } from '../config/permissions';
import ChainStatusBar from '../components/audit/ChainStatusBar';
import AuditFilterBar from '../components/audit/AuditFilterBar';
import SecurityTimeline from '../components/audit/SecurityTimeline';

const PAGE_SIZE = 25;

const AuditLog = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const canSeeActors = user?.role === ROLES.SUPER_ADMIN;

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [severityCounts, setSeverityCounts] = useState(null);

  const [collectionName, setCollectionName] = useState('');
  const [action, setAction] = useState('');
  const [severity, setSeverity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [actors, setActors] = useState(null);

  const [chainLoading, setChainLoading] = useState(true);
  const [chainError, setChainError] = useState(false);
  const [chainResult, setChainResult] = useState(null);
  const [jumpToBreakToken, setJumpToBreakToken] = useState(0);

  // Debounce free-text search 300ms before it hits the server-side filter.
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const filterParams = { collectionName, action, severity, dateFrom, dateTo, actorEmail, search };

  const fetchPage = useCallback(async (pageToFetch, append) => {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      const params = { page: pageToFetch, limit: PAGE_SIZE, ...filterParams };
      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });
      const res = await auditService.getAll(params);
      setLogs((prev) => (append ? [...prev, ...res.data.data] : res.data.data));
      setSeverityCounts(res.data.severityCounts);
      setTotal(res.data.pagination.total);
      setPage(pageToFetch);
    } catch (err) {
      toast.error(t('common.loadError'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, action, severity, dateFrom, dateTo, actorEmail, search]);

  // Any filter change restarts the list from page 1.
  useEffect(() => {
    fetchPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, action, severity, dateFrom, dateTo, actorEmail, search]);

  useEffect(() => {
    if (canSeeActors) {
      auditService.getActors().then((res) => setActors(res.data.data)).catch(() => setActors([]));
    }
  }, [canSeeActors]);

  const runVerify = useCallback(async () => {
    setChainLoading(true);
    setChainError(false);
    try {
      const res = await auditService.verify();
      setChainResult(res.data.data);
    } catch (err) {
      setChainError(true);
    } finally {
      setChainLoading(false);
    }
  }, []);

  useEffect(() => {
    runVerify();
  }, [runVerify]);

  const handleClearFilters = () => {
    setCollectionName('');
    setAction('');
    setSeverity('');
    setDateFrom('');
    setDateTo('');
    setActorEmail('');
    setSearchInput('');
  };

  const handleJumpToBreak = () => setJumpToBreakToken((n) => n + 1);

  const hasMore = logs.length < total;
  const remainingCount = total - logs.length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>🛡️ {t('auditLog.title')}</h1>
          <p>{t('auditLog.subtitle')}</p>
        </div>
      </div>

      <ChainStatusBar
        loading={chainLoading}
        error={chainError}
        result={chainResult}
        onReverify={runVerify}
        onJumpToBreak={handleJumpToBreak}
      />

      <AuditFilterBar
        collectionName={collectionName} setCollectionName={setCollectionName}
        action={action} setAction={setAction}
        severity={severity} setSeverity={setSeverity}
        severityCounts={severityCounts}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        search={searchInput} setSearch={setSearchInput}
        actors={canSeeActors ? actors : null}
        actorEmail={actorEmail} setActorEmail={setActorEmail}
        onClear={handleClearFilters}
      />

      <SecurityTimeline
        logs={logs}
        loading={loading}
        brokenAtSequence={chainResult && !chainResult.intact ? chainResult.brokenAtSequence : null}
        expected={chainResult?.expected}
        found={chainResult?.found}
        hasMore={hasMore}
        remainingCount={remainingCount}
        loadingMore={loadingMore}
        onLoadMore={() => fetchPage(page + 1, true)}
        jumpToBreakToken={jumpToBreakToken}
        onClearFilters={handleClearFilters}
      />
    </>
  );
};

export default AuditLog;
