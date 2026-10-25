import { Badge, Button, Card, Dialog, Input, Table, Textarea, Toast } from "@pand/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPandClient } from "@todo-pand/sdk";
import type React from "react";
import { useState } from "react";
import { DropdownSelect } from "../components/DropdownSelect.js";
import { useSession } from "../lib/auth.js";
import {
  type ProjectItem,
  type TodoItem,
  createGuestTodo,
  deleteGuestTodo,
  listGuestProjects,
  listGuestTodos,
  updateGuestTodo,
} from "../lib/guest-storage.js";

const sdk = createPandClient({ baseUrl: window.location.origin });

type TodoStatus = "todo" | "in_progress" | "done";
type TodoPriority = "low" | "medium" | "high" | "urgent";

const STATUS_OPTIONS = [
  { label: "To Do", value: "todo", dotColor: "#64748b" },
  { label: "In Progress", value: "in_progress", dotColor: "#f59e0b" },
  { label: "Done", value: "done", dotColor: "#10b981" },
];

const PRIORITY_OPTIONS = [
  { label: "Low", value: "low", dotColor: "#10b981" },
  { label: "Medium", value: "medium", dotColor: "#6366f1" },
  { label: "High", value: "high", dotColor: "#f59e0b" },
  { label: "Urgent", value: "urgent", dotColor: "#ef4444" },
];

export default function TodosPage({ onNavigate }: { onNavigate?: (to: string) => void } = {}) {
  const queryClient = useQueryClient();
  const { data: user, isLoading: sessionLoading } = useSession();
  const isGuest = !sessionLoading && !user;

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    projectId: "",
    title: "",
    description: "",
    status: "todo" as TodoStatus,
    priority: "medium" as TodoPriority,
    dueDate: "",
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["core", "projects", isGuest, user?.id],
    queryFn: async () => {
      if (isGuest) {
        return listGuestProjects();
      }
      const { data, error } = await sdk.GET("/api/v1/core/projects", {
        params: { query: { limit: 100 } },
      });
      if (error) throw new Error("Failed to load Projects");
      return (data?.items ?? []) as ProjectItem[];
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["core", "todos", isGuest, user?.id, search],
    queryFn: async () => {
      if (isGuest) {
        return listGuestTodos({
          q: search.trim() || undefined,
        });
      }
      const { data, error } = await sdk.GET("/api/v1/core/todos", {
        params: {
          query: {
            limit: 100,
            ...(search.trim() ? { q: search.trim() } : {}),
          },
        },
      });
      if (error) throw new Error("Failed to load Todos");
      return (data?.items ?? []) as TodoItem[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof formState) => {
      if (isGuest) {
        return createGuestTodo({
          projectId: payload.projectId || null,
          title: payload.title,
          description: payload.description || null,
          status: payload.status,
          priority: payload.priority,
          dueDate: payload.dueDate ? new Date(payload.dueDate).toISOString() : null,
        });
      }
      const { data, error } = await sdk.POST("/api/v1/core/todos", {
        body: {
          projectId: payload.projectId || null,
          title: payload.title,
          description: payload.description || null,
          status: payload.status,
          priority: payload.priority,
          dueDate: payload.dueDate ? new Date(payload.dueDate).toISOString() : null,
        },
      });
      if (error) throw new Error("Failed to create Todo");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core", "todos"] });
      queryClient.invalidateQueries({ queryKey: ["core", "todo-stats"] });
      setModalOpen(false);
      setFormState({
        projectId: "",
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        dueDate: "",
      });
      setToast("Created Todo");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TodoStatus }) => {
      if (isGuest) {
        return updateGuestTodo(id, { status });
      }
      const { data, error } = await sdk.PATCH("/api/v1/core/todos/{id}", {
        params: { path: { id } },
        body: { status },
      });
      if (error) throw new Error("Failed to update status");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core", "todos"] });
      queryClient.invalidateQueries({ queryKey: ["core", "todo-stats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) {
        deleteGuestTodo(id);
        return;
      }
      const { error } = await sdk.DELETE("/api/v1/core/todos/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error("Failed to delete Todo");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core", "todos"] });
      queryClient.invalidateQueries({ queryKey: ["core", "todo-stats"] });
      setToast("Deleted Todo");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.title.trim()) return;
    createMutation.mutate(formState);
  };

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const projectOptions = [
    { label: "Inbox / Unassigned", value: "", dotColor: "#94a3b8" },
    ...projects.map((p) => ({ label: p.name, value: p.id, dotColor: p.color })),
  ];

  return (
    <div className="space-y-6">
      {isGuest && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/80 p-3.5 text-xs text-indigo-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-[11px]">
              G
            </span>
            <div>
              <span className="font-semibold text-slate-900">Guest Mode:</span> Tasks and projects
              are currently stored in your browser.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate?.("/signup")}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Sign Up to Sync
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Todos</h1>
          <p className="text-sm text-slate-500">All tasks across your workspace</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Create Todo</Button>
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search Todos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      {isLoading ? (
        <Card>Loading Todos...</Card>
      ) : (
        <Table>
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Title</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Project</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Priority</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Due Date</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item) => {
              const proj = item.projectId ? projectMap.get(item.projectId) : null;
              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.title}</div>
                    {item.description && (
                      <div className="text-xs text-slate-500">{item.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {proj ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: proj.color }}
                        />
                        {proj.name}
                      </span>
                    ) : (
                      <span className="text-slate-400">Inbox</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownSelect
                      size="sm"
                      className="w-36"
                      ariaLabel={`Status for ${item.title}`}
                      value={item.status}
                      options={STATUS_OPTIONS}
                      onChange={(val) =>
                        statusMutation.mutate({
                          id: item.id,
                          status: val as TodoStatus,
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        item.priority === "urgent"
                          ? "danger"
                          : item.priority === "high"
                            ? "warning"
                            : item.priority === "low"
                              ? "success"
                              : "default"
                      }
                    >
                      {item.priority}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Dialog open={modalOpen} title="Create Todo" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DropdownSelect
            id="projectId"
            label="Project"
            value={formState.projectId}
            options={projectOptions}
            onChange={(val) => setFormState((s) => ({ ...s, projectId: val }))}
          />
          <Input
            id="title"
            label="Title"
            value={formState.title}
            onChange={(e) => setFormState((s) => ({ ...s, title: e.target.value }))}
          />
          <Textarea
            id="description"
            label="Description"
            value={formState.description}
            onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
          />
          <DropdownSelect
            id="status"
            label="Status"
            value={formState.status}
            options={STATUS_OPTIONS}
            onChange={(val) => setFormState((s) => ({ ...s, status: val as TodoStatus }))}
          />
          <DropdownSelect
            id="priority"
            label="Priority"
            value={formState.priority}
            options={PRIORITY_OPTIONS}
            onChange={(val) => setFormState((s) => ({ ...s, priority: val as TodoPriority }))}
          />
          <Input
            id="dueDate"
            type="date"
            label="Due Date"
            value={formState.dueDate}
            onChange={(e) => setFormState((s) => ({ ...s, dueDate: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Toast message={toast} variant="success" onDismiss={() => setToast(null)} />
    </div>
  );
}
