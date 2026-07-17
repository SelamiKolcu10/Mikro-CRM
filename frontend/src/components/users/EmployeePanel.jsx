import { useState, useEffect, useRef } from 'react';
import { HiOutlineX, HiOutlineTrash, HiOutlinePhone } from 'react-icons/hi';
import { FaLinkedin, FaGithub } from 'react-icons/fa';
import { useLanguage } from '../../context/LanguageContext';
import { ALL_ROLES, ROLE_LABELS, DEPARTMENTS, DEPARTMENT_LABELS } from '../../config/permissions';
import userService from '../../services/userService';
import toast from 'react-hot-toast';
import EmployeeAvatar from './EmployeeAvatar';
import DeveloperTree from './DeveloperTree';

const IconLinks = ({ user }) => {
  const { phone, linkedin, github } = user.personalInfo || {};
  return (
    <div className="panel-icons">
      {phone && <a className="icon-link" href={`tel:${phone}`} aria-label="telefon"><HiOutlinePhone /></a>}
      {linkedin && <a className="icon-link" href={linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><FaLinkedin /></a>}
      {github && <a className="icon-link" href={github} target="_blank" rel="noopener noreferrer" aria-label="GitHub"><FaGithub /></a>}
    </div>
  );
};

/**
 * Çalışan Dizini'nde karta tıklayınca açılan sağ panel — kimlik + (süper admin
 * ise) eski Kullanıcı Yönetimi tablosundan gelen Yönetim kontrolleri + ortak
 * DeveloperTree (bkz. components/users/DeveloperTree.jsx).
 */
const EmployeePanel = ({ employee, isAdmin, onClose, onChanged }) => {
  const { t } = useLanguage();
  const panelRef = useRef(null);
  const headerRef = useRef(null);
  const bodyRef = useRef(null);
  const [tree, setTree] = useState(null);

  useEffect(() => {
    if (!employee) return;
    setTree(null);
    userService.getTree(employee._id).then((res) => setTree(res.data.data)).catch(() => setTree({ tenureMonths: 0, projects: [] }));
    panelRef.current?.focus();
  }, [employee]);

  // CSS flex (flex:1 + min-height:0 + overflow-y:auto) *should* be enough to
  // make panel-body scroll on its own, ama panel açıkken içerik uzunsa
  // kayma çalışmadığı defalarca bildirildi — o yüzden burada JS ile header'ın
  // GERÇEK ölçülen yüksekliğine göre panel-body'ye kesin bir maxHeight/overflow
  // basıyoruz; hangi CSS/tarayıcı tuhaflığı devredeyse onu bypass eder.
  useEffect(() => {
    if (!employee || !headerRef.current || !bodyRef.current) return;
    const header = headerRef.current;
    const body = bodyRef.current;

    const applyHeight = () => {
      const headerHeight = header.getBoundingClientRect().height;
      body.style.maxHeight = `calc(100vh - ${headerHeight}px)`;
      body.style.overflowY = 'auto';
    };

    applyHeight();
    const observer = new ResizeObserver(applyHeight);
    observer.observe(header);
    window.addEventListener('resize', applyHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', applyHeight);
    };
  }, [employee]);

  useEffect(() => {
    if (!employee) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [employee, onClose]);

  // Backdrop arkasındaki sayfa scroll edilebilir kalırsa, panelin dar
  // (460px) alanı dışında herhangi bir yerde tekerlek çevirmek arka sayfayı
  // kaydırıyor — panel açıkken body'yi kilitleyip tüm scroll'u panel-body'ye
  // yönlendiriyoruz (bkz. ProjectDrawer'da da olmayan, burada eklenen düzeltme).
  useEffect(() => {
    if (!employee) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [employee]);

  if (!employee) return null;

  const handleApprove = async () => {
    try {
      await userService.approve(employee._id);
      toast.success(t('users.approved'));
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleReject = async () => {
    if (!window.confirm(t('users.management.rejectConfirm').replace('{name}', employee.name))) return;
    try {
      await userService.reject(employee._id);
      toast.success(t('users.rejected'));
      onClose();
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleRoleChange = async (e) => {
    try {
      await userService.updateRole(employee._id, e.target.value);
      toast.success(t('users.management.roleSaved'));
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleDeptChange = async (e) => {
    try {
      await userService.updateDepartment(employee._id, { department: e.target.value || null });
      toast.success(t('users.management.deptSaved'));
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleLeadToggle = async (e) => {
    try {
      await userService.updateDepartment(employee._id, { isDepartmentLead: e.target.checked });
      toast.success(t(e.target.checked ? 'users.management.leadOn' : 'users.management.leadOff'));
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('users.management.deleteConfirm').replace('{name}', employee.name))) return;
    try {
      await userService.delete(employee._id);
      toast.success(t('common.delete') + ' ✅');
      onClose();
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="project-drawer employee-panel" role="dialog" aria-modal="true" tabIndex={-1} ref={panelRef}>
        <header className="panel-header" ref={headerRef}>
          <EmployeeAvatar user={employee} size="lg" />
          <div className="panel-id">
            <h2 className="panel-name">{employee.name}</h2>
            <div className="panel-meta">
              {employee.status === 'pending' ? (
                <span className="pill pill--warning">{t('users.statuses.pending')}</span>
              ) : (
                <span className={`pill pill--${employee.role === 'super_admin' ? 'danger' : employee.role === 'accountant' ? 'info' : employee.role === 'support' ? 'success' : 'accent'}`}>
                  {t(ROLE_LABELS[employee.role])}
                </span>
              )}
              <span className="dept">{employee.department ? t(DEPARTMENT_LABELS[employee.department]) : t('departments.none')}</span>
              {employee.isDepartmentLead && employee.status !== 'pending' && <span className="pill pill--accent">{t('users.directory.leadBadge')}</span>}
            </div>
            <IconLinks user={employee} />
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label={t('common.close')}><HiOutlineX /></button>
        </header>

        <div className="panel-body" ref={bodyRef}>
          {isAdmin && (
            <>
              <h3 className="section-title">{t('users.management.title')}</h3>
              {employee.status === 'pending' ? (
                <div className="admin-box">
                  <div className="pending-banner">
                    <span className="pill pill--warning">{t('users.statuses.pending')}</span>
                    <p>{t('users.management.pendingHint')}</p>
                  </div>
                  <div className="admin-actions">
                    <button type="button" className="btn btn-primary" onClick={handleApprove}>{t('users.approve')}</button>
                    <button type="button" className="btn btn--danger-outline" onClick={handleReject}>{t('users.reject')}</button>
                  </div>
                </div>
              ) : (
                <div className="admin-box">
                  <div className="field">
                    <label htmlFor="panelRole">{t('users.role')}</label>
                    <select id="panelRole" className="form-select" value={employee.role} onChange={handleRoleChange}>
                      {ALL_ROLES.map((role) => <option key={role} value={role}>{t(ROLE_LABELS[role])}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="panelDept">{t('users.department')}</label>
                    <select id="panelDept" className="form-select" value={employee.department || ''} onChange={handleDeptChange}>
                      <option value="">{t('departments.none')}</option>
                      {DEPARTMENTS.map((dept) => <option key={dept} value={dept}>{t(DEPARTMENT_LABELS[dept])}</option>)}
                    </select>
                  </div>
                  <div className="toggle-row">
                    <div>
                      <div className="toggle-label">{t('users.isDepartmentLead')}</div>
                      <div className="frac-label">{t('users.management.leadToggleHint')}</div>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={!!employee.isDepartmentLead} onChange={handleLeadToggle} />
                      <span className="track" />
                    </label>
                  </div>
                  <button type="button" className="danger-link" onClick={handleDelete}>
                    <HiOutlineTrash /> {t('users.management.deleteAction')}
                  </button>
                </div>
              )}
            </>
          )}

          {tree && <DeveloperTree tenureMonths={tree.tenureMonths} tenureDays={tree.tenureDays} projects={tree.projects} />}
        </div>
      </div>
    </>
  );
};

export default EmployeePanel;
