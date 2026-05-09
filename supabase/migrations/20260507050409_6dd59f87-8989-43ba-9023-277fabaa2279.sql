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