import React, { useState, useEffect, useRef } from 'react';
import { User, Task, OfficeContact } from './types';
import {
  INITIAL_UNITS,
  INITIAL_TAGS,
  INITIAL_PENDING_OFFICES,
  INITIAL_DESIGNATIONS,
  DEFAULT_OFFICE_CONTACTS,
  GROUP_FIELD,
  GROUP_DIVISION,
} from './constants';
import {
  getInitialTasks,
  getInitialUsers,
  DEFAULT_ADMIN_USER,
} from './data/seedData';
import { load, save } from './utils/storage';
import { reconcileTasks } from './utils/taskReconciliation';
import { allUnitsOf, isFieldOfficeUnit, uid, isFollowUpDue, sanitizeComments } from './utils/helpers';
import { formatIndianPhoneNumber } from './utils/phoneUtils';
import {
  testConnection,
  subscribeCloudTasks,
  fetchTasksDirectFromCloud,
  saveTaskToCloud,
  saveTasksBatchToCloud,
  deleteTaskFromCloud,
  subscribeCloudAppConfig,
  saveAppConfigToCloud,
} from './utils/firebase';

import { LoginScreen } from './components/LoginScreen';
import { TopBar } from './components/TopBar';
import { SpaceTabBar } from './components/SpaceTabBar';
import { Dashboard } from './components/Dashboard';
import { FollowUpCalendar } from './components/FollowUpCalendar';
import { Analytics } from './components/Analytics';
import { AdminPanel } from './components/AdminPanel';
import { NewTaskModal } from './components/NewTaskModal';
import { TaskDetail } from './components/TaskDetail';
import { PersonalApp } from './components/PersonalApp';
import { WhatsAppActionModal } from './components/WhatsAppActionModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeSpace, setActiveSpace] = useState<'office' | 'personal'>(() => {
    try {
      const saved = localStorage.getItem('taskreg_active_space');
      if (saved === 'personal' || saved === 'office') return saved;
    } catch {}
    return 'office';
  });
  const [currentView, setCurrentView] = useState<'dashboard' | 'calendar' | 'analytics' | 'admin'>(() => {
    try {
      const saved = localStorage.getItem('taskreg_current_view');
      if (saved && ['dashboard', 'calendar', 'analytics', 'admin'].includes(saved)) {
        return saved as any;
      }
    } catch {}
    return 'dashboard';
  });
  const [calendarInitialView, setCalendarInitialView] = useState<'agenda' | 'month' | 'week' | 'matrix'>('agenda');

  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;
  const [tags, setTags] = useState<string[]>([]);
  const [pendingOffices, setPendingOffices] = useState<string[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [packages, setPackages] = useState<string[]>([]);
  const [officeContacts, setOfficeContacts] = useState<Record<string, OfficeContact>>(DEFAULT_OFFICE_CONTACTS);
  const [whatsAppModalTask, setWhatsAppModalTask] = useState<{ task: Task; reminderType?: string } | null>(() => {
    try {
      const saved = sessionStorage.getItem('taskreg_whatsapp_modal_task');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [unitFilter, setUnitFilter] = useState('ALL');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('taskreg_selected_task_id') || null;
    } catch {
      return null;
    }
  });

  const handleSetActiveSpace = (space: 'office' | 'personal') => {
    setActiveSpace(space);
    try {
      localStorage.setItem('taskreg_active_space', space);
    } catch {}
    handleSetSelectedTaskId(null);
  };

  const handleSetCurrentView = (view: 'dashboard' | 'calendar' | 'analytics' | 'admin') => {
    setCurrentView(view);
    try {
      localStorage.setItem('taskreg_current_view', view);
    } catch {}
    handleSetSelectedTaskId(null);
  };

  const handleSetSelectedTaskId = (id: string | null) => {
    setSelectedTaskId(id);
    try {
      if (id) {
        sessionStorage.setItem('taskreg_selected_task_id', id);
      } else {
        sessionStorage.removeItem('taskreg_selected_task_id');
      }
    } catch {}
  };

  const handleSetWhatsAppModalTask = (val: { task: Task; reminderType?: string } | null) => {
    setWhatsAppModalTask(val);
    try {
      if (val) {
        sessionStorage.setItem('taskreg_whatsapp_modal_task', JSON.stringify(val));
      } else {
        sessionStorage.removeItem('taskreg_whatsapp_modal_task');
      }
    } catch {}
  };
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskInitialDate, setNewTaskInitialDate] = useState<string | null>(null);
  const [showNewUser, setShowNewUser] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Cloud Synchronization state
  const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'offline'>('syncing');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const hasInitializedSeed = useRef(false);

  const handleOpenNewTask = (initialDate?: string) => {
    setNewTaskInitialDate(initialDate || null);
    setShowNewTask(true);
  };

  // Initialize storage, session, and cloud real-time synchronization
  useEffect(() => {
    let unsubTasks: (() => void) | null = null;
    let unsubConfig: (() => void) | null = null;

    (async () => {
      let localUsers = await load<User[]>('users');
      if (!localUsers || localUsers.length === 0) {
        localUsers = [DEFAULT_ADMIN_USER];
        await save('users', localUsers);
      }
      let localUnits = await load<string[]>('units');
      if (!localUnits || localUnits.length === 0) {
        localUnits = INITIAL_UNITS;
        await save('units', localUnits);
      }
      let localTasks = await load<Task[]>('tasks');
      if (!localTasks || localTasks.length === 0) {
        localTasks = getInitialTasks();
        await save('tasks', localTasks);
      }
      let localTags = await load<string[]>('tags');
      if (!localTags || localTags.length === 0) {
        localTags = INITIAL_TAGS;
        await save('tags', localTags);
      }
      let localOffices = await load<string[]>('pending-offices');
      if (!localOffices || localOffices.length === 0) {
        localOffices = INITIAL_PENDING_OFFICES;
        await save('pending-offices', localOffices);
      }
      let localDesignations = await load<string[]>('designations');
      if (!localDesignations || localDesignations.length === 0) {
        localDesignations = INITIAL_DESIGNATIONS;
        await save('designations', localDesignations);
      }
      let localPackages = await load<string[]>('packages');
      if (!localPackages) {
        localPackages = [];
        await save('packages', localPackages);
      }
      let localOfficeContacts = await load<Record<string, OfficeContact>>('office-contacts');
      if (!localOfficeContacts) {
        localOfficeContacts = DEFAULT_OFFICE_CONTACTS;
        await save('office-contacts', localOfficeContacts);
      }

      setUsers(localUsers);
      setUnits(localUnits);
      setTasks(localTasks);
      tasksRef.current = localTasks;
      setTags(localTags);
      setPendingOffices(localOffices);
      setDesignations(localDesignations);
      setPackages(localPackages);
      setOfficeContacts(localOfficeContacts);

      let activeUser: User | null = null;
      try {
        const storedUserJson = sessionStorage.getItem('task-reg-user') || sessionStorage.getItem('tlip-user');
        if (storedUserJson) {
          const parsed = JSON.parse(storedUserJson);
          activeUser = localUsers.find((item) => item.id === parsed.id) || null;
        }
      } catch (err) {
        console.error('Failed to load session user', err);
      }
      if (!activeUser && localUsers.length > 0) {
        activeUser = localUsers.find((item) => item.role === 'admin') || localUsers[0];
        try {
          sessionStorage.setItem('task-reg-user', JSON.stringify(activeUser));
        } catch {
          // ignore
        }
      }
      setCurrentUser(activeUser);
      setReady(true);

      // 2. Validate cloud connection and fetch latest cloud tasks with Smart Two-Way Reconciliation
      testConnection().then((connected) => {
        if (connected) {
          setSyncStatus('connected');
        }
      });
      fetchTasksDirectFromCloud()
        .then(async (latestTasks) => {
          if (latestTasks && latestTasks.length > 0) {
            const current = tasksRef.current.length > 0 ? tasksRef.current : localTasks;
            const { reconciled, pendingLocalToUpload } = reconcileTasks(current, latestTasks);
            if (pendingLocalToUpload.length > 0) {
              console.log(`Initial sync: uploading ${pendingLocalToUpload.length} pending local tasks to cloud...`);
              saveTasksBatchToCloud(pendingLocalToUpload).catch(console.warn);
            }
            setTasks(reconciled);
            tasksRef.current = reconciled;
            await save('tasks', reconciled);
            setSyncStatus('connected');
            setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        })
        .catch((err) => {
          console.warn('Initial direct tasks fetch warning:', err);
        });

      // 3. Connect Live Real-Time Firestore Tasks Subscription with Smart Two-Way Reconciliation
      unsubTasks = subscribeCloudTasks(
        async (cloudTasks) => {
          setSyncStatus('connected');
          setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

          if (cloudTasks && cloudTasks.length > 0) {
            const current = tasksRef.current.length > 0 ? tasksRef.current : localTasks;
            const { reconciled, pendingLocalToUpload } = reconcileTasks(current, cloudTasks);
            if (pendingLocalToUpload.length > 0) {
              console.log(`Live sync: uploading ${pendingLocalToUpload.length} pending local tasks to cloud...`);
              saveTasksBatchToCloud(pendingLocalToUpload).catch(console.warn);
            }
            setTasks(reconciled);
            tasksRef.current = reconciled;
            await save('tasks', reconciled);
          }
        },
        (err) => {
          console.warn('Firestore tasks sync offline fallback:', err);
          setSyncStatus('offline');
        }
      );

      // 4. Connect Live Real-Time Firestore Metadata Subscription
      unsubConfig = subscribeCloudAppConfig(
        async (cloudCfg) => {
          if (cloudCfg) {
            if (cloudCfg.users && cloudCfg.users.length > 0) {
              setUsers(cloudCfg.users);
              await save('users', cloudCfg.users);
            }
            if (cloudCfg.units && cloudCfg.units.length > 0) {
              setUnits(cloudCfg.units);
              await save('units', cloudCfg.units);
            }
            if (cloudCfg.tags && cloudCfg.tags.length > 0) {
              setTags(cloudCfg.tags);
              await save('tags', cloudCfg.tags);
            }
            if (cloudCfg.pendingOffices && cloudCfg.pendingOffices.length > 0) {
              setPendingOffices(cloudCfg.pendingOffices);
              await save('pending-offices', cloudCfg.pendingOffices);
            }
            if (cloudCfg.designations && cloudCfg.designations.length > 0) {
              setDesignations(cloudCfg.designations);
              await save('designations', cloudCfg.designations);
            }
            if (cloudCfg.packages) {
              setPackages(cloudCfg.packages);
              await save('packages', cloudCfg.packages);
            }
            if (cloudCfg.officeContacts && Object.keys(cloudCfg.officeContacts).length > 0) {
              setOfficeContacts(cloudCfg.officeContacts);
              await save('office-contacts', cloudCfg.officeContacts);
            }
          } else {
            // Seed initial config to cloud
            await saveAppConfigToCloud({
              users: localUsers,
              units: localUnits,
              tags: localTags,
              pendingOffices: localOffices,
              officeContacts: localOfficeContacts,
              designations: localDesignations,
              packages: localPackages,
            });
          }
        },
        (err) => {
          console.warn('Firestore config sync error:', err);
        }
      );
    })();

    return () => {
      if (unsubTasks) unsubTasks();
      if (unsubConfig) unsubConfig();
    };
  }, []);

  const flash = (msg: string) => {
    setFlashMessage(msg);
    setTimeout(() => {
      setFlashMessage((current) => (current === msg ? null : current));
    }, 3200);
  };

  const persistTasks = async (nextTasks: Task[]) => {
    setTasks(nextTasks);
    await save('tasks', nextTasks);
    setSyncStatus('syncing');
    try {
      await saveTasksBatchToCloud(nextTasks);
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.warn('Cloud tasks save warning (saved locally):', err);
      setSyncStatus('offline');
    }
  };

  const persistUsers = async (nextUsers: User[]) => {
    setUsers(nextUsers);
    await save('users', nextUsers);
    saveAppConfigToCloud({ users: nextUsers }).catch(console.warn);
    // Keep currentUser updated if modified
    if (currentUser) {
      const updatedCurrent = nextUsers.find((u) => u.id === currentUser.id);
      if (updatedCurrent) {
        setCurrentUser(updatedCurrent);
        sessionStorage.setItem('task-reg-user', JSON.stringify(updatedCurrent));
      }
    }
  };

  const persistUnits = async (nextUnits: string[]) => {
    setUnits(nextUnits);
    await save('units', nextUnits);
    saveAppConfigToCloud({ units: nextUnits }).catch(console.warn);
  };

  const addTagIfNew = async (tag: string, currentTags: string[]) => {
    const clean = tag.trim();
    if (!clean) return currentTags;
    if ((currentTags || []).includes(clean)) return currentTags;
    const next = [...currentTags, clean];
    setTags(next);
    await save('tags', next);
    saveAppConfigToCloud({ tags: next }).catch(console.warn);
    return next;
  };

  const deleteTag = async (tagName: string) => {
    const next = (tags || []).filter((t) => t !== tagName);
    setTags(next);
    await save('tags', next);
    saveAppConfigToCloud({ tags: next }).catch(console.warn);
  };

  const addPendingOfficeIfNew = async (office: string) => {
    const clean = office.trim();
    if (!clean) return;
    if ((pendingOffices || []).includes(clean)) return;
    const next = [...(pendingOffices || []), clean];
    setPendingOffices(next);
    await save('pending-offices', next);
    saveAppConfigToCloud({ pendingOffices: next }).catch(console.warn);
  };

  const deletePendingOffice = async (officeName: string) => {
    const next = (pendingOffices || []).filter((o) => o !== officeName);
    setPendingOffices(next);
    await save('pending-offices', next);
    saveAppConfigToCloud({ pendingOffices: next }).catch(console.warn);
  };

  const addPackageIfNew = async (pkgName: string) => {
    const clean = pkgName.trim();
    if (!clean) return;
    if ((packages || []).some((p) => p.toLowerCase() === clean.toLowerCase())) return;
    const next = [...(packages || []), clean];
    setPackages(next);
    await save('packages', next);
    saveAppConfigToCloud({ packages: next }).catch(console.warn);
  };

  const deletePackage = async (pkgName: string) => {
    const next = (packages || []).filter((p) => p.toLowerCase() !== pkgName.toLowerCase());
    setPackages(next);
    await save('packages', next);
    saveAppConfigToCloud({ packages: next }).catch(console.warn);
  };

  const persistOfficeContacts = async (contacts: Record<string, OfficeContact>) => {
    setOfficeContacts(contacts);
    await save('office-contacts', contacts);
    saveAppConfigToCloud({ officeContacts: contacts }).catch(console.warn);
  };

  const handleSaveOfficeContact = async (office: string, contact: OfficeContact) => {
    const formattedPhone = contact.phone ? formatIndianPhoneNumber(contact.phone) : '';
    const updated = {
      ...officeContacts,
      [office]: {
        ...contact,
        phone: formattedPhone,
      },
    };
    await persistOfficeContacts(updated);
    flash(`Office contact details saved for "${office}".`);
  };

  const handleClearAllOfficePhones = async () => {
    const updated: Record<string, OfficeContact> = {};
    for (const off of Object.keys(officeContacts)) {
      const contact = officeContacts[off] as OfficeContact;
      updated[off] = {
        ...contact,
        phone: '',
      };
    }
    await persistOfficeContacts(updated);
    flash('All preloaded office WhatsApp numbers cleared. You can manually enter numbers now.');
  };

  const handleSaveUserPhone = async (userId: string, phone: string) => {
    const formattedPhone = phone ? formatIndianPhoneNumber(phone) : undefined;
    const updatedUsers = users.map((u) => (u.id === userId ? { ...u, phone: formattedPhone } : u));
    await persistUsers(updatedUsers);
    flash('User WhatsApp contact number updated.');
  };

  const addDesignationIfNew = async (d: string) => {
    const clean = d.trim();
    if (!clean) return;
    if ((designations || []).includes(clean)) return;
    const next = [...(designations || []), clean];
    setDesignations(next);
    await save('designations', next);
    saveAppConfigToCloud({ designations: next }).catch(console.warn);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('task-reg-user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('task-reg-user');
    sessionStorage.removeItem('tlip-user');
    setSelectedTaskId(null);
    setCurrentView('dashboard');
  };

  const handleFactoryReset = async () => {
    // 1. Delete all tasks from cloud and local
    if (tasks.length > 0) {
      for (const t of tasks) {
        deleteTaskFromCloud(t.id).catch(console.warn);
      }
    }
    setTasks([]);
    await save('tasks', []);

    // 2. Clear packages
    setPackages([]);
    await save('packages', []);

    // 3. Reset user roster to just the default Executive Engineer admin
    const resetUsers = [DEFAULT_ADMIN_USER];
    setUsers(resetUsers);
    await save('users', resetUsers);
    setCurrentUser(DEFAULT_ADMIN_USER);

    // 4. Update cloud configuration metadata
    saveAppConfigToCloud({
      users: resetUsers,
      packages: [],
    }).catch(console.warn);

    try {
      sessionStorage.setItem('task-reg-user', JSON.stringify(DEFAULT_ADMIN_USER));
      sessionStorage.removeItem('taskreg_selected_task_id');
      sessionStorage.removeItem('taskreg_whatsapp_modal_task');
      sessionStorage.removeItem('taskreg_personal_selected_id');
    } catch {}

    flash('Factory reset complete: Tasks, team roster, and packages cleared for new Executive Engineer.');
  };

  const handleManualSync = async () => {
    setSyncStatus('syncing');
    try {
      const ok = await testConnection();
      if (ok) {
        const cloudTasks = await fetchTasksDirectFromCloud();
        const currentLocal = tasksRef.current.length > 0 ? tasksRef.current : tasks;
        const { reconciled, pendingLocalToUpload } = reconcileTasks(currentLocal, cloudTasks || []);

        if (pendingLocalToUpload.length > 0) {
          console.log(`Manual sync: uploading ${pendingLocalToUpload.length} pending local changes to cloud...`);
          await saveTasksBatchToCloud(pendingLocalToUpload);
        }

        setTasks(reconciled);
        tasksRef.current = reconciled;
        await save('tasks', reconciled);
        setSyncStatus('connected');
        setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        flash(`Cloud synchronized: ${reconciled.length} tasks verified across all devices.`);
      } else {
        setSyncStatus('offline');
        flash('Currently working offline with local storage cache.');
      }
    } catch (err) {
      console.warn('Manual sync error:', err);
      setSyncStatus('offline');
      flash('Sync notice: Working with cached records.');
    }
  };

  if (!ready) {
    return (
      <div className="tw-body" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div className="tw-loading">Opening task register…</div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen users={users} onLogin={handleLogin} />;
  }

  // Active task for details view
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  // Filter tasks visible to current user in Office Dashboard
  const visibleTasks = tasks.filter((t) => {
    const taskUnits = t.units || (t.unit ? [t.unit] : []);
    if (currentUser.role === 'admin') {
      if (unitFilter === 'ALL') return true;
      if (unitFilter === GROUP_FIELD) return taskUnits.some(isFieldOfficeUnit);
      if (unitFilter === GROUP_DIVISION) return taskUnits.some((u) => !isFieldOfficeUnit(u));
      return taskUnits.includes(unitFilter);
    }
    const myUnits = allUnitsOf(currentUser);
    const inMyUnit = taskUnits.some((u) => myUnits.includes(u));
    const assignedToMe = (t.assigneeIds || []).includes(currentUser.id);
    if (!inMyUnit && !assignedToMe) return false;
    if (unitFilter === 'ALL') return true;
    if (unitFilter === GROUP_FIELD) return taskUnits.some(isFieldOfficeUnit);
    if (unitFilter === GROUP_DIVISION) return taskUnits.some((u) => !isFieldOfficeUnit(u));
    return taskUnits.includes(unitFilter);
  });

  const followUpAlertCount = visibleTasks.filter((t) => isFollowUpDue(t)).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--tw-paper)' }}>
      {/* Toast Notification */}
      {flashMessage && (
        <div className="tw-toast">
          {flashMessage}
        </div>
      )}

      {/* Primary Space Switcher Tab */}
      <SpaceTabBar
        spaceTab={activeSpace}
        setSpaceTab={(space) => handleSetActiveSpace(space)}
      />

      {/* Personal Space Workspace */}
      {activeSpace === 'personal' && (
        <PersonalApp
          currentUser={currentUser}
          onLogout={handleLogout}
          officeTasks={tasks}
          officeUsers={users}
          onOpenOfficeTask={(id) => {
            // Open task detail directly while staying in Personal space
            handleSetSelectedTaskId(id);
          }}
        />
      )}

      {/* Office Register Workspace */}
      {activeSpace === 'office' && (
        <>
          <TopBar
            currentUser={currentUser}
            view={currentView}
            setView={(view) => {
              handleSetCurrentView(view as 'dashboard' | 'calendar' | 'analytics' | 'admin');
            }}
            onLogout={handleLogout}
            followUpAlertCount={followUpAlertCount}
            syncStatus={syncStatus}
            lastSyncedTime={lastSyncedTime}
            onManualSync={handleManualSync}
          />

          <main className="tw-body" style={{ paddingBottom: 60 }}>
            {currentView === 'dashboard' && (
              <Dashboard
                currentUser={currentUser}
                tasks={visibleTasks}
                allTasks={tasks}
                users={users}
                units={units}
                unitFilter={unitFilter}
                setUnitFilter={setUnitFilter}
                tags={tags}
                pendingOffices={pendingOffices}
                packages={packages}
                onOpenTask={(id) => handleSetSelectedTaskId(id)}
                onNewTask={() => handleOpenNewTask()}
                onUpdateTasks={persistTasks}
                onOpenWhatsApp={(task, reminderType) =>
                  handleSetWhatsAppModalTask({ task, reminderType })
                }
                onTriggerReminder={(task, type) =>
                  handleSetWhatsAppModalTask({ task, reminderType: type })
                }
                onGoToCalendar={(mode) => {
                  if (mode) setCalendarInitialView(mode);
                  handleSetCurrentView('calendar');
                }}
                flash={flash}
              />
            )}

            {currentView === 'calendar' && (
              <FollowUpCalendar
                currentUser={currentUser}
                tasks={tasks}
                users={users}
                units={units}
                unitFilter={unitFilter}
                setUnitFilter={setUnitFilter}
                onOpenTask={(id) => handleSetSelectedTaskId(id)}
                onUpdateTasks={persistTasks}
                onNewTask={handleOpenNewTask}
                flash={flash}
                initialViewMode={calendarInitialView}
              />
            )}

            {currentView === 'analytics' && (
              <Analytics
                currentUser={currentUser}
                tasks={tasks}
                users={users}
                units={units}
                onOpenTask={(id) => {
                  handleSetCurrentView('dashboard');
                  handleSetSelectedTaskId(id);
                }}
              />
            )}

            {currentView === 'admin' && currentUser.role === 'admin' && (
              <AdminPanel
                users={users}
                units={units}
                persistUsers={persistUsers}
                persistUnits={persistUnits}
                designations={designations}
                addDesignationIfNew={addDesignationIfNew}
                tags={tags}
                addTagIfNew={addTagIfNew}
                deleteTag={deleteTag}
                pendingOffices={pendingOffices}
                addPendingOfficeIfNew={addPendingOfficeIfNew}
                deletePendingOffice={deletePendingOffice}
                packages={packages}
                addPackageIfNew={addPackageIfNew}
                deletePackage={deletePackage}
                tasks={tasks}
                persistTasks={persistTasks}
                flash={flash}
                showNewUser={showNewUser}
                setShowNewUser={setShowNewUser}
                officeContacts={officeContacts}
                onSaveOfficeContact={handleSaveOfficeContact}
                onClearAllOfficePhones={handleClearAllOfficePhones}
                onFactoryReset={handleFactoryReset}
              />
            )}
          </main>

          {/* New Task Allocation Modal */}
          {showNewTask && (
            <NewTaskModal
              currentUser={currentUser}
              users={users}
              units={units}
              tags={tags}
              addTagIfNew={addTagIfNew}
              packages={packages}
              initialNextFollowUpDate={newTaskInitialDate}
              onClose={() => {
                setShowNewTask(false);
                setNewTaskInitialDate(null);
              }}
              onCreate={async (draft) => {
                const newTask: Task = {
                  id: uid('tsk'),
                  createdAt: new Date().toISOString(),
                  createdBy: currentUser.id,
                  status: 'NOT_STARTED',
                  lastFollowUp: null,
                  pendingAt: [],
                  history: [
                    {
                      status: 'NOT_STARTED',
                      at: new Date().toISOString(),
                      by: currentUser.id,
                    },
                  ],
                  comments: [],
                  title: draft.title || '',
                  description: draft.description || '',
                  units: draft.units || [],
                  assigneeIds: draft.assigneeIds || [],
                  priority: draft.priority || 'Medium',
                  deadline: draft.deadline || null,
                  nextFollowUpDate: draft.nextFollowUpDate || null,
                  tags: draft.tags || [],
                  package: draft.package,
                  scheme: draft.scheme || draft.package,
                };
                saveTaskToCloud(newTask).catch(console.warn);
                await persistTasks([newTask, ...tasks]);
                setShowNewTask(false);
                setNewTaskInitialDate(null);
                flash('Task allocated and added to register.');
              }}
            />
          )}
        </>
      )}

      {/* Task Detail Modal - accessible from BOTH Personal and Office spaces! */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          allTasks={tasks}
          currentUser={currentUser}
          users={users}
          tags={tags}
          addTagIfNew={addTagIfNew}
          pendingOffices={pendingOffices}
          addPendingOfficeIfNew={addPendingOfficeIfNew}
          packages={packages}
          onClose={() => handleSetSelectedTaskId(null)}
          onOpenTask={(id) => handleSetSelectedTaskId(id)}
          onOpenWhatsApp={(task, reminderType) =>
            handleSetWhatsAppModalTask({ task, reminderType })
          }
          onUpdate={async (updated) => {
            saveTaskToCloud(updated).catch(console.warn);
            await persistTasks(
              tasks.map((t) => (t.id === updated.id ? updated : t))
            );
          }}
          onDelete={async () => {
            const toDeleteId = selectedTask.id;
            deleteTaskFromCloud(toDeleteId).catch(console.warn);
            await persistTasks(tasks.filter((t) => t.id !== toDeleteId));
            handleSetSelectedTaskId(null);
            flash('Task permanently removed.');
          }}
          flash={flash}
        />
      )}

      {/* 1-Click WhatsApp Action Memo Modal - accessible from BOTH Personal and Office spaces! */}
      {whatsAppModalTask && (
        <WhatsAppActionModal
          task={whatsAppModalTask.task}
          users={users}
          officeContacts={officeContacts}
          currentUser={currentUser}
          onSaveOfficeContact={handleSaveOfficeContact}
          onSaveUserPhone={handleSaveUserPhone}
          onClose={() => handleSetWhatsAppModalTask(null)}
          onLogReminder={async (note: string) => {
            const targetTask = whatsAppModalTask.task;
            const newComment = {
              id: uid('cmt'),
              userId: currentUser?.id || 'usr_ee_admin',
              text: note,
              at: new Date().toISOString(),
            };
            const updatedTask: Task = {
              ...targetTask,
              lastFollowUp: new Date().toISOString(),
              comments: [...(targetTask.comments || []), newComment],
              history: [
                ...(targetTask.history || []),
                {
                  status: targetTask.status,
                  at: new Date().toISOString(),
                  by: currentUser?.id || 'usr_ee_admin',
                },
              ],
            };
            await persistTasks(
              tasks.map((t) => (t.id === targetTask.id ? updatedTask : t))
            );
            saveTaskToCloud(updatedTask).catch(console.warn);
            flash('WhatsApp follow-up logged into file remarks.');
          }}
        />
      )}
    </div>
  );
}
