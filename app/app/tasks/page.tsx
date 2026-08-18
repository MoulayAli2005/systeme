"use client";

import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Field, inputClass, PrimaryButton } from "@/components/ui";
import { api } from "@/lib/api";

export default function TasksPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["tasks"],
    queryFn: () =>
      api<{
        rows: Array<{
          id: string;
          title: string;
          status: string;
          priority: string;
          dueAt: string | null;
          assignee: { name: string } | null;
        }>;
      }>("/api/v1/tasks"),
  });
  const create = useMutation({
    mutationFn: (body: { title: string; priority: string }) =>
      api("/api/v1/tasks", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    create.mutate({ title: String(data.get("title")), priority: String(data.get("priority") || "medium") });
    e.currentTarget.reset();
  }

  if (q.isLoading) return <p className="text-sm text-zinc-500">Loading tasks…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tasks</h1>
      <form className="flex flex-wrap gap-2 rounded-2xl border border-sand bg-white p-4" onSubmit={onSubmit}>
        <Field label="Title">
          <input name="title" required className={inputClass} placeholder="Call back Casablanca VIP" />
        </Field>
        <Field label="Priority">
          <select name="priority" className={inputClass}>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </Field>
        <PrimaryButton type="submit">Add</PrimaryButton>
      </form>
      <ul className="divide-y divide-sand overflow-hidden rounded-2xl border border-sand bg-white">
        {(q.data?.rows ?? []).map((t) => (
          <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <div className="font-semibold">{t.title}</div>
              <div className="text-xs text-zinc-500">
                {t.priority} · {t.status} · {t.assignee?.name ?? "Unassigned"}
              </div>
            </div>
            {t.status === "open" ? (
              <button
                className="text-xs font-semibold text-emerald-800"
                onClick={async () => {
                  await api(`/api/v1/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) });
                  qc.invalidateQueries({ queryKey: ["tasks"] });
                }}
              >
                Complete
              </button>
            ) : null}
          </li>
        ))}
        {!q.data?.rows.length ? <li className="px-4 py-6 text-sm text-zinc-500">No tasks yet.</li> : null}
      </ul>
    </div>
  );
}
