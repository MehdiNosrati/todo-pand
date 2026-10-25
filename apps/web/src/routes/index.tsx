import { Badge, Button, Card, Dialog, Input, Textarea, Toast } from "@pand/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPandClient } from "@todo-pand/sdk";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DropdownSelect } from "../components/DropdownSelect.js";
import { useSession } from "../lib/auth.js";
import {
  type ProjectItem,
  type TodoItem,
  type TodoPriority,
  type TodoStats,
  type TodoStatus,
  bulkUpdateGuestTodoStatus,
  clearCompletedGuestTodos,
  computeGuestTodoStats,
  createGuestProject,
  createGuestTodo,
  deleteGuestProject,
  deleteGuestTodo,
  getGuestWorkspace,
  listGuestProjects,
  listGuestTodos,
  resetGuestWorkspace,
  updateGuestTodo,
} from "../lib/guest-storage.js";

const sdk = createPandClient({ baseUrl: window.location.origin });

const COLOR_PRESETS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6"];

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

function priorityBadgeVariant(
  priority: TodoPriority,
): "default" | "success" | "warning" | "danger" {
  switch (priority) {
    case "urgent":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "default";
    case "low":
      return "success";
  }
}

function statusBadgeVariant(status: TodoStatus): "default" | "success" | "warning" | "danger" {
  switch (status) {
    case "done":
      return "success";
    case "in_progress":
      return "warning";
    case "todo":
      return "default";
  }
}

function statusLabel(status: TodoStatus): string {
  switch (status) {
    case "todo":
      return "To Do";
    case "in_progress":
      return "In Progress";
    case "done":
      return "Done";
  }
}

function formatDueDate(
  iso: string | null,
  status: TodoStatus,
): {
  label: string;
  isOverdue: boolean;
  isDueToday: boolean;
} | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dueStr = date.toISOString().slice(0, 10);
  const isDueToday = dueStr === todayStr && status !== "done";
  const isOverdue = !isDueToday && date.getTime() < now.getTime() && status !== "done";

  const formatted = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  if (isOverdue) {
    return { label: `Overdue · ${formatted}`, isOverdue: true, isDueToday: false };
  }
  if (isDueToday) {
    return { label: `Due Today · ${formatted}`, isOverdue: false, isDueToday: true };
  }
  return { label: `Due ${formatted}`, isOverdue: false, isDueToday: false };
}

export default function IndexPage({ onNavigate }: { onNavigate?: (to: string) => void }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading: sessionLoading } = useSession();
  const isGuest = !sessionLoading && !user;
  const autoSyncedRef = useRef<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);

  // Quick-add state
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriority, setQuickPriority] = useState<TodoPriority>("medium");
  const [quickDueDate, setQuickDueDate] = useState("");
  const [quickProjectId, setQuickProjectId] = useState<string>("");

  // Project Dialog state
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    color: "#6366f1",
  });

  // Edit Todo Dialog state
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    projectId: "",
    status: "todo" as TodoStatus,
    priority: "medium" as TodoPriority,
    dueDate: "",
  });

  const invalidateWorkspace = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["core", "projects"] });
    queryClient.invalidateQueries({ queryKey: ["core", "todos"] });
    queryClient.invalidateQueries({ queryKey: ["core", "todo-stats"] });
  }, [queryClient]);

  // Projects Query
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["core", "projects", isGuest, user?.id],
    queryFn: async () => {
      if (isGuest) {
        return listGuestProjects();
      }
      const { data, error } = await sdk.GET("/api/v1/core/projects", {
        params: { query: { limit: 100 } },
      });
      if (error) throw new Error("Failed to load projects");
      return (data?.items ?? []) as ProjectItem[];
    },
  });

  // Todos Query
  const { data: todos = [], isLoading: loadingTodos } = useQuery({
    queryKey: [
      "core",
      "todos",
      isGuest,
      user?.id,
      selectedProjectId,
      statusFilter,
      priorityFilter,
      searchQuery,
    ],
    queryFn: async () => {
      if (isGuest) {
        return listGuestTodos({
          projectId: selectedProjectId,
          status: statusFilter,
          priority: priorityFilter,
          q: searchQuery,
        });
      }
      const query: Record<string, any> = { limit: 100 };
      if (selectedProjectId !== "all") {
        query.projectId = selectedProjectId;
      }
      if (statusFilter !== "all") {
        query.status = statusFilter;
      }
      if (priorityFilter !== "all") {
        query.priority = priorityFilter;
      }
      if (searchQuery.trim()) {
        query.q = searchQuery.trim();
      }
      const { data, error } = await sdk.GET("/api/v1/core/todos", {
        params: { query },
      });
      if (error) throw new Error("Failed to load todos");
      return (data?.items ?? []) as TodoItem[];
    },
  });

  // Stats Query
  const { data: stats } = useQuery({
    queryKey: ["core", "todo-stats", isGuest, user?.id, selectedProjectId],
    queryFn: async () => {
      if (isGuest) {
        return computeGuestTodoStats(selectedProjectId);
      }
      const query: Record<string, any> = {};
      if (selectedProjectId !== "all") {
        query.projectId = selectedProjectId;
      }
      const { data, error } = await sdk.GET("/api/v1/core/todos/stats", {
        params: { query },
      });
      if (error) throw new Error("Failed to load stats");
      return data as TodoStats;
    },
  });

  // Guest claim / Account initial sync on sign-in
  useEffect(() => {
    if (!user?.id || autoSyncedRef.current === user.id || loadingProjects || loadingTodos) {
      return;
    }
    autoSyncedRef.current = user.id;

    // If this account has 0 projects and 0 todos, import from guest workspace
    if (projects.length === 0 && todos.length === 0) {
      const guestWs = getGuestWorkspace();
      const hasGuestData = guestWs.projects.length > 0 || guestWs.todos.length > 0;

      if (hasGuestData) {
        sdk
          .POST("/api/v1/core/todos/import-guest", {
            body: {
              onlyIfEmpty: true,
              projects: guestWs.projects.map((p) => ({
                localId: p.id,
                name: p.name,
                description: p.description,
                color: p.color,
                icon: p.icon,
                archived: p.archived,
              })),
              todos: guestWs.todos.map((t) => ({
                projectId: t.projectId,
                title: t.title,
                description: t.description,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate,
              })),
            },
          })
          .then((res) => {
            if (res.data?.imported) {
              invalidateWorkspace();
              setToast(
                `Synced your guest workspace (${res.data.projectsCreated} projects, ${res.data.todosCreated} tasks) into your account!`,
              );
            }
          })
          .catch(() => {});
      } else {
        // Brand new empty account with no guest data: seed demo data
        sdk
          .POST("/api/v1/core/todos/seed", { body: { force: false } })
          .then((res) => {
            if (res.data?.seeded) {
              invalidateWorkspace();
            }
          })
          .catch(() => {});
      }
    }
  }, [user?.id, projects.length, todos.length, loadingProjects, loadingTodos, invalidateWorkspace]);

  // Seed / Reset Workspace Mutation
  const seedMutation = useMutation({
    mutationFn: async (force: boolean) => {
      if (isGuest) {
        return resetGuestWorkspace();
      }
      const { data, error } = await sdk.POST("/api/v1/core/todos/seed", {
        body: { force },
      });
      if (error) throw new Error("Failed to seed sample workspace");
      return data;
    },
    onSuccess: (res) => {
      if (res?.seeded) {
        invalidateWorkspace();
        setToast(`Loaded ${res.projectsCreated} projects and ${res.todosCreated} sample tasks`);
      }
    },
  });

  // Create Todo Mutation
  const createTodoMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      projectId?: string | null;
      priority: TodoPriority;
      status?: TodoStatus;
      dueDate?: string | null;
      description?: string | null;
    }) => {
      if (isGuest) {
        return createGuestTodo(payload);
      }
      const { data, error } = await sdk.POST("/api/v1/core/todos", {
        body: {
          title: payload.title,
          projectId: payload.projectId || null,
          priority: payload.priority,
          status: payload.status ?? "todo",
          dueDate: payload.dueDate ? new Date(payload.dueDate).toISOString() : null,
          description: payload.description ?? null,
        },
      });
      if (error) throw new Error("Failed to create task");
      return data;
    },
    onSuccess: () => {
      invalidateWorkspace();
      setQuickTitle("");
      setQuickDueDate("");
      setToast("Task added");
    },
  });

  // Update Todo Mutation
  const updateTodoMutation = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: {
        title?: string;
        description?: string | null;
        projectId?: string | null;
        status?: TodoStatus;
        priority?: TodoPriority;
        dueDate?: string | null;
      };
    }) => {
      if (isGuest) {
        return updateGuestTodo(id, patch);
      }
      const { data, error } = await sdk.PATCH("/api/v1/core/todos/{id}", {
        params: { path: { id } },
        body: patch,
      });
      if (error) throw new Error("Failed to update task");
      return data;
    },
    onSuccess: () => {
      invalidateWorkspace();
      setEditingTodo(null);
    },
  });

  // Delete Todo Mutation
  const deleteTodoMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) {
        deleteGuestTodo(id);
        return;
      }
      const { error } = await sdk.DELETE("/api/v1/core/todos/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error("Failed to delete task");
    },
    onSuccess: () => {
      invalidateWorkspace();
      setToast("Task deleted");
    },
  });

  // Bulk Status Mutation
  const bulkStatusMutation = useMutation({
    mutationFn: async ({
      status,
      projectId,
    }: {
      status: TodoStatus;
      projectId?: string | null;
    }) => {
      if (isGuest) {
        return bulkUpdateGuestTodoStatus(status, projectId);
      }
      const { data, error } = await sdk.POST("/api/v1/core/todos/bulk-status", {
        body: {
          status,
          ...(projectId !== undefined ? { projectId } : {}),
        },
      });
      if (error) throw new Error("Bulk update failed");
      return data;
    },
    onSuccess: (res) => {
      invalidateWorkspace();
      setToast(`Updated ${res?.updatedCount ?? 0} tasks to ${statusLabel(res?.status ?? "done")}`);
    },
  });

  // Clear Completed Mutation
  const clearCompletedMutation = useMutation({
    mutationFn: async (projectId?: string | null) => {
      if (isGuest) {
        return clearCompletedGuestTodos(projectId);
      }
      const { data, error } = await sdk.POST("/api/v1/core/todos/clear-completed", {
        body: {
          ...(projectId !== undefined ? { projectId } : {}),
        },
      });
      if (error) throw new Error("Failed to clear completed tasks");
      return data;
    },
    onSuccess: (res) => {
      invalidateWorkspace();
      setToast(`Cleared ${res?.deletedCount ?? 0} completed tasks`);
    },
  });

  // Create Project Mutation
  const createProjectMutation = useMutation({
    mutationFn: async (payload: { name: string; description: string; color: string }) => {
      if (isGuest) {
        return createGuestProject(payload);
      }
      const { data, error } = await sdk.POST("/api/v1/core/projects", {
        body: {
          name: payload.name,
          description: payload.description || null,
          color: payload.color,
          icon: "folder",
          archived: false,
        },
      });
      if (error) throw new Error("Failed to create project");
      return data;
    },
    onSuccess: (created) => {
      invalidateWorkspace();
      setProjectDialogOpen(false);
      setProjectForm({ name: "", description: "", color: "#6366f1" });
      if (created?.id) {
        setSelectedProjectId(created.id);
      }
      setToast("Project created");
    },
  });

  // Delete Project Mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) {
        deleteGuestProject(id);
        return;
      }
      const { error } = await sdk.DELETE("/api/v1/core/projects/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error("Failed to delete project");
    },
    onSuccess: () => {
      setSelectedProjectId("all");
      invalidateWorkspace();
      setToast("Project removed");
    },
  });

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    const effectiveProjectId =
      quickProjectId ||
      (selectedProjectId !== "all" && selectedProjectId !== "unassigned" ? selectedProjectId : "");
    createTodoMutation.mutate({
      title: trimmed,
      projectId: effectiveProjectId || null,
      priority: quickPriority,
      dueDate: quickDueDate || null,
    });
  };

  const openEditModal = (todo: TodoItem) => {
    setEditingTodo(todo);
    setEditForm({
      title: todo.title,
      description: todo.description ?? "",
      projectId: todo.projectId ?? "",
      status: todo.status,
      priority: todo.priority,
      dueDate: todo.dueDate ? todo.dueDate.slice(0, 10) : "",
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTodo || !editForm.title.trim()) return;
    updateTodoMutation.mutate({
      id: editingTodo.id,
      patch: {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        projectId: editForm.projectId || null,
        status: editForm.status,
        priority: editForm.priority,
        dueDate: editForm.dueDate ? new Date(editForm.dueDate).toISOString() : null,
      },
    });
  };

  const projectLookup = new Map<string, ProjectItem>(projects.map((p) => [p.id, p]));
  const activeProject =
    selectedProjectId !== "all" && selectedProjectId !== "unassigned"
      ? projectLookup.get(selectedProjectId)
      : null;

  const scopedProjectIdForBulk =
    selectedProjectId === "all"
      ? undefined
      : selectedProjectId === "unassigned"
        ? null
        : selectedProjectId;

  const projectDropdownOptions = [
    { label: "Inbox / No Project", value: "", dotColor: "#94a3b8" },
    ...projects.map((p) => ({
      label: p.name,
      value: p.id,
      dotColor: p.color,
    })),
  ];

  const kanbanColumns: Array<{ status: TodoStatus; title: string; subtitle: string }> = [
    { status: "todo", title: "To Do", subtitle: "Planned & queued" },
    { status: "in_progress", title: "In Progress", subtitle: "Actively working" },
    { status: "done", title: "Done", subtitle: "Completed tasks" },
  ];

  return (
    <div className="space-y-6">
      {/* Guest Mode Callout Banner */}
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
              className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700 cursor-pointer"
            >
              Sign Up to Sync
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.("/login")}
              className="rounded-md bg-white px-2.5 py-1.5 font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* Top Workspace Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            {activeProject && (
              <span
                className="inline-block h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: activeProject.color }}
              />
            )}
            <h1 className="text-2xl font-bold text-slate-900">
              {activeProject
                ? activeProject.name
                : selectedProjectId === "unassigned"
                  ? "Inbox / Unassigned"
                  : user
                    ? `${user.name || user.email.split("@")[0]}'s Workspace`
                    : "All Workspace Tasks"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {activeProject?.description ||
              (user
                ? `Private task workspace for ${user.email}. Everything is scoped to your account.`
                : "Organize projects, track task progress across List and Kanban views, and monitor completion metrics.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => seedMutation.mutate(true)}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? "Seeding..." : "Reset Demo Data"}
          </Button>
          <Button size="sm" onClick={() => setProjectDialogOpen(true)}>
            + New Project
          </Button>
        </div>
      </div>

      {/* Live Analytics Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Total Tasks
            </span>
            <Badge variant="default">{stats?.total ?? todos.length}</Badge>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {stats?.byStatus.todo ?? 0}{" "}
            <span className="text-sm font-normal text-slate-500">open</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {stats?.byStatus.in_progress ?? 0} in progress · {stats?.byStatus.done ?? 0} completed
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Completion Rate
            </span>
            <Badge variant={(stats?.completionRate ?? 0) >= 50 ? "success" : "default"}>
              {stats?.completionRate ?? 0}%
            </Badge>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {stats?.byStatus.done ?? 0} / {stats?.total ?? 0}
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${stats?.completionRate ?? 0}%` }}
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              High & Urgent
            </span>
            <Badge variant={(stats?.byPriority.urgent ?? 0) > 0 ? "danger" : "default"}>
              {stats?.byPriority.urgent ?? 0} urgent
            </Badge>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {(stats?.byPriority.urgent ?? 0) + (stats?.byPriority.high ?? 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {stats?.byPriority.high ?? 0} high · {stats?.byPriority.medium ?? 0} medium ·{" "}
            {stats?.byPriority.low ?? 0} low
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Schedule Alerts
            </span>
            <Badge variant={(stats?.overdue ?? 0) > 0 ? "danger" : "success"}>
              {(stats?.overdue ?? 0) > 0 ? `${stats?.overdue} overdue` : "On track"}
            </Badge>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {stats?.dueToday ?? 0}{" "}
            <span className="text-sm font-normal text-slate-500">due today</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">{stats?.overdue ?? 0} past due date</div>
        </Card>
      </div>

      {/* Main 12-Col Workspace Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Project Sidebar (3 cols) */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Projects & Lists
              </h2>
              <button
                type="button"
                onClick={() => setProjectDialogOpen(true)}
                className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                + Add
              </button>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedProjectId("all")}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  selectedProjectId === "all"
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  All Tasks
                </span>
                <span className="text-xs text-slate-500">
                  {stats?.byProject.reduce((acc, p) => acc + p.total, 0) ?? todos.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedProjectId("unassigned")}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  selectedProjectId === "unassigned"
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                  Inbox / Unassigned
                </span>
                <span className="text-xs text-slate-500">
                  {stats?.byProject.find((p) => p.projectId === null)?.total ?? 0}
                </span>
              </button>

              <div className="my-2 border-t border-slate-100" />

              {projects.map((project) => {
                const projStat = stats?.byProject.find((p) => p.projectId === project.id);
                const isSelected = selectedProjectId === project.id;
                return (
                  <div key={project.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedProjectId(project.id)}
                      className={`flex flex-1 cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="truncate">{project.name}</span>
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        {projStat ? `${projStat.done}/${projStat.total}` : "0/0"}
                      </span>
                    </button>
                    {isSelected && (
                      <button
                        type="button"
                        title="Delete Project"
                        onClick={() => deleteProjectMutation.mutate(project.id)}
                        className="cursor-pointer rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Bulk Workspace Actions Card */}
          <Card className="space-y-2.5 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Quick Bulk Actions
            </h3>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center"
              disabled={bulkStatusMutation.isPending || todos.length === 0}
              onClick={() =>
                bulkStatusMutation.mutate({
                  status: "done",
                  projectId: scopedProjectIdForBulk,
                })
              }
            >
              ✓ Mark All Done
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center"
              disabled={clearCompletedMutation.isPending || (stats?.byStatus.done ?? 0) === 0}
              onClick={() => clearCompletedMutation.mutate(scopedProjectIdForBulk)}
            >
              Clear Completed ({stats?.byStatus.done ?? 0})
            </Button>
          </Card>
        </div>

        {/* Main Task Area (9 cols) */}
        <div className="space-y-4 lg:col-span-9">
          {/* Quick-Add Bar */}
          <Card className="p-4">
            <form onSubmit={handleQuickAdd} className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <Input
                    placeholder="What needs to get done? Press Enter to add..."
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={createTodoMutation.isPending || !quickTitle.trim()}>
                  {createTodoMutation.isPending ? "Adding..." : "+ Add Task"}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <DropdownSelect
                  ariaLabel="Select project for new task"
                  value={
                    quickProjectId ||
                    (selectedProjectId !== "all" && selectedProjectId !== "unassigned"
                      ? selectedProjectId
                      : "")
                  }
                  options={projectDropdownOptions}
                  onChange={(val) => setQuickProjectId(val)}
                />
                <DropdownSelect
                  ariaLabel="Select priority for new task"
                  value={quickPriority}
                  options={[
                    { label: "Priority: Low", value: "low", dotColor: "#10b981" },
                    { label: "Priority: Medium", value: "medium", dotColor: "#6366f1" },
                    { label: "Priority: High", value: "high", dotColor: "#f59e0b" },
                    { label: "Priority: Urgent", value: "urgent", dotColor: "#ef4444" },
                  ]}
                  onChange={(val) => setQuickPriority(val as TodoPriority)}
                />
                <Input
                  type="date"
                  value={quickDueDate}
                  onChange={(e) => setQuickDueDate(e.target.value)}
                />
              </div>
            </form>
          </Card>

          {/* Filter & View Mode Toolbar */}
          <Card className="p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="min-w-[180px] flex-1">
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <DropdownSelect
                  ariaLabel="Filter by status"
                  className="min-w-[150px]"
                  value={statusFilter}
                  options={[{ label: "All Statuses", value: "all" }, ...STATUS_OPTIONS]}
                  onChange={(val) => setStatusFilter(val)}
                />
                <DropdownSelect
                  ariaLabel="Filter by priority"
                  className="min-w-[150px]"
                  value={priorityFilter}
                  options={[
                    { label: "All Priorities", value: "all" },
                    { label: "Urgent", value: "urgent", dotColor: "#ef4444" },
                    { label: "High", value: "high", dotColor: "#f59e0b" },
                    { label: "Medium", value: "medium", dotColor: "#6366f1" },
                    { label: "Low", value: "low", dotColor: "#10b981" },
                  ]}
                  onChange={(val) => setPriorityFilter(val)}
                />
              </div>

              {/* View Switcher */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    viewMode === "list"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  List View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("kanban")}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    viewMode === "kanban"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Kanban Board
                </button>
              </div>
            </div>
          </Card>

          {/* Task Views */}
          {loadingTodos ? (
            <Card className="p-8 text-center text-sm text-slate-500">Loading tasks...</Card>
          ) : todos.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="text-base font-semibold text-slate-900">No tasks match your view</div>
              <p className="mt-1 text-sm text-slate-500">
                Add a task above, adjust your filters, or load sample tasks to explore.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                {(statusFilter !== "all" ||
                  priorityFilter !== "all" ||
                  searchQuery ||
                  selectedProjectId !== "all") && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedProjectId("all");
                      setStatusFilter("all");
                      setPriorityFilter("all");
                      setSearchQuery("");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
                <Button size="sm" onClick={() => seedMutation.mutate(true)}>
                  Load Sample Tasks
                </Button>
              </div>
            </Card>
          ) : viewMode === "list" ? (
            <div className="space-y-2.5">
              {todos.map((todo) => {
                const proj = todo.projectId ? projectLookup.get(todo.projectId) : null;
                const dueInfo = formatDueDate(todo.dueDate, todo.status);
                const isDone = todo.status === "done";

                return (
                  <Card
                    key={todo.id}
                    className={`p-4 transition hover:border-slate-300 ${
                      isDone ? "bg-slate-50/70" : "bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isDone}
                          aria-label={`Mark "${todo.title}" as completed`}
                          onChange={() =>
                            updateTodoMutation.mutate({
                              id: todo.id,
                              patch: { status: isDone ? "todo" : "done" },
                            })
                          }
                          className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-medium ${
                                isDone ? "text-slate-400 line-through" : "text-slate-900"
                              }`}
                            >
                              {todo.title}
                            </span>
                            <Badge variant={priorityBadgeVariant(todo.priority)}>
                              {todo.priority}
                            </Badge>
                            <Badge variant={statusBadgeVariant(todo.status)}>
                              {statusLabel(todo.status)}
                            </Badge>
                            {proj && (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                                style={{
                                  backgroundColor: `${proj.color}18`,
                                  color: proj.color,
                                }}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: proj.color }}
                                />
                                {proj.name}
                              </span>
                            )}
                            {dueInfo && (
                              <span
                                className={`rounded px-2 py-0.5 text-xs font-medium ${
                                  dueInfo.isOverdue
                                    ? "bg-red-50 text-red-700"
                                    : dueInfo.isDueToday
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {dueInfo.label}
                              </span>
                            )}
                          </div>
                          {todo.description && (
                            <p className="text-sm text-slate-600">{todo.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                        <DropdownSelect
                          size="sm"
                          className="w-36"
                          ariaLabel={`Status for ${todo.title}`}
                          value={todo.status}
                          options={STATUS_OPTIONS}
                          onChange={(val) =>
                            updateTodoMutation.mutate({
                              id: todo.id,
                              patch: { status: val as TodoStatus },
                            })
                          }
                        />
                        <Button variant="secondary" size="sm" onClick={() => openEditModal(todo)}>
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => deleteTodoMutation.mutate(todo.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* Kanban Board View */
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {kanbanColumns.map((col) => {
                const colTodos = todos.filter((t) => t.status === col.status);
                return (
                  <div
                    key={col.status}
                    className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                  >
                    <div className="mb-3 flex items-center justify-between px-1">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{col.title}</h3>
                        <p className="text-xs text-slate-500">{col.subtitle}</p>
                      </div>
                      <Badge variant={statusBadgeVariant(col.status)}>{colTodos.length}</Badge>
                    </div>

                    <div className="space-y-2.5">
                      {colTodos.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                          No tasks in {col.title}
                        </div>
                      ) : (
                        colTodos.map((todo) => {
                          const proj = todo.projectId ? projectLookup.get(todo.projectId) : null;
                          const dueInfo = formatDueDate(todo.dueDate, todo.status);
                          return (
                            <Card key={todo.id} className="space-y-2.5 bg-white p-3.5 shadow-sm">
                              <div className="flex items-start justify-between gap-2">
                                <span
                                  className={`text-sm font-medium ${
                                    todo.status === "done"
                                      ? "text-slate-400 line-through"
                                      : "text-slate-900"
                                  }`}
                                >
                                  {todo.title}
                                </span>
                                <Badge variant={priorityBadgeVariant(todo.priority)}>
                                  {todo.priority}
                                </Badge>
                              </div>

                              {todo.description && (
                                <p className="line-clamp-2 text-xs text-slate-600">
                                  {todo.description}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-1.5">
                                {proj && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                                    style={{
                                      backgroundColor: `${proj.color}18`,
                                      color: proj.color,
                                    }}
                                  >
                                    <span
                                      className="h-1.5 w-1.5 rounded-full"
                                      style={{ backgroundColor: proj.color }}
                                    />
                                    {proj.name}
                                  </span>
                                )}
                                {dueInfo && (
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                                      dueInfo.isOverdue
                                        ? "bg-red-50 text-red-700"
                                        : dueInfo.isDueToday
                                          ? "bg-amber-50 text-amber-700"
                                          : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {dueInfo.label}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                                <div className="flex gap-1">
                                  {col.status !== "todo" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateTodoMutation.mutate({
                                          id: todo.id,
                                          patch: {
                                            status: col.status === "done" ? "in_progress" : "todo",
                                          },
                                        })
                                      }
                                      className="cursor-pointer rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                                    >
                                      ← Move Back
                                    </button>
                                  )}
                                  {col.status !== "done" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateTodoMutation.mutate({
                                          id: todo.id,
                                          patch: {
                                            status: col.status === "todo" ? "in_progress" : "done",
                                          },
                                        })
                                      }
                                      className="cursor-pointer rounded bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                                    >
                                      Advance →
                                    </button>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(todo)}
                                    className="cursor-pointer rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteTodoMutation.mutate(todo.id)}
                                    className="cursor-pointer rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      <Dialog
        open={projectDialogOpen}
        title="Create Project List"
        onClose={() => setProjectDialogOpen(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!projectForm.name.trim()) return;
            createProjectMutation.mutate({
              name: projectForm.name.trim(),
              description: projectForm.description.trim(),
              color: projectForm.color,
            });
          }}
          className="space-y-4"
        >
          <Input
            id="project-name"
            label="Project Name"
            placeholder="e.g. Marketing Q4, Mobile App, Personal"
            value={projectForm.name}
            onChange={(e) => setProjectForm((s) => ({ ...s, name: e.target.value }))}
          />
          <Textarea
            id="project-description"
            label="Description"
            placeholder="Optional description for this project..."
            value={projectForm.description}
            onChange={(e) => setProjectForm((s) => ({ ...s, description: e.target.value }))}
          />
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-slate-700">Project Color</span>
            <div className="flex items-center gap-2">
              {COLOR_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Select color ${hex}`}
                  onClick={() => setProjectForm((s) => ({ ...s, color: hex }))}
                  className={`h-7 w-7 cursor-pointer rounded-full border-2 transition ${
                    projectForm.color === hex
                      ? "scale-110 border-slate-900"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setProjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProjectMutation.isPending || !projectForm.name.trim()}
            >
              {createProjectMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Todo Modal */}
      <Dialog open={Boolean(editingTodo)} title="Edit Task" onClose={() => setEditingTodo(null)}>
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            id="edit-title"
            label="Task Title"
            value={editForm.title}
            onChange={(e) => setEditForm((s) => ({ ...s, title: e.target.value }))}
          />
          <Textarea
            id="edit-description"
            label="Notes / Description"
            value={editForm.description}
            onChange={(e) => setEditForm((s) => ({ ...s, description: e.target.value }))}
          />
          <DropdownSelect
            id="edit-project"
            label="Project"
            value={editForm.projectId}
            options={projectDropdownOptions}
            onChange={(val) => setEditForm((s) => ({ ...s, projectId: val }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DropdownSelect
              id="edit-status"
              label="Status"
              value={editForm.status}
              options={STATUS_OPTIONS}
              onChange={(val) => setEditForm((s) => ({ ...s, status: val as TodoStatus }))}
            />
            <DropdownSelect
              id="edit-priority"
              label="Priority"
              value={editForm.priority}
              options={PRIORITY_OPTIONS}
              onChange={(val) => setEditForm((s) => ({ ...s, priority: val as TodoPriority }))}
            />
          </div>
          <Input
            id="edit-due-date"
            type="date"
            label="Due Date"
            value={editForm.dueDate}
            onChange={(e) => setEditForm((s) => ({ ...s, dueDate: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditingTodo(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateTodoMutation.isPending || !editForm.title.trim()}>
              {updateTodoMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Toast message={toast} variant="success" onDismiss={() => setToast(null)} />
    </div>
  );
}
