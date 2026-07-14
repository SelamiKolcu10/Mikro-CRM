import TaskAvatar from '../tasks/TaskAvatar';
import ProgressRing from './ProgressRing';

const MAX_VISIBLE_PILLS = 4;
const MAX_VISIBLE_AVATARS = 4;

// Aynı 5 token çiftinden deterministik seçim — TaskAvatar.colorForId ile aynı
// hash mekanizması (bkz. design-direction dokümanı: "React" her kartta hep
// aynı renktir).
const PILL_COLORS = [
  { bg: 'var(--accent-primary-glow)', color: 'var(--accent-primary)' },
  { bg: 'var(--color-info-soft)', color: 'var(--color-info)' },
  { bg: 'var(--color-success-soft)', color: 'var(--color-success)' },
  { bg: 'var(--color-warning-soft)', color: 'var(--color-warning)' },
  { bg: 'var(--color-danger-soft)', color: 'var(--color-danger)' },
];

function colorForTech(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PILL_COLORS[Math.abs(hash) % PILL_COLORS.length];
}

const ProjectCard = ({ project, onClick }) => {
  const visiblePills = project.techStack.slice(0, MAX_VISIBLE_PILLS);
  const extraPills = project.techStack.length - visiblePills.length;
  const visibleAvatars = project.teamMembers.slice(0, MAX_VISIBLE_AVATARS);
  const extraAvatars = project.teamMembers.length - visibleAvatars.length;

  return (
    <div className="project-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="project-card-header">
        <div>
          <h3 className="project-card-name">{project.name}</h3>
          <div className="project-card-pills">
            {visiblePills.map((tech) => {
              const { bg, color } = colorForTech(tech);
              return (
                <span key={tech} className="pill pill-tech" style={{ background: bg, color }}>{tech}</span>
              );
            })}
            {extraPills > 0 && <span className="pill pill-overflow">+{extraPills}</span>}
          </div>
        </div>
        <ProgressRing percent={project.progress} />
      </div>

      <div className="project-card-footer">
        <div className="task-avatar-stack">
          {visibleAvatars.map((member) => (
            <TaskAvatar key={member._id} user={member} />
          ))}
          {extraAvatars > 0 && <span className="task-avatar task-avatar-overflow">+{extraAvatars}</span>}
        </div>
        <span className="project-card-task-count">{project.doneCount}/{project.taskCount}</span>
      </div>
    </div>
  );
};

export default ProjectCard;
