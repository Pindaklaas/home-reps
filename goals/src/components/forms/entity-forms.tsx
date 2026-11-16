"use client";

import { useState, type ReactNode } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { ActionForm, Modal, SubmitButton, type FormAction } from "@/components/ui/forms";
import {
  GOAL_CATEGORIES,
  GOAL_PROGRESS_MODE_LABEL,
  GOAL_PROGRESS_MODES,
  GOAL_STATUS_LABEL,
  GOAL_STATUSES,
  IDEA_CATEGORIES,
  IDEA_STATUS_LABEL,
  IDEA_STATUSES,
  PRIORITIES,
  PRIORITY_LABEL,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUSES,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
} from "@/lib/constants";
import type { ActionState } from "@/lib/validation";
import { createGoal, updateGoal } from "@/lib/actions/goals";
import { createProject, updateProject } from "@/lib/actions/projects";
import { createTask, updateTask } from "@/lib/actions/tasks";
import { createIdea, updateIdea } from "@/lib/actions/ideas";
import type { Tables } from "@/lib/supabase/database.types";

type Option = { id: string; title: string };
const err = (s: ActionState, k: string): string[] | undefined => (s && !s.ok ? s.fieldErrors?.[k] : undefined);

function PrioritySelect({ id, defaultValue }: { id: string; defaultValue?: string }) {
  return (
    <Select id={id} name="priority" defaultValue={defaultValue ?? "medium"}>
      {PRIORITIES.map((p) => (
        <option key={p} value={p}>
          {PRIORITY_LABEL[p]}
        </option>
      ))}
    </Select>
  );
}

function FormFooter({ close, submit }: { close: () => void; submit: string }) {
  return (
    <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
      <Button variant="ghost" onClick={close}>
        Cancelar
      </Button>
      <SubmitButton pendingLabel="Guardando…">{submit}</SubmitButton>
    </div>
  );
}

/** Trigger + modal + form, the standard way to create or edit an entity. */
function EntityModal({
  title,
  description,
  action,
  trigger,
  submit,
  children,
  wide,
  onCreated,
}: {
  title: string;
  description?: string;
  action: FormAction;
  trigger: (open: () => void) => ReactNode;
  submit: string;
  children: (state: ActionState) => ReactNode;
  wide?: boolean;
  onCreated?: (id?: string) => void;
}) {
  return (
    <Modal title={title} description={description} trigger={trigger} wide={wide}>
      {(close) => (
        <ActionForm
          action={action}
          onSuccess={(s) => {
            close();
            onCreated?.(s.id);
          }}
        >
          {(state) => (
            <>
              <div className="grid gap-4">{children(state)}</div>
              <FormFooter close={close} submit={submit} />
            </>
          )}
        </ActionForm>
      )}
    </Modal>
  );
}

export function NewButton({ label, onClick, variant = "primary" }: { label: string; onClick: () => void; variant?: "primary" | "secondary" }) {
  return (
    <Button variant={variant} onClick={onClick}>
      <Plus className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Goal
// ---------------------------------------------------------------------------
export function GoalDialog({
  goal,
  trigger,
}: {
  goal?: Tables<"goals">;
  trigger?: (open: () => void) => ReactNode;
}) {
  const [mode, setMode] = useState(goal?.progress_mode ?? "projects");
  return (
    <EntityModal
      title={goal ? "Editar objetivo" : "Nuevo objetivo"}
      description={goal ? undefined : "Un objetivo es un resultado que quieres conseguir. Los proyectos lo hacen avanzar."}
      action={goal ? updateGoal : createGoal}
      submit={goal ? "Guardar" : "Crear objetivo"}
      trigger={trigger ?? ((open) => <NewButton label="Nuevo objetivo" onClick={open} />)}
      wide
    >
      {(s) => (
        <>
          {goal ? <input type="hidden" name="id" value={goal.id} /> : null}
          <Field label="Nombre" htmlFor="g-title" error={err(s, "title")}>
            <Input id="g-title" name="title" defaultValue={goal?.title} required autoFocus placeholder="Ej. Ahorrar 10.000 € este año" />
          </Field>
          <Field label="Descripción" htmlFor="g-desc" error={err(s, "description")}>
            <Textarea id="g-desc" name="description" defaultValue={goal?.description ?? ""} placeholder="Por qué importa y cómo sabrás que lo has logrado" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Categoría" htmlFor="g-cat">
              <Select id="g-cat" name="category" defaultValue={goal?.category ?? "personal"}>
                {Array.from(new Set([...GOAL_CATEGORIES, goal?.category ?? "personal"])).map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prioridad" htmlFor="g-prio">
              <PrioritySelect id="g-prio" defaultValue={goal?.priority} />
            </Field>
            <Field label="Fecha objetivo" htmlFor="g-date" error={err(s, "target_date")}>
              <Input id="g-date" name="target_date" type="date" defaultValue={goal?.target_date ?? ""} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estado" htmlFor="g-status">
              <Select id="g-status" name="status" defaultValue={goal?.status ?? "active"}>
                {GOAL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {GOAL_STATUS_LABEL[st]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cómo se mide el progreso" htmlFor="g-mode">
              <Select id="g-mode" name="progress_mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                {GOAL_PROGRESS_MODES.map((m) => (
                  <option key={m} value={m}>
                    {GOAL_PROGRESS_MODE_LABEL[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {mode === "manual" ? (
            <Field label="Progreso (%)" htmlFor="g-manual" error={err(s, "manual_progress")}>
              <Input id="g-manual" name="manual_progress" type="number" min={0} max={100} defaultValue={goal?.manual_progress ?? 0} />
            </Field>
          ) : null}
          <fieldset className="grid gap-4 rounded-lg border border-line p-3 sm:grid-cols-4">
            <legend className="px-1 text-xs text-faint">Métrica {mode === "metric" ? "(obligatoria)" : "(opcional)"}</legend>
            <Field label="Nombre" htmlFor="g-mname" className="sm:col-span-2">
              <Input id="g-mname" name="metric_name" defaultValue={goal?.metric_name ?? ""} placeholder="Ahorro acumulado" />
            </Field>
            <Field label="Unidad" htmlFor="g-munit">
              <Input id="g-munit" name="metric_unit" defaultValue={goal?.metric_unit ?? ""} placeholder="€" />
            </Field>
            <div className="hidden sm:block" />
            <Field label="Valor inicial" htmlFor="g-mstart" className="sm:col-span-2">
              <Input id="g-mstart" name="metric_start" type="number" step="any" defaultValue={goal?.metric_start ?? 0} />
            </Field>
            <Field label="Meta" htmlFor="g-mtarget" error={err(s, "metric_target")} className="sm:col-span-2">
              <Input id="g-mtarget" name="metric_target" type="number" step="any" defaultValue={goal?.metric_target ?? ""} />
            </Field>
          </fieldset>
          <Checkbox name="is_primary" defaultChecked={goal?.is_primary ?? false} label="Es mi objetivo principal ahora mismo" />
        </>
      )}
    </EntityModal>
  );
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------
export function ProjectDialog({
  project,
  goals,
  defaultGoalId,
  trigger,
}: {
  project?: Tables<"projects">;
  goals: Option[];
  defaultGoalId?: string;
  trigger?: (open: () => void) => ReactNode;
}) {
  return (
    <EntityModal
      title={project ? "Editar proyecto" : "Nuevo proyecto"}
      action={project ? updateProject : createProject}
      submit={project ? "Guardar" : "Crear proyecto"}
      trigger={trigger ?? ((open) => <NewButton label="Nuevo proyecto" onClick={open} />)}
      wide
    >
      {(s) => (
        <>
          {project ? (
            <>
              <input type="hidden" name="id" value={project.id} />
              <input type="hidden" name="notes" value={project.notes ?? ""} />
              <input type="hidden" name="outcomes" value={project.outcomes ?? ""} />
            </>
          ) : null}
          <Field label="Nombre" htmlFor="p-title" error={err(s, "title")}>
            <Input id="p-title" name="title" defaultValue={project?.title} required autoFocus />
          </Field>
          <Field label="Descripción" htmlFor="p-desc" error={err(s, "description")}>
            <Textarea id="p-desc" name="description" defaultValue={project?.description ?? ""} placeholder="Qué vas a construir o conseguir" />
          </Field>
          <Field label="Objetivo relacionado" htmlFor="p-goal" hint={goals.length ? undefined : "Aún no tienes objetivos activos."}>
            <Select id="p-goal" name="goal_id" defaultValue={project?.goal_id ?? defaultGoalId ?? ""}>
              <option value="">Sin objetivo</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Estado" htmlFor="p-status">
              <Select id="p-status" name="status" defaultValue={project?.status ?? "planned"}>
                {PROJECT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {PROJECT_STATUS_LABEL[st]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prioridad" htmlFor="p-prio">
              <PrioritySelect id="p-prio" defaultValue={project?.priority} />
            </Field>
            <Field label="Fecha límite" htmlFor="p-due" error={err(s, "due_date")}>
              <Input id="p-due" name="due_date" type="date" defaultValue={project?.due_date ?? ""} />
            </Field>
          </div>
        </>
      )}
    </EntityModal>
  );
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------
export function TaskDialog({
  task,
  projects,
  defaultProjectId,
  defaultScheduledDate,
  trigger,
}: {
  task?: Tables<"tasks">;
  projects: Option[];
  defaultProjectId?: string;
  defaultScheduledDate?: string;
  trigger?: (open: () => void) => ReactNode;
}) {
  return (
    <EntityModal
      title={task ? "Editar tarea" : "Nueva tarea"}
      action={task ? updateTask : createTask}
      submit={task ? "Guardar" : "Crear tarea"}
      trigger={trigger ?? ((open) => <NewButton label="Nueva tarea" onClick={open} />)}
    >
      {(s) => (
        <>
          {task ? <input type="hidden" name="id" value={task.id} /> : null}
          <Field label="Nombre" htmlFor="t-title" error={err(s, "title")}>
            <Input id="t-title" name="title" defaultValue={task?.title} required autoFocus />
          </Field>
          <Field label="Descripción" htmlFor="t-desc" error={err(s, "description")}>
            <Textarea id="t-desc" name="description" rows={2} defaultValue={task?.description ?? ""} />
          </Field>
          <Field label="Proyecto" htmlFor="t-project">
            <Select id="t-project" name="project_id" defaultValue={task?.project_id ?? defaultProjectId ?? ""}>
              <option value="">Sin proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prioridad" htmlFor="t-prio">
              <PrioritySelect id="t-prio" defaultValue={task?.priority} />
            </Field>
            {task ? (
              <Field label="Estado" htmlFor="t-status">
                <Select id="t-status" name="status" defaultValue={task.status}>
                  {TASK_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {TASK_STATUS_LABEL[st]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Tiempo estimado (min)" htmlFor="t-est" error={err(s, "estimated_minutes")}>
                <Input id="t-est" name="estimated_minutes" type="number" min={0} step={5} inputMode="numeric" />
              </Field>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Planificada para" htmlFor="t-sched" error={err(s, "scheduled_date")}>
              <Input id="t-sched" name="scheduled_date" type="date" defaultValue={task?.scheduled_date ?? defaultScheduledDate ?? ""} />
            </Field>
            <Field label="Fecha límite" htmlFor="t-due" error={err(s, "due_date")}>
              <Input id="t-due" name="due_date" type="date" defaultValue={task?.due_date ?? ""} />
            </Field>
          </div>
          {task ? (
            <Field label="Tiempo estimado (min)" htmlFor="t-est" error={err(s, "estimated_minutes")}>
              <Input id="t-est" name="estimated_minutes" type="number" min={0} step={5} inputMode="numeric" defaultValue={task.estimated_minutes ?? ""} />
            </Field>
          ) : null}
        </>
      )}
    </EntityModal>
  );
}

// ---------------------------------------------------------------------------
// Idea
// ---------------------------------------------------------------------------
export function IdeaDialog({ idea, trigger }: { idea?: Tables<"ideas">; trigger?: (open: () => void) => ReactNode }) {
  return (
    <EntityModal
      title={idea ? "Editar idea" : "Nueva idea"}
      description={idea ? undefined : "Guárdala ahora; ya decidirás después si merece la pena."}
      action={idea ? updateIdea : createIdea}
      submit={idea ? "Guardar" : "Guardar idea"}
      trigger={trigger ?? ((open) => <NewButton label="Nueva idea" onClick={open} />)}
      wide
    >
      {(s) => (
        <>
          {idea ? <input type="hidden" name="id" value={idea.id} /> : null}
          <Field label="Título" htmlFor="i-title" error={err(s, "title")}>
            <Input id="i-title" name="title" defaultValue={idea?.title} required autoFocus />
          </Field>
          <Field label="Descripción" htmlFor="i-desc" error={err(s, "description")}>
            <Textarea id="i-desc" name="description" rows={4} defaultValue={idea?.description ?? ""} placeholder="Problema, a quién ayuda, cómo ganaría dinero o valor…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoría" htmlFor="i-cat">
              <Select id="i-cat" name="category" defaultValue={idea?.category ?? "general"}>
                {Array.from(new Set([...IDEA_CATEGORIES, idea?.category ?? "general"])).map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Estado" htmlFor="i-status">
              <Select id="i-status" name="status" defaultValue={idea?.status ?? "new"}>
                {IDEA_STATUSES.filter((st) => st !== "converted" || idea?.status === "converted").map((st) => (
                  <option key={st} value={st}>
                    {IDEA_STATUS_LABEL[st]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Potencial (1-5)" htmlFor="i-pot" error={err(s, "potential")}>
              <Input id="i-pot" name="potential" type="number" min={1} max={5} defaultValue={idea?.potential ?? ""} />
            </Field>
            <Field label="Dificultad (1-5)" htmlFor="i-dif" error={err(s, "difficulty")}>
              <Input id="i-dif" name="difficulty" type="number" min={1} max={5} defaultValue={idea?.difficulty ?? ""} />
            </Field>
            <Field label="Coste (€)" htmlFor="i-cost" error={err(s, "estimated_cost")}>
              <Input id="i-cost" name="estimated_cost" type="number" min={0} step="any" defaultValue={idea?.estimated_cost ?? ""} />
            </Field>
          </div>
        </>
      )}
    </EntityModal>
  );
}

// ---------------------------------------------------------------------------
// "Editar" buttons for Server Components (they cannot pass render props).
// ---------------------------------------------------------------------------
function EditTrigger({ open }: { open: () => void }) {
  return (
    <Button size="sm" onClick={open}>
      <Pencil className="h-3.5 w-3.5" /> Editar
    </Button>
  );
}

export function EditGoalButton({ goal }: { goal: Tables<"goals"> }) {
  return <GoalDialog goal={goal} trigger={(open) => <EditTrigger open={open} />} />;
}

export function EditProjectButton({ project, goals }: { project: Tables<"projects">; goals: Option[] }) {
  return <ProjectDialog project={project} goals={goals} trigger={(open) => <EditTrigger open={open} />} />;
}
