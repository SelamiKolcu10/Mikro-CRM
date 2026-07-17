const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const { ROLES } = require('../config/permissions');
const { computeWorkload } = require('../utils/workloadCalculator');

/**
 * Yeni eklenen ekip üyelerine projectHistory kaydı düşer (bkz. User modeli —
 * proje bazlı kıdem buradan hesaplanır). Zaten bir kaydı olan üye tekrar
 * eklenirse (çıkar-tekrar-ekle) joinedAt YENİLENMEZ — ilk katılım tarihi
 * anlamlı kalan bilgidir.
 */
async function recordProjectJoins(projectId, newTeamMemberIds) {
  if (!newTeamMemberIds || newTeamMemberIds.length === 0) return;
  await User.updateMany(
    { _id: { $in: newTeamMemberIds }, 'projectHistory.project': { $ne: projectId } },
    { $push: { projectHistory: { project: projectId, joinedAt: new Date() } } }
  );
}

const TEAM_MEMBER_POPULATE = { path: 'teamMembers', select: 'name email role department' };
const PROJECT_LEAD_POPULATE = { path: 'projectLead', select: 'name email role department' };
const COMMENT_USER_POPULATE = { path: 'comments.user', select: 'name email role' };

/** projectLead her zaman teamMembers'ın bir üyesi olmalı — yoksa "kontrol" iddiası anlamsız kalır. */
function validateProjectLead(teamMembers, projectLead) {
  if (!projectLead) return true;
  return (teamMembers || []).map(String).includes(String(projectLead));
}

/**
 * Tüm projelerin tamamlanma yüzdesini tek aggregation'da hesaplar.
 * `progress` DB'ye yazılmaz (bkz. design doc Bölüm 1) — her okunuşta
 * projectId'ye bağlı Task'lardan (done / toplam) türetilir, senkron tutma
 * riski taşımaz.
 */
async function attachProgress(projects) {
  const counts = await Task.aggregate([
    { $match: { projectId: { $ne: null } } },
    {
      $group: {
        _id: '$projectId',
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
      },
    },
  ]);
  const byProject = new Map(counts.map((c) => [c._id.toString(), c]));

  return projects.map((project) => {
    const stats = byProject.get(project._id.toString());
    const taskCount = stats?.total || 0;
    const doneCount = stats?.done || 0;
    return {
      ...project.toObject(),
      taskCount,
      doneCount,
      progress: taskCount === 0 ? 0 : Math.round((doneCount / taskCount) * 100),
    };
  });
}

/**
 * @route   GET /api/projects
 */
const getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find().populate([TEAM_MEMBER_POPULATE, PROJECT_LEAD_POPULATE]).sort({ createdAt: -1 });
    res.json({ success: true, data: await attachProgress(projects) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/projects/:id
 */
const getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).populate([TEAM_MEMBER_POPULATE, PROJECT_LEAD_POPULATE]);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Proje bulunamadı.' });
    }
    const [withProgress] = await attachProgress([project]);
    res.json({ success: true, data: withProgress });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/projects/mine
 * @desc    canManageProjects olmayan bir proje çalışanının kendi ekibinde
 *          olduğu projeleri görebilmesi için — tam listeye (GET /) erişimi
 *          yok, requireProjectManager bu route'ta hiç uygulanmaz (bkz.
 *          routes/projectRoutes.js).
 */
const getMyProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({ teamMembers: req.user._id })
      .populate([TEAM_MEMBER_POPULATE, PROJECT_LEAD_POPULATE])
      .sort({ createdAt: -1 });
    res.json({ success: true, data: await attachProgress(projects) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/projects/eligible-members
 * @desc    Proje ekibi seçimi için aday listesi — TÜM departmanlar (bir
 *          projenin ekibi departmanlar arası olabilir, bkz. design doc
 *          Bölüm 2: department/projectId bağımsız eksenler). role staff/
 *          super_admin ile sınırlı: bu sayfaya zaten sadece o roller
 *          erişebiliyor (RoleGuard), erişemeyecek birini ekip üyesi olarak
 *          seçtirmenin anlamı yok.
 */
const getEligibleMembers = async (req, res, next) => {
  try {
    const users = await User.find({
      status: 'approved',
      role: { $in: [ROLES.STAFF, ROLES.SUPER_ADMIN] },
    }).select('name email department role');

    // Aynı Algorithmic Workload Balancer (bkz. taskController.getWorkloadStatus)
    // burada departmandan bağımsız çalışır — proje ekibi departmanlar arası
    // olduğu için tüm departmanlardaki üyelerin yoğunluğu tek seferde çekilir.
    const userIds = users.map((u) => u._id);
    const activeTasks = await Task.find({ assignedTo: { $in: userIds }, status: { $ne: 'done' } }).select('assignedTo priority deadline');
    const tasksByUser = new Map();
    for (const task of activeTasks) {
      const key = task.assignedTo.toString();
      if (!tasksByUser.has(key)) tasksByUser.set(key, []);
      tasksByUser.get(key).push(task);
    }

    const now = Date.now();
    const data = users.map((u) => {
      const { activeTaskCount, workloadScore, loadStatus } = computeWorkload(tasksByUser.get(u._id.toString()) || [], now);
      return { _id: u._id, name: u.name, email: u.email, department: u.department, role: u.role, activeTaskCount, workloadScore, loadStatus };
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/projects/contributions-overview
 * @desc    "Projeler" görünümü (Çalışan Dizini'nin proje-bazlı sekmesi) —
 *          TÜM projeler (görevi olmayanlar dahil) ve her projenin TÜM ekip
 *          üyeleri (henüz tamamlanmış görevi olmasa bile) — bkz. tasarım
 *          kararı: "tüm çalışanları ve tüm projeleri görebilelim". Yetki
 *          requireProjectManager ile aynı (bkz. routes/projectRoutes.js).
 */
const getContributionsOverview = async (req, res, next) => {
  try {
    const projects = await Project.find().populate([TEAM_MEMBER_POPULATE, PROJECT_LEAD_POPULATE]).sort({ createdAt: -1 });

    const doneCounts = await Task.aggregate([
      { $match: { projectId: { $ne: null }, status: 'done' } },
      { $group: { _id: { projectId: '$projectId', assignedTo: '$assignedTo' }, count: { $sum: 1 } } },
    ]);
    const byProjectMember = new Map(doneCounts.map((c) => [`${c._id.projectId}:${c._id.assignedTo}`, c.count]));
    const byProject = new Map();
    for (const c of doneCounts) {
      const key = c._id.projectId.toString();
      byProject.set(key, (byProject.get(key) || 0) + c.count);
    }

    const data = projects.map((project) => {
      const pid = project._id.toString();
      const totalDone = byProject.get(pid) || 0;
      const members = project.teamMembers
        .map((member) => ({
          user: { _id: member._id, name: member.name, department: member.department },
          isLead: String(project.projectLead?._id || project.projectLead || '') === String(member._id),
          userDone: byProjectMember.get(`${pid}:${member._id}`) || 0,
        }))
        .sort((a, b) => b.userDone - a.userDone);

      return {
        _id: project._id,
        name: project.name,
        projectLead: project.projectLead ? { _id: project.projectLead._id, name: project.projectLead.name } : null,
        totalDone,
        members,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/projects/:id/tasks
 * @desc    Drawer'daki görev akışı — statüye gruplama client'ta yapılır,
 *          burası sadece projectId'ye bağlı tüm görevleri döner. Yetki
 *          requireProjectViewer'da zaten kontrol edildi (req.project).
 */
const getProjectTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find({ projectId: req.project._id })
      .populate({ path: 'assignedTo', select: 'name email department role' })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/projects/:id/comments
 * @desc    Proje tartışması — canViewProject (yönetici ya da ekip üyesi)
 *          okuyabilir (bkz. requireProjectViewer).
 */
const getProjectComments = async (req, res, next) => {
  try {
    await req.project.populate(COMMENT_USER_POPULATE);
    res.json({ success: true, data: req.project.comments });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/projects/:id/comments
 * @desc    Yazma da canViewProject ile aynı kural (yönetici + ekip üyesi),
 *          intern hariç — uygulama genelindeki read-only intern kuralıyla
 *          tutarlı (bkz. taskController.addTaskComment aynı desen).
 */
const addProjectComment = async (req, res, next) => {
  try {
    if (req.user.role === ROLES.INTERN) {
      return res.status(403).json({ success: false, error: 'Yorum yazma yetkiniz yok.' });
    }
    req.project.comments.push({ user: req.user._id, text: req.body.text });
    await req.project.save();
    await req.project.populate(COMMENT_USER_POPULATE);
    res.status(201).json({ success: true, data: req.project.comments[req.project.comments.length - 1] });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/projects
 */
const createProject = async (req, res, next) => {
  try {
    const { name, techStack, architectureNotes, teamMembers, projectLead } = req.body;
    if (!validateProjectLead(teamMembers, projectLead)) {
      return res.status(400).json({ success: false, error: 'Proje lideri ekip üyelerinden biri olmalıdır.' });
    }
    const project = await Project.create({ name, techStack, architectureNotes, teamMembers, projectLead: projectLead || null });
    await recordProjectJoins(project._id, teamMembers);
    await project.populate([TEAM_MEMBER_POPULATE, PROJECT_LEAD_POPULATE]);
    const [withProgress] = await attachProgress([project]);
    res.status(201).json({ success: true, data: withProgress });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/projects/:id
 * @desc    projectLead validasyonu bu isteğin GÖNDERMEDİĞİ alanları da
 *          hesaba katar (ör. sadece architectureNotes güncellenirken
 *          teamMembers gönderilmemiş olabilir) — bu yüzden mevcut kaydı
 *          önce okuyup nihai teamMembers/projectLead'i ona göre kurar.
 */
const updateProject = async (req, res, next) => {
  try {
    const { name, techStack, architectureNotes, teamMembers, projectLead } = req.body;

    const existing = await Project.findById(req.params.id).select('teamMembers projectLead');
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Proje bulunamadı.' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (techStack !== undefined) updates.techStack = techStack;
    if (architectureNotes !== undefined) updates.architectureNotes = architectureNotes;
    if (teamMembers !== undefined) updates.teamMembers = teamMembers;
    if (projectLead !== undefined) updates.projectLead = projectLead || null;

    const finalTeamMembers = teamMembers !== undefined ? teamMembers : existing.teamMembers;
    const finalLead = projectLead !== undefined ? projectLead : existing.projectLead;
    if (!validateProjectLead(finalTeamMembers, finalLead)) {
      return res.status(400).json({ success: false, error: 'Proje lideri ekip üyelerinden biri olmalıdır.' });
    }

    if (teamMembers !== undefined) {
      const existingIds = new Set(existing.teamMembers.map(String));
      const newlyAdded = teamMembers.filter((id) => !existingIds.has(String(id)));
      await recordProjectJoins(req.params.id, newlyAdded);
    }

    const project = await Project.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate([TEAM_MEMBER_POPULATE, PROJECT_LEAD_POPULATE]);
    const [withProgress] = await attachProgress([project]);
    res.json({ success: true, data: withProgress });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/projects/:id
 * @desc    Sert silme — bağlı görevler silinmez, sadece projectId'leri
 *          temizlenir (sarkan referans kalmasın diye; arşivleme/soft-delete
 *          kapsam dışı, bkz. design doc).
 */
const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Proje bulunamadı.' });
    }
    await Task.updateMany({ projectId: project._id }, { $set: { projectId: null } });
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjects,
  getProjectById,
  getProjectTasks,
  getMyProjects,
  getEligibleMembers,
  getContributionsOverview,
  getProjectComments,
  addProjectComment,
  createProject,
  updateProject,
  deleteProject,
};
