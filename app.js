/**
 * OS&CI Task Scheduler - Core Logic, Router, Database Engine & Interactive Gantt
 * Premium Apple-inspired Manufacturing Workspace System
 */

(function () {
  'use strict';

  // =========================================================================
  // PRODUCTION CLOUD SETTINGS
  // =========================================================================
  // To lock the app to your live Supabase database for all users,
  // simply paste your Supabase Project URL and Public Anon Key in the quotes below:
  const DEFAULT_SUPABASE_URL = 'https://ossrvllofrbkkkcdcsnt.supabase.co';
  const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zc3J2bGxvZnJia2trY2Rjc250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5Njk2NDgsImV4cCI6MjA5NTU0NTY0OH0.hLq4-f5mXh_U3uGUQH1hsUlo3dUe_Yo4C_iNUbqiR_c';

  // =========================================================================
  // STATE MANAGEMENT & GLOBAL CONFIG
  // =========================================================================
  const state = {
    currentEmployee: null,
    currentRole: null,
    currentView: 'dashboard',
    activeProjectId: null,
    projects: [],
    tasks: [],
    employees: [],
    systemSettings: {
      plants: ["Plant A", "Plant B", "Plant C", "Plant D"],
      departments: ["OS&CI", "Production", "Quality", "Logistics", "Engineering", "EHS", "HR"],
      categories: ["5S", "Kaizen", "TPM", "P3", "D&A", "OS&CI"],
      adminPin: "778899"
    },
    expandedTasks: new Set(), // Set of Task UUIDs that are expanded in tree
    ganttVisible: true,
    supabaseClient: null,
    isOfflineMode: false,
    theme: 'light'
  };

  // Local storage keys
  const STORAGE_KEYS = {
    SUPABASE_URL: 'osci_sb_url',
    SUPABASE_KEY: 'osci_sb_key',
    OFFLINE_MODE: 'osci_offline_mode',
    SESSION_EMPLOYEE: 'osci_session_employee',
    SESSION_ROLE: 'osci_session_role',
    SANDBOX_DATA: 'osci_sandbox_data',
    THEME: 'osci_theme'
  };

  // Default Mock Sandbox Data for offline/demo use
  const DEFAULT_SANDBOX_DATA = {
    employee_master: [
      { employee_code: 'EMP001', name: 'Kitti Prasertsook', role: 'OSCI_ADMIN', department: 'OS&CI', status: 'ACTIVE' },
      { employee_code: 'EMP002', name: 'Somchai Jaidee', role: 'MANAGER', department: 'Production', status: 'ACTIVE' },
      { employee_code: 'EMP003', name: 'Nattaporn Srisuwan', role: 'OWNER', department: 'Quality', status: 'ACTIVE' },
      { employee_code: 'EMP004', name: 'Wichai Rungrueng', role: 'OWNER', department: 'Logistics', status: 'ACTIVE' },
      { employee_code: 'EMP005', name: 'Preecha Silpa', role: 'VIEWER', department: 'Engineering', status: 'ACTIVE' },
      { employee_code: 'ADMIN99', name: 'System Emergency Admin', role: 'OSCI_ADMIN', department: 'OS&CI', status: 'ACTIVE' }
    ],
    projects: [
      { id: 'a0000001', name: '5S Workspace Standardization - Plant 1 Assembly Line', year: 2026, plant: 'Plant A', category: '5S', status: 'In Progress', progress: 53, owner_code: 'EMP002', created_at: new Date().toISOString() },
      { id: 'a0000002', name: 'TPM OEE Improvement on Stamping Machine B', year: 2026, plant: 'Plant B', category: 'TPM', status: 'Planning', progress: 0, owner_code: 'EMP003', created_at: new Date().toISOString() },
      { id: 'a0000003', name: 'Kaizen Material Handling Cost Reduction', year: 2026, plant: 'Plant A', category: 'Kaizen', status: 'Completed', progress: 100, owner_code: 'EMP004', created_at: new Date().toISOString() }
    ],
    tasks: [
      // Project 1 Tasks
      { id: 't0000001', project_id: 'a0000001', parent_id: null, name: 'Preparation & Training', owner_code: 'EMP002', department: 'OS&CI', start_date: '2026-05-01', due_date: '2026-05-10', duration: 10, progress: 100, status: 'Completed', priority: 'High', dependency_id: null, is_milestone: false, sort_order: 1 },
      { id: 't0000002', project_id: 'a0000001', parent_id: 't0000001', name: 'Form 5S Steering Committee', owner_code: 'EMP002', department: 'OS&CI', start_date: '2026-05-01', due_date: '2026-05-04', duration: 4, progress: 100, status: 'Completed', priority: 'Medium', dependency_id: null, is_milestone: false, sort_order: 2 },
      { id: 't0000003', project_id: 'a0000001', parent_id: 't0000001', name: 'Kick-off Meeting & Awareness Training', owner_code: 'EMP005', department: 'Engineering', start_date: '2026-05-05', due_date: '2026-05-10', duration: 6, progress: 100, status: 'Completed', priority: 'Low', dependency_id: null, is_milestone: false, sort_order: 3 },
      
      { id: 't0000004', project_id: 'a0000001', parent_id: null, name: 'Sorting & Straightening (Seiri & Seiton)', owner_code: 'EMP003', department: 'Production', start_date: '2026-05-11', due_date: '2026-05-25', duration: 15, progress: 60, status: 'In Progress', priority: 'Critical', dependency_id: null, is_milestone: false, sort_order: 4 },
      { id: 't0000005', project_id: 'a0000001', parent_id: 't0000004', name: 'Sort Red-Tag Campaign (Remove Unnecessary Items)', owner_code: 'EMP003', department: 'Production', start_date: '2026-05-11', due_date: '2026-05-17', duration: 7, progress: 100, status: 'Completed', priority: 'High', dependency_id: null, is_milestone: false, sort_order: 5 },
      { id: 't0000006', project_id: 'a0000001', parent_id: 't0000004', name: 'Visual Management & Floor Layout Marking', owner_code: 'EMP004', department: 'Logistics', start_date: '2026-05-18', due_date: '2026-05-25', duration: 8, progress: 20, status: 'In Progress', priority: 'Critical', dependency_id: 't0000005', is_milestone: false, sort_order: 6 },
      
      { id: 't0000007', project_id: 'a0000001', parent_id: null, name: 'Shining & Standardizing (Seiso & Seiketsu)', owner_code: 'EMP002', department: 'OS&CI', start_date: '2026-05-26', due_date: '2026-06-15', duration: 21, progress: 0, status: 'Not Started', priority: 'Medium', dependency_id: null, is_milestone: false, sort_order: 7 },
      { id: 't0000008', project_id: 'a0000001', parent_id: 't0000007', name: 'Establish Cleaning Schedules & Responsibilities', owner_code: 'EMP002', department: 'OS&CI', start_date: '2026-05-26', due_date: '2026-06-02', duration: 8, progress: 0, status: 'Not Started', priority: 'Medium', dependency_id: 't0000006', is_milestone: false, sort_order: 8 },
      { id: 't0000009', project_id: 'a0000001', parent_id: 't0000007', name: 'Final Audit & Standardization Board Setup', owner_code: 'EMP003', department: 'Quality', start_date: '2026-06-03', due_date: '2026-06-15', duration: 13, progress: 0, status: 'Not Started', priority: 'High', dependency_id: 't0000008', is_milestone: true, sort_order: 9 },

      // Project 2 Tasks
      { id: 't0000010', project_id: 'a0000002', parent_id: null, name: 'Analyze Losses & Current OEE Baseline', owner_code: 'EMP003', department: 'Production', start_date: '2026-06-01', due_date: '2026-06-10', duration: 10, progress: 0, status: 'Not Started', priority: 'High', dependency_id: null, is_milestone: false, sort_order: 1 },
      { id: 't0000011', project_id: 'a0000002', parent_id: null, name: 'Implement Predictive Maintenance Schedule', owner_code: 'EMP005', department: 'Engineering', start_date: '2026-06-11', due_date: '2026-06-25', duration: 15, progress: 0, status: 'Not Started', priority: 'Critical', dependency_id: null, is_milestone: false, sort_order: 2 },

      // Project 3 Tasks
      { id: 't0000020', project_id: 'a0000003', parent_id: null, name: 'Route Optimization & Forklift Idle Reduction', owner_code: 'EMP004', department: 'Logistics', start_date: '2026-04-01', due_date: '2026-04-15', duration: 15, progress: 100, status: 'Completed', priority: 'High', dependency_id: null, is_milestone: false, sort_order: 1 },
      { id: 't0000021', project_id: 'a0000003', parent_id: null, name: 'Deploy AGV System in Assembly A', owner_code: 'EMP005', department: 'Engineering', start_date: '2026-04-16', due_date: '2026-05-15', duration: 30, progress: 100, status: 'Completed', priority: 'Critical', dependency_id: null, is_milestone: false, sort_order: 2 }
    ],
    task_attachments: [],
    activity_logs: [
      { id: 'l0001', project_id: 'a0000001', employee_code: 'EMP002', action_type: 'LOGIN', description: 'Kitti Prasertsook logged into workspace', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 'l0002', project_id: 'a0000001', employee_code: 'EMP002', action_type: 'UPDATE_TASK', description: 'Updated progress on task "Sort Red-Tag Campaign" to 100%', created_at: new Date(Date.now() - 1800000).toISOString() }
    ]
  };

  // =========================================================================
  // SUPABASE & SANDBOX MULTI-LAYER DATABASE ADAPTER
  // =========================================================================
  const db = {
    async init() {
      const url = localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || DEFAULT_SUPABASE_URL;
      const key = localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY) || DEFAULT_SUPABASE_KEY;
      const forceOffline = localStorage.getItem(STORAGE_KEYS.OFFLINE_MODE) === 'true';

      if (url && key && !forceOffline) {
        try {
          // Initialize Supabase SDK
          state.supabaseClient = supabase.createClient(url, key);
          
          // Test fetching employees as connection test
          const { data, error } = await state.supabaseClient.from('employee_master').select('count', { count: 'exact', head: true });
          if (error) throw error;
          
          state.isOfflineMode = false;
          showToast('Synchronized with Cloud Supabase successfully!', 'success');
          updateDbStatus(true);
          return true;
        } catch (err) {
          console.warn("Supabase failed, falling back to local sandbox:", err);
          state.isOfflineMode = true;
          updateDbStatus(false, "Connection Failed - Demo Sandboxed");
          showToast('Could not reach cloud. Working in Offline Demo Sandbox.', 'info');
        }
      } else {
        state.isOfflineMode = true;
        updateDbStatus(false, "Offline Demo Sandbox");
      }

      // Initialize sandbox datasets if empty in localStorage
      if (!localStorage.getItem(STORAGE_KEYS.SANDBOX_DATA)) {
        localStorage.setItem(STORAGE_KEYS.SANDBOX_DATA, JSON.stringify(DEFAULT_SANDBOX_DATA));
      }
      return false;
    },

    getSandbox() {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SANDBOX_DATA)) || DEFAULT_SANDBOX_DATA;
    },

    saveSandbox(data) {
      localStorage.setItem(STORAGE_KEYS.SANDBOX_DATA, JSON.stringify(data));
    },

    async logActivity(projectId, taskId, actionType, description) {
      const empCode = state.currentEmployee ? state.currentEmployee.employee_code : 'EMP001';
      const log = {
        project_id: projectId,
        task_id: taskId,
        employee_code: empCode,
        action_type: actionType,
        description: description,
        created_at: new Date().toISOString()
      };

      if (!state.isOfflineMode) {
        try {
          await state.supabaseClient.from('activity_logs').insert(log);
        } catch (e) { console.error("Cloud logging failed:", e); }
      }

      // Always save to sandbox for continuity
      const sand = this.getSandbox();
      log.id = 'l' + Math.random().toString(36).substr(2, 9);
      sand.activity_logs.unshift(log);
      if (sand.activity_logs.length > 50) sand.activity_logs.pop(); // Keep last 50
      this.saveSandbox(sand);
    },

    // PROJECTS CRUD
    async getProjects() {
      if (!state.isOfflineMode) {
        try {
          const { data, error } = await state.supabaseClient
            .from('projects')
            .select('*, employee_master(name)')
            .order('created_at', { ascending: false });
          if (error) throw error;
          
          // Format standard owner name
          return data.map(p => ({
            ...p,
            owner_name: p.employee_master ? p.employee_master.name : 'Unassigned'
          }));
        } catch (err) {
          console.error("Supabase getProjects error, using sandbox:", err);
        }
      }

      // Sandbox fallback
      const sand = this.getSandbox();
      return sand.projects.map(p => {
        const emp = sand.employee_master.find(e => e.employee_code === p.owner_code);
        return {
          ...p,
          owner_name: emp ? emp.name : 'Unassigned'
        };
      });
    },

    async saveProject(proj) {
      if (!state.isOfflineMode) {
        try {
          let res;
          if (proj.id) {
            res = await state.supabaseClient.from('projects').update(proj).eq('id', proj.id).select();
          } else {
            res = await state.supabaseClient.from('projects').insert(proj).select();
          }
          if (res.error) throw res.error;
          this.logActivity(proj.id || res.data[0].id, null, proj.id ? 'UPDATE_PROJECT' : 'CREATE_PROJECT', `Saved project details for "${proj.name}"`);
          return res.data[0];
        } catch (err) {
          console.error("Supabase saveProject error:", err);
          showToast('Failed to save in Cloud Supabase. Writing to local data.', 'error');
        }
      }

      // Sandbox Fallback
      const sand = this.getSandbox();
      if (proj.id) {
        const idx = sand.projects.findIndex(p => p.id === proj.id);
        if (idx !== -1) {
          sand.projects[idx] = { ...sand.projects[idx], ...proj };
        }
      } else {
        proj.id = 'a' + Math.random().toString(36).substr(2, 9);
        proj.progress = 0;
        proj.status = 'Planning';
        proj.created_at = new Date().toISOString();
        sand.projects.push(proj);
      }
      this.saveSandbox(sand);
      this.logActivity(proj.id, null, 'SAVE_PROJECT_SANDBOX', `Saved sandbox project "${proj.name}"`);
      return proj;
    },

    async deleteProject(id) {
      if (!state.isOfflineMode) {
        try {
          const { error } = await state.supabaseClient.from('projects').delete().eq('id', id);
          if (error) throw error;
          this.logActivity(id, null, 'DELETE_PROJECT', `Deleted project ID ${id}`);
          return true;
        } catch (err) {
          console.error("Supabase deleteProject error:", err);
        }
      }

      const sand = this.getSandbox();
      sand.projects = sand.projects.filter(p => p.id !== id);
      sand.tasks = sand.tasks.filter(t => t.project_id !== id); // Cascade
      this.saveSandbox(sand);
      this.logActivity(id, null, 'DELETE_PROJECT_SANDBOX', `Deleted sandbox project ID ${id}`);
      return true;
    },

    // TASKS SCHEDULER CRUD
    async getTasks(projectId) {
      if (!state.isOfflineMode) {
        try {
          const { data, error } = await state.supabaseClient
            .from('tasks')
            .select('*, employee_master(name)')
            .eq('project_id', projectId)
            .order('sort_order', { ascending: true });
          if (error) throw error;
          return data.map(t => ({
            ...t,
            owner_name: t.employee_master ? t.employee_master.name : ''
          }));
        } catch (err) {
          console.error("Supabase getTasks error:", err);
        }
      }

      // Sandbox Fallback
      const sand = this.getSandbox();
      return sand.tasks
        .filter(t => t.project_id === projectId)
        .map(t => {
          const emp = sand.employee_master.find(e => e.employee_code === t.owner_code);
          return {
            ...t,
            owner_name: emp ? emp.name : ''
          };
        })
        .sort((a, b) => a.sort_order - b.sort_order);
    },

    async saveTask(task) {
      // Ensure dates are valid
      if (new Date(task.due_date) < new Date(task.start_date)) {
        task.due_date = task.start_date;
      }
      task.duration = Math.max(1, Math.round((new Date(task.due_date) - new Date(task.start_date)) / (1000 * 60 * 60 * 24)) + 1);

      if (!state.isOfflineMode) {
        try {
          let res;
          if (task.id) {
            res = await state.supabaseClient.from('tasks').update(task).eq('id', task.id).select();
          } else {
            // Get max sort_order
            const { data: maxTask } = await state.supabaseClient.from('tasks').select('sort_order').eq('project_id', task.project_id).order('sort_order', { ascending: false }).limit(1);
            task.sort_order = maxTask && maxTask.length > 0 ? maxTask[0].sort_order + 1 : 1;
            res = await state.supabaseClient.from('tasks').insert(task).select();
          }
          if (res.error) throw res.error;
          
          this.logActivity(task.project_id, task.id || res.data[0].id, 'SAVE_TASK', `Saved task "${task.name}"`);
          return res.data[0];
        } catch (err) {
          console.error("Supabase saveTask error, writing to sandbox fallback:", err);
        }
      }

      // Sandbox Fallback
      const sand = this.getSandbox();
      if (task.id) {
        const idx = sand.tasks.findIndex(t => t.id === task.id);
        if (idx !== -1) {
          sand.tasks[idx] = { ...sand.tasks[idx], ...task };
        }
      } else {
        task.id = 't' + Math.random().toString(36).substr(2, 9);
        const projectTasks = sand.tasks.filter(t => t.project_id === task.project_id);
        task.sort_order = projectTasks.length > 0 ? Math.max(...projectTasks.map(t => t.sort_order)) + 1 : 1;
        sand.tasks.push(task);
      }

      // Perform trigger parent-child rollup logic manually in JS for the Sandbox Mode!
      this.recalculateSandboxRollups(sand, task.project_id);
      
      this.saveSandbox(sand);
      this.logActivity(task.project_id, task.id, 'SAVE_TASK_SANDBOX', `Saved sandbox task "${task.name}"`);
      return task;
    },

    async deleteTask(id) {
      let projectId = null;
      if (!state.isOfflineMode) {
        try {
          const { data: taskDetails } = await state.supabaseClient.from('tasks').select('project_id').eq('id', id).single();
          projectId = taskDetails ? taskDetails.project_id : null;
          
          const { error } = await state.supabaseClient.from('tasks').delete().eq('id', id);
          if (error) throw error;
          if (projectId) this.logActivity(projectId, null, 'DELETE_TASK', `Deleted task ID ${id}`);
          return true;
        } catch (err) {
          console.error("Supabase deleteTask error:", err);
        }
      }

      const sand = this.getSandbox();
      const task = sand.tasks.find(t => t.id === id);
      if (task) {
        projectId = task.project_id;
        // Cascade delete children
        const deleteRecursive = (taskId) => {
          sand.tasks = sand.tasks.filter(t => {
            if (t.parent_id === taskId) {
              deleteRecursive(t.id);
              return false;
            }
            return true;
          });
        };
        deleteRecursive(id);
        sand.tasks = sand.tasks.filter(t => t.id !== id);
        
        if (projectId) {
          this.recalculateSandboxRollups(sand, projectId);
        }
        this.saveSandbox(sand);
        this.logActivity(projectId, null, 'DELETE_TASK_SANDBOX', `Deleted sandbox task ID ${id}`);
      }
      return true;
    },

    // Sandbox Manual rollup calculator mirroring PostgreSQL triggers
    recalculateSandboxRollups(sand, projectId) {
      const pTasks = sand.tasks.filter(t => t.project_id === projectId);
      
      // We bubble up from children to parents recursively (up to 3 times for hierarchy depth)
      for (let run = 0; run < 3; run++) {
        pTasks.forEach(parent => {
          const children = pTasks.filter(c => c.parent_id === parent.id);
          if (children.length > 0) {
            // Start Date rollup (MIN)
            const startDates = children.map(c => new Date(c.start_date)).filter(d => !isNaN(d));
            if (startDates.length > 0) {
              const minStart = new Date(Math.min(...startDates));
              parent.start_date = minStart.toISOString().split('T')[0];
            }

            // Due Date rollup (MAX)
            const dueDates = children.map(c => new Date(c.due_date)).filter(d => !isNaN(d));
            if (dueDates.length > 0) {
              const maxDue = new Date(Math.max(...dueDates));
              parent.due_date = maxDue.toISOString().split('T')[0];
            }

            // Progress Rollup (weighted average)
            const avgProgress = children.reduce((sum, c) => sum + c.progress, 0) / children.length;
            parent.progress = Math.round(avgProgress);

            // Status Rollup
            const allCompleted = children.every(c => c.status === 'Completed');
            const anyDelayed = children.some(c => c.status === 'Delayed' || (new Date(c.due_date) < new Date() && c.progress < 100));
            const anyInProgress = children.some(c => c.status === 'In Progress' || c.progress > 0);

            if (parent.progress === 100 || allCompleted) {
              parent.status = 'Completed';
              parent.progress = 100;
            } else if (anyDelayed) {
              parent.status = 'Delayed';
            } else if (anyInProgress || parent.progress > 0) {
              parent.status = 'In Progress';
            } else {
              parent.status = 'Not Started';
            }

            parent.duration = Math.max(1, Math.round((new Date(parent.due_date) - new Date(parent.start_date)) / (1000 * 60 * 60 * 24)) + 1);
          }
        });
      }

      // Rollup to project level
      const project = sand.projects.find(p => p.id === projectId);
      if (project) {
        const topTasks = pTasks.filter(t => t.parent_id === null);
        if (topTasks.length > 0) {
          const avgProjProgress = topTasks.reduce((sum, t) => sum + t.progress, 0) / topTasks.length;
          project.progress = Math.round(avgProjProgress);

          const allCompleted = topTasks.every(t => t.status === 'Completed');
          const anyDelayed = topTasks.some(t => t.status === 'Delayed');
          const anyInProgress = topTasks.some(t => t.status === 'In Progress' || t.progress > 0);

          if (project.progress === 100 || allCompleted) {
            project.status = 'Completed';
            project.progress = 100;
          } else if (anyDelayed) {
            project.status = 'Delayed';
          } else if (anyInProgress || project.progress > 0) {
            project.status = 'In Progress';
          } else {
            project.status = 'Planning';
          }
        } else {
          project.progress = 0;
          project.status = 'Planning';
        }
      }
    },

    // EMPLOYEES CRUD
    async getEmployees() {
      if (!state.isOfflineMode) {
        try {
          const { data, error } = await state.supabaseClient
            .from('employee_master')
            .select('*')
            .order('employee_code', { ascending: true });
          if (error) throw error;
          return data;
        } catch (err) {
          console.error("Supabase getEmployees error:", err);
        }
      }

      const sand = this.getSandbox();
      return sand.employee_master;
    },

    async saveEmployee(emp) {
      if (!state.isOfflineMode) {
        try {
          const { data, error } = await state.supabaseClient
            .from('employee_master')
            .upsert(emp)
            .select();
          if (error) throw error;
          return data[0];
        } catch (err) {
          console.error("Supabase saveEmployee error:", err);
        }
      }

      const sand = this.getSandbox();
      const idx = sand.employee_master.findIndex(e => e.employee_code === emp.employee_code);
      if (idx !== -1) {
        sand.employee_master[idx] = { ...sand.employee_master[idx], ...emp };
      } else {
        sand.employee_master.push(emp);
      }
      this.saveSandbox(sand);
      return emp;
    },

    async deleteEmployee(code) {
      if (!state.isOfflineMode) {
        try {
          const { error } = await state.supabaseClient
            .from('employee_master')
            .delete()
            .eq('employee_code', code);
          if (error) throw error;
          return true;
        } catch (err) {
          console.error("Supabase deleteEmployee error:", err);
        }
      }

      const sand = this.getSandbox();
      sand.employee_master = sand.employee_master.filter(e => e.employee_code !== code);
      this.saveSandbox(sand);
      return true;
    },

    // EVIDENCE / ATTACHMENTS
    async getAttachments(taskId) {
      if (!state.isOfflineMode) {
        try {
          const { data, error } = await state.supabaseClient
            .from('task_attachments')
            .select('*, employee_master(name)')
            .eq('task_id', taskId);
          if (error) throw error;
          return data.map(a => ({
            ...a,
            uploader_name: a.employee_master ? a.employee_master.name : 'Unknown'
          }));
        } catch (e) {
          console.error("Supabase getAttachments error:", e);
        }
      }

      const sand = this.getSandbox();
      return sand.task_attachments
        .filter(a => a.task_id === taskId)
        .map(a => {
          const emp = sand.employee_master.find(e => e.employee_code === a.uploaded_by);
          return {
            ...a,
            uploader_name: emp ? emp.name : 'Unknown'
          };
        });
    },

    async uploadAttachment(taskId, fileName, fileBlob) {
      const uploader = state.currentEmployee ? state.currentEmployee.employee_code : 'EMP001';
      
      if (!state.isOfflineMode) {
        try {
          // 1. Save to Supabase Storage Bucket ('task-evidence')
          const storagePath = `task_${taskId}/${Date.now()}_${fileName}`;
          const { data: uploadData, error: uploadError } = await state.supabaseClient.storage
            .from('task-evidence')
            .upload(storagePath, fileBlob, { contentType: 'image/jpeg', cacheControl: '3600' });
            
          if (uploadError) throw uploadError;

          // 2. Fetch public url
          const { data: urlData } = state.supabaseClient.storage
            .from('task-evidence')
            .getPublicUrl(storagePath);
            
          const publicUrl = urlData ? urlData.publicUrl : '';

          // 3. Write metadata record
          const attachmentObj = {
            task_id: taskId,
            file_name: fileName,
            file_path: publicUrl,
            file_size: fileBlob.size,
            uploaded_by: uploader
          };

          const { data, error } = await state.supabaseClient
            .from('task_attachments')
            .insert(attachmentObj)
            .select();
            
          if (error) throw error;
          
          this.logActivity(null, taskId, 'UPLOAD_EVIDENCE', `Uploaded cloud evidence "${fileName}"`);
          return data[0];
        } catch (err) {
          console.error("Supabase Storage upload failed, writing locally to sandbox:", err);
          showToast('Failed cloud upload. Saved to sandboxed memory.', 'info');
        }
      }

      // Sandbox Offline Mode - Save as Base64 Image
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(fileBlob);
        reader.onloadend = () => {
          const base64data = reader.result;
          const sand = this.getSandbox();
          const newAttach = {
            id: 'at' + Math.random().toString(36).substr(2, 9),
            task_id: taskId,
            file_name: fileName,
            file_path: base64data,
            file_size: fileBlob.size,
            uploaded_by: uploader,
            created_at: new Date().toISOString()
          };
          sand.task_attachments.push(newAttach);
          this.saveSandbox(sand);
          this.logActivity(null, taskId, 'UPLOAD_EVIDENCE_SANDBOX', `Uploaded local evidence "${fileName}"`);
          resolve(newAttach);
        };
      });
    },

    async deleteAttachment(id) {
      if (!state.isOfflineMode) {
        try {
          // Simplify by removing db record directly, let bucket clean up via periodic sweep or storage cascades
          const { error } = await state.supabaseClient.from('task_attachments').delete().eq('id', id);
          if (error) throw error;
          return true;
        } catch (e) { console.error("Cloud delete attachment failed:", e); }
      }

      const sand = this.getSandbox();
      sand.task_attachments = sand.task_attachments.filter(a => a.id !== id);
      this.saveSandbox(sand);
      return true;
    },

    // DYNAMIC SYSTEM CONFIG FOR LIST ENUMS
    async fetchSystemSettings() {
      if (!state.isOfflineMode) {
        try {
          const { data, error } = await state.supabaseClient.from('system_settings').select('*');
          if (error) throw error;
          if (data && data.length > 0) {
            data.forEach(set => {
              if (set.key === 'plant_list') state.systemSettings.plants = set.value;
              if (set.key === 'departments') state.systemSettings.departments = set.value;
              if (set.key === 'categories') state.systemSettings.categories = set.value;
              if (set.key === 'admin_pin') state.systemSettings.adminPin = set.value.pin;
            });
          }
          return;
        } catch (e) { console.warn("Supabase load system settings failed, using defaults:", e); }
      }

      // Offline Sandbox Mode persistence
      try {
        const saved = localStorage.getItem('osci_sandbox_settings');
        if (saved) {
          state.systemSettings = JSON.parse(saved);
        } else {
          localStorage.setItem('osci_sandbox_settings', JSON.stringify(state.systemSettings));
        }
      } catch (e) {
        console.error("Offline fetchSystemSettings error:", e);
      }
    },

    async saveSystemSettings(settings) {
      if (!state.isOfflineMode) {
        try {
          // Upsert keys into cloud system_settings table
          const r1 = await state.supabaseClient.from('system_settings').upsert({ key: 'plant_list', value: settings.plants });
          if (r1.error) throw new Error(`plant_list: ${r1.error.message}`);

          const r2 = await state.supabaseClient.from('system_settings').upsert({ key: 'departments', value: settings.departments });
          if (r2.error) throw new Error(`departments: ${r2.error.message}`);

          const r3 = await state.supabaseClient.from('system_settings').upsert({ key: 'categories', value: settings.categories });
          if (r3.error) throw new Error(`categories: ${r3.error.message}`);

          const r4 = await state.supabaseClient.from('system_settings').upsert({ key: 'admin_pin', value: { pin: settings.adminPin } });
          if (r4.error) throw new Error(`admin_pin: ${r4.error.message}`);
        } catch (e) {
          console.error("Cloud saveSystemSettings error:", e);
          throw e;
        }
      }

      // Save to sandbox settings
      localStorage.setItem('osci_sandbox_settings', JSON.stringify(settings));
      state.systemSettings = settings;
    }
  };

  // =========================================================================
  // TOAST FLOATING ALERTS & UI STATUS HANDLERS
  // =========================================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'x-circle';

    toast.innerHTML = `
      <i data-lucide="${icon}"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    lucide.createIcons();

    // Auto dismiss
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function updateDbStatus(isOnline, customText = '') {
    const dot = document.getElementById('db-status-dot');
    const text = document.getElementById('db-status-text');
    if (!dot || !text) return;

    if (isOnline) {
      dot.className = "status-dot";
      text.textContent = "Supabase Cloud Online";
    } else {
      dot.className = "status-dot offline";
      text.textContent = customText || "Sandbox Offline Mode";
    }
  }

  // =========================================================================
  // CORE AUTHENTICATION CONSOLE LAYER
  // =========================================================================
  async function performLogin(employeeCode) {
    const errorText = document.getElementById('login-error-text');
    errorText.style.display = 'none';

    try {
      // Refresh employees set
      state.employees = await db.getEmployees();
      
      const employee = state.employees.find(
        e => e.employee_code.toLowerCase().trim() === employeeCode.toLowerCase().trim()
      );

      if (employee) {
        if (employee.status !== 'ACTIVE') {
          errorText.textContent = 'Account inactive. Contact OS&CI Administrator.';
          errorText.style.display = 'block';
          return false;
        }

        // Login Success
        state.currentEmployee = employee;
        state.currentRole = employee.role;

        // Persist session
        localStorage.setItem(STORAGE_KEYS.SESSION_EMPLOYEE, JSON.stringify(employee));
        localStorage.setItem(STORAGE_KEYS.SESSION_ROLE, employee.role);

        // Hide overlay screen
        document.getElementById('login-screen').style.display = 'none';
        
        // Load configurations
        await db.fetchSystemSettings();
        
        // Refresh entire state layout
        setupUIForEmployee();
        routeTo(window.location.hash || '#/dashboard');
        
        showToast(`Welcome back, ${employee.name}!`, 'success');
        db.logActivity(null, null, 'LOGIN', `Employee ${employee.name} logged into dashboard`);
        return true;
      } else {
        errorText.textContent = 'Invalid Employee Code. Please re-enter.';
        errorText.style.display = 'block';
        return false;
      }
    } catch (e) {
      console.error(e);
      errorText.textContent = 'Database offline. Try the Sandbox emergency PIN bypass.';
      errorText.style.display = 'block';
    }
  }

  function checkSession() {
    const saved = localStorage.getItem(STORAGE_KEYS.SESSION_EMPLOYEE);
    if (saved) {
      state.currentEmployee = JSON.parse(saved);
      state.currentRole = localStorage.getItem(STORAGE_KEYS.SESSION_ROLE) || 'VIEWER';
      document.getElementById('login-screen').style.display = 'none';
      setupUIForEmployee();
      db.fetchSystemSettings().then(() => {
        routeTo(window.location.hash || '#/dashboard');
      });
    } else {
      document.getElementById('login-screen').style.display = 'flex';
    }
  }

  function performLogout() {
    localStorage.removeItem(STORAGE_KEYS.SESSION_EMPLOYEE);
    localStorage.removeItem(STORAGE_KEYS.SESSION_ROLE);
    state.currentEmployee = null;
    state.currentRole = null;
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('employee-code-input').value = '';
    showToast('Log out successful.', 'info');
  }

  function setupUIForEmployee() {
    if (!state.currentEmployee) return;

    // Set avatar & profile labels on sidebar
    const initial = state.currentEmployee.name.charAt(0);
    document.getElementById('user-profile-avatar').textContent = initial;
    document.getElementById('user-profile-name').textContent = state.currentEmployee.name;
    document.getElementById('user-profile-role').textContent = `${state.currentEmployee.department} - ${state.currentEmployee.role}`;

    // Hide or show Admin Management Nav item based on role
    const usersNav = document.getElementById('nav-users');
    if (state.currentRole === 'OSCI_ADMIN') {
      usersNav.style.display = 'flex';
    } else {
      usersNav.style.display = 'none';
    }
  }

  // =========================================================================
  // SPA ROUTER IMPLEMENTATION
  // =========================================================================
  function routeTo(hash) {
    if (!state.currentEmployee) {
      document.getElementById('login-screen').style.display = 'flex';
      return;
    }

    let cleanHash = hash.replace(/^#\/?/, '');
    let view = 'dashboard';
    let projectId = null;

    if (cleanHash.startsWith('projects/') && cleanHash.endsWith('/scheduler')) {
      view = 'scheduler';
      projectId = cleanHash.split('/')[1];
    } else if (cleanHash) {
      view = cleanHash;
    }

    state.currentView = view;
    state.activeProjectId = projectId;
    window.location.hash = hash;

    // Handle Active States of Sidebar menu buttons
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-target') === view) {
        btn.classList.add('active');
      }
    });

    // Handle viewport swapping
    document.querySelectorAll('.screen-content, .scheduler-shell').forEach(viewEl => {
      viewEl.style.display = 'none';
    });

    // Update screen header title
    const pageTitle = document.getElementById('page-title');
    const headerBar = document.querySelector('header.navbar');
    headerBar.style.display = 'flex';

    if (view === 'dashboard') {
      document.getElementById('view-dashboard').style.display = 'block';
      pageTitle.textContent = "Manufacturing Dashboard";
      loadDashboardKPIs();
    } else if (view === 'projects') {
      document.getElementById('view-projects').style.display = 'block';
      pageTitle.textContent = "OS&CI Projects Control Room";
      loadProjectsList();
    } else if (view === 'scheduler') {
      headerBar.style.display = 'none'; // Scheduler has its own premium layout header
      document.getElementById('view-scheduler').style.display = 'flex';
      loadSchedulerWorkspace(projectId);
    } else if (view === 'users') {
      if (state.currentRole !== 'OSCI_ADMIN') {
        showToast('Access denied: Administrator permissions required.', 'error');
        routeTo('#/dashboard');
        return;
      }
      document.getElementById('view-users').style.display = 'block';
      pageTitle.textContent = "User Profiles & Security Matrix";
      loadUsersConsole();
    } else if (view === 'settings') {
      document.getElementById('view-settings').style.display = 'block';
      pageTitle.textContent = "System Preferences";
      loadSettingsPanel();
    }
  }

  // =========================================================================
  // VIEW: DASHBOARD PANEL RENDERERS
  // =========================================================================
  async function loadDashboardKPIs() {
    try {
      const projs = await db.getProjects();
      let allTasks = [];
      
      for (const p of projs) {
        const ts = await db.getTasks(p.id);
        allTasks.push(...ts);
      }

      // Count operations
      const activeTasks = allTasks.filter(t => t.status !== 'Completed');
      const delayedTasks = allTasks.filter(t => t.status === 'Delayed' || (new Date(t.due_date) < new Date() && t.progress < 100));
      
      // Due this week
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
      const dueThisWeek = allTasks.filter(t => {
        const due = new Date(t.due_date);
        return t.status !== 'Completed' && due >= new Date() && due <= oneWeekFromNow;
      });

      const completedKaizens = projs.filter(p => p.status === 'Completed').length;

      // Update UI tiles
      document.getElementById('kpi-total-tasks').textContent = activeTasks.length;
      document.getElementById('kpi-delayed-tasks').textContent = delayedTasks.length;
      document.getElementById('kpi-due-week').textContent = dueThisWeek.length;
      document.getElementById('kpi-completed-projects').textContent = completedKaizens;

      // Fill "My Tasks Checklist"
      const myTasksBox = document.getElementById('dashboard-my-tasks');
      myTasksBox.innerHTML = '';

      const myTasks = allTasks.filter(
        t => t.owner_code === state.currentEmployee.employee_code && t.status !== 'Completed'
      );

      if (myTasks.length === 0) {
        myTasksBox.innerHTML = `
          <div style="text-align: center; color: var(--text-secondary); padding: 32px 0;">
            <i data-lucide="check-circle-2" style="font-size: 24px; margin-bottom: 8px; color: var(--status-green-text);"></i>
            <div>Excellent! No outstanding tasks assigned to you.</div>
          </div>
        `;
      } else {
        myTasks.forEach(t => {
          const proj = projs.find(p => p.id === t.project_id);
          const taskRow = document.createElement('div');
          taskRow.className = `my-task-item ${t.status === 'Completed' ? 'completed' : ''}`;
          
          taskRow.innerHTML = `
            <div class="my-task-left">
              <div class="custom-checkbox" data-id="${t.id}">
                <i data-lucide="check" style="width: 12px; height: 12px;"></i>
              </div>
              <div>
                <span class="my-task-name">${t.name}</span>
                <div class="my-task-details">
                  <span class="my-task-project">${proj ? proj.name.substring(0, 30) + '...' : 'Project'}</span>
                  <span>Due: ${t.due_date}</span>
                </div>
              </div>
            </div>
            <span class="status-badge ${t.status.toLowerCase().replace(' ', '-')}">${t.status}</span>
          `;

          // Handle checklist quick completion click
          taskRow.querySelector('.custom-checkbox').addEventListener('click', async (e) => {
            e.stopPropagation();
            t.progress = 100;
            t.status = 'Completed';
            await db.saveTask(t);
            showToast(`Task "${t.name}" marked complete!`, 'success');
            loadDashboardKPIs(); // Reload stats
          });

          myTasksBox.appendChild(taskRow);
        });
      }

      // Load recent audit logs
      const sand = db.getSandbox();
      const logsBox = document.getElementById('dashboard-activity-logs');
      logsBox.innerHTML = '';
      
      const sortedLogs = sand.activity_logs.slice(0, 10);
      if (sortedLogs.length === 0) {
        logsBox.innerHTML = `<span style="color: var(--text-secondary);">No logs yet recorded.</span>`;
      } else {
        sortedLogs.forEach(l => {
          const emp = sand.employee_master.find(e => e.employee_code === l.employee_code);
          const name = emp ? emp.name : l.employee_code;
          const logEl = document.createElement('div');
          logEl.className = 'activity-item';
          
          const formattedTime = new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          logEl.innerHTML = `
            <div class="activity-marker"></div>
            <div class="activity-text">
              <span class="activity-desc"><strong>${name}</strong>: ${l.description}</span>
              <div class="activity-time">${formattedTime} - ${new Date(l.created_at).toLocaleDateString()}</div>
            </div>
          `;
          logsBox.appendChild(logEl);
        });
      }

      lucide.createIcons();
    } catch (e) {
      console.error(e);
    }
  }

  // =========================================================================
  // VIEW: PROJECTS PORTAL RENDERERS
  // =========================================================================
  async function loadProjectsList() {
    const tbody = document.getElementById('projects-table-body');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Refreshing project matrix...</td></tr>';

    try {
      state.projects = await db.getProjects();
      
      // Get filter parameters
      const search = document.getElementById('project-search').value.toLowerCase().trim();
      const plant = document.getElementById('project-filter-plant').value;
      const category = document.getElementById('project-filter-category').value;

      // Apply filtering
      const filtered = state.projects.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search) || p.owner_name.toLowerCase().includes(search);
        const matchesPlant = plant === 'All' || p.plant === plant;
        const matchesCat = category === 'All' || p.category === category;
        return matchesSearch && matchesPlant && matchesCat;
      });

      tbody.innerHTML = '';
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 40px;">No projects match current filter selection.</td></tr>';
        return;
      }

      filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong style="color: var(--text-primary); cursor: pointer;" class="project-title-link" data-id="${p.id}">${p.name}</strong></td>
          <td>${p.year}</td>
          <td>${p.plant}</td>
          <td><span class="category-badge">${p.category}</span></td>
          <td><span class="status-badge ${p.status.toLowerCase().replace(' ', '-')}">${p.status}</span></td>
          <td>
            <div class="progress-container">
              <div class="progress-bar-bg">
                <div class="progress-bar-fill ${p.progress === 100 ? 'completed' : ''}" style="width: ${p.progress}%;"></div>
              </div>
              <span class="progress-text">${p.progress}%</span>
            </div>
          </td>
          <td>${p.owner_name}</td>
          <td style="text-align: right; padding-right: 16px;">
            <div class="table-actions" style="justify-content: flex-end;">
              <button class="action-btn primary table-btn-sched" data-id="${p.id}" title="Open Project Interactive Scheduler" style="padding: 4px 10px; font-size: 11px;">
                <i data-lucide="gantt-chart" style="width: 14px; height: 14px;"></i> Open Scheduler
              </button>
              <button class="table-btn table-btn-edit" data-id="${p.id}" title="Edit Project Properties"><i data-lucide="edit-3" style="width: 16px; height: 16px;"></i></button>
              <button class="table-btn table-btn-delete" data-id="${p.id}" title="Delete Project" style="color: var(--status-red-text);"><i data-lucide="trash-2" style="width: 16px; height: 16px;"></i></button>
            </div>
          </td>
        `;

        // Action Bindings
        tr.querySelector('.project-title-link').addEventListener('click', () => routeTo(`#/projects/${p.id}/scheduler`));
        tr.querySelector('.table-btn-sched').addEventListener('click', () => routeTo(`#/projects/${p.id}/scheduler`));
        
        tr.querySelector('.table-btn-edit').addEventListener('click', () => openProjectModal(p.id));
        tr.querySelector('.table-btn-delete').addEventListener('click', () => deleteProjectPrompt(p.id, p.name));

        tbody.appendChild(tr);
      });

      lucide.createIcons();
    } catch (err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--status-red-text);">Error loading projects list.</td></tr>';
    }
  }

  // Project Editing Modals
  async function openProjectModal(projectId = null) {
    const modal = document.getElementById('modal-project');
    const form = document.getElementById('project-form-action');
    const title = document.getElementById('project-modal-title');
    
    // Clear forms
    form.reset();
    document.getElementById('project-id-field').value = '';

    // Populate drop selectors
    const plantField = document.getElementById('project-plant-field');
    plantField.innerHTML = '';
    state.systemSettings.plants.forEach(p => {
      plantField.innerHTML += `<option value="${p}">${p}</option>`;
    });

    const catField = document.getElementById('project-category-field');
    catField.innerHTML = '';
    state.systemSettings.categories.forEach(c => {
      catField.innerHTML += `<option value="${c}">${c}</option>`;
    });

    const employees = await db.getEmployees();
    const ownerField = document.getElementById('project-owner-field');
    ownerField.innerHTML = '';
    employees.forEach(e => {
      ownerField.innerHTML += `<option value="${e.employee_code}">${e.name} (${e.department})</option>`;
    });

    if (projectId) {
      title.textContent = "Modify Project Parameters";
      const p = state.projects.find(x => x.id === projectId);
      if (p) {
        document.getElementById('project-id-field').value = p.id;
        document.getElementById('project-name-field').value = p.name;
        document.getElementById('project-year-field').value = p.year;
        document.getElementById('project-plant-field').value = p.plant;
        document.getElementById('project-category-field').value = p.category;
        document.getElementById('project-owner-field').value = p.owner_code;
      }
    } else {
      title.textContent = "Initialize OS&CI Master Project";
    }

    modal.classList.add('active');
  }

  async function handleProjectSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('project-id-field').value;
    const name = document.getElementById('project-name-field').value;
    const year = parseInt(document.getElementById('project-year-field').value);
    const plant = document.getElementById('project-plant-field').value;
    const category = document.getElementById('project-category-field').value;
    const ownerCode = document.getElementById('project-owner-field').value;

    const projData = {
      name,
      year,
      plant,
      category,
      owner_code: ownerCode
    };

    if (id) projData.id = id;

    await db.saveProject(projData);
    document.getElementById('modal-project').classList.remove('active');
    showToast('Project configured and synced successfully!', 'success');
    loadProjectsList();
  }

  async function deleteProjectPrompt(id, name) {
    if (confirm(`Are you absolutely sure you want to delete the project "${name}"?\nThis action cascades and deletes all scheduling tasks and files!`)) {
      await db.deleteProject(id);
      showToast('Project deleted successfully.', 'info');
      loadProjectsList();
    }
  }

  // =========================================================================
  // VIEW: CORE INTERACTIVE SCHEDULER & GANTT ENGINE
  // =========================================================================
  let GANTT_COL_WIDTH = parseInt(localStorage.getItem('osci_gantt_col_width')) || 40; // Spacious calendar day column width (improved from 28px)
  let timelineDates = []; // Array of Date objects displayed in Gantt columns
  const expandedNodes = new Set(); // Remembers closed state of rows

  async function loadSchedulerWorkspace(projectId) {
    try {
      state.projects = await db.getProjects();
      const proj = state.projects.find(p => p.id === projectId);
      
      if (!proj) {
        showToast('Target manufacturing project not found!', 'error');
        routeTo('#/projects');
        return;
      }

      // Render Header Meta
      document.getElementById('scheduler-project-name').textContent = proj.name;
      document.getElementById('scheduler-project-meta').textContent = `${proj.plant} plant | Category: ${proj.category} | Progress rollup: ${proj.progress}%`;

      // Fetch active tasks list
      state.tasks = await db.getTasks(projectId);
      
      // Calculate dynamic Gantt date span bounds
      calculateTimelineSpan();
      
      // Render tree tables and charts
      renderWorkbookWorkspace();
      
      // Synchronize Scroll offsets between table pane and timeline grid
      syncSplitPaneScrolls();
      
    } catch (e) {
      console.error(e);
      showToast('Failed to initialize scheduling workbench.', 'error');
    }
  }

  function calculateTimelineSpan() {
    const dates = [];
    state.tasks.forEach(t => {
      if (t.start_date) dates.push(new Date(t.start_date));
      if (t.due_date) dates.push(new Date(t.due_date));
    });

    let startDate, endDate;
    if (dates.length > 0) {
      startDate = new Date(Math.min(...dates));
      endDate = new Date(Math.max(...dates));
    } else {
      // Default span starting today if empty
      startDate = new Date();
      endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // 30 days default
    }

    // Add padding buffers before and after (1 week each)
    startDate.setDate(startDate.getDate() - 5);
    endDate.setDate(endDate.getDate() + 10);

    // Normalize timeline dates array
    timelineDates = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      timelineDates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  }

  // Prepares tree maps out of flat SQL arrays
  function buildTaskTree(flatTasks) {
    const taskMap = {};
    const tree = [];

    flatTasks.forEach(t => {
      taskMap[t.id] = { ...t, children: [], depth: 0 };
    });

    flatTasks.forEach(t => {
      const mapped = taskMap[t.id];
      if (t.parent_id && taskMap[t.parent_id]) {
        taskMap[t.parent_id].children.push(mapped);
      } else {
        tree.push(mapped);
      }
    });

    // Sort top level tasks by sort_order
    tree.sort((a, b) => a.sort_order - b.sort_order);

    // Calculate depths and clean orders recursively
    const calculateDepth = (node, depth, wbsPrefix) => {
      node.depth = depth;
      
      // Keep children sorted by sort_order
      node.children.sort((a, b) => a.sort_order - b.sort_order);
      
      node.children.forEach((c, idx) => {
        const wbs = `${wbsPrefix}.${idx + 1}`;
        c.wbs = wbs;
        calculateDepth(c, depth + 1, wbs);
      });
    };

    tree.forEach((t, idx) => {
      const wbs = `${idx + 1}`;
      t.wbs = wbs;
      calculateDepth(t, 0, wbs);
    });

    // Flatten tree back to array respecting visual node expansions
    const flattened = [];
    const flattenNode = (node) => {
      flattened.push(node);
      
      // If node is expanded, recursively append active children
      const isExpanded = !state.expandedTasks.has(node.id); // Default is expanded (expandedTasks maintains collapsed keys)
      if (isExpanded && node.children.length > 0) {
        node.children.forEach(c => flattenNode(c));
      }
    };

    tree.forEach(t => flattenNode(t));
    return flattened;
  }

  async function renderWorkbookWorkspace() {
    const tableBody = document.getElementById('scheduler-tasks-body');
    const headerGrid = document.getElementById('gantt-timeline-header-grid');
    const colsLayer = document.getElementById('gantt-grid-columns-layer');
    const barsContainer = document.getElementById('gantt-bars-container');

    // Reset viewports
    tableBody.innerHTML = '';
    headerGrid.innerHTML = '';
    colsLayer.innerHTML = '';
    barsContainer.innerHTML = '';

    // Calculate CSS Grid Column setup based on days scale
    const colCount = timelineDates.length;
    const gridStyle = `grid-template-columns: repeat(${colCount}, ${GANTT_COL_WIDTH}px);`; // Spacious layout widths
    headerGrid.setAttribute('style', gridStyle);
    colsLayer.setAttribute('style', gridStyle);

    // 1. Render Gantt Timeline Scale Headers
    let lastMonth = '';
    timelineDates.forEach(date => {
      // Background Grid Line Columns
      const colEl = document.createElement('div');
      colEl.className = 'gantt-grid-column';
      
      const day = date.getDay();
      if (day === 0 || day === 6) {
        colEl.style.backgroundColor = 'rgba(0,0,0,0.02)'; // Soft highlight weekends
      }
      colsLayer.appendChild(colEl);

      // Date Header labels
      const headerUnit = document.createElement('div');
      headerUnit.className = 'gantt-scale-unit';
      
      // Soft highlight weekend headers for high-fidelity manufacturing workdays spotting
      if (day === 0 || day === 6) {
        headerUnit.style.backgroundColor = 'var(--bg-primary)';
        headerUnit.style.color = 'var(--text-secondary)';
      }
      
      const dayNum = date.getDate();
      const monthLabel = date.toLocaleString('default', { month: 'short' });
      
      // Show month headers
      if (monthLabel !== lastMonth) {
        headerUnit.innerHTML = `<span style="font-weight: 700; color: var(--color-primary);">${dayNum} ${monthLabel}</span>`;
        lastMonth = monthLabel;
      } else {
        headerUnit.textContent = dayNum;
      }
      headerGrid.appendChild(headerUnit);
    });

    // 2. Structuring Tree tasks
    const activeWorkspaceTasks = buildTaskTree(state.tasks);
    
    // Fetch dropdown list options
    const emps = await db.getEmployees();
    const depts = state.systemSettings.departments;

    if (activeWorkspaceTasks.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="13" style="text-align: center; color: var(--text-secondary); padding: 48px;">
            This project does not contain scheduled tasks yet. Click "Add Main Task" or "Import" to establish your schedule.
          </td>
        </tr>
      `;
      return;
    }

    // 3. Render row details
    activeWorkspaceTasks.forEach((t) => {
      const isParent = state.tasks.some(x => x.parent_id === t.id);
      const isExpanded = !state.expandedTasks.has(t.id);
      
      // --- TABLE ROW ELEMENT ---
      const tr = document.createElement('tr');
      tr.className = `workbook-row ${t.parent_id ? 'sub-row' : ''}`;
      tr.setAttribute('data-id', t.id);
      
      // Format Owner selection
      let ownerOptions = `<option value="">Unassigned</option>`;
      emps.forEach(e => {
        ownerOptions += `<option value="${e.employee_code}" ${t.owner_code === e.employee_code ? 'selected' : ''}>${e.name}</option>`;
      });

      // Format Dept selection
      let deptOptions = `<option value="">Choose...</option>`;
      depts.forEach(d => {
        deptOptions += `<option value="${d}" ${t.department === d ? 'selected' : ''}>${d}</option>`;
      });

      // Left branch margins padding
      const indentOffset = t.depth * 16;
      const expandIcon = isParent ? `<div class="tree-expander ${!isExpanded ? 'collapsed' : ''}" data-id="${t.id}"><i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i></div>` : '<div class="tree-indent"></div>';

      tr.innerHTML = `
        <td class="sticky-col" style="text-align: center; width: 40px; border-right: 1px solid var(--border-color); background-color: var(--bg-secondary);">
          <i data-lucide="grip-vertical" class="row-grabber" draggable="true" data-id="${t.id}"></i>
        </td>
        <td class="sticky-col" style="left: 40px; width: 60px; font-weight: 600; text-align: center; color: var(--text-secondary); background-color: var(--bg-secondary);">${t.wbs}</td>
        
        <td class="sticky-col editable-cell" style="left: 100px; width: 240px; background-color: var(--bg-secondary);">
          <div class="task-tree-cell" style="padding-left: ${indentOffset}px;">
            ${expandIcon}
            <input type="text" class="cell-input" value="${t.name}" data-field="name" data-id="${t.id}" ${isParent ? 'style="font-weight:600;"' : ''}>
          </div>
        </td>
        
        <td class="editable-cell">
          <select class="cell-select" data-field="owner_code" data-id="${t.id}">${ownerOptions}</select>
        </td>
        <td class="editable-cell">
          <select class="cell-select" data-field="department" data-id="${t.id}">${deptOptions}</select>
        </td>
        
        <td class="editable-cell" style="text-align: center;">
          <input type="date" class="cell-input" value="${t.start_date}" data-field="start_date" data-id="${t.id}" ${isParent ? 'disabled' : ''}>
        </td>
        <td class="editable-cell" style="text-align: center;">
          <input type="date" class="cell-input" value="${t.due_date}" data-field="due_date" data-id="${t.id}" ${isParent ? 'disabled' : ''}>
        </td>
        
        <td style="text-align: center; font-weight: 500;">${t.duration}d</td>
        
        <td class="editable-cell" style="text-align: center;">
          <input type="number" class="cell-input" value="${t.progress}" min="0" max="100" data-field="progress" data-id="${t.id}" style="text-align: center; font-weight: 600;" ${isParent ? 'disabled' : ''}>
        </td>
        
        <td class="editable-cell" style="text-align: center;">
          <select class="cell-select status-select-cell ${t.status.toLowerCase().replace(' ', '-')}" data-field="status" data-id="${t.id}" ${isParent ? 'disabled' : ''}>
            <option value="Not Started" ${t.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
            <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Completed" ${t.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Delayed" ${t.status === 'Delayed' ? 'selected' : ''}>Delayed</option>
          </select>
        </td>
        
        <td class="editable-cell" style="text-align: center;">
          <select class="cell-select priority-select-cell ${t.priority.toLowerCase()}" data-field="priority" data-id="${t.id}">
            <option value="Low" ${t.priority === 'Low' ? 'selected' : ''}>Low</option>
            <option value="Medium" ${t.priority === 'Medium' ? 'selected' : ''}>Medium</option>
            <option value="High" ${t.priority === 'High' ? 'selected' : ''}>High</option>
            <option value="Critical" ${t.priority === 'Critical' ? 'selected' : ''}>Critical</option>
          </select>
        </td>
        
        <td style="text-align: center;">
          <button class="table-btn uploader-btn" data-id="${t.id}" title="Upload Audit Evidence/Images" style="color: var(--color-primary);">
            <i data-lucide="image" style="width: 16px; height: 16px;"></i>
          </button>
        </td>
        
        <td style="text-align: center;">
          <div class="table-actions" style="justify-content: center;">
            <button class="table-btn add-subtask-btn" data-id="${t.id}" title="Add child task"><i data-lucide="corner-down-right" style="width: 14px; height: 14px;"></i></button>
            <button class="table-btn delete-task-btn" data-id="${t.id}" title="Delete Task" style="color: var(--status-red-text);"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
          </div>
        </td>
      `;

      // Event binds
      const expander = tr.querySelector('.tree-expander');
      if (expander) {
        expander.addEventListener('click', () => {
          if (state.expandedTasks.has(t.id)) {
            state.expandedTasks.delete(t.id);
          } else {
            state.expandedTasks.add(t.id);
          }
          renderWorkbookWorkspace();
        });
      }

      // Inline edits triggers
      tr.querySelectorAll('.cell-input, .cell-select').forEach(input => {
        input.addEventListener('change', async (e) => {
          const field = e.target.getAttribute('data-field');
          let val = e.target.value;

          if (field === 'progress') val = Math.max(0, Math.min(100, parseInt(val) || 0));

          const updatedTask = { id: t.id, project_id: t.project_id };
          updatedTask[field] = val;

          // If date changed, perform logical validation on standard fields
          if (field === 'start_date' || field === 'due_date') {
            const startStr = field === 'start_date' ? val : t.start_date;
            const dueStr = field === 'due_date' ? val : t.due_date;
            if (new Date(dueStr) < new Date(startStr)) {
              showToast('Target due date cannot be earlier than start date.', 'error');
              renderWorkbookWorkspace();
              return;
            }
          }

          showToast('Saving scheduling card...', 'info');
          await db.saveTask(updatedTask);
          
          // Re-render
          loadSchedulerWorkspace(state.activeProjectId);
        });
      });

      // Row Actions binds
      tr.querySelector('.add-subtask-btn').addEventListener('click', () => {
        openTaskModal(null, t.id);
      });
      tr.querySelector('.delete-task-btn').addEventListener('click', () => {
        if (confirm(`Remove scheduled task "${t.name}"?`)) {
          db.deleteTask(t.id).then(() => {
            loadSchedulerWorkspace(state.activeProjectId);
            showToast('Task removed from board.', 'info');
          });
        }
      });
      tr.querySelector('.uploader-btn').addEventListener('click', () => {
        openEvidenceModal(t.id, t.name);
      });

      // Drag and Drop Sort events
      const grabber = tr.querySelector('.row-grabber');
      grabber.addEventListener('dragstart', (e) => {
        tr.classList.add('dragging');
        e.dataTransfer.setData('text/plain', t.id);
      });
      grabber.addEventListener('dragend', () => {
        tr.classList.remove('dragging');
      });

      tr.addEventListener('dragover', (e) => {
        e.preventDefault();
      });

      tr.addEventListener('drop', async (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId === t.id) return;

        const draggedTask = state.tasks.find(x => x.id === draggedId);
        const targetTask = t;

        if (draggedTask && targetTask) {
          // Keep same level hierarchy sorting swaps
          draggedTask.parent_id = targetTask.parent_id;
          
          // Adjust sorting allocations
          const brotherTasks = state.tasks.filter(x => x.parent_id === targetTask.parent_id && x.id !== draggedId);
          const targetIdx = brotherTasks.findIndex(x => x.id === targetTask.id);
          
          // Inject
          brotherTasks.splice(targetIdx, 0, draggedTask);
          
          // Batch save sort allocations
          for (let i = 0; i < brotherTasks.length; i++) {
            brotherTasks[i].sort_order = i + 1;
            await db.saveTask({ id: brotherTasks[i].id, sort_order: i + 1, parent_id: brotherTasks[i].parent_id, project_id: t.project_id });
          }

          loadSchedulerWorkspace(state.activeProjectId);
          showToast('Tasks layout re-ordered!', 'success');
        }
      });

      tableBody.appendChild(tr);

      // --- 4. GANTT TIMELINE ROW ELEMENT RENDER ---
      const ganttRow = document.createElement('div');
      ganttRow.className = 'gantt-row';
      
      // Calculate placement offset math
      const tStart = new Date(t.start_date);
      const tDue = new Date(t.due_date);
      
      const tlStart = timelineDates[0];
      
      const startDiffDays = Math.round((tStart - tlStart) / (1000 * 60 * 60 * 24));
      const durationDays = Math.max(1, Math.round((tDue - tStart) / (1000 * 60 * 60 * 24)) + 1);

      // Verify task resides inside timeline bounds
      if (startDiffDays + durationDays >= 0 && startDiffDays <= timelineDates.length) {
        
        if (t.is_milestone) {
          // Render Diamond
          const leftOffset = (startDiffDays * GANTT_COL_WIDTH) + (GANTT_COL_WIDTH / 2 - 6); // Centered diamond
          const milestone = document.createElement('div');
          milestone.className = `gantt-milestone-diamond ${t.status.toLowerCase().replace(' ', '-')}`;
          milestone.setAttribute('style', `left: ${leftOffset}px;`);
          milestone.setAttribute('title', `Milestone: ${t.name}\nDue: ${t.due_date}`);
          
          milestone.addEventListener('click', () => openTaskModal(t.id));
          ganttRow.appendChild(milestone);
        } else {
          // Standard Rect Task Bar
          const barWrapper = document.createElement('div');
          barWrapper.className = `gantt-bar-wrapper ${t.status.toLowerCase().replace(' ', '-')}`;
          barWrapper.setAttribute('data-id', t.id);
          
          const barStyle = `
            left: ${startDiffDays * GANTT_COL_WIDTH}px;
            width: ${durationDays * GANTT_COL_WIDTH}px;
          `;
          barWrapper.setAttribute('style', barStyle);

          barWrapper.innerHTML = `
            <div class="gantt-resizer left" data-id="${t.id}"></div>
            <div class="gantt-bar-progress" style="width: ${t.progress}%;"></div>
            <div class="gantt-bar-content">${t.wbs} ${t.name} (${t.progress}%)</div>
            <div class="gantt-resizer right" data-id="${t.id}"></div>
          `;

          // Gantt bar interaction binds
          barWrapper.addEventListener('click', () => openTaskModal(t.id));
          
          // Custom drags
          setupGanttBarDrag(barWrapper, t, startDiffDays, durationDays);

          ganttRow.appendChild(barWrapper);
        }
      }

      barsContainer.appendChild(ganttRow);
    });

    lucide.createIcons();
    setTimeout(syncRowHeights, 50);
  }

  // Robust row height synchronizer to keep Workbook Table & Gantt Chart fully aligned
  function syncRowHeights() {
    const tableRows = document.querySelectorAll('.workbook-row');
    const ganttRows = document.querySelectorAll('.gantt-row');
    tableRows.forEach((tr, index) => {
      if (ganttRows[index]) {
        const h = tr.getBoundingClientRect().height;
        ganttRows[index].style.height = `${h}px`;
      }
    });

    const tableHeader = document.querySelector('.workbook-table thead tr');
    const ganttHeader = document.getElementById('gantt-timeline-header-grid');
    if (tableHeader && ganttHeader) {
      const h = tableHeader.getBoundingClientRect().height;
      ganttHeader.style.height = `${h}px`;
    }
  }

  // Double-sync vert scrolls
  function syncSplitPaneScrolls() {
    const tablePane = document.getElementById('table-pane-container');
    const ganttPane = document.getElementById('gantt-pane-container');

    if (!tablePane || !ganttPane) return;

    let isScrollingTable = false;
    let isScrollingGantt = false;

    tablePane.addEventListener('scroll', () => {
      if (isScrollingGantt) return;
      isScrollingTable = true;
      ganttPane.scrollTop = tablePane.scrollTop;
      setTimeout(() => isScrollingTable = false, 50);
    });

    ganttPane.addEventListener('scroll', () => {
      if (isScrollingTable) return;
      isScrollingGantt = true;
      tablePane.scrollTop = ganttPane.scrollTop;
      setTimeout(() => isScrollingGantt = false, 50);
    });
  }

  // Custom Gantt Drag and Resize Controller
  function setupGanttBarDrag(barWrapper, task, initialStartCol, initialDuration) {
    if (state.tasks.some(x => x.parent_id === task.id)) return; // Disable dragging on parent rollup tasks

    let startX = 0;
    let currentX = 0;
    let draggingMode = null; // 'move', 'resize-left', 'resize-right'
    
    const handleBarMouseDown = (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      startX = e.clientX;
      barWrapper.classList.add('dragging');
      
      const leftResizer = e.target.classList.contains('left');
      const rightResizer = e.target.classList.contains('right');

      if (leftResizer) {
        draggingMode = 'resize-left';
      } else if (rightResizer) {
        draggingMode = 'resize-right';
      } else {
        draggingMode = 'move';
      }

      document.addEventListener('mousemove', handleBarMouseMove);
      document.addEventListener('mouseup', handleBarMouseUp);
    };

    const handleBarMouseMove = (e) => {
      currentX = e.clientX;
      const diffX = currentX - startX;
      const diffCols = Math.round(diffX / GANTT_COL_WIDTH); // Spacious columns
      
      if (diffCols === 0) return;

      let newStartCol = initialStartCol;
      let newDuration = initialDuration;

      if (draggingMode === 'move') {
        newStartCol = initialStartCol + diffCols;
      } else if (draggingMode === 'resize-left') {
        newStartCol = initialStartCol + diffCols;
        newDuration = initialDuration - diffCols;
        if (newDuration < 1) {
          newStartCol = initialStartCol + initialDuration - 1;
          newDuration = 1;
        }
      } else if (draggingMode === 'resize-right') {
        newDuration = initialDuration + diffCols;
        if (newDuration < 1) newDuration = 1;
      }

      // Drag boundaries validation
      if (newStartCol < 0) newStartCol = 0;
      
      // Update element layout styling dynamically
      barWrapper.style.left = `${newStartCol * GANTT_COL_WIDTH}px`;
      barWrapper.style.width = `${newDuration * GANTT_COL_WIDTH}px`;
    };

    const handleBarMouseUp = async (e) => {
      barWrapper.classList.remove('dragging');
      document.removeEventListener('mousemove', handleBarMouseMove);
      document.removeEventListener('mouseup', handleBarMouseUp);

      if (draggingMode) {
        const finalDiffX = e.clientX - startX;
        const diffCols = Math.round(finalDiffX / GANTT_COL_WIDTH);

        if (diffCols !== 0) {
          const startDate = new Date(timelineDates[0]);
          let newStartCol = initialStartCol;
          let newDuration = initialDuration;

          if (draggingMode === 'move') {
            newStartCol = initialStartCol + diffCols;
          } else if (draggingMode === 'resize-left') {
            newStartCol = initialStartCol + diffCols;
            newDuration = initialDuration - diffCols;
            if (newDuration < 1) {
              newStartCol = initialStartCol + initialDuration - 1;
              newDuration = 1;
            }
          } else if (draggingMode === 'resize-right') {
            newDuration = initialDuration + diffCols;
            if (newDuration < 1) newDuration = 1;
          }

          if (newStartCol < 0) newStartCol = 0;

          // Convert final cols to target Dates
          const newStart = new Date(startDate);
          newStart.setDate(newStart.getDate() + newStartCol);
          
          const newDue = new Date(newStart);
          newDue.setDate(newDue.getDate() + newDuration - 1);

          showToast('Updating schedule duration...', 'info');
          
          await db.saveTask({
            id: task.id,
            project_id: task.project_id,
            start_date: newStart.toISOString().split('T')[0],
            due_date: newDue.toISOString().split('T')[0]
          });

          loadSchedulerWorkspace(state.activeProjectId);
        } else {
          // If no displacement occurred, fall back to standard modal trigger clicks
          openTaskModal(task.id);
        }
      }

      draggingMode = null;
    };

    barWrapper.addEventListener('mousedown', handleBarMouseDown);
  }

  // ADD / EDIT TASK POPUP FOR SCHEDULER
  async function openTaskModal(taskId = null, parentId = null) {
    const modal = document.getElementById('modal-task');
    const form = document.getElementById('task-form-action');
    const title = document.getElementById('task-modal-title');

    form.reset();
    document.getElementById('task-id-field').value = '';
    document.getElementById('task-parent-field').value = parentId || '';

    // Populate drop choices
    const employees = await db.getEmployees();
    const ownerField = document.getElementById('task-owner-field');
    ownerField.innerHTML = '<option value="">Unassigned</option>';
    employees.forEach(e => {
      ownerField.innerHTML += `<option value="${e.employee_code}">${e.name} (${e.department})</option>`;
    });

    const deptField = document.getElementById('task-dept-field');
    deptField.innerHTML = '<option value="">Choose...</option>';
    state.systemSettings.departments.forEach(d => {
      deptField.innerHTML += `<option value="${d}">${d}</option>`;
    });

    const depField = document.getElementById('task-dep-field');
    depField.innerHTML = '<option value="">No Predecessor</option>';
    state.tasks.forEach(x => {
      depField.innerHTML += `<option value="${x.id}">${x.wbs} ${x.name.substring(0, 20)}...</option>`;
    });

    if (taskId) {
      title.textContent = "Modify Scheduled Task Details";
      const t = state.tasks.find(x => x.id === taskId);
      if (t) {
        const isParent = state.tasks.some(x => x.parent_id === t.id);
        document.getElementById('task-id-field').value = t.id;
        document.getElementById('task-parent-field').value = t.parent_id || '';
        document.getElementById('task-name-field').value = t.name;
        document.getElementById('task-owner-field').value = t.owner_code || '';
        document.getElementById('task-dept-field').value = t.department || '';
        document.getElementById('task-start-field').value = t.start_date;
        document.getElementById('task-due-field').value = t.due_date;
        const priorityField = document.getElementById('task-priority-field');
        priorityField.value = t.priority;
        priorityField.className = `filter-select priority-select-cell ${t.priority.toLowerCase()}`;

        document.getElementById('task-dep-field').value = t.dependency_id || '';
        document.getElementById('task-milestone-field').checked = t.is_milestone;

        const statusField = document.getElementById('task-status-field');
        statusField.value = t.status || 'Not Started';
        statusField.className = `filter-select status-select-cell ${(t.status || 'Not Started').toLowerCase().replace(' ', '-')}`;
        statusField.disabled = isParent; // Disable status dropdown for parent tasks (calculated by rollup engine)
      }
    } else {
      title.textContent = "Initialize Scheduled Action Task";
      // Defaults to project bounds
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('task-start-field').value = today;
      document.getElementById('task-due-field').value = today;

      const priorityField = document.getElementById('task-priority-field');
      priorityField.value = 'Medium';
      priorityField.className = 'filter-select priority-select-cell medium';

      const statusField = document.getElementById('task-status-field');
      statusField.value = 'Not Started';
      statusField.className = 'filter-select status-select-cell not-started';
      statusField.disabled = false;
    }

    modal.classList.add('active');
  }

  async function handleTaskSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('task-id-field').value;
    const parentId = document.getElementById('task-parent-field').value;
    const name = document.getElementById('task-name-field').value;
    const ownerCode = document.getElementById('task-owner-field').value;
    const dept = document.getElementById('task-dept-field').value;
    const startDate = document.getElementById('task-start-field').value;
    const dueDate = document.getElementById('task-due-field').value;
    const priority = document.getElementById('task-priority-field').value;
    const status = document.getElementById('task-status-field').value;
    const depId = document.getElementById('task-dep-field').value;
    const isMilestone = document.getElementById('task-milestone-field').checked;

    if (new Date(dueDate) < new Date(startDate)) {
      showToast('Due date cannot be earlier than start date.', 'error');
      return;
    }

    const taskObj = {
      project_id: state.activeProjectId,
      parent_id: parentId || null,
      name,
      owner_code: ownerCode || null,
      department: dept,
      start_date: startDate,
      due_date: dueDate,
      priority,
      status,
      dependency_id: depId || null,
      is_milestone: isMilestone
    };

    if (id) taskObj.id = id;

    showToast('Saving scheduling changes...', 'info');
    await db.saveTask(taskObj);
    
    document.getElementById('modal-task').classList.remove('active');
    loadSchedulerWorkspace(state.activeProjectId);
    showToast('Task configurations synchronized successfully!', 'success');
  }

  // =========================================================================
  // SCHEDULER DATA EXPORTS & IMPORTS
  // =========================================================================
  function exportTasksToCSV() {
    if (state.tasks.length === 0) {
      showToast('No tasks available to export.', 'error');
      return;
    }

    // Build standard CSV file rows
    let csv = 'WBS,Task Name,Owner Code,Department,Start Date,Due Date,Duration,Progress %,Status,Priority,Milestone\n';
    
    const treeTasks = buildTaskTree(state.tasks);
    treeTasks.forEach(t => {
      csv += `"${t.wbs}","${t.name.replace(/"/g, '""')}","${t.owner_code || ''}","${t.department || ''}","${t.start_date}","${t.due_date}","${t.duration}","${t.progress}","${t.status}","${t.priority}","${t.is_milestone ? 'Yes' : 'No'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `OSCI_Schedule_Project_${state.activeProjectId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('CSV schedule workbook generated!', 'success');
    db.logActivity(state.activeProjectId, null, 'EXPORT_CSV', `Exported CSV project spreadsheet`);
  }

  function triggerImportCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target.result;
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          
          // Skip header row
          if (lines.length <= 1) throw new Error("Empty document");

          showToast('Importing raw operations spreadsheet...', 'info');
          
          for (let i = 1; i < lines.length; i++) {
            // Very simple CSV parser regex split
            const parts = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.replace(/^"|"$/g, '').trim());
            if (parts.length < 6) continue;

            const name = parts[1] || 'Imported Task';
            const owner = parts[2] || null;
            const dept = parts[3] || 'Production';
            const start = parts[4] || new Date().toISOString().split('T')[0];
            const due = parts[5] || start;
            const progress = parseInt(parts[7]) || 0;
            const status = parts[8] || 'Not Started';
            const priority = parts[9] || 'Medium';
            const isMilestone = (parts[10] || '').toLowerCase() === 'yes';

            await db.saveTask({
              project_id: state.activeProjectId,
              name,
              owner_code: owner,
              department: dept,
              start_date: start,
              due_date: due,
              progress,
              status,
              priority,
              is_milestone: isMilestone
            });
          }

          loadSchedulerWorkspace(state.activeProjectId);
          showToast('Mass schedules imported successfully!', 'success');
          db.logActivity(state.activeProjectId, null, 'IMPORT_CSV', `Imported schedule rows via CSV workbook`);
        } catch (e) {
          console.error(e);
          showToast('Error reading spreadsheet rows. Please verify CSV headings.', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // =========================================================================
  // VIEW: USER PROFILES CONSOLE (OSCI_ADMIN ONLY)
  // =========================================================================
  async function loadUsersConsole() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Refreshing credentials registry...</td></tr>';

    try {
      state.employees = await db.getEmployees();
      
      const search = document.getElementById('user-search').value.toLowerCase().trim();
      const filtered = state.employees.filter(
        e => e.name.toLowerCase().includes(search) || e.employee_code.toLowerCase().includes(search)
      );

      tbody.innerHTML = '';
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No matching employee records.</td></tr>';
        return;
      }

      filtered.forEach(e => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${e.employee_code}</strong></td>
          <td>${e.name}</td>
          <td><span class="category-badge" style="color: var(--color-primary);">${e.role}</span></td>
          <td>${e.department}</td>
          <td><span class="status-badge ${e.status === 'ACTIVE' ? 'completed' : 'not-started'}">${e.status}</span></td>
          <td style="text-align: right; padding-right: 16px;">
            <div class="table-actions" style="justify-content: flex-end;">
              <button class="table-btn user-btn-toggle" data-code="${e.employee_code}" data-status="${e.status}" title="${e.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} account">
                <i data-lucide="${e.status === 'ACTIVE' ? 'user-x' : 'user-check'}"></i>
              </button>
              <button class="table-btn user-btn-edit" data-code="${e.employee_code}" title="Edit Profile" style="color: var(--color-primary);">
                <i data-lucide="edit"></i>
              </button>
              <button class="table-btn user-btn-delete" data-code="${e.employee_code}" title="Delete Record" style="color: var(--status-red-text);"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        `;

        tr.querySelector('.user-btn-toggle').addEventListener('click', async () => {
          const next = e.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          await db.saveEmployee({ employee_code: e.employee_code, status: next });
          showToast(`Employee ${e.employee_code} status modified!`, 'success');
          loadUsersConsole();
        });

        tr.querySelector('.user-btn-edit').addEventListener('click', () => {
          openEditUserModal(e);
        });

        tr.querySelector('.user-btn-delete').addEventListener('click', async () => {
          if (e.employee_code === state.currentEmployee.employee_code) {
            showToast('You cannot delete your own session record.', 'error');
            return;
          }
          if (confirm(`Completely delete employee record for ${e.name} (${e.employee_code})?`)) {
            await db.deleteEmployee(e.employee_code);
            showToast('Employee profile deleted.', 'info');
            loadUsersConsole();
          }
        });

        tbody.appendChild(tr);
      });

      lucide.createIcons();
    } catch (e) {
      console.error(e);
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--status-red-text);">Access error loading master employees registry.</td></tr>';
    }
  }

  function openAddUserModal() {
    document.getElementById('user-modal-title').textContent = "Register Employee Profile";
    
    const codeField = document.getElementById('user-code-field');
    codeField.value = '';
    codeField.disabled = false;
    codeField.placeholder = "e.g. EMP001";
    
    document.getElementById('user-name-field').value = '';
    document.getElementById('user-role-field').value = 'OWNER';
    document.getElementById('user-status-field').value = 'ACTIVE';
    document.getElementById('user-dept-field').value = '';
    
    document.getElementById('modal-user').classList.add('active');
  }

  function openEditUserModal(emp) {
    document.getElementById('user-modal-title').textContent = "Edit Employee Profile";
    
    const codeField = document.getElementById('user-code-field');
    codeField.value = emp.employee_code;
    codeField.disabled = true;
    
    document.getElementById('user-name-field').value = emp.name || '';
    document.getElementById('user-role-field').value = emp.role || 'OWNER';
    document.getElementById('user-status-field').value = emp.status || 'ACTIVE';
    document.getElementById('user-dept-field').value = emp.department || '';
    
    document.getElementById('modal-user').classList.add('active');
  }

  async function handleUserSubmit(e) {
    e.preventDefault();
    
    const codeField = document.getElementById('user-code-field');
    const employee_code = codeField.value.trim();
    const name = document.getElementById('user-name-field').value.trim();
    const role = document.getElementById('user-role-field').value;
    const status = document.getElementById('user-status-field').value;
    const department = document.getElementById('user-dept-field').value.trim();
    
    if (!employee_code || !name || !role || !status || !department) {
      showToast('Please fill all required profile fields.', 'error');
      return;
    }
    
    showToast('Saving employee credentials...', 'info');
    try {
      await db.saveEmployee({
        employee_code,
        name,
        role,
        department,
        status
      });
      
      if (employee_code === state.currentEmployee.employee_code) {
        state.currentEmployee.name = name;
        state.currentEmployee.role = role;
        state.currentEmployee.department = department;
        state.currentEmployee.status = status;
        
        document.getElementById('user-profile-avatar').textContent = name.charAt(0).toUpperCase();
        document.getElementById('user-profile-name').textContent = name;
        document.getElementById('user-profile-role').textContent = role;
      }
      
      document.getElementById('modal-user').classList.remove('active');
      loadUsersConsole();
      showToast('Employee profile updated successfully!', 'success');
      db.logActivity(null, null, 'UPDATE_USER', `Updated employee profile for code ${employee_code}`);
    } catch (err) {
      console.error(err);
      showToast('Error saving employee profile.', 'error');
    }
  }

  // =========================================================================
  // VIEW: SETTINGS CONTROL BOARD RENDERERS
  // =========================================================================
  function loadSettingsPanel() {
    document.getElementById('settings-supabase-url').value = localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || '';
    document.getElementById('settings-supabase-key').value = localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY) || '';
    document.getElementById('settings-theme-selector').value = state.theme;

    // Populate dropdown configurator values
    document.getElementById('settings-plants-list').value = state.systemSettings.plants.join(', ');
    document.getElementById('settings-depts-list').value = state.systemSettings.departments.join(', ');
    document.getElementById('settings-categories-list').value = state.systemSettings.categories.join(', ');
    document.getElementById('settings-gantt-width').value = GANTT_COL_WIDTH;
    document.getElementById('settings-admin-pin').value = state.systemSettings.adminPin;
  }

  function handleSaveSettings(e) {
    e.preventDefault();
    const url = document.getElementById('settings-supabase-url').value.trim();
    const key = document.getElementById('settings-supabase-key').value.trim();

    if (url && key) {
      localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url);
      localStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, key);
      localStorage.setItem(STORAGE_KEYS.OFFLINE_MODE, 'false');
      showToast('Secrets configured! Restarting backend synchronization...', 'info');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_MODE, 'true');
      showToast('Sandbox offline mode force active.', 'info');
      setTimeout(() => window.location.reload(), 1000);
    }
  }

  async function handleSaveDropdownSettings(e) {
    e.preventDefault();

    const plantsText = document.getElementById('settings-plants-list').value;
    const deptsText = document.getElementById('settings-depts-list').value;
    const catsText = document.getElementById('settings-categories-list').value;
    const colWidth = parseInt(document.getElementById('settings-gantt-width').value);
    const adminPin = document.getElementById('settings-admin-pin').value.trim();

    const plants = plantsText.split(',').map(x => x.trim()).filter(x => x.length > 0);
    const departments = deptsText.split(',').map(x => x.trim()).filter(x => x.length > 0);
    const categories = catsText.split(',').map(x => x.trim()).filter(x => x.length > 0);

    if (plants.length === 0 || departments.length === 0 || categories.length === 0 || !adminPin) {
      showToast('Please fill all configurator fields with valid lists.', 'error');
      return;
    }

    showToast('Updating system config...', 'info');
    try {
      await db.saveSystemSettings({
        plants,
        departments,
        categories,
        adminPin
      });

      localStorage.setItem('osci_gantt_col_width', colWidth);
      GANTT_COL_WIDTH = colWidth;

      showToast('System configurations saved successfully!', 'success');
      db.logActivity(null, null, 'UPDATE_SETTINGS', `Updated system lists and admin configurations`);
    } catch (err) {
      console.error(err);
      const errMsg = err.message || err.details || JSON.stringify(err);
      showToast(`Error saving configurations: ${errMsg}`, 'error');
    }
  }

  function handleResetSandbox() {
    if (confirm('Are you sure you want to completely reset the offline sandbox database? This will restore all demo projects, tasks, and employees to initial seed values and erase any modifications.')) {
      localStorage.removeItem(STORAGE_KEYS.SANDBOX_DATA);
      localStorage.removeItem('osci_sandbox_settings');
      showToast('Offline sandbox erased! Reloading seed data...', 'success');
      setTimeout(() => window.location.reload(), 1000);
    }
  }

  // =========================================================================
  // CANVAS ENGINE: PRE-FLIGHT COMPRESSOR & EVIDENCE photos UPLOADER
  // =========================================================================
  let activeEvidenceTaskId = null;

  async function openEvidenceModal(taskId, taskName) {
    activeEvidenceTaskId = taskId;
    document.getElementById('evidence-task-name').textContent = `Task Reference: "${taskName}"`;
    document.getElementById('modal-evidence').classList.add('active');

    loadEvidenceGallery(taskId);
  }

  async function loadEvidenceGallery(taskId) {
    const grid = document.getElementById('evidence-attachments-grid');
    grid.innerHTML = '<span style="color: var(--text-secondary); grid-column: span 4; text-align: center; font-size:12px;">Scanning attachments...</span>';

    try {
      const attachs = await db.getAttachments(taskId);
      grid.innerHTML = '';

      if (attachs.length === 0) {
        grid.innerHTML = '<span style="color: var(--text-secondary); grid-column: span 4; text-align: center; font-size:11px; padding: 24px 0;">No audit photos/images uploaded as evidence.</span>';
        return;
      }

      attachs.forEach(a => {
        const tile = document.createElement('div');
        tile.className = 'attachment-tile';
        tile.innerHTML = `
          <div class="attachment-tile-delete" data-id="${a.id}"><i data-lucide="trash-2" style="width: 10px; height: 10px;"></i></div>
          <img src="${a.file_path}" alt="${a.file_name}" title="Uploaded by: ${a.uploader_name}">
        `;

        // Click tile opens lightbox
        tile.addEventListener('click', (e) => {
          if (e.target.closest('.attachment-tile-delete')) return;
          const lb = document.getElementById('lightbox-viewer');
          const lbImg = document.getElementById('lightbox-image-tag');
          lbImg.src = a.file_path;
          lb.classList.add('active');
        });

        // Click delete
        tile.querySelector('.attachment-tile-delete').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Remove evidence photo attachment "${a.file_name}"?`)) {
            showToast('Deleting evidence card...', 'info');
            await db.deleteAttachment(a.id);
            loadEvidenceGallery(taskId);
            showToast('Attachment deleted.', 'info');
          }
        });

        grid.appendChild(tile);
      });

      lucide.createIcons();
    } catch (e) {
      console.error(e);
      grid.innerHTML = '<span style="color: var(--status-red-text); grid-column: span 4; text-align: center;">Error loading images catalog.</span>';
    }
  }

  // Pre-flight Canvas Image Compressor Engine (Absolute Premium Standard)
  async function compressAndUploadEvidence(files) {
    if (!activeEvidenceTaskId) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.match('image.*')) {
        showToast('Supports image payloads only (JPG, PNG, WEBP).', 'error');
        continue;
      }

      showToast(`Compressing evidence "${file.name}"...`, 'info');

      // Execute Canvas compression
      try {
        const compressedBlob = await compressImageCanvas(file, 1024, 0.8); // Scale to 1024px, 80% quality JPEG
        showToast(`Uploading compressed payload (${(compressedBlob.size / 1024).toFixed(1)} KB)...`, 'info');
        
        await db.uploadAttachment(activeEvidenceTaskId, file.name, compressedBlob);
        showToast(`Uploaded evidence "${file.name}" successfully!`, 'success');
      } catch (err) {
        console.error(err);
        showToast(`Compression/upload failed for "${file.name}".`, 'error');
      }
    }

    loadEvidenceGallery(activeEvidenceTaskId);
  }

  // Pure Canvas Compress algorithm
  function compressImageCanvas(file, maxEdgePixel, qualityScale) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          // Calculate scale ratios
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxEdgePixel) {
              height *= maxEdgePixel / width;
              width = maxEdgePixel;
            }
          } else {
            if (height > maxEdgePixel) {
              width *= maxEdgePixel / height;
              height = maxEdgePixel;
            }
          }

          // Build canvas context
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Standard blob conversion
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas compression blob generation failed"));
            }
          }, 'image/jpeg', qualityScale);
        };
      };
      reader.onerror = (e) => reject(e);
    });
  }

  // =========================================================================
  // VIEWPORT STYLING & BIND CONTROLLERS
  // =========================================================================
  function bindUIEventListeners() {
    // 1. Sidebar toggles
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      const app = document.getElementById('app');
      const toggle = document.getElementById('sidebar-toggle');
      app.classList.toggle('collapsed');
      
      const isCollapsed = app.classList.contains('collapsed');
      toggle.innerHTML = `<i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-left'}"></i>`;
      lucide.createIcons();
    });

    // 2. Sidebar Navigation Items
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-target');
        routeTo(`#/${view}`);
      });
    });

    // 3. Login Action submit
    document.getElementById('login-form-action').addEventListener('submit', (e) => {
      e.preventDefault();
      const code = document.getElementById('employee-code-input').value.trim();
      performLogin(code);
    });

    // 4. Admin pin emergency login
    document.getElementById('login-admin-bypass').addEventListener('click', () => {
      const pin = prompt("Enter Emergency Administrator Security PIN (Default: 778899):");
      if (pin === state.systemSettings.adminPin) {
        performLogin('ADMIN99');
      } else {
        alert("Incorrect PIN configuration!");
      }
    });

    // 5. Logout Session trigger
    document.getElementById('logout-btn').addEventListener('click', () => {
      performLogout();
    });

    // 6. Theme Toggles
    const toggleBtn = document.getElementById('theme-toggle');
    const systemThemeLoader = () => {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
      state.theme = saved;
      document.body.setAttribute('data-theme', saved);
      document.getElementById('settings-theme-selector').value = saved;
      toggleBtn.innerHTML = `<i data-lucide="${saved === 'dark' ? 'sun' : 'moon'}"></i>`;
      lucide.createIcons();
    };

    toggleBtn.addEventListener('click', () => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEYS.THEME, next);
      systemThemeLoader();
      showToast(`Interface switched to ${next === 'dark' ? 'Dark Mode' : 'Light Mode'}`, 'info');
    });

    document.getElementById('settings-theme-selector').addEventListener('change', (e) => {
      const val = e.target.value;
      localStorage.setItem(STORAGE_KEYS.THEME, val);
      systemThemeLoader();
    });

    // 7. Supabase Setup Connection Modal Save (Initial Startup Modal)
    document.getElementById('init-db-save-btn').addEventListener('click', () => {
      const url = document.getElementById('init-db-url').value.trim();
      const key = document.getElementById('init-db-key').value.trim();

      if (url && key) {
        localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url);
        localStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, key);
        localStorage.setItem(STORAGE_KEYS.OFFLINE_MODE, 'false');
        document.getElementById('modal-supabase-config').classList.remove('active');
        showToast('Synchronizing Supabase cloud details...', 'info');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        alert('Credentials must be specified. Or use Sandbox Offline Mode.');
      }
    });

    document.getElementById('init-use-mock').addEventListener('click', () => {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_MODE, 'true');
      document.getElementById('modal-supabase-config').classList.remove('active');
      showToast('Loaded Sandbox offline demonstration sandbox.', 'success');
      setTimeout(() => window.location.reload(), 500);
    });

    // 8. Projects lists filters
    document.getElementById('project-search').addEventListener('input', () => loadProjectsList());
    document.getElementById('project-filter-plant').addEventListener('change', () => loadProjectsList());
    document.getElementById('project-filter-category').addEventListener('change', () => loadProjectsList());
    
    // Add Projects Modal triggers
    document.getElementById('add-project-btn').addEventListener('click', () => openProjectModal());
    document.getElementById('project-modal-close').addEventListener('click', () => document.getElementById('modal-project').classList.remove('active'));
    document.getElementById('project-modal-cancel').addEventListener('click', () => document.getElementById('modal-project').classList.remove('active'));
    document.getElementById('project-form-action').addEventListener('submit', handleProjectSubmit);

    // 9. Interactive Scheduler Workspace Header Binds
    document.getElementById('scheduler-back-btn').addEventListener('click', () => {
      routeTo('#/projects');
    });

    document.getElementById('scheduler-add-task-btn').addEventListener('click', () => {
      openTaskModal(null, null); // Add top-level main task
    });

    document.getElementById('scheduler-toggle-gantt').addEventListener('click', () => {
      const workspace = document.getElementById('scheduler-split-workspace');
      const btn = document.getElementById('scheduler-toggle-gantt');
      workspace.classList.toggle('gantt-hidden');
      
      const hidden = workspace.classList.contains('gantt-hidden');
      btn.innerHTML = `<i data-lucide="${hidden ? 'eye' : 'eye-off'}"></i> ${hidden ? 'Show Gantt Chart' : 'Toggle Gantt Chart'}`;
      lucide.createIcons();
    });

    document.getElementById('scheduler-export-btn').addEventListener('click', exportTasksToCSV);
    document.getElementById('scheduler-import-btn').addEventListener('click', triggerImportCSV);

    // Interactive Resizing Dividers Binds
    const divider = document.getElementById('workspace-split-divider');
    const ws = document.getElementById('scheduler-split-workspace');
    if (divider && ws) {
      divider.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const onMouseMove = (moveEvent) => {
          const clientX = moveEvent.clientX;
          const totalWidth = window.innerWidth - (document.getElementById('app').classList.contains('collapsed') ? 68 : 260);
          const leftPercent = ((clientX - (document.getElementById('app').classList.contains('collapsed') ? 68 : 260)) / totalWidth) * 100;
          if (leftPercent > 20 && leftPercent < 85) {
            ws.style.gridTemplateColumns = `${leftPercent}% ${100 - leftPercent}%`;
            divider.style.left = `${leftPercent}%`;
          }
        };
        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          syncRowHeights();
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    }

    // 10. Add Tasks Planner Form submit
    document.getElementById('task-modal-close').addEventListener('click', () => document.getElementById('modal-task').classList.remove('active'));
    document.getElementById('task-modal-cancel').addEventListener('click', () => document.getElementById('modal-task').classList.remove('active'));
    document.getElementById('task-form-action').addEventListener('submit', handleTaskSubmit);

    // Dynamic dropdown badge style updates inside modal details form
    document.getElementById('task-priority-field').addEventListener('change', (e) => {
      e.target.className = `filter-select priority-select-cell ${e.target.value.toLowerCase()}`;
    });
    document.getElementById('task-status-field').addEventListener('change', (e) => {
      e.target.className = `filter-select status-select-cell ${e.target.value.toLowerCase().replace(' ', '-')}`;
    });

    // 11. User Management console triggers (OSCI_ADMIN)
    document.getElementById('user-search').addEventListener('input', () => loadUsersConsole());
    document.getElementById('add-user-btn').addEventListener('click', openAddUserModal);
    document.getElementById('user-modal-close').addEventListener('click', () => document.getElementById('modal-user').classList.remove('active'));
    document.getElementById('user-modal-cancel').addEventListener('click', () => document.getElementById('modal-user').classList.remove('active'));
    document.getElementById('user-form-action').addEventListener('submit', handleUserSubmit);

    // Dynamic resize listener to keep Workbook Table & Gantt Chart rows in perfect sync
    window.addEventListener('resize', syncRowHeights);

    // 12. Settings view CRUD
    document.getElementById('settings-save-db-btn').addEventListener('click', handleSaveSettings);
    document.getElementById('settings-dropdowns-form').addEventListener('submit', handleSaveDropdownSettings);
    document.getElementById('settings-reset-sandbox-btn').addEventListener('click', handleResetSandbox);
    
    // Connection test binding inside settings
    document.getElementById('settings-test-db-btn').addEventListener('click', async () => {
      const url = document.getElementById('settings-supabase-url').value.trim();
      const key = document.getElementById('settings-supabase-key').value.trim();
      
      if (!url || !key) {
        showToast('Supabase secrets cannot be blank.', 'error');
        return;
      }
      
      showToast('Testing cloud integration...', 'info');
      try {
        const client = supabase.createClient(url, key);
        const { error } = await client.from('employee_master').select('count', { count: 'exact', head: true });
        if (error) throw error;
        showToast('Connection verified successfully! Connection parameters are valid.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Connection failed! Please check credentials or network parameters.', 'error');
      }
    });

    // 13. Audit evidence lightbox modal triggers
    document.getElementById('evidence-modal-close').addEventListener('click', () => {
      document.getElementById('modal-evidence').classList.remove('active');
      activeEvidenceTaskId = null;
    });

    // Dropzone logic
    const dropzone = document.getElementById('evidence-dropzone');
    const fileInput = document.getElementById('evidence-file-input');

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragging');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragging');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragging');
      const files = e.dataTransfer.files;
      if (files.length > 0) compressAndUploadEvidence(files);
    });

    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files.length > 0) compressAndUploadEvidence(files);
    });

    // Lightbox Closer
    document.getElementById('lightbox-close-btn').addEventListener('click', () => {
      document.getElementById('lightbox-viewer').classList.remove('active');
    });

    // Bootstrap initial active preferences
    systemThemeLoader();
  }

  // =========================================================================
  // BOOTSTRAP SYSTEM INITIALIZATION
  // =========================================================================
  async function bootstrapApp() {
    console.log("OS&CI Scheduler: Initializing workplace context...");
    
    // Bind global buttons immediately
    bindUIEventListeners();

    // Initialize backend adapters
    const isCloudConnected = await db.init();

    // Check if configuration secrets are empty, and prompt modal
    const sbUrl = localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || DEFAULT_SUPABASE_URL;
    const sbKey = localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY) || DEFAULT_SUPABASE_KEY;
    const forceOffline = localStorage.getItem(STORAGE_KEYS.OFFLINE_MODE) === 'true';

    if (!sbUrl && !sbKey && !forceOffline) {
      document.getElementById('modal-supabase-config').classList.add('active');
    }

    // Populate dropdown arrays
    const filterPlant = document.getElementById('project-filter-plant');
    if (filterPlant) {
      filterPlant.innerHTML = '<option value="All">All Plants</option>';
      state.systemSettings.plants.forEach(p => {
        filterPlant.innerHTML += `<option value="${p}">${p}</option>`;
      });
    }

    const filterCat = document.getElementById('project-filter-category');
    if (filterCat) {
      filterCat.innerHTML = '<option value="All">All Categories</option>';
      state.systemSettings.categories.forEach(c => {
        filterCat.innerHTML += `<option value="${c}">${c}</option>`;
      });
    }

    // Manage Routing & Session loops
    checkSession();
    
    // Watch hash swaps
    window.addEventListener('hashchange', () => {
      routeTo(window.location.hash);
    });
  }

  // Fire when page loaded
  window.addEventListener('DOMContentLoaded', bootstrapApp);

})();
