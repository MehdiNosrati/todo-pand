export type TodoStatus = "todo" | "in_progress" | "done";
export type TodoPriority = "low" | "medium" | "high" | "urgent";

export interface ProjectItem {
  id: string;
  ownerId?: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TodoItem {
  id: string;
  ownerId?: string;
  projectId: string | null;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodoStats {
  total: number;
  byStatus: {
    todo: number;
    in_progress: number;
    done: number;
  };
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  overdue: number;
  dueToday: number;
  completionRate: number;
  byProject: Array<{
    projectId: string | null;
    projectName: string;
    color: string;
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    completionRate: number;
  }>;
}

interface GuestWorkspaceState {
  projects: ProjectItem[];
  todos: TodoItem[];
}

const GUEST_STORAGE_KEY = "todo_pand_guest_workspace_v1";

function createDefaultGuestWorkspace(): GuestWorkspaceState {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const nowIso = new Date(now).toISOString();

  const pLaunchId = "00000000-0000-4000-8000-000000000101";
  const pEngId = "00000000-0000-4000-8000-000000000102";
  const pPersonalId = "00000000-0000-4000-8000-000000000103";

  const projects: ProjectItem[] = [
    {
      id: pLaunchId,
      ownerId: "guest",
      name: "Product Launch",
      description: "Go-to-market milestones, release notes, and launch readiness checklist",
      color: "#6366f1",
      icon: "rocket",
      archived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: pEngId,
      ownerId: "guest",
      name: "Engineering Sprint",
      description: "Core platform architecture, API contracts, and reliability improvements",
      color: "#0ea5e9",
      icon: "code",
      archived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: pPersonalId,
      ownerId: "guest",
      name: "Personal & Errands",
      description: "Daily life tasks, reading list, and personal reminders",
      color: "#10b981",
      icon: "check-circle",
      archived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const todos: TodoItem[] = [
    {
      id: "00000000-0000-4000-8000-000000000201",
      ownerId: "guest",
      projectId: pLaunchId,
      title: "Finalize Q4 product launch announcement post",
      description: "Coordinate copy review with design and engineering before publishing.",
      status: "in_progress",
      priority: "urgent",
      dueDate: new Date(now + 1 * dayMs).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "00000000-0000-4000-8000-000000000202",
      ownerId: "guest",
      projectId: pLaunchId,
      title: "Record 2-minute interactive product demo video",
      description: "Walk through project creation, Kanban board workflow, and live analytics.",
      status: "todo",
      priority: "high",
      dueDate: new Date(now + 2 * dayMs).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "00000000-0000-4000-8000-000000000203",
      ownerId: "guest",
      projectId: pLaunchId,
      title: "Approve production domain & SSL certificates",
      description: "Verified edge routing and TLS certificates on Pand Box.",
      status: "done",
      priority: "high",
      dueDate: new Date(now - 2 * dayMs).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "00000000-0000-4000-8000-000000000204",
      ownerId: "guest",
      projectId: pEngId,
      title: "Generate OpenAPI 3.1 contract and TypeScript SDK",
      description:
        "Ensure all custom stats and bulk action endpoints are reflected in @todo-pand/sdk.",
      status: "done",
      priority: "urgent",
      dueDate: new Date(now - 1 * dayMs).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "00000000-0000-4000-8000-000000000205",
      ownerId: "guest",
      projectId: pEngId,
      title: "Audit overdue task alerts and query indexes",
      description: "Verify fast filtering by project, status, and priority on the todos table.",
      status: "in_progress",
      priority: "medium",
      dueDate: new Date(now - 1 * dayMs).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "00000000-0000-4000-8000-000000000206",
      ownerId: "guest",
      projectId: pEngId,
      title: "Add end-to-end Vitest coverage for bulk operations",
      description: "Test bulk mark-done, clear-completed, and workspace stats aggregation.",
      status: "todo",
      priority: "high",
      dueDate: new Date(now + 3 * dayMs).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "00000000-0000-4000-8000-000000000207",
      ownerId: "guest",
      projectId: pPersonalId,
      title: "Book dentist appointment and annual checkup",
      description: "Call clinic before Friday afternoon.",
      status: "todo",
      priority: "medium",
      dueDate: new Date(now + 4 * dayMs).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "00000000-0000-4000-8000-000000000208",
      ownerId: "guest",
      projectId: pPersonalId,
      title: "Order espresso beans and desk lamp",
      description: "Picked up medium roast beans from local roaster.",
      status: "done",
      priority: "low",
      dueDate: new Date(now - 3 * dayMs).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  return { projects, todos };
}

export function getGuestWorkspace(): GuestWorkspaceState {
  try {
    const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GuestWorkspaceState;
      if (Array.isArray(parsed.projects) && Array.isArray(parsed.todos)) {
        return parsed;
      }
    }
  } catch {
    // fallback to default
  }
  const initial = createDefaultGuestWorkspace();
  saveGuestWorkspace(initial);
  return initial;
}

export function saveGuestWorkspace(state: GuestWorkspaceState): void {
  try {
    window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export function resetGuestWorkspace(): {
  seeded: boolean;
  projectsCreated: number;
  todosCreated: number;
} {
  const initial = createDefaultGuestWorkspace();
  saveGuestWorkspace(initial);
  return {
    seeded: true,
    projectsCreated: initial.projects.length,
    todosCreated: initial.todos.length,
  };
}

export function listGuestProjects(query?: { q?: string; archived?: boolean }): ProjectItem[] {
  const { projects } = getGuestWorkspace();
  const term = query?.q?.trim().toLowerCase();
  return projects.filter((p) => {
    if (query?.archived !== undefined && p.archived !== query.archived) return false;
    if (term) {
      const inName = p.name.toLowerCase().includes(term);
      const inDesc = (p.description ?? "").toLowerCase().includes(term);
      if (!inName && !inDesc) return false;
    }
    return true;
  });
}

export function createGuestProject(input: {
  name: string;
  description?: string | null;
  color?: string;
  icon?: string;
  archived?: boolean;
}): ProjectItem {
  const ws = getGuestWorkspace();
  const nowIso = new Date().toISOString();
  const created: ProjectItem = {
    id: crypto.randomUUID(),
    ownerId: "guest",
    name: input.name,
    description: input.description ?? null,
    color: input.color ?? "#6366f1",
    icon: input.icon ?? "folder",
    archived: input.archived ?? false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  ws.projects.push(created);
  saveGuestWorkspace(ws);
  return created;
}

export function updateGuestProject(
  id: string,
  patch: Partial<Pick<ProjectItem, "name" | "description" | "color" | "icon" | "archived">>,
): ProjectItem {
  const ws = getGuestWorkspace();
  const idx = ws.projects.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error("Project not found");
  const updated: ProjectItem = {
    ...ws.projects[idx]!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  ws.projects[idx] = updated;
  saveGuestWorkspace(ws);
  return updated;
}

export function deleteGuestProject(id: string): void {
  const ws = getGuestWorkspace();
  ws.projects = ws.projects.filter((p) => p.id !== id);
  ws.todos = ws.todos.map((t) => (t.projectId === id ? { ...t, projectId: null } : t));
  saveGuestWorkspace(ws);
}

export function listGuestTodos(filter?: {
  projectId?: string;
  status?: string;
  priority?: string;
  q?: string;
}): TodoItem[] {
  const { todos } = getGuestWorkspace();
  const term = filter?.q?.trim().toLowerCase();
  return todos.filter((t) => {
    if (filter?.projectId && filter.projectId !== "all") {
      if (filter.projectId === "unassigned") {
        if (t.projectId !== null) return false;
      } else if (t.projectId !== filter.projectId) {
        return false;
      }
    }
    if (filter?.status && filter.status !== "all" && t.status !== filter.status) {
      return false;
    }
    if (filter?.priority && filter.priority !== "all" && t.priority !== filter.priority) {
      return false;
    }
    if (term) {
      const inTitle = t.title.toLowerCase().includes(term);
      const inDesc = (t.description ?? "").toLowerCase().includes(term);
      if (!inTitle && !inDesc) return false;
    }
    return true;
  });
}

export function createGuestTodo(input: {
  title: string;
  projectId?: string | null;
  description?: string | null;
  status?: TodoStatus;
  priority?: TodoPriority;
  dueDate?: string | null;
}): TodoItem {
  const ws = getGuestWorkspace();
  const nowIso = new Date().toISOString();
  const created: TodoItem = {
    id: crypto.randomUUID(),
    ownerId: "guest",
    projectId: input.projectId || null,
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? "todo",
    priority: input.priority ?? "medium",
    dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  ws.todos.unshift(created);
  saveGuestWorkspace(ws);
  return created;
}

export function updateGuestTodo(
  id: string,
  patch: Partial<
    Pick<TodoItem, "title" | "description" | "projectId" | "status" | "priority" | "dueDate">
  >,
): TodoItem {
  const ws = getGuestWorkspace();
  const idx = ws.todos.findIndex((t) => t.id === id);
  if (idx < 0) throw new Error("Todo not found");
  const updated: TodoItem = {
    ...ws.todos[idx]!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  ws.todos[idx] = updated;
  saveGuestWorkspace(ws);
  return updated;
}

export function deleteGuestTodo(id: string): void {
  const ws = getGuestWorkspace();
  ws.todos = ws.todos.filter((t) => t.id !== id);
  saveGuestWorkspace(ws);
}

export function bulkUpdateGuestTodoStatus(
  status: TodoStatus,
  projectId?: string | null,
): { updatedCount: number; status: TodoStatus } {
  const ws = getGuestWorkspace();
  let updatedCount = 0;
  const nowIso = new Date().toISOString();
  ws.todos = ws.todos.map((t) => {
    const matchesProject =
      projectId === undefined
        ? true
        : projectId === null
          ? t.projectId === null
          : t.projectId === projectId;
    if (!matchesProject) return t;
    updatedCount += 1;
    return { ...t, status, updatedAt: nowIso };
  });
  saveGuestWorkspace(ws);
  return { updatedCount, status };
}

export function clearCompletedGuestTodos(projectId?: string | null): { deletedCount: number } {
  const ws = getGuestWorkspace();
  const before = ws.todos.length;
  ws.todos = ws.todos.filter((t) => {
    if (t.status !== "done") return true;
    const matchesProject =
      projectId === undefined
        ? true
        : projectId === null
          ? t.projectId === null
          : t.projectId === projectId;
    return !matchesProject;
  });
  const deletedCount = before - ws.todos.length;
  saveGuestWorkspace(ws);
  return { deletedCount };
}

export function computeGuestTodoStats(projectId?: string): TodoStats {
  const { projects: allProjects, todos: allTodos } = getGuestWorkspace();
  const scopedTodos =
    projectId && projectId !== "all"
      ? projectId === "unassigned"
        ? allTodos.filter((t) => t.projectId === null)
        : allTodos.filter((t) => t.projectId === projectId)
      : allTodos;

  const byStatus = { todo: 0, in_progress: 0, done: 0 };
  const byPriority = { low: 0, medium: 0, high: 0, urgent: 0 };
  const now = new Date();
  const todayIsoPrefix = now.toISOString().slice(0, 10);
  let overdue = 0;
  let dueToday = 0;

  for (const item of scopedTodos) {
    byStatus[item.status] += 1;
    byPriority[item.priority] += 1;
    if (item.status !== "done" && item.dueDate) {
      const dueDateIso = item.dueDate.slice(0, 10);
      if (dueDateIso === todayIsoPrefix) {
        dueToday += 1;
      } else if (new Date(item.dueDate).getTime() < now.getTime()) {
        overdue += 1;
      }
    }
  }

  const total = scopedTodos.length;
  const completionRate = total > 0 ? Math.round((byStatus.done / total) * 100) : 0;

  const projectMap = new Map<
    string | null,
    {
      projectId: string | null;
      projectName: string;
      color: string;
      total: number;
      todo: number;
      inProgress: number;
      done: number;
    }
  >();

  for (const p of allProjects) {
    projectMap.set(p.id, {
      projectId: p.id,
      projectName: p.name,
      color: p.color,
      total: 0,
      todo: 0,
      inProgress: 0,
      done: 0,
    });
  }

  for (const t of allTodos) {
    const key = t.projectId && projectMap.has(t.projectId) ? t.projectId : null;
    if (!projectMap.has(key)) {
      projectMap.set(null, {
        projectId: null,
        projectName: "Inbox / Unassigned",
        color: "#64748b",
        total: 0,
        todo: 0,
        inProgress: 0,
        done: 0,
      });
    }
    const entry = projectMap.get(key);
    if (entry) {
      entry.total += 1;
      if (t.status === "todo") entry.todo += 1;
      else if (t.status === "in_progress") entry.inProgress += 1;
      else if (t.status === "done") entry.done += 1;
    }
  }

  const byProject = Array.from(projectMap.values()).map((entry) => ({
    ...entry,
    completionRate: entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0,
  }));

  return {
    total,
    byStatus,
    byPriority,
    overdue,
    dueToday,
    completionRate,
    byProject,
  };
}
