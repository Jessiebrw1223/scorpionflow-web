import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { AlertTriangle, ShieldAlert, Flame, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export type RiskRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  project_id: string | null;
  category: "financial" | "operational" | "technical" | "commercial" | "hr" | "legal";
  probability: number;
  impact: number;
  estimated_cost: number;
  owner_name: string | null;
  due_date: string | null;
  mitigation_plan: string | null;
  status: "open" | "in_treatment" | "mitigated" | "closed";
};

const CATEGORIES: { value: RiskRow["category"]; label: string }[] = [
  { value: "financial", label: "Financiero" },
  { value: "operational", label: "Operativo" },
  { value: "technical", label: "Técnico" },
  { value: "commercial", label: "Comercial" },
  { value: "hr", label: "RRHH" },
  { value: "legal", label: "Legal" },
];

const STATUSES: { value: RiskRow["status"]; label: string }[] = [
  { value: "open", label: "Abierto" },
  { value: "in_treatment", label: "En mitigación" },
  { value: "mitigated", label: "Mitigado" },
  { value: "closed", label: "Cerrado" },
];

function levelMeta(score: number) {
  if (score >= 76) return { label: "Crítico", icon: Flame, cls: "bg-status-blocked/15 border-status-blocked/40 text-status-blocked" };
  if (score >= 51) return { label: "Alto", icon: AlertTriangle, cls: "bg-orange-500/15 border-orange-500/40 text-orange-400" };
  if (score >= 21) return { label: "Medio", icon: ShieldAlert, cls: "bg-status-review/15 border-status-review/40 text-status-review" };
  return { label: "Bajo", icon: ShieldCheck, cls: "bg-status-completed/15 border-status-completed/40 text-status-completed" };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<RiskRow> | null;
  defaultProjectId?: string | null;
}

export function NewRiskDialog({ open, onOpenChange, initial, defaultProjectId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isEdit = !!initial?.id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [category, setCategory] = useState<RiskRow["category"]>("operational");
  const [probability, setProbability] = useState(50);
  const [impact, setImpact] = useState(50);
  const [estimatedCost, setEstimatedCost] = useState<string>("0");
  const [ownerName, setOwnerName] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [mitigation, setMitigation] = useState("");
  const [status, setStatus] = useState<RiskRow["status"]>("open");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setProjectId(initial?.project_id ?? defaultProjectId ?? "");
    setCategory((initial?.category as any) ?? "operational");
    setProbability(initial?.probability ?? 50);
    setImpact(initial?.impact ?? 50);
    setEstimatedCost(String(initial?.estimated_cost ?? 0));
    setOwnerName(initial?.owner_name ?? "");
    setDueDate(initial?.due_date ?? "");
    setMitigation(initial?.mitigation_plan ?? "");
    setStatus((initial?.status as any) ?? "open");
  }, [open, initial, defaultProjectId]);

  const { data: projects = [] } = useQuery({
    queryKey: ["risk-dialog-projects"],
    enabled: !!user && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name, owner_id").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const score = Math.round((probability * impact) / 100);
  const meta = levelMeta(score);

  async function handleSubmit() {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Pon un título al riesgo");
      return;
    }
    setSaving(true);
    try {
      const projOwner = projects.find((p: any) => p.id === projectId)?.owner_id;
      const ownerId = projOwner ?? user.id;

      if (isEdit && initial?.id) {
        const { error } = await (supabase as any).from("risks").update({
          title: title.trim(),
          description: description.trim() || null,
          project_id: projectId || null,
          category,
          probability,
          impact,
          estimated_cost: Number(estimatedCost) || 0,
          owner_name: ownerName.trim() || null,
          due_date: dueDate || null,
          mitigation_plan: mitigation.trim() || null,
          status,
        }).eq("id", initial.id);
        if (error) throw error;
        toast.success("Riesgo actualizado");
      } else {
        // Generar code RISK-001 incremental por owner
        const { count } = await (supabase as any)
          .from("risks")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", ownerId);
        const code = `RISK-${String((count ?? 0) + 1).padStart(3, "0")}`;

        const { error } = await (supabase as any).from("risks").insert({
          owner_id: ownerId,
          project_id: projectId || null,
          code,
          title: title.trim(),
          description: description.trim() || null,
          category,
          probability,
          impact,
          estimated_cost: Number(estimatedCost) || 0,
          owner_name: ownerName.trim() || null,
          due_date: dueDate || null,
          mitigation_plan: mitigation.trim() || null,
          status,
          created_by: user.id,
        });
        if (error) throw error;
        toast.success(`Riesgo ${code} creado`);
      }
      qc.invalidateQueries({ queryKey: ["manual-risks"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar el riesgo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            {isEdit ? "Editar riesgo" : "Nuevo riesgo"}
          </DialogTitle>
          <DialogDescription>
            Registra un riesgo con su impacto, probabilidad y plan de mitigación. El nivel se calcula automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Título + estado */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Título del riesgo *</Label>
              <Input
                placeholder="Ej: Retraso de proveedor cloud"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <Badge variant="outline" className={cn("text-[11px] px-3 py-1.5", meta.cls)}>
              <meta.icon className="w-3.5 h-3.5 mr-1" /> {meta.label} · {score}
            </Badge>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descripción</Label>
            <Textarea
              rows={2}
              placeholder="Contexto del riesgo: qué puede pasar y por qué."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Proyecto asociado</Label>
              <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sin proyecto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sin proyecto —</SelectItem>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Probabilidad</Label>
                <span className="font-mono text-primary">{probability}%</span>
              </div>
              <Slider value={[probability]} min={0} max={100} step={5} onValueChange={([v]) => setProbability(v)} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Impacto</Label>
                <span className="font-mono text-primary">{impact}%</span>
              </div>
              <Slider value={[impact]} min={0} max={100} step={5} onValueChange={([v]) => setImpact(v)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Impacto económico (S/)</Label>
              <Input
                type="number" min={0} step={100}
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Responsable</Label>
              <Input
                placeholder="Nombre"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha estimada</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Plan de mitigación</Label>
            <Textarea
              rows={2}
              placeholder="¿Qué acción tomarás para reducir o controlar este riesgo?"
              value={mitigation}
              onChange={(e) => setMitigation(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear riesgo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
