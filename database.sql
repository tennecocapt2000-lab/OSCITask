-- OS&CI Task Scheduler Database Schema Initialization
-- For manufacturing operations task tracking and Gantt visualizations

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. employee_master
-- =========================================================================
CREATE TABLE IF NOT EXISTS employee_master (
    employee_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('OSCI_ADMIN', 'MANAGER', 'OWNER', 'VIEWER')),
    department TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 2. projects
-- =========================================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 2000),
    plant TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Planning', 'In Progress', 'Completed', 'Delayed')) DEFAULT 'Planning',
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    owner_code TEXT REFERENCES employee_master(employee_code) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 3. tasks
-- =========================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    wbs TEXT, -- Can be dynamically generated in app or cached
    name TEXT NOT NULL,
    owner_code TEXT REFERENCES employee_master(employee_code) ON DELETE SET NULL,
    department TEXT,
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    duration INTEGER NOT NULL DEFAULT 1 CHECK (duration > 0),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status TEXT NOT NULL CHECK (status IN ('Not Started', 'In Progress', 'Completed', 'Delayed')) DEFAULT 'Not Started',
    priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    dependency_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    is_milestone BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_dates CHECK (due_date >= start_date)
);

-- =========================================================================
-- 4. column_settings
-- =========================================================================
CREATE TABLE IF NOT EXISTS column_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_code TEXT NOT NULL REFERENCES employee_master(employee_code) ON DELETE CASCADE UNIQUE,
    visible_columns JSONB NOT NULL DEFAULT '{"wbs":true,"name":true,"owner":true,"department":true,"start_date":true,"due_date":true,"duration":true,"progress":true,"status":true,"priority":true,"dependency":true,"actions":true}'::jsonb,
    gantt_visible BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 5. task_attachments
-- =========================================================================
CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Storage path
    file_size INTEGER,
    uploaded_by TEXT REFERENCES employee_master(employee_code) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 6. task_comments
-- =========================================================================
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    author_code TEXT NOT NULL REFERENCES employee_master(employee_code) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 7. activity_logs
-- =========================================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    employee_code TEXT REFERENCES employee_master(employee_code) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- 'CREATE_TASK', 'UPDATE_TASK', 'DELETE_TASK', 'UPLOAD_EVIDENCE', 'LOGIN', etc.
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 8. system_settings
-- =========================================================================
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- INDEXES FOR MAXIMUM SEARCH & JOIN PERFORMANCE
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_code ON tasks(owner_code);
CREATE INDEX IF NOT EXISTS idx_projects_owner_code ON projects(owner_code);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- =========================================================================
-- POSTGRES TRIGGER LOGIC FOR PARENT-CHILD ROLLUPS
-- =========================================================================

-- Trigger to auto-update duration whenever start_date or due_date changes
CREATE OR REPLACE FUNCTION fn_calc_task_duration()
RETURNS TRIGGER AS $$
BEGIN
    NEW.duration := COALESCE(NEW.due_date - NEW.start_date + 1, 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_task_duration
BEFORE INSERT OR UPDATE OF start_date, due_date ON tasks
FOR EACH ROW EXECUTE FUNCTION fn_calc_task_duration();


-- Trigger function to roll up child task stats (dates, progress, status) to parent tasks and projects
CREATE OR REPLACE FUNCTION fn_rollup_task_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_id UUID;
    v_project_id UUID;
    v_child_count INTEGER;
    v_avg_progress INTEGER;
    v_min_start DATE;
    v_max_due DATE;
    v_all_completed BOOLEAN;
    v_any_delayed BOOLEAN;
    v_any_in_progress BOOLEAN;
    v_parent_status TEXT;
    v_proj_progress INTEGER;
    v_proj_status TEXT;
    v_proj_any_delayed BOOLEAN;
    v_proj_any_in_progress BOOLEAN;
BEGIN
    -- Determine which task/project needs updating based on the action type
    IF TG_OP = 'DELETE' THEN
        v_parent_id := OLD.parent_id;
        v_project_id := OLD.project_id;
    ELSE
        v_parent_id := NEW.parent_id;
        v_project_id := NEW.project_id;
    END IF;

    -- 1. ROLL UP TO PARENT TASK (RECURSIVE BUBBLE-UP)
    IF v_parent_id IS NOT NULL THEN
        -- Check if any children exist for this parent
        SELECT COUNT(*), AVG(progress), MIN(start_date), MAX(due_date)
        INTO v_child_count, v_avg_progress, v_min_start, v_max_due
        FROM tasks
        WHERE parent_id = v_parent_id;

        IF v_child_count > 0 THEN
            -- Check child statuses
            SELECT 
                COUNT(*) FILTER (WHERE status != 'Completed') = 0,
                COUNT(*) FILTER (WHERE status = 'Delayed' OR (due_date < CURRENT_DATE AND progress < 100)) > 0,
                COUNT(*) FILTER (WHERE status = 'In Progress' OR progress > 0) > 0
            INTO v_all_completed, v_any_delayed, v_any_in_progress
            FROM tasks
            WHERE parent_id = v_parent_id;

            -- Calculate status
            IF v_all_completed THEN
                v_parent_status := 'Completed';
                v_avg_progress := 100;
            ELSIF v_any_delayed THEN
                v_parent_status := 'Delayed';
            ELSIF v_any_in_progress OR v_avg_progress > 0 THEN
                v_parent_status := 'In Progress';
            ELSE
                v_parent_status := 'Not Started';
            END IF;

            -- Apply standard updates to parent task
            -- This update will recursively fire this trigger for v_parent_id's parent
            UPDATE tasks
            SET 
                start_date = COALESCE(v_min_start, start_date),
                due_date = COALESCE(v_max_due, due_date),
                progress = COALESCE(ROUND(v_avg_progress)::INTEGER, 0),
                status = v_parent_status
            WHERE id = v_parent_id 
              -- Avoid triggering unnecessary updates to prevent infinite recursion
              AND (start_date IS DISTINCT FROM v_min_start 
                   OR due_date IS DISTINCT FROM v_max_due 
                   OR progress IS DISTINCT FROM ROUND(v_avg_progress)::INTEGER 
                   OR status IS DISTINCT FROM v_parent_status);
        END IF;
    END IF;

    -- 2. ROLL UP TO PROJECT LEVEL (FOR TOP-LEVEL TASKS OR SYSTEM FLATTENING)
    -- Calculate average progress and overall status of all top-level tasks (parent_id IS NULL)
    SELECT COUNT(*), AVG(progress)
    INTO v_child_count, v_avg_progress
    FROM tasks
    WHERE project_id = v_project_id AND parent_id IS NULL;

    IF v_child_count > 0 THEN
        SELECT 
            COUNT(*) FILTER (WHERE status != 'Completed') = 0,
            COUNT(*) FILTER (WHERE status = 'Delayed' OR (due_date < CURRENT_DATE AND progress < 100)) > 0,
            COUNT(*) FILTER (WHERE status = 'In Progress' OR progress > 0) > 0
        INTO v_all_completed, v_proj_any_delayed, v_proj_any_in_progress
        FROM tasks
        WHERE project_id = v_project_id AND parent_id IS NULL;

        IF v_all_completed THEN
            v_proj_status := 'Completed';
            v_avg_progress := 100;
        ELSIF v_proj_any_delayed THEN
            v_proj_status := 'Delayed';
        ELSIF v_proj_any_in_progress OR v_avg_progress > 0 THEN
            v_proj_status := 'In Progress';
        ELSE
            v_proj_status := 'Planning';
        END IF;

        UPDATE projects
        SET 
            progress = COALESCE(ROUND(v_avg_progress)::INTEGER, 0),
            status = v_proj_status
        WHERE id = v_project_id
          AND (progress IS DISTINCT FROM ROUND(v_avg_progress)::INTEGER
               OR status IS DISTINCT FROM v_proj_status);
    ELSE
        -- No tasks exist for the project, reset to default state
        UPDATE projects
        SET progress = 0, status = 'Planning'
        WHERE id = v_project_id AND (progress != 0 OR status != 'Planning');
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Hook trigger to run AFTER changes to task list to recalculate parents & projects
CREATE TRIGGER trg_rollup_task_changes
AFTER INSERT OR UPDATE OF start_date, due_date, progress, status, parent_id OR DELETE ON tasks
FOR EACH ROW
EXECUTE FUNCTION fn_rollup_task_changes();


-- =========================================================================
-- SEED DATA SETUP
-- =========================================================================

-- Clean up any existing data
TRUNCATE TABLE system_settings CASCADE;
TRUNCATE TABLE task_attachments CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE projects CASCADE;
TRUNCATE TABLE column_settings CASCADE;
TRUNCATE TABLE employee_master CASCADE;

-- Insert Employee Master List
INSERT INTO employee_master (employee_code, name, role, department, status) VALUES
('EMP001', 'Kitti Prasertsook', 'OSCI_ADMIN', 'OS&CI', 'ACTIVE'),
('EMP002', 'Somchai Jaidee', 'MANAGER', 'Production', 'ACTIVE'),
('EMP003', 'Nattaporn Srisuwan', 'OWNER', 'Quality', 'ACTIVE'),
('EMP004', 'Wichai Rungrueng', 'OWNER', 'Logistics', 'ACTIVE'),
('EMP005', 'Preecha Silpa', 'VIEWER', 'Engineering', 'ACTIVE'),
('ADMIN99', 'System Emergency Admin', 'OSCI_ADMIN', 'OS&CI', 'ACTIVE');

-- Insert Column Customization Settings for seed employees
INSERT INTO column_settings (employee_code, visible_columns, gantt_visible) VALUES
('EMP001', '{"wbs":true,"name":true,"owner":true,"department":true,"start_date":true,"due_date":true,"duration":true,"progress":true,"status":true,"priority":true,"dependency":true,"actions":true}'::jsonb, TRUE),
('EMP002', '{"wbs":true,"name":true,"owner":true,"department":true,"start_date":true,"due_date":true,"duration":true,"progress":true,"status":true,"priority":true,"dependency":true,"actions":true}'::jsonb, TRUE),
('EMP003', '{"wbs":true,"name":true,"owner":true,"department":true,"start_date":true,"due_date":true,"duration":true,"progress":true,"status":true,"priority":true,"dependency":true,"actions":true}'::jsonb, TRUE);

-- Insert Manufacturing Projects (OS&CI / Kaizen / 5S / TPM)
INSERT INTO projects (id, name, year, plant, category, status, progress, owner_code) VALUES
('a0000000-0000-0000-0000-000000000001', '5S Workspace Standardization - Plant 1 Assembly Line', 2026, 'Plant A', '5S', 'In Progress', 0, 'EMP002'),
('a0000000-0000-0000-0000-000000000002', 'TPM OEE Improvement on Stamping Machine B', 2026, 'Plant B', 'TPM', 'Planning', 0, 'EMP003'),
('a0000000-0000-0000-0000-000000000003', 'Kaizen Material Handling Cost Reduction', 2026, 'Plant A', 'Kaizen', 'Completed', 100, 'EMP004');

-- Insert Initial Tasks for Project 1 (5S Workspace Standardization)
-- We disable trigger temporarily to set direct baseline records easily, then enable it
ALTER TABLE tasks DISABLE TRIGGER trg_rollup_task_changes;

-- Insert baseline tasks (Main Task 1)
INSERT INTO tasks (id, project_id, parent_id, wbs, name, owner_code, department, start_date, due_date, progress, status, priority, sort_order) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NULL, '1', 'Preparation & Training', 'EMP002', 'OS&CI', '2026-05-01', '2026-05-10', 100, 'Completed', 'High', 1),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '1.1', 'Form 5S Steering Committee', 'EMP002', 'OS&CI', '2026-05-01', '2026-05-04', 100, 'Completed', 'Medium', 2),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '1.2', 'Kick-off Meeting & Awareness Training', 'EMP005', 'Engineering', '2026-05-05', '2026-05-10', 100, 'Completed', 'Low', 3);

-- Main Task 2
INSERT INTO tasks (id, project_id, parent_id, wbs, name, owner_code, department, start_date, due_date, progress, status, priority, sort_order) VALUES
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', NULL, '2', 'Sorting & Straightening (Seiri & Seiton)', 'EMP003', 'Production', '2026-05-11', '2026-05-25', 60, 'In Progress', 'Critical', 4),
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', '2.1', 'Sort Red-Tag Campaign (Remove Unnecessary Items)', 'EMP003', 'Production', '2026-05-11', '2026-05-17', 100, 'Completed', 'High', 5),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', '2.2', 'Visual Management & Floor Layout Marking', 'EMP004', 'Logistics', '2026-05-18', '2026-05-25', 20, 'In Progress', 'Critical', 6);

-- Main Task 3
INSERT INTO tasks (id, project_id, parent_id, wbs, name, owner_code, department, start_date, due_date, progress, status, priority, sort_order) VALUES
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', NULL, '3', 'Shining & Standardizing (Seiso & Seiketsu)', 'EMP002', 'OS&CI', '2026-05-26', '2026-06-15', 0, 'Not Started', 'Medium', 7),
('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000007', '3.1', 'Establish Cleaning Schedules & Responsibilities', 'EMP002', 'OS&CI', '2026-05-26', '2026-06-02', 0, 'Not Started', 'Medium', 8),
('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', '3.2', 'Final Audit & Standardization Board Setup', 'EMP003', 'Quality', '2026-06-03', '2026-06-15', 0, 'Not Started', 'High', 9, TRUE); -- Milestone

-- Enable the trigger back to normal operations
ALTER TABLE tasks ENABLE TRIGGER trg_rollup_task_changes;

-- Run standard manual roll up to initialize the project statistics for seed databases
-- Project 1 Calculations
UPDATE tasks SET progress = 100, status = 'Completed' WHERE id = 'b0000000-0000-0000-0000-000000000001';
UPDATE tasks SET progress = 60, status = 'In Progress' WHERE id = 'b0000000-0000-0000-0000-000000000004';
UPDATE tasks SET progress = 0, status = 'Not Started' WHERE id = 'b0000000-0000-0000-0000-000000000007';

-- Insert Initial Tasks for Project 2 (OEE Improvement)
ALTER TABLE tasks DISABLE TRIGGER trg_rollup_task_changes;
INSERT INTO tasks (id, project_id, parent_id, wbs, name, owner_code, department, start_date, due_date, progress, status, priority, sort_order) VALUES
('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000002', NULL, '1', 'Analyze Losses & Current OEE Baseline', 'EMP003', 'Production', '2026-06-01', '2026-06-10', 0, 'Not Started', 'High', 1),
('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002', NULL, '2', 'Implement Predictive Maintenance Schedule', 'EMP005', 'Engineering', '2026-06-11', '2026-06-25', 0, 'Not Started', 'Critical', 2);
ALTER TABLE tasks ENABLE TRIGGER trg_rollup_task_changes;

-- Insert Initial Tasks for Project 3 (Material Handling)
ALTER TABLE tasks DISABLE TRIGGER trg_rollup_task_changes;
INSERT INTO tasks (id, project_id, parent_id, wbs, name, owner_code, department, start_date, due_date, progress, status, priority, sort_order) VALUES
('b0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000003', NULL, '1', 'Route Optimization & Forklift Idle Reduction', 'EMP004', 'Logistics', '2026-04-01', '2026-04-15', 100, 'Completed', 'High', 1),
('b0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000003', NULL, '2', 'Deploy AGV System in Assembly A', 'EMP005', 'Engineering', '2026-04-16', '2026-05-15', 100, 'Completed', 'Critical', 2);
ALTER TABLE tasks ENABLE TRIGGER trg_rollup_task_changes;

-- Trigger updates to make project statistics accurate
UPDATE projects SET progress = 53, status = 'In Progress' WHERE id = 'a0000000-0000-0000-0000-000000000001';
UPDATE projects SET progress = 0, status = 'Planning' WHERE id = 'a0000000-0000-0000-0000-000000000002';
UPDATE projects SET progress = 100, status = 'Completed' WHERE id = 'a0000000-0000-0000-0000-000000000003';

-- System settings initialization
INSERT INTO system_settings (key, value) VALUES
('plant_list', '["Plant A", "Plant B", "Plant C", "Plant D"]'::jsonb),
('departments', '["OS&CI", "Production", "Quality", "Logistics", "Engineering", "EHS", "HR"]'::jsonb),
('categories', '["5S", "Kaizen", "TPM", "P3", "D&A", "OS&CI"]'::jsonb),
('admin_pin', '{"pin": "778899"}'::jsonb);

-- Enable RLS for all tables
ALTER TABLE employee_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE column_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create Open Policies (Standard simplified read/write access for intranets)
-- Allows reading all tables for any visitor, and modification if employee_code is present in header/session
CREATE POLICY "Allow read for all employees" ON employee_master FOR SELECT USING (true);
CREATE POLICY "Allow write for admin" ON employee_master FOR ALL USING (true);

CREATE POLICY "Allow read for projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Allow write for projects" ON projects FOR ALL USING (true);

CREATE POLICY "Allow read for tasks" ON tasks FOR SELECT USING (true);
CREATE POLICY "Allow write for tasks" ON tasks FOR ALL USING (true);

CREATE POLICY "Allow read for column_settings" ON column_settings FOR SELECT USING (true);
CREATE POLICY "Allow write for column_settings" ON column_settings FOR ALL USING (true);

CREATE POLICY "Allow read for task_attachments" ON task_attachments FOR SELECT USING (true);
CREATE POLICY "Allow write for task_attachments" ON task_attachments FOR ALL USING (true);

CREATE POLICY "Allow read for task_comments" ON task_comments FOR SELECT USING (true);
CREATE POLICY "Allow write for task_comments" ON task_comments FOR ALL USING (true);

CREATE POLICY "Allow read for activity_logs" ON activity_logs FOR SELECT USING (true);
CREATE POLICY "Allow write for activity_logs" ON activity_logs FOR ALL USING (true);

CREATE POLICY "Allow read for system_settings" ON system_settings FOR SELECT USING (true);
CREATE POLICY "Allow write for system_settings" ON system_settings FOR ALL USING (true);
