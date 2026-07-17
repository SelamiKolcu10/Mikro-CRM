import { useState } from 'react';
import { HiOutlineBriefcase, HiOutlineFolder, HiOutlineCheck, HiOutlineChevronDown } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';
import { formatTenureSpan, formatTenureSince } from '../../utils/tenure';
import ContributionRing from './ContributionRing';

/**
 * "Developer Tree" — kıdem istatistikleri + proje bazlı katkı akordeonu.
 * Hem Çalışan Dizini panelinde (bkz. EmployeePanel) hem Profilim'de (bkz.
 * pages/Profile.jsx) aynı veri şekliyle (backend/utils/developerTree.js)
 * kullanılır.
 */
const DeveloperTree = ({ tenureMonths, tenureDays, projects }) => {
  const { t } = useLanguage();
  const [openId, setOpenId] = useState(projects[0]?.projectId ?? null);

  return (
    <>
      <div className="stats">
        <div className="stat">
          <span className="stat-icon"><HiOutlineBriefcase /></span>
          <div>
            <div className="stat-label">{t('users.tree.companyTenure')}</div>
            <div className="stat-value">{formatTenureSpan(tenureMonths, tenureDays)}</div>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon"><HiOutlineFolder /></span>
          <div>
            <div className="stat-label">{t('users.tree.projectCount')}</div>
            <div className="stat-value">{projects.length} {t('users.tree.projectCountSuffix')}</div>
          </div>
        </div>
      </div>

      <h3 className="section-title">{t('users.tree.contributedProjects')}</h3>

      {projects.length === 0 ? (
        <p className="empty-note">{t('users.tree.empty')}</p>
      ) : (
        projects.map((project) => {
          const isOpen = openId === project.projectId;
          return (
            <div key={project.projectId} className={`acc${isOpen ? ' open' : ''}`}>
              <button
                type="button"
                className="acc-header"
                aria-expanded={isOpen}
                onClick={() => setOpenId(isOpen ? null : project.projectId)}
              >
                <div className="acc-title">
                  <div className="acc-project">
                    {project.name}
                    {project.isLead && <span className="pill pill--accent" style={{ marginLeft: 6 }}>{t('users.directory.leadBadge')}</span>}
                  </div>
                  <div className="acc-since">{formatTenureSince(project.sinceMonths, project.sinceDays)} {t('users.tree.since')}</div>
                </div>
                <div className="acc-contrib">
                  <div className="contrib-frac">
                    <div className="frac-num">{project.userDone} / {project.totalDone}</div>
                    <div className="frac-label">{t('users.tree.completedOf')}</div>
                  </div>
                  <ContributionRing userDone={project.userDone} totalDone={project.totalDone} />
                </div>
                <span className="chev"><HiOutlineChevronDown /></span>
              </button>
              {isOpen && (
                <div className="acc-content">
                  <p className="contrib-note">
                    {t('users.tree.contributionNote')
                      .replace('{total}', project.totalDone)
                      .replace('{mine}', project.userDone)}
                  </p>
                  <div>
                    <div className="task-group-label">{t('users.tree.activeTasks')}<span className="count">{project.active.length}</span></div>
                    <ul className="task-list">
                      {project.active.map((task) => (
                        <li key={task._id} className="task">
                          <span className={`status-dot status-dot--${task.status}`} aria-hidden="true" />
                          <span className="task-title">{task.title}</span>
                          <span className={`pill pill--${task.status === 'in_progress' ? 'info' : task.status === 'in_review' ? 'warning' : 'muted'}`}>
                            {t(`tasks.status.${task.status}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="task-group-label">{t('users.tree.doneTasks')}<span className="count">{project.done.length}</span></div>
                    <ul className="task-list">
                      {project.done.map((task) => (
                        <li key={task._id} className="task task--done">
                          <HiOutlineCheck />
                          <span className="task-title">{task.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </>
  );
};

export default DeveloperTree;
