"use client";

import { useState } from "react";
import { useFormAction } from "@/components/ui/forms";
import { setProjectStatus } from "@/lib/actions/projects";
import { PROJECT_STATUS_LABEL, PROJECT_STATUSES, type ProjectStatus } from "@/lib/constants";
import { Select } from "@/components/ui/field";

export function StatusSwitcher({ id, status }: { id: string; status: ProjectStatus }) {
  const [state, onSubmit, pending] = useFormAction(setProjectStatus);
  const [value, setValue] = useState(status);
  return (
    <form onSubmit={onSubmit} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="project-status" className="sr-only">
        Estado del proyecto
      </label>
      <Select
        id="project-status"
        name="status"
        value={value}
        disabled={pending}
        onChange={(e) => {
          setValue(e.target.value as ProjectStatus);
          e.target.form?.requestSubmit();
        }}
        className="h-8 w-auto text-[13px]"
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PROJECT_STATUS_LABEL[s]}
          </option>
        ))}
      </Select>
      {state && !state.ok ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}
