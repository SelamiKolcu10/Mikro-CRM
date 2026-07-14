import { useLanguage } from '../../context/LanguageContext';
import { ROLE_LABELS, DEPARTMENT_LABELS } from '../../config/permissions';
import TaskAvatar from '../tasks/TaskAvatar';

const ProjectTeamList = ({ teamMembers, projectLead }) => {
  const { t } = useLanguage();

  if (teamMembers.length === 0) {
    return <p className="task-comment-empty">{t('projects.drawer.teamEmpty')}</p>;
  }

  const leadId = projectLead?._id || projectLead;

  return (
    <div className="project-team-list">
      {teamMembers.map((member) => (
        <div key={member._id} className="project-team-row">
          <TaskAvatar user={member} />
          <div className="project-team-row-info">
            <span className="project-team-row-name">{member.name}</span>
            {member.department && (
              <span className="project-team-row-dept">{t(DEPARTMENT_LABELS[member.department])}</span>
            )}
          </div>
          {member._id === leadId && <span className="pill pill-lead">{t('projects.drawer.teamLeadBadge')}</span>}
          {member.role && <span className="badge badge-role">{t(ROLE_LABELS[member.role])}</span>}
        </div>
      ))}
    </div>
  );
};

export default ProjectTeamList;
