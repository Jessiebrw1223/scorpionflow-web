]633;E;for f in supabase/migrations/*.sql\x3b do   echo ""\x3b   echo "-- =========================================="\x3b   echo "-- MIGRATION: $f"\x3b   echo "-- =========================================="\x3b   cat "$f"\x3b done > supabase/all_migrations.sql;e3db7afb-cfc8-46d4-b1ac-37133fc8d521]633;C
-- ==========================================
-- MIGRATION: supabase/migrations/20260417064614_f5fbcab9-0720-4766-84fd-fc1ed53c9761.sql
-- ==========================================

CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles viewable by owner" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TYPE public.client_type AS ENUM ('hotel', 'spa', 'business', 'other');

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  client_type client_type NOT NULL DEFAULT 'business',
  email TEXT,
  phone TEXT,
  ruc TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_clients_owner ON public.clients(owner_id);

CREATE POLICY "owners view clients" ON public.clients FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owners insert clients" ON public.clients FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update clients" ON public.clients FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owners delete clients" ON public.clients FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TYPE public.quotation_status AS ENUM ('pending', 'in_contact', 'quoted', 'won', 'lost');

CREATE TABLE public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  status quotation_status NOT NULL DEFAULT 'pending',
  currency TEXT NOT NULL DEFAULT 'PEN',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 18,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  valid_until DATE,
  converted_to_project BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_quotations_owner ON public.quotations(owner_id);
CREATE INDEX idx_quotations_client ON public.quotations(client_id);
CREATE INDEX idx_quotations_status ON public.quotations(status);

CREATE POLICY "owners view quotations" ON public.quotations FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owners insert quotations" ON public.quotations FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update quotations" ON public.quotations FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owners delete quotations" ON public.quotations FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER trg_quotations_updated BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_quotation_items_quotation ON public.quotation_items(quotation_id);

CREATE POLICY "items follow quotation owner" ON public.quotation_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id AND q.owner_id = auth.uid()));
CREATE POLICY "items insert by owner" ON public.quotation_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id AND q.owner_id = auth.uid()));
CREATE POLICY "items update by owner" ON public.quotation_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id AND q.owner_id = auth.uid()));
CREATE POLICY "items delete by owner" ON public.quotation_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id AND q.owner_id = auth.uid()));

-- ==========================================
-- MIGRATION: supabase/migrations/20260417071056_0da2a9aa-e274-4a49-befc-d0ebef5f67b9.sql
-- ==========================================
-- 1. Ampliar enum client_type
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'industrial';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'tech';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'retail';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'healthcare';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'education';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'government';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'manufacturing';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'logistics';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'international';

-- 2. Enum estado comercial
DO $$ BEGIN
  CREATE TYPE public.commercial_status AS ENUM ('active', 'pending', 'no_followup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Ampliar tabla clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS commercial_status public.commercial_status NOT NULL DEFAULT 'pending';

-- 4. Ampliar tabla quotations
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS close_probability INTEGER NOT NULL DEFAULT 50 CHECK (close_probability >= 0 AND close_probability <= 100);

-- 5. Tipos de alerta
DO $$ BEGIN
  CREATE TYPE public.alert_type AS ENUM ('task_blocked', 'project_risk', 'client_no_followup', 'cost_overrun', 'resource_overload', 'quotation_stale', 'general');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.alert_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Tabla notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_type public.alert_type NOT NULL DEFAULT 'general',
  severity public.alert_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  related_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- 7. Trigger para actualizar status_changed_at en quotations
CREATE OR REPLACE FUNCTION public.track_quotation_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_quotation_status_change ON public.quotations;
CREATE TRIGGER trg_quotation_status_change
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.track_quotation_status_change();
-- ==========================================
-- MIGRATION: supabase/migrations/20260417192257_5b4def98-7885-42b9-a0bb-9ebe94fbc5d8.sql
-- ==========================================
-- ============================================
-- Tabla: projects (proyectos reales)
-- ============================================
CREATE TYPE public.project_status AS ENUM ('on_track', 'at_risk', 'over_budget', 'completed', 'cancelled');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'in_review', 'done', 'blocked');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status public.project_status NOT NULL DEFAULT 'on_track',
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  budget numeric NOT NULL DEFAULT 0,
  actual_cost numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PEN',
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view projects" ON public.projects FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owners insert projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update projects" ON public.projects FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owners delete projects" ON public.projects FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_projects_owner ON public.projects(owner_id);
CREATE INDEX idx_projects_client ON public.projects(client_id);
CREATE INDEX idx_projects_quotation ON public.projects(quotation_id);

-- ============================================
-- Tabla: tasks (tareas vinculadas a proyectos)
-- ============================================
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  assignee_id uuid,
  assignee_name text,
  due_date date,
  blocks_project boolean NOT NULL DEFAULT false,
  blocked_since timestamptz,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view tasks" ON public.tasks FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owners insert tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update tasks" ON public.tasks FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owners delete tasks" ON public.tasks FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: si una tarea pasa a 'blocked', registrar el momento
CREATE OR REPLACE FUNCTION public.track_task_blocked_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'blocked' AND (OLD.status IS DISTINCT FROM 'blocked' OR OLD.blocked_since IS NULL) THEN
    NEW.blocked_since = now();
  ELSIF NEW.status <> 'blocked' THEN
    NEW.blocked_since = NULL;
    NEW.blocks_project = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER track_tasks_blocked
  BEFORE INSERT OR UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.track_task_blocked_at();

CREATE INDEX idx_tasks_owner ON public.tasks(owner_id);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);

-- ============================================
-- Tabla: client_interactions (historial CRM)
-- ============================================
CREATE TYPE public.interaction_type AS ENUM ('call', 'meeting', 'email', 'whatsapp', 'note', 'proposal_sent');

CREATE TABLE public.client_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  interaction_type public.interaction_type NOT NULL DEFAULT 'note',
  summary text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view interactions" ON public.client_interactions FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owners insert interactions" ON public.client_interactions FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update interactions" ON public.client_interactions FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owners delete interactions" ON public.client_interactions FOR DELETE USING (auth.uid() = owner_id);

CREATE INDEX idx_interactions_client ON public.client_interactions(client_id);
CREATE INDEX idx_interactions_owner ON public.client_interactions(owner_id);

-- ============================================
-- Trigger: al insertar interacción, actualizar last_contact_at del cliente
-- ============================================
CREATE OR REPLACE FUNCTION public.update_client_last_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.clients
  SET last_contact_at = NEW.occurred_at,
      commercial_status = CASE
        WHEN commercial_status = 'no_followup' THEN 'pending'::commercial_status
        ELSE commercial_status
      END
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_interaction_update_client
  AFTER INSERT ON public.client_interactions
  FOR EACH ROW EXECUTE FUNCTION public.update_client_last_contact();
-- ==========================================
-- MIGRATION: supabase/migrations/20260417214501_93cbfa13-6820-4d9e-9144-0e944b17c932.sql
-- ==========================================
-- Tipo enum para el "Impacto" de la tarea en el negocio
DO $$ BEGIN
  CREATE TYPE public.task_impact AS ENUM ('time', 'cost', 'delivery');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Añadir columna impact a tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS impact public.task_impact NOT NULL DEFAULT 'delivery';

-- ==========================================
-- MIGRATION: supabase/migrations/20260417221716_d6d42cd1-d4a6-49f9-9a70-eb8edafa61ce.sql
-- ==========================================
-- Enum para tipo de nodo en jerarquía de planificación
CREATE TYPE public.task_node_type AS ENUM (
  'epic',         -- Ágil: Épica
  'story',        -- Ágil: Historia de Usuario
  'task',         -- Ágil: Tarea (default — compatible con datos existentes)
  'phase',        -- Tradicional: Fase
  'subphase',     -- Tradicional: Subfase
  'activity'      -- Tradicional: Actividad
);

-- Enum para modo de planificación del proyecto
CREATE TYPE public.planning_mode AS ENUM ('agile', 'traditional');

-- Agregar campos a tasks
ALTER TABLE public.tasks
  ADD COLUMN node_type public.task_node_type NOT NULL DEFAULT 'task',
  ADD COLUMN parent_id uuid NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN start_date date NULL;

CREATE INDEX idx_tasks_parent_id ON public.tasks(parent_id);
CREATE INDEX idx_tasks_project_node ON public.tasks(project_id, node_type);
CREATE INDEX idx_tasks_dates ON public.tasks(project_id, start_date, due_date);

-- Agregar modo de planificación a projects
ALTER TABLE public.projects
  ADD COLUMN planning_mode public.planning_mode NOT NULL DEFAULT 'agile';
-- ==========================================
-- MIGRATION: supabase/migrations/20260417225138_75638904-e97f-4905-b888-cad53ccf90a1.sql
-- ==========================================
-- 1. Costos por tarea
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS estimated_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cost numeric NOT NULL DEFAULT 0;

-- 2. Recalcular progreso del proyecto basado en tareas (solo nodos hoja: task / activity)
CREATE OR REPLACE FUNCTION public.recalc_project_progress(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count int;
  done_count int;
  new_progress int;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE node_type IN ('task','activity')),
    COUNT(*) FILTER (WHERE node_type IN ('task','activity') AND status = 'done')
  INTO total_count, done_count
  FROM public.tasks
  WHERE project_id = _project_id;

  IF total_count = 0 THEN
    new_progress := 0;
  ELSE
    new_progress := ROUND((done_count::numeric / total_count::numeric) * 100);
  END IF;

  UPDATE public.projects
  SET progress = new_progress,
      updated_at = now()
  WHERE id = _project_id;
END;
$$;

-- 3. Trigger que dispara recálculo en cada cambio de tarea
CREATE OR REPLACE FUNCTION public.trigger_recalc_project_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_project_progress(OLD.project_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_project_progress(NEW.project_id);
    -- Si cambió de proyecto (raro pero posible) recalcula el anterior también
    IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN
      PERFORM public.recalc_project_progress(OLD.project_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS tasks_recalc_progress ON public.tasks;
CREATE TRIGGER tasks_recalc_progress
AFTER INSERT OR UPDATE OF status, node_type, project_id OR DELETE
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalc_project_progress();

-- 4. Recalcular para todos los proyectos existentes (one-shot)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT id FROM public.projects LOOP
    PERFORM public.recalc_project_progress(p.id);
  END LOOP;
END$$;
-- ==========================================
-- MIGRATION: supabase/migrations/20260417231711_1a28e782-6673-494e-b531-16d1bce2d6ad.sql
-- ==========================================
-- Tipo de recurso asignado
CREATE TYPE public.resource_kind AS ENUM ('human', 'tech', 'asset');
CREATE TYPE public.resource_unit AS ENUM ('hour', 'month', 'use', 'fixed');

CREATE TABLE public.project_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  kind public.resource_kind NOT NULL,
  name TEXT NOT NULL,
  role_or_type TEXT,
  unit public.resource_unit NOT NULL DEFAULT 'fixed',
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  quantity NUMERIC NOT NULL DEFAULT 1,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_resources_project ON public.project_resources(project_id);
CREATE INDEX idx_project_resources_kind ON public.project_resources(kind);

ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view project resources"
ON public.project_resources FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "owners insert project resources"
ON public.project_resources FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owners update project resources"
ON public.project_resources FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "owners delete project resources"
ON public.project_resources FOR DELETE
USING (auth.uid() = owner_id);

-- Auto: total_cost = unit_cost * quantity
CREATE OR REPLACE FUNCTION public.compute_resource_total_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.total_cost := COALESCE(NEW.unit_cost, 0) * COALESCE(NEW.quantity, 0);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER project_resources_compute_total
BEFORE INSERT OR UPDATE OF unit_cost, quantity ON public.project_resources
FOR EACH ROW
EXECUTE FUNCTION public.compute_resource_total_cost();

-- Recalcular actual_cost del proyecto = suma de total_cost de recursos
CREATE OR REPLACE FUNCTION public.recalc_project_actual_cost(_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  resource_total NUMERIC;
  task_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(total_cost), 0) INTO resource_total
  FROM public.project_resources
  WHERE project_id = _project_id AND status = 'active';

  SELECT COALESCE(SUM(actual_cost), 0) INTO task_total
  FROM public.tasks
  WHERE project_id = _project_id;

  UPDATE public.projects
  SET actual_cost = resource_total + task_total,
      updated_at = now()
  WHERE id = _project_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_recalc_project_actual_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_project_actual_cost(OLD.project_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_project_actual_cost(NEW.project_id);
    IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN
      PERFORM public.recalc_project_actual_cost(OLD.project_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER project_resources_recalc_actual
AFTER INSERT OR UPDATE OR DELETE ON public.project_resources
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalc_project_actual_cost();

-- También recalcular actual_cost cuando cambian costos reales en tareas
CREATE OR REPLACE FUNCTION public.trigger_tasks_recalc_actual_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_project_actual_cost(OLD.project_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_project_actual_cost(NEW.project_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER tasks_recalc_actual_cost
AFTER INSERT OR UPDATE OF actual_cost OR DELETE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.trigger_tasks_recalc_actual_cost();
-- ==========================================
-- MIGRATION: supabase/migrations/20260418000757_ba9b598b-b71e-44c2-b004-24999baf59f7.sql
-- ==========================================
-- Tabla de aportes adicionales del propietario al proyecto
CREATE TABLE public.project_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  contributed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view contributions" ON public.project_contributions
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owners insert contributions" ON public.project_contributions
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update contributions" ON public.project_contributions
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owners delete contributions" ON public.project_contributions
  FOR DELETE USING (auth.uid() = owner_id);

CREATE INDEX idx_project_contributions_project ON public.project_contributions(project_id);

CREATE TRIGGER update_project_contributions_updated_at
BEFORE UPDATE ON public.project_contributions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- ==========================================
-- MIGRATION: supabase/migrations/20260418025222_684be1a9-9b98-42c1-b1ba-7a2a1f6a5c14.sql
-- ==========================================
-- Tabla de configuración de negocio por usuario
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'PEN',
  cost_model TEXT NOT NULL DEFAULT 'mixed',
  target_margin NUMERIC NOT NULL DEFAULT 20,
  auto_alerts JSONB NOT NULL DEFAULT '{"budgetOver80": true, "marginBelow15": true, "projectInLoss": true}'::jsonb,
  auto_behavior JSONB NOT NULL DEFAULT '{"autoCostFromResources": true, "autoProgressFromTasks": true, "inferSchedule": false}'::jsonb,
  alerts JSONB NOT NULL DEFAULT '{"losingMoney": true, "criticalDelays": true, "budgetExceeded": true, "blockingTask": true}'::jsonb,
  channel TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_settings"
  ON public.user_settings FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- ==========================================
-- MIGRATION: supabase/migrations/20260418045101_50a82090-11a3-4f33-8f96-9957c478e6ef.sql
-- ==========================================

-- Enum para rol del miembro
CREATE TYPE public.team_role AS ENUM ('admin', 'collaborator', 'viewer');

-- Enum para estado de invitación
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'expired');

-- Enum para plan de suscripción
CREATE TYPE public.subscription_plan AS ENUM ('free', 'starter', 'pro', 'business');

-- Tabla de suscripciones (1 por usuario dueño)
CREATE TABLE public.account_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL UNIQUE,
  plan public.subscription_plan NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view own subscription"
ON public.account_subscriptions FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "owners insert own subscription"
ON public.account_subscriptions FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owners update own subscription"
ON public.account_subscriptions FOR UPDATE
USING (auth.uid() = owner_id);

CREATE TRIGGER trg_account_subscriptions_updated
BEFORE UPDATE ON public.account_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla de miembros del equipo
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  role public.team_role NOT NULL DEFAULT 'collaborator',
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view team members"
ON public.team_members FOR SELECT
USING (auth.uid() = owner_id OR auth.uid() = user_id);

CREATE POLICY "owners insert team members"
ON public.team_members FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owners update team members"
ON public.team_members FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "owners delete team members"
ON public.team_members FOR DELETE
USING (auth.uid() = owner_id);

CREATE TRIGGER trg_team_members_updated
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla de invitaciones
CREATE TABLE public.team_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  email TEXT NOT NULL,
  role public.team_role NOT NULL DEFAULT 'collaborator',
  status public.invitation_status NOT NULL DEFAULT 'pending',
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view own invitations"
ON public.team_invitations FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "invited users view own invitations"
ON public.team_invitations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() AND lower(u.email) = lower(team_invitations.email)
  )
);

CREATE POLICY "owners insert invitations"
ON public.team_invitations FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owners update invitations"
ON public.team_invitations FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "invited users update own invitations"
ON public.team_invitations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() AND lower(u.email) = lower(team_invitations.email)
  )
);

CREATE POLICY "owners delete invitations"
ON public.team_invitations FOR DELETE
USING (auth.uid() = owner_id);

CREATE TRIGGER trg_team_invitations_updated
BEFORE UPDATE ON public.team_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_team_invitations_email ON public.team_invitations (lower(email));
CREATE INDEX idx_team_members_owner ON public.team_members (owner_id);
CREATE INDEX idx_team_members_user ON public.team_members (user_id);

-- Función: límite por plan
CREATE OR REPLACE FUNCTION public.get_plan_user_limit(_plan public.subscription_plan)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN 5
    WHEN 'starter' THEN 10
    WHEN 'pro' THEN 999999
    WHEN 'business' THEN 999999
  END;
$$;

-- Función: contar usuarios usados (owner + miembros activos + invitaciones pendientes)
CREATE OR REPLACE FUNCTION public.count_team_usage(_owner_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  members_count INTEGER;
  pending_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO members_count
  FROM public.team_members
  WHERE owner_id = _owner_id AND is_active = true;

  SELECT COUNT(*) INTO pending_count
  FROM public.team_invitations
  WHERE owner_id = _owner_id AND status = 'pending' AND expires_at > now();

  -- +1 por el dueño
  RETURN 1 + COALESCE(members_count, 0) + COALESCE(pending_count, 0);
END;
$$;

-- Auto-crear suscripción Free al crear usuario
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.account_subscriptions (owner_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (owner_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Backfill: crear subscripción Free para usuarios existentes
INSERT INTO public.account_subscriptions (owner_id, plan, status)
SELECT id, 'free', 'active' FROM auth.users
ON CONFLICT (owner_id) DO NOTHING;

-- ==========================================
-- MIGRATION: supabase/migrations/20260418045117_77c4e65e-47f0-4a37-9ef9-2b8f439dd77d.sql
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_plan_user_limit(_plan public.subscription_plan)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN 5
    WHEN 'starter' THEN 10
    WHEN 'pro' THEN 999999
    WHEN 'business' THEN 999999
  END;
$$;

-- ==========================================
-- MIGRATION: supabase/migrations/20260418192301_email_infra.sql
-- ==========================================
-- Email infrastructure
-- Creates the queue system, send log, send state, suppression, and unsubscribe
-- tables used by both auth and transactional emails.

-- Extensions required for queue processing
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email queues (auth = high priority, transactional = normal)
-- Wrapped in DO blocks to handle "queue already exists" errors idempotently.
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dead-letter queues for messages that exceed max retries
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
-- (PostgREST only exposes functions in the public schema; pgmq functions are in the pgmq schema)
-- All wrappers auto-create the queue on undefined_table (42P01) so emails
-- are never lost if the queue was dropped (extension upgrade, restore, etc.).
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPC wrappers to service_role only (SECURITY DEFINER runs as owner,
-- so without this any authenticated user could manipulate the email queues)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ============================================================
-- POST-MIGRATION STEPS (applied dynamically by setup_email_infra)
-- These steps contain project-specific secrets and URLs and
-- cannot be expressed as static SQL. They are applied via the
-- Supabase Management API (ExecuteSQL) each time the tool runs.
-- ============================================================
--
-- 1. VAULT SECRET
--    Stores (or updates) the Supabase service_role key in
--    vault as 'email_queue_service_role_key'.
--    Uses vault.create_secret / vault.update_secret (upsert).
--    To revert: DELETE FROM vault.secrets WHERE name = 'email_queue_service_role_key';
--
-- 2. CRON JOB (pg_cron)
--    Creates job 'process-email-queue' with a 5-second interval.
--    The job checks:
--      a) rate-limit cooldown (email_send_state.retry_after_until)
--      b) whether auth_emails or transactional_emails queues have messages
--    If conditions are met, it calls the process-email-queue Edge Function
--    via net.http_post using the vault-stored service_role key.
--    To revert: SELECT cron.unschedule('process-email-queue');

-- ==========================================
-- MIGRATION: supabase/migrations/20260418200054_1cfcf77e-7f70-4e83-8535-5db21126fdc7.sql
-- ==========================================
-- Drop the policies that reference auth.users (which causes "permission denied for table users")
DROP POLICY IF EXISTS "invited users view own invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "invited users update own invitations" ON public.team_invitations;

-- Recreate using auth.email() which is safe and does not require access to auth.users
CREATE POLICY "invited users view own invitations"
ON public.team_invitations
FOR SELECT
TO authenticated
USING (lower(email) = lower(auth.email()));

CREATE POLICY "invited users update own invitations"
ON public.team_invitations
FOR UPDATE
TO authenticated
USING (lower(email) = lower(auth.email()));
-- ==========================================
-- MIGRATION: supabase/migrations/20260418212018_c31e0c14-3c5a-40d1-be26-215931a763a6.sql
-- ==========================================
-- Agregar columnas Stripe a account_subscriptions para sincronizar suscripciones
ALTER TABLE public.account_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS account_subscriptions_owner_id_unique
  ON public.account_subscriptions(owner_id);

CREATE INDEX IF NOT EXISTS account_subscriptions_stripe_customer_idx
  ON public.account_subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS account_subscriptions_stripe_subscription_idx
  ON public.account_subscriptions(stripe_subscription_id);

-- Permitir al service role gestionar suscripciones desde el webhook
CREATE POLICY "service role manages subscriptions"
  ON public.account_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
-- ==========================================
-- MIGRATION: supabase/migrations/20260418235939_211fd276-e930-42e3-be1b-74ec5e4eed6f.sql
-- ==========================================
-- 1) Función que crea user_settings por defecto al registrarse un nuevo usuario
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 2) Trigger que dispara la creación automáticamente
DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_settings();

-- 3) Asegurar que user_settings.user_id tenga índice único (para el ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'user_settings' 
    AND indexname = 'user_settings_user_id_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX user_settings_user_id_unique_idx ON public.user_settings(user_id);
  END IF;
END $$;

-- 4) Backfill: crear settings para usuarios existentes que no las tienen
INSERT INTO public.user_settings (user_id)
SELECT u.id FROM auth.users u
LEFT JOIN public.user_settings s ON s.user_id = u.id
WHERE s.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
-- ==========================================
-- MIGRATION: supabase/migrations/20260419043006_34977300-5ca9-4d63-a740-350b55bb87a9.sql
-- ==========================================
-- Lifecycle columns en account_subscriptions
ALTER TABLE public.account_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_downgrade_plan public.subscription_plan,
  ADD COLUMN IF NOT EXISTS pending_downgrade_billing_cycle text;

CREATE INDEX IF NOT EXISTS idx_account_subscriptions_stripe_customer
  ON public.account_subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_account_subscriptions_stripe_subscription
  ON public.account_subscriptions (stripe_subscription_id);

-- Tabla de auditoría de eventos
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  event_type text NOT NULL,
  from_plan public.subscription_plan,
  to_plan public.subscription_plan,
  billing_cycle text,
  stripe_event_id text,
  stripe_subscription_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_owner
  ON public.subscription_events (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_stripe_event
  ON public.subscription_events (stripe_event_id);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners view own subscription events" ON public.subscription_events;
CREATE POLICY "owners view own subscription events"
  ON public.subscription_events
  FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "service role manages subscription events" ON public.subscription_events;
CREATE POLICY "service role manages subscription events"
  ON public.subscription_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
-- ==========================================
-- MIGRATION: supabase/migrations/20260425210653_c9f32a20-ba35-494d-a1c2-912be6184d7c.sql
-- ==========================================
-- =========================================================
-- Fase 1: Workspace compartido (RLS basadas en team_members)
-- =========================================================

-- 1) Funciones SECURITY DEFINER (evitan recursión en RLS)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    _user_id = _owner_id
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.owner_id = _owner_id
        AND tm.user_id = _user_id
        AND tm.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(_user_id uuid, _owner_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id = _owner_id THEN 'owner'
    ELSE (
      SELECT tm.role::text FROM public.team_members tm
      WHERE tm.owner_id = _owner_id
        AND tm.user_id = _user_id
        AND tm.is_active = true
      LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_write_workspace(_user_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.get_workspace_role(_user_id, _owner_id) IN ('owner','admin','collaborator');
$$;

CREATE OR REPLACE FUNCTION public.can_admin_workspace(_user_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.get_workspace_role(_user_id, _owner_id) IN ('owner','admin');
$$;

-- 2) PROJECTS
DROP POLICY IF EXISTS "owners view projects" ON public.projects;
DROP POLICY IF EXISTS "owners insert projects" ON public.projects;
DROP POLICY IF EXISTS "owners update projects" ON public.projects;
DROP POLICY IF EXISTS "owners delete projects" ON public.projects;

CREATE POLICY "workspace members view projects" ON public.projects
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace admins insert projects" ON public.projects
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update projects" ON public.projects
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete projects" ON public.projects
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 3) CLIENTS
DROP POLICY IF EXISTS "owners view clients" ON public.clients;
DROP POLICY IF EXISTS "owners insert clients" ON public.clients;
DROP POLICY IF EXISTS "owners update clients" ON public.clients;
DROP POLICY IF EXISTS "owners delete clients" ON public.clients;

CREATE POLICY "workspace members view clients" ON public.clients
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace admins insert clients" ON public.clients
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update clients" ON public.clients
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete clients" ON public.clients
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 4) CLIENT INTERACTIONS
DROP POLICY IF EXISTS "owners view interactions" ON public.client_interactions;
DROP POLICY IF EXISTS "owners insert interactions" ON public.client_interactions;
DROP POLICY IF EXISTS "owners update interactions" ON public.client_interactions;
DROP POLICY IF EXISTS "owners delete interactions" ON public.client_interactions;

CREATE POLICY "workspace members view interactions" ON public.client_interactions
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace writers insert interactions" ON public.client_interactions
  FOR INSERT WITH CHECK (public.can_write_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update interactions" ON public.client_interactions
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete interactions" ON public.client_interactions
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 5) QUOTATIONS
DROP POLICY IF EXISTS "owners view quotations" ON public.quotations;
DROP POLICY IF EXISTS "owners insert quotations" ON public.quotations;
DROP POLICY IF EXISTS "owners update quotations" ON public.quotations;
DROP POLICY IF EXISTS "owners delete quotations" ON public.quotations;

CREATE POLICY "workspace members view quotations" ON public.quotations
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace admins insert quotations" ON public.quotations
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update quotations" ON public.quotations
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete quotations" ON public.quotations
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 6) QUOTATION ITEMS (siguen al owner de la cotización)
DROP POLICY IF EXISTS "items follow quotation owner" ON public.quotation_items;
DROP POLICY IF EXISTS "items insert by owner" ON public.quotation_items;
DROP POLICY IF EXISTS "items update by owner" ON public.quotation_items;
DROP POLICY IF EXISTS "items delete by owner" ON public.quotation_items;

CREATE POLICY "workspace members view quotation items" ON public.quotation_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.quotations q
            WHERE q.id = quotation_items.quotation_id
              AND public.is_workspace_member(auth.uid(), q.owner_id))
  );
CREATE POLICY "workspace admins insert quotation items" ON public.quotation_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.quotations q
            WHERE q.id = quotation_items.quotation_id
              AND public.can_admin_workspace(auth.uid(), q.owner_id))
  );
CREATE POLICY "workspace admins update quotation items" ON public.quotation_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.quotations q
            WHERE q.id = quotation_items.quotation_id
              AND public.can_admin_workspace(auth.uid(), q.owner_id))
  );
CREATE POLICY "workspace admins delete quotation items" ON public.quotation_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.quotations q
            WHERE q.id = quotation_items.quotation_id
              AND public.can_admin_workspace(auth.uid(), q.owner_id))
  );

-- 7) TASKS (colaborador puede escribir; visualizador no)
DROP POLICY IF EXISTS "owners view tasks" ON public.tasks;
DROP POLICY IF EXISTS "owners insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "owners update tasks" ON public.tasks;
DROP POLICY IF EXISTS "owners delete tasks" ON public.tasks;

CREATE POLICY "workspace members view tasks" ON public.tasks
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace writers insert tasks" ON public.tasks
  FOR INSERT WITH CHECK (public.can_write_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace writers update tasks" ON public.tasks
  FOR UPDATE USING (public.can_write_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace writers delete tasks" ON public.tasks
  FOR DELETE USING (public.can_write_workspace(auth.uid(), owner_id));

-- 8) PROJECT RESOURCES
DROP POLICY IF EXISTS "owners view project resources" ON public.project_resources;
DROP POLICY IF EXISTS "owners insert project resources" ON public.project_resources;
DROP POLICY IF EXISTS "owners update project resources" ON public.project_resources;
DROP POLICY IF EXISTS "owners delete project resources" ON public.project_resources;

CREATE POLICY "workspace members view project resources" ON public.project_resources
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace admins insert project resources" ON public.project_resources
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update project resources" ON public.project_resources
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete project resources" ON public.project_resources
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 9) PROJECT CONTRIBUTIONS
DROP POLICY IF EXISTS "owners view contributions" ON public.project_contributions;
DROP POLICY IF EXISTS "owners insert contributions" ON public.project_contributions;
DROP POLICY IF EXISTS "owners update contributions" ON public.project_contributions;
DROP POLICY IF EXISTS "owners delete contributions" ON public.project_contributions;

CREATE POLICY "workspace members view contributions" ON public.project_contributions
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace admins insert contributions" ON public.project_contributions
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update contributions" ON public.project_contributions
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete contributions" ON public.project_contributions
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 10) TEAM MEMBERS — los miembros pueden ver el equipo; solo admin gestiona
DROP POLICY IF EXISTS "owners view team members" ON public.team_members;
DROP POLICY IF EXISTS "owners insert team members" ON public.team_members;
DROP POLICY IF EXISTS "owners update team members" ON public.team_members;
DROP POLICY IF EXISTS "owners delete team members" ON public.team_members;

CREATE POLICY "workspace members view team members" ON public.team_members
  FOR SELECT USING (
    public.is_workspace_member(auth.uid(), owner_id)
    OR auth.uid() = user_id
  );
CREATE POLICY "workspace admins insert team members" ON public.team_members
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update team members" ON public.team_members
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete team members" ON public.team_members
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 11) TEAM INVITATIONS — admin puede invitar; miembros ven invitaciones del workspace
DROP POLICY IF EXISTS "owners view own invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "owners insert invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "owners update invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "owners delete invitations" ON public.team_invitations;

CREATE POLICY "workspace members view invitations" ON public.team_invitations
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace admins insert invitations" ON public.team_invitations
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update invitations" ON public.team_invitations
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete invitations" ON public.team_invitations
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));
-- ==========================================
-- MIGRATION: supabase/migrations/20260425212642_7d54ee99-6d83-4412-9e91-052a5db8c89e.sql
-- ==========================================
-- Tighten task editing for shared workspaces and role management safety.

DROP POLICY IF EXISTS "workspace writers insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "workspace writers update tasks" ON public.tasks;
DROP POLICY IF EXISTS "workspace writers delete tasks" ON public.tasks;

CREATE POLICY "workspace admins insert tasks"
ON public.tasks
FOR INSERT
WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));

CREATE POLICY "workspace admins or assigned collaborators update tasks"
ON public.tasks
FOR UPDATE
USING (
  public.can_admin_workspace(auth.uid(), owner_id)
  OR (
    public.get_workspace_role(auth.uid(), owner_id) = 'collaborator'
    AND assignee_id = auth.uid()
  )
)
WITH CHECK (
  public.can_admin_workspace(auth.uid(), owner_id)
  OR (
    public.get_workspace_role(auth.uid(), owner_id) = 'collaborator'
    AND assignee_id = auth.uid()
  )
);

CREATE POLICY "workspace admins delete tasks"
ON public.tasks
FOR DELETE
USING (public.can_admin_workspace(auth.uid(), owner_id));

DROP POLICY IF EXISTS "workspace admins update team members" ON public.team_members;
DROP POLICY IF EXISTS "workspace admins delete team members" ON public.team_members;

CREATE POLICY "workspace owner updates team members"
ON public.team_members
FOR UPDATE
USING (auth.uid() = owner_id AND user_id <> owner_id)
WITH CHECK (auth.uid() = owner_id AND user_id <> owner_id);

CREATE POLICY "workspace owner deletes team members"
ON public.team_members
FOR DELETE
USING (auth.uid() = owner_id AND user_id <> owner_id);

-- Keep invitations admin-capable so admins can invite, while member role changes remain owner-only.

-- ==========================================
-- MIGRATION: supabase/migrations/20260425212703_fcfdf7cb-1db8-4206-b62d-bf49b873c54a.sql
-- ==========================================
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
-- ==========================================
-- MIGRATION: supabase/migrations/20260425221208_fbad53c2-5d88-4142-a380-1de85e3c2be4.sql
-- ==========================================
-- =====================================================
-- FASE 2: Acceso granular a proyectos (project_members)
-- Modelo ADITIVO: owner/admin/viewer del workspace mantienen visibilidad global.
-- Solo el rol "collaborator" se restringe a proyectos donde tenga membership.
-- =====================================================

-- 1. Tabla project_members
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role public.team_role NOT NULL DEFAULT 'collaborator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_project_members_updated_at ON public.project_members;
CREATE TRIGGER trg_project_members_updated_at
  BEFORE UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Helper SECURITY DEFINER: ¿el usuario tiene acceso a este proyecto?
-- Reglas:
--   - Owner del workspace: SIEMPRE
--   - Admin del workspace: SIEMPRE
--   - Viewer del workspace: SIEMPRE (solo lectura, ya cubierto en políticas de write)
--   - Collaborator del workspace: SOLO si está en project_members
--                                  O si tiene tareas asignadas en ese proyecto (compatibilidad con datos previos)
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH proj AS (
    SELECT owner_id FROM public.projects WHERE id = _project_id
  ),
  ws_role AS (
    SELECT public.get_workspace_role(_user_id, (SELECT owner_id FROM proj)) AS role
  )
  SELECT
    -- Sin proyecto, sin acceso
    (SELECT owner_id FROM proj) IS NOT NULL
    AND (
      -- Owner/Admin/Viewer del workspace ven todo
      (SELECT role FROM ws_role) IN ('owner','admin','viewer')
      -- Collaborator: requiere membresía explícita o tareas asignadas
      OR (
        (SELECT role FROM ws_role) = 'collaborator'
        AND (
          EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = _project_id AND pm.user_id = _user_id
          )
          OR EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.project_id = _project_id AND t.assignee_id = _user_id
          )
        )
      )
    );
$$;

-- 3. Helper: ¿puede administrar este proyecto? (admin del workspace o admin en project_members)
CREATE OR REPLACE FUNCTION public.can_admin_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH proj AS (
    SELECT owner_id FROM public.projects WHERE id = _project_id
  )
  SELECT
    (SELECT owner_id FROM proj) IS NOT NULL
    AND (
      public.can_admin_workspace(_user_id, (SELECT owner_id FROM proj))
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = _project_id
          AND pm.user_id = _user_id
          AND pm.role IN ('admin')
      )
    );
$$;

-- 4. RLS de project_members
DROP POLICY IF EXISTS "workspace members view project memberships" ON public.project_members;
CREATE POLICY "workspace members view project memberships"
  ON public.project_members FOR SELECT
  USING (
    -- Cualquier miembro del workspace dueño del proyecto puede ver memberships
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.is_workspace_member(auth.uid(), p.owner_id)
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "workspace admins manage project memberships insert" ON public.project_members;
CREATE POLICY "workspace admins manage project memberships insert"
  ON public.project_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.can_admin_workspace(auth.uid(), p.owner_id)
    )
  );

DROP POLICY IF EXISTS "workspace admins manage project memberships update" ON public.project_members;
CREATE POLICY "workspace admins manage project memberships update"
  ON public.project_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.can_admin_workspace(auth.uid(), p.owner_id)
    )
  );

DROP POLICY IF EXISTS "workspace admins manage project memberships delete" ON public.project_members;
CREATE POLICY "workspace admins manage project memberships delete"
  ON public.project_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.can_admin_workspace(auth.uid(), p.owner_id)
    )
  );

-- 5. Endurecer SELECT en projects: collaborator solo ve los que tiene asignados
DROP POLICY IF EXISTS "workspace members view projects" ON public.projects;
CREATE POLICY "workspace members view projects"
  ON public.projects FOR SELECT
  USING (
    public.is_workspace_member(auth.uid(), owner_id)
    AND (
      public.get_workspace_role(auth.uid(), owner_id) IN ('owner','admin','viewer')
      OR (
        public.get_workspace_role(auth.uid(), owner_id) = 'collaborator'
        AND public.has_project_access(auth.uid(), id)
      )
    )
  );

-- 6. Endurecer SELECT en tasks
DROP POLICY IF EXISTS "workspace members view tasks" ON public.tasks;
CREATE POLICY "workspace members view tasks"
  ON public.tasks FOR SELECT
  USING (
    public.is_workspace_member(auth.uid(), owner_id)
    AND (
      public.get_workspace_role(auth.uid(), owner_id) IN ('owner','admin','viewer')
      OR (
        public.get_workspace_role(auth.uid(), owner_id) = 'collaborator'
        AND public.has_project_access(auth.uid(), project_id)
      )
    )
  );

-- 7. project_resources SELECT
DROP POLICY IF EXISTS "workspace members view project resources" ON public.project_resources;
CREATE POLICY "workspace members view project resources"
  ON public.project_resources FOR SELECT
  USING (
    public.is_workspace_member(auth.uid(), owner_id)
    AND (
      public.get_workspace_role(auth.uid(), owner_id) IN ('owner','admin','viewer')
      OR (
        public.get_workspace_role(auth.uid(), owner_id) = 'collaborator'
        AND public.has_project_access(auth.uid(), project_id)
      )
    )
  );

-- 8. project_contributions SELECT
DROP POLICY IF EXISTS "workspace members view contributions" ON public.project_contributions;
CREATE POLICY "workspace members view contributions"
  ON public.project_contributions FOR SELECT
  USING (
    public.is_workspace_member(auth.uid(), owner_id)
    AND (
      public.get_workspace_role(auth.uid(), owner_id) IN ('owner','admin','viewer')
      OR (
        public.get_workspace_role(auth.uid(), owner_id) = 'collaborator'
        AND public.has_project_access(auth.uid(), project_id)
      )
    )
  );

-- NOTA: clients y quotations conservan la política existente (visible para
-- todos los miembros del workspace) porque no están atadas a un proyecto
-- único. La fase de UI puede filtrarlas por proyectos accesibles si se
-- requiere ocultarlas a colaboradores específicos.

-- ==========================================
-- MIGRATION: supabase/migrations/20260425231940_c8272d32-6f24-458e-ad53-3c1fa50daae7.sql
-- ==========================================
-- Agregar metadata a team_invitations para guardar scope y proyectos asignados
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'workspace',
  ADD COLUMN IF NOT EXISTS assigned_project_ids uuid[] NOT NULL DEFAULT '{}';

-- Trigger: cuando se acepta una invitación, materializar project_members
-- a partir de assigned_project_ids del invitado.
CREATE OR REPLACE FUNCTION public.materialize_invitation_project_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_project_id uuid;
BEGIN
  -- Solo cuando pasa de pending -> accepted
  IF (NEW.status = 'accepted' AND COALESCE(OLD.status, 'pending') <> 'accepted') THEN
    -- Buscar user_id del invitado por email
    SELECT user_id INTO v_user_id
    FROM public.team_members
    WHERE owner_id = NEW.owner_id
      AND lower(email) = lower(NEW.email)
    LIMIT 1;

    IF v_user_id IS NOT NULL AND array_length(NEW.assigned_project_ids, 1) > 0 THEN
      FOREACH v_project_id IN ARRAY NEW.assigned_project_ids LOOP
        INSERT INTO public.project_members (project_id, user_id, role)
        VALUES (v_project_id, v_user_id, NEW.role)
        ON CONFLICT (project_id, user_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_materialize_invitation_project_members ON public.team_invitations;
CREATE TRIGGER trg_materialize_invitation_project_members
  AFTER UPDATE ON public.team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.materialize_invitation_project_members();

-- Asegurar índice único para evitar duplicados en project_members
CREATE UNIQUE INDEX IF NOT EXISTS project_members_project_user_unique
  ON public.project_members (project_id, user_id);
-- ==========================================
-- MIGRATION: supabase/migrations/20260425234611_a5e9a212-1270-4526-9038-2c9177c96c2a.sql
-- ==========================================
-- =========================================================
-- FASE 3: Seguridad comercial — Clients y Quotations
-- Colaboradores solo ven datos de proyectos a los que tienen acceso.
-- Owner / Admin / Viewer siguen viendo todo el workspace.
-- =========================================================

-- CLIENTS: reemplazar política SELECT
DROP POLICY IF EXISTS "workspace members view clients" ON public.clients;

CREATE POLICY "workspace members view clients"
ON public.clients
FOR SELECT
USING (
  is_workspace_member(auth.uid(), owner_id)
  AND (
    get_workspace_role(auth.uid(), owner_id) IN ('owner','admin','viewer')
    OR (
      get_workspace_role(auth.uid(), owner_id) = 'collaborator'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.client_id = clients.id
          AND has_project_access(auth.uid(), p.id)
      )
    )
  )
);

-- QUOTATIONS: reemplazar política SELECT
DROP POLICY IF EXISTS "workspace members view quotations" ON public.quotations;

CREATE POLICY "workspace members view quotations"
ON public.quotations
FOR SELECT
USING (
  is_workspace_member(auth.uid(), owner_id)
  AND (
    get_workspace_role(auth.uid(), owner_id) IN ('owner','admin','viewer')
    OR (
      get_workspace_role(auth.uid(), owner_id) = 'collaborator'
      AND (
        -- Cotización ya convertida en un proyecto accesible
        EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.quotation_id = quotations.id
            AND has_project_access(auth.uid(), p.id)
        )
        -- O cliente con al menos un proyecto accesible
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.client_id = quotations.client_id
            AND has_project_access(auth.uid(), p.id)
        )
      )
    )
  )
);

-- QUOTATION_ITEMS: heredan de la cotización (ya filtrada por su política);
-- mantenemos la regla actual basada en is_workspace_member + EXISTS quotations.
-- No requiere cambios porque la subconsulta a quotations queda filtrada por su nueva RLS.
-- ==========================================
-- MIGRATION: supabase/migrations/20260426012331_f17e3ab9-be26-43ff-86df-68389f440552.sql
-- ==========================================

-- 1) Agregar 'cancelled' al enum task_status (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'cancelled'
      AND enumtypid = 'public.task_status'::regtype
  ) THEN
    ALTER TYPE public.task_status ADD VALUE 'cancelled';
  END IF;
END$$;

-- 2) Columna blocked_reason (catálogo libre validado en app)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS blocked_reason text;

-- ==========================================
-- MIGRATION: supabase/migrations/20260426012400_012d3070-5532-4ee9-9aec-ac8c6a954e37.sql
-- ==========================================

-- Recalcular el progreso del proyecto excluyendo canceladas
-- y contando bloqueadas como pendientes (no como done).
CREATE OR REPLACE FUNCTION public.recalc_project_progress(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count int;
  done_count int;
  new_progress int;
BEGIN
  SELECT
    COUNT(*) FILTER (
      WHERE node_type IN ('task','activity')
        AND status::text <> 'cancelled'
    ),
    COUNT(*) FILTER (
      WHERE node_type IN ('task','activity')
        AND status::text = 'done'
    )
  INTO total_count, done_count
  FROM public.tasks
  WHERE project_id = _project_id;

  IF total_count = 0 THEN
    new_progress := 0;
  ELSE
    new_progress := ROUND((done_count::numeric / total_count::numeric) * 100);
  END IF;

  UPDATE public.projects
  SET progress = new_progress,
      updated_at = now()
  WHERE id = _project_id;
END;
$$;

-- Recalcular para todos los proyectos existentes (one-shot)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT id FROM public.projects LOOP
    PERFORM public.recalc_project_progress(p.id);
  END LOOP;
END$$;

-- ==========================================
-- MIGRATION: supabase/migrations/20260426021348_a40ca1f5-756f-40f4-8718-38052ce8bb62.sql
-- ==========================================
-- Refactor de métrica de avance: pesos (story points) + ponderación real
-- Solo nodos hoja contables (task/activity), canceladas excluidas.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 1
    CHECK (weight >= 1 AND weight <= 100);

COMMENT ON COLUMN public.tasks.weight IS
  'Peso/Story points de la tarea para el cálculo de avance ponderado. Default 1.';

-- Backfill por prioridad para tareas existentes con weight = 1
UPDATE public.tasks
SET weight = CASE priority::text
  WHEN 'low' THEN 1
  WHEN 'medium' THEN 3
  WHEN 'high' THEN 8
  WHEN 'critical' THEN 13
  ELSE 1
END
WHERE weight = 1
  AND node_type::text IN ('task','activity');

-- Refactorizar recalc_project_progress para usar pesos
CREATE OR REPLACE FUNCTION public.recalc_project_progress(_project_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_weight numeric;
  done_weight numeric;
  new_progress int;
BEGIN
  -- Solo hojas reales (task/activity), excluyendo canceladas.
  -- Contenedores (epic/story/phase/subphase) NO cuentan: son agrupadores.
  SELECT
    COALESCE(SUM(weight) FILTER (
      WHERE node_type::text IN ('task','activity')
        AND status::text <> 'cancelled'
    ), 0),
    COALESCE(SUM(weight) FILTER (
      WHERE node_type::text IN ('task','activity')
        AND status::text = 'done'
    ), 0)
  INTO total_weight, done_weight
  FROM public.tasks
  WHERE project_id = _project_id;

  IF total_weight = 0 THEN
    new_progress := 0;
  ELSE
    new_progress := ROUND((done_weight / total_weight) * 100);
  END IF;

  UPDATE public.projects
  SET progress = new_progress,
      updated_at = now()
  WHERE id = _project_id;
END;
$function$;

-- Recalcular todos los proyectos con la nueva fórmula ponderada
DO $$
DECLARE
  pid uuid;
BEGIN
  FOR pid IN SELECT id FROM public.projects LOOP
    PERFORM public.recalc_project_progress(pid);
  END LOOP;
END $$;
-- ==========================================
-- MIGRATION: supabase/migrations/20260426211311_db2f473d-0d65-4dfb-994a-81ef8ebf4410.sql
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'superadmin'
      AND enumtypid = 'public.app_role'::regtype
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'superadmin';
  END IF;
END$$;

-- ==========================================
-- MIGRATION: supabase/migrations/20260426211353_3f99f695-a4c9-4540-b6d6-242844b4968b.sql
-- ==========================================

-- Función helper is_superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'superadmin'::app_role
  );
$$;

-- Tabla audit logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  target_user_id uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmins view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY "superadmins insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (public.is_superadmin(auth.uid()) AND admin_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON public.admin_audit_logs(target_user_id);

-- Profiles
CREATE POLICY "superadmins view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_superadmin(auth.uid()));

-- Account subscriptions
CREATE POLICY "superadmins view all subscriptions"
  ON public.account_subscriptions FOR SELECT
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY "superadmins update all subscriptions"
  ON public.account_subscriptions FOR UPDATE
  USING (public.is_superadmin(auth.uid()));

-- Subscription events
CREATE POLICY "superadmins view all subscription events"
  ON public.subscription_events FOR SELECT
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY "superadmins insert subscription events"
  ON public.subscription_events FOR INSERT
  WITH CHECK (public.is_superadmin(auth.uid()));

-- User roles
CREATE POLICY "superadmins view all user roles"
  ON public.user_roles FOR SELECT
  USING (public.is_superadmin(auth.uid()));

-- ==========================================
-- MIGRATION: supabase/migrations/20260426212250_d1d630d1-806b-490a-a726-3475d121d8cc.sql
-- ==========================================
DROP POLICY IF EXISTS "owners update own subscription" ON public.account_subscriptions;
-- ==========================================
-- MIGRATION: supabase/migrations/20260506235824_a9f31fbb-07e6-4ada-8958-1e665ba5c0bc.sql
-- ==========================================

ALTER TABLE public.account_subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_customer_email TEXT,
  ADD COLUMN IF NOT EXISTS mp_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_last_payment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_account_subscriptions_mp_preapproval
  ON public.account_subscriptions(mp_preapproval_id)
  WHERE mp_preapproval_id IS NOT NULL;

-- ==========================================
-- MIGRATION: supabase/migrations/20260507041950_63d57543-a8e7-42b4-90dc-23815d37719d.sql
-- ==========================================
DROP POLICY IF EXISTS "owners insert own subscription" ON public.account_subscriptions;

CREATE POLICY "owners insert own free subscription"
ON public.account_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND plan = 'free'::subscription_plan
  AND status IN ('active','pending')
);
-- ==========================================
-- MIGRATION: supabase/migrations/20260507050409_6dd59f87-8989-43ba-9023-277fabaa2279.sql
-- ==========================================
-- Enums
CREATE TYPE public.risk_category AS ENUM ('financial','operational','technical','commercial','hr','legal');
CREATE TYPE public.risk_status AS ENUM ('open','in_treatment','mitigated','closed');

-- Tabla
CREATE TABLE public.risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  category public.risk_category NOT NULL DEFAULT 'operational',
  probability integer NOT NULL DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
  impact integer NOT NULL DEFAULT 50 CHECK (impact >= 0 AND impact <= 100),
  estimated_cost numeric NOT NULL DEFAULT 0,
  owner_name text,
  due_date date,
  mitigation_plan text,
  status public.risk_status NOT NULL DEFAULT 'open',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_risks_owner ON public.risks(owner_id);
CREATE INDEX idx_risks_project ON public.risks(project_id);

ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members view risks"
ON public.risks FOR SELECT
USING (
  public.is_workspace_member(auth.uid(), owner_id)
  AND (
    public.get_workspace_role(auth.uid(), owner_id) IN ('owner','admin','viewer')
    OR (
      public.get_workspace_role(auth.uid(), owner_id) = 'collaborator'
      AND project_id IS NOT NULL
      AND public.has_project_access(auth.uid(), project_id)
    )
  )
);

CREATE POLICY "workspace admins insert risks"
ON public.risks FOR INSERT
WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));

CREATE POLICY "workspace admins update risks"
ON public.risks FOR UPDATE
USING (public.can_admin_workspace(auth.uid(), owner_id));

CREATE POLICY "workspace admins delete risks"
ON public.risks FOR DELETE
USING (public.can_admin_workspace(auth.uid(), owner_id));

CREATE TRIGGER update_risks_updated_at
BEFORE UPDATE ON public.risks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();