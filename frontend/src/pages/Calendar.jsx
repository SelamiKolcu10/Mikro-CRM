import { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ROLES } from '../config/permissions';
import CalendarView from '../components/tasks/CalendarView';
import CreateTaskModal from '../components/tasks/CreateTaskModal';

/**
 * Bağımsız Takvim sayfası — Tasks.jsx'teki "calendar" sekmesiyle AYNI veri ve
 * mantığı kullanır (useTasks, updateTaskDeadline, sürükle-bırak, tarih seçici
 * modal — hepsi CalendarView içinde, burada tekrar yazılmadı). Tek fark:
 * departman/atanan filtresi yok (tüm görevler, backend zaten role bazlı
 * kapsıyor — bkz. utils/taskScope.js) ve tarihsiz görevler yan yerine altta
 * (bkz. CalendarView `stacked` prop + index.css .calendar-view--stacked).
 */
const Calendar = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { tasks, loading, error, createTask, updateTaskDeadline, getAssignableUsers } = useTasks();
  const [modalOpen, setModalOpen] = useState(false);

  // Görevler sayfasıyla aynı yetki kuralı — "+ Etkinlik" aslında deadline'lı
  // yeni bir görev oluşturuyor (bkz. spec: ayrı bir Event modeli yok, takvimde
  // görünen şey zaten Task.deadline).
  const canCreate = user?.role === ROLES.SUPER_ADMIN || user?.isDepartmentLead;

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (error) return <p className="error-text">{error}</p>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{t('calendar.title')}</h1>
          <p>{t('calendar.subtitle')}</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>{t('calendar.addEvent')}</button>
        )}
      </div>

      <CalendarView tasks={tasks} onUpdateDeadline={updateTaskDeadline} stacked />

      <CreateTaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={createTask}
        getAssignableUsers={getAssignableUsers}
      />
    </div>
  );
};

export default Calendar;
