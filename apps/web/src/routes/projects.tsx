import { Badge, Button, Card, Checkbox, Dialog, Input, Table, Textarea, Toast } from "@pand/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPandClient } from "@todo-pand/sdk";
import type React from "react";
import { useState } from "react";
import { useSession } from "../lib/auth.js";
import {
  type ProjectItem,
  createGuestProject,
  deleteGuestProject,
  listGuestProjects,
  updateGuestProject,
} from "../lib/guest-storage.js";

const sdk = createPandClient({ baseUrl: window.location.origin });

export default function ProjectsPage({ onNavigate }: { onNavigate?: (to: string) => void } = {}) {
  const queryClient = useQueryClient();
  const { data: user, isLoading: sessionLoading } = useSession();
  const isGuest = !sessionLoading && !user;

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: "",
    description: "",
    color: "#6366f1",
    icon: "folder",
    archived: false,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["core", "projects", isGuest, user?.id, search],
    queryFn: async () => {
      if (isGuest) {
        return listGuestProjects({
          q: search.trim() || undefined,
        });
      }
      const { data, error } = await sdk.GET("/api/v1/core/projects", {
        params: {
          query: {
            limit: 100,
            ...(search.trim() ? { q: search.trim() } : {}),
          },
        },
      });
      if (error) throw new Error("Failed to load Projects");
      return (data?.items ?? []) as ProjectItem[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof formState) => {
      if (isGuest) {
        return createGuestProject({
          name: payload.name,
          description: payload.description || null,
          color: payload.color,
          icon: payload.icon,
          archived: payload.archived,
        });
      }
      const { data, error } = await sdk.POST("/api/v1/core/projects", {
        body: {
          name: payload.name,
          description: payload.description || null,
          color: payload.color,
          icon: payload.icon,
          archived: payload.archived,
        },
      });
      if (error) throw new Error("Failed to create Project");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core", "projects"] });
      queryClient.invalidateQueries({ queryKey: ["core", "todo-stats"] });
      setModalOpen(false);
      setFormState({
        name: "",
        description: "",
        color: "#6366f1",
        icon: "folder",
        archived: false,
      });
      setToast("Created Project");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      if (isGuest) {
        return updateGuestProject(id, { archived });
      }
      const { data, error } = await sdk.PATCH("/api/v1/core/projects/{id}", {
        params: { path: { id } },
        body: { archived },
      });
      if (error) throw new Error("Failed to update Project");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core", "projects"] });
      setToast("Updated Project");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) {
        deleteGuestProject(id);
        return;
      }
      const { error } = await sdk.DELETE("/api/v1/core/projects/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error("Failed to delete Project");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core", "projects"] });
      queryClient.invalidateQueries({ queryKey: ["core", "todos"] });
      queryClient.invalidateQueries({ queryKey: ["core", "todo-stats"] });
      setToast("Deleted Project");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim()) return;
    createMutation.mutate(formState);
  };

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
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">Manage project lists and task categories</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Create Project</Button>
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search Projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      {isLoading ? (
        <Card>Loading Projects...</Card>
      ) : (
        <Table>
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Project</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Description</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-slate-900">{item.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.description ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={item.archived ? "warning" : "success"}>
                    {item.archived ? "Archived" : "Active"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        archiveMutation.mutate({ id: item.id, archived: !item.archived })
                      }
                    >
                      {item.archived ? "Restore" : "Archive"}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Dialog open={modalOpen} title="Create Project" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            label="Name"
            value={formState.name}
            onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
          />
          <Textarea
            id="description"
            label="Description"
            value={formState.description}
            onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
          />
          <Input
            id="color"
            label="Color (Hex)"
            value={formState.color}
            onChange={(e) => setFormState((s) => ({ ...s, color: e.target.value }))}
          />
          <Checkbox
            id="archived"
            label="Archived"
            checked={formState.archived}
            onChange={(e) => setFormState((s) => ({ ...s, archived: e.target.checked }))}
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
