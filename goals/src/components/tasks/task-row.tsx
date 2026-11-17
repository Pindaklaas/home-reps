"use client";

import Link from "next/link";
import { Check, Clock, CalendarPlus, CalendarX, Pencil, Play, Star, Trash2 } from "lucide-react";
import { InlineAction, ActionForm, Modal, SubmitButton } from "@/components/ui/forms";
import { Menu, menuItemClass } from "@/components/ui/menu";
import { Dot } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/field";
import { TaskDialog } from "@/components/forms/entity-forms";
import { deleteTask, logTime, scheduleTask, setFocus, setTaskStatus, toggleTask } from "@/lib/actions/tasks";
import { PRIORITY_LABEL, PRIORITY_TONE } from "@/lib/constants";
import { addDays, formatMinutes, relativeDay } from "@/lib/dates";
import type { TaskWithProject } from "@/lib/data";
import { cn } from "@/lib/cn";

type Option = { id: string; title: string };

export function TaskRow({
  task,
  projects,
  today,
  showProject = true,
  focusDate,
  showFocusBadge = true,
}: {
  task: TaskWithProject;
  projects: Option[];
  today: string;
  showProject?: boolean;
  /** When set, the menu offers the day's 1-3 priority slots for this date. */
  focusDate?: string;
  /** Hide the 1-3 badge where the slot number is already shown. */
  showFocusBadge?: boolean;
}) {
  const done = task.status === "completed";
  const cancelled = task.status === "cancelled";
  const overdue = !done && !cancelled && task.due_date && task.due_date < today;

  return (
    <li className="group flex items-start gap-3 border-b border-line px-1 py-2.5 last:border-b-0">
      <InlineAction
        action={toggleTask}
        fields={{ id: task.id }}
        title={done ? "Marcar como pendiente" : "Marcar como completada"}
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
          done ? "border-success bg-success text-bg" : "border-line-strong hover:border-accent",
        )}
      >
        {done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </InlineAction>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {task.scheduled_time ? (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-accent" title="Hora (con aviso)">
              {task.scheduled_time.slice(0, 5)}
            </span>
          ) : null}
          {task.focus_rank && showFocusBadge ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded bg-accent-soft px-1 text-[10px] font-semibold text-accent" title="Prioridad del día">
              {task.focus_rank}
            </span>
          ) : null}
          <span className={cn("truncate text-sm", done || cancelled ? "text-faint line-through" : "text-fg")}>{task.title}</span>
          {task.status === "in_progress" ? <span className="text-[11px] font-medium text-accent">en curso</span> : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-faint">
          {showProject && task.project_title && task.project_id ? (
            <Link href={`/projects/${task.project_id}`} className="truncate hover:text-muted">
              {task.project_title}
            </Link>
          ) : null}
          {task.due_date ? (
            <span className={cn(overdue && "text-danger")}>Vence {relativeDay(task.due_date, today)}</span>
          ) : null}
          {task.scheduled_date && !focusDate ? <span>Plan: {relativeDay(task.scheduled_date, today)}</span> : null}
          {task.estimated_minutes || task.spent_minutes ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="h-3 w-3" aria-hidden />
              {task.spent_minutes ? formatMinutes(task.spent_minutes) : "0 min"}
              {task.estimated_minutes ? ` / ${formatMinutes(task.estimated_minutes)}` : ""}
            </span>
          ) : null}
        </div>
      </div>

      <span className="mt-1 hidden items-center gap-1.5 text-[11px] text-faint sm:inline-flex" title={`Prioridad ${PRIORITY_LABEL[task.priority]}`}>
        <Dot tone={PRIORITY_TONE[task.priority]} />
        {PRIORITY_LABEL[task.priority]}
      </span>

      <div className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        <Menu label={`Acciones de ${task.title}`}>
          <TaskDialog
            task={task}
            projects={projects}
            trigger={(open) => (
              <button type="button" className={menuItemClass} onClick={open}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            )}
          />
          {!done && task.status !== "in_progress" ? (
            <InlineAction action={setTaskStatus} fields={{ id: task.id, status: "in_progress" }} className={menuItemClass}>
              <Play className="h-3.5 w-3.5" /> Empezar
            </InlineAction>
          ) : null}
          <LogTimeItem taskId={task.id} today={today} />
          {focusDate ? (
            <>
              {[1, 2, 3].map((rank) =>
                task.focus_rank === rank ? null : (
                  <InlineAction key={rank} action={setFocus} fields={{ id: task.id, date: focusDate, rank: String(rank) }} className={menuItemClass}>
                    <Star className="h-3.5 w-3.5" /> Prioridad {rank} del día
                  </InlineAction>
                ),
              )}
              {task.focus_rank ? (
                <InlineAction action={setFocus} fields={{ id: task.id, date: focusDate, rank: "" }} className={menuItemClass}>
                  <Star className="h-3.5 w-3.5" /> Quitar de prioridades
                </InlineAction>
              ) : null}
            </>
          ) : null}
          {task.scheduled_date !== today ? (
            <InlineAction action={scheduleTask} fields={{ id: task.id, date: today }} className={menuItemClass}>
              <CalendarPlus className="h-3.5 w-3.5" /> Planificar para hoy
            </InlineAction>
          ) : null}
          {task.scheduled_date !== addDays(today, 1) ? (
            <InlineAction action={scheduleTask} fields={{ id: task.id, date: addDays(today, 1) }} className={menuItemClass}>
              <CalendarPlus className="h-3.5 w-3.5" /> Planificar para mañana
            </InlineAction>
          ) : null}
          {task.scheduled_date ? (
            <InlineAction action={scheduleTask} fields={{ id: task.id, date: "" }} className={menuItemClass}>
              <CalendarX className="h-3.5 w-3.5" /> Quitar del plan
            </InlineAction>
          ) : null}
          <div className="my-1 h-px bg-line" />
          <InlineAction
            action={deleteTask}
            fields={{ id: task.id }}
            confirm={`¿Eliminar la tarea «${task.title}»? No se puede deshacer.`}
            className={cn(menuItemClass, "hover:text-danger")}
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </InlineAction>
        </Menu>
      </div>
    </li>
  );
}

function LogTimeItem({ taskId, today }: { taskId: string; today: string }) {
  return (
    <Modal
      title="Registrar tiempo"
      trigger={(open) => (
        <button type="button" className={menuItemClass} onClick={open}>
          <Clock className="h-3.5 w-3.5" /> Registrar tiempo
        </button>
      )}
    >
      {(close) => (
        <ActionForm action={logTime} onSuccess={close}>
          <input type="hidden" name="task_id" value={taskId} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Minutos" htmlFor="lt-min">
              <Input id="lt-min" name="minutes" type="number" min={1} max={1440} step={5} defaultValue={25} inputMode="numeric" autoFocus />
            </Field>
            <Field label="Día" htmlFor="lt-day">
              <Input id="lt-day" name="logged_on" type="date" defaultValue={today} />
            </Field>
          </div>
          <Field label="Nota (opcional)" htmlFor="lt-note" className="mt-4">
            <Input id="lt-note" name="note" maxLength={500} />
          </Field>
          <div className="mt-5 flex justify-end">
            <SubmitButton>Registrar</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Modal>
  );
}
