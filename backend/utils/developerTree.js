const Project = require('../models/Project');
const Task = require('../models/Task');
const { monthsBetween, daysBetween } = require('./tenure');

/**
 * "Developer Tree" — bir kullanıcının şirket kıdemi + hâlâ üyesi olduğu her
 * projedeki (Project.teamMembers'a bakılarak, projectHistory'ye değil —
 * ayrılınca geçmiş kaydı silinmiyor ama artık ağaçta görünmemeli) proje
 * kıdemi ve katkı oranı. Hem admin panelindeki Yönetim/tree bölümü hem
 * Profilim self-servis sayfası bu tek fonksiyonu kullanır.
 *
 * Contribution % = (bu kullanıcının o projede tamamladığı görev) /
 *                   (o projede toplam tamamlanan görev) — spesifikasyondaki formül.
 */
async function buildDeveloperTree(user) {
  const companyJoinDate = user.hireDate || user.createdAt;
  const projects = await Project.find({ teamMembers: user._id }).select('name teamMembers projectLead createdAt').lean();

  if (projects.length === 0) {
    return { tenureMonths: monthsBetween(companyJoinDate), tenureDays: daysBetween(companyJoinDate), projects: [] };
  }

  const projectIds = projects.map((p) => p._id);
  const tasks = await Task.find({ projectId: { $in: projectIds } })
    .select('title status priority assignedTo projectId')
    .lean();

  const tasksByProject = new Map();
  for (const task of tasks) {
    const key = task.projectId.toString();
    if (!tasksByProject.has(key)) tasksByProject.set(key, []);
    tasksByProject.get(key).push(task);
  }

  const historyMap = new Map((user.projectHistory || []).map((h) => [h.project.toString(), h.joinedAt]));

  const treeProjects = projects.map((project) => {
    const pid = project._id.toString();
    const projectTasks = tasksByProject.get(pid) || [];
    const totalDone = projectTasks.filter((t) => t.status === 'done').length;

    const mine = projectTasks.filter((t) => t.assignedTo.toString() === user._id.toString());
    const userDone = mine.filter((t) => t.status === 'done').length;
    const active = mine
      .filter((t) => t.status !== 'done')
      .map((t) => ({ _id: t._id, title: t.title, status: t.status, priority: t.priority }));
    const done = mine.filter((t) => t.status === 'done').map((t) => ({ _id: t._id, title: t.title }));

    // Geçmişte kayıt yoksa (bu özellikten önce eklenmiş üyelik) en iyi tahmin:
    // projenin oluşturulma tarihi.
    const joinedAt = historyMap.get(pid) || project.createdAt;

    return {
      projectId: project._id,
      name: project.name,
      isLead: String(project.projectLead || '') === String(user._id),
      sinceMonths: monthsBetween(joinedAt),
      sinceDays: daysBetween(joinedAt),
      userDone,
      totalDone,
      active,
      done,
    };
  });

  return { tenureMonths: monthsBetween(companyJoinDate), tenureDays: daysBetween(companyJoinDate), projects: treeProjects };
}

module.exports = { buildDeveloperTree };
