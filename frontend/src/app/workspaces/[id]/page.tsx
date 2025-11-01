"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Users } from "lucide-react";

type Workspace = { id: string; name: string; ownerId?: string; settings?: any; description?: string | null; createdAt?: string; updatedAt?: string; owner?: { id: string; email: string; name?: string | null } };
type Project = { id: string; name: string; description?: string | null };
type Member = { userId: string; role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"; user: { id: string; name?: string | null; email: string } };

const ROLE_COLORS: Record<string, string> = {
	OWNER: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
	ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
	MEMBER: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	VIEWER: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export default function WorkspacePage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const [workspace, setWorkspace] = useState<Workspace | null>(null);
	const [projects, setProjects] = useState<Project[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [userRole, setUserRole] = useState<"OWNER" | "ADMIN" | "MEMBER" | "VIEWER">("VIEWER");
	const [showSettings, setShowSettings] = useState(false);
	const [isEditingWs, setIsEditingWs] = useState(false);
	const [editName, setEditName] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const workspaceId = params.id;
    const [limitedView, setLimitedView] = useState(false);

	async function load() {
		try {
			const ws = await apiFetch<{ workspace: Workspace }>(`/api/workspaces/${workspaceId}`);
			setWorkspace(ws.workspace);
			setEditName(ws.workspace.name || "");
			setEditDescription(ws.workspace.description || "");
			setLimitedView(false);

			const projs = await apiFetch<{ projects: Project[] }>(`/api/projects?workspaceId=${workspaceId}`);
			setProjects(projs.projects);

			// Get current user's role
			const userStr = localStorage.getItem("user");
			if (userStr) {
				const user = JSON.parse(userStr);
				// Check if user is the owner
				if (ws.workspace.ownerId === user.id) {
					setUserRole("OWNER");
				} else {
					// Check membership role
					const members = await apiFetch<{ members: Member[] }>(`/api/workspaces/${workspaceId}/members`);
					const member = members.members.find((m) => m.userId === user.id);
					if (member) {
						setUserRole(member.role);
					}
				}
			}

			setError(null);
		} catch (e: any) {
			// If workspace details are forbidden, fallback to limited (projects-only) view
			setWorkspace(null);
			setLimitedView(true);
			try {
				const projs = await apiFetch<{ projects: Project[] }>(`/api/projects?workspaceId=${workspaceId}`);
				setProjects(projs.projects);
				setUserRole("MEMBER");
				setError(null);
			} catch (e2: any) {
				setError(e2.message || "Failed to load projects");
			}
		}
	}

	useEffect(() => {
		if (workspaceId) load();
	}, [workspaceId]);

	async function saveWorkspace(e: React.FormEvent) {
		e.preventDefault();
		try {
			await apiFetch(`/api/workspaces/${workspaceId}`, {
				method: "PUT",
				body: JSON.stringify({ name: editName.trim() || undefined, description: editDescription.trim() || "" }),
			});
			await load();
			setIsEditingWs(false);
		} catch (e: any) {
			setError(e.message || "Failed to update workspace");
		}
	}

	async function deleteWorkspace() {
		if (!confirm("Delete this workspace? This cannot be undone.")) return;
		try {
			await apiFetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
			router.push(`/workspaces`);
		} catch (e: any) {
			setError(e.message || "Failed to delete workspace");
		}
	}

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim() || loading) return;

		setLoading(true);
		try {
			await apiFetch("/api/projects", {
				method: "POST",
				body: JSON.stringify({ name, description, workspaceId }),
			});
			setName("");
			setDescription("");
			await load();
		} catch (e: any) {
			setError(e.message || "Failed to create project");
		} finally {
			setLoading(false);
		}
	}

	// Owners and Admins can always create projects
	// Members can create projects in their workspaces
	// Viewers can create projects only in their own workspace (where they're owner)
	const canCreateProject = userRole === "OWNER" || userRole === "ADMIN" || userRole === "MEMBER";
	const canManageTeam = userRole === "OWNER" || userRole === "ADMIN";

	return (
		<div className="max-w-7xl mx-auto p-8">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold">{workspace?.name ?? (limitedView ? "Projects" : "Workspace")}</h1>
					<div className="mt-2 flex items-center gap-2">
						<span className="text-sm text-zinc-500 dark:text-zinc-400">Your Role:</span>
						<span className={`text-sm font-semibold px-3 py-1 rounded ${ROLE_COLORS[userRole]}`}>{userRole}</span>
						<span className="text-xs text-zinc-400 dark:text-zinc-500">
							{userRole === "OWNER" && "(Full control)"}
							{userRole === "ADMIN" && "(Can manage members and projects)"}
							{userRole === "MEMBER" && "(Can work on tasks)"}
							{userRole === "VIEWER" && "(Read-only access)"}
						</span>
					</div>
				</div>
				<div className="flex items-center gap-3">
					{!limitedView && (userRole === "OWNER" || userRole === "ADMIN") && (
						<button onClick={() => { setShowSettings(!showSettings); setIsEditingWs(showSettings ? false : true); }} className="text-sm px-3 py-1 rounded bg-zinc-900 text-white">
							Settings
						</button>
					)}
				</div>
			</div>

			{!limitedView && (userRole === "OWNER" || userRole === "ADMIN") && showSettings && (
				<div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mb-6">
					<div className="flex items-center justify-between mb-3">
						<h2 className="font-semibold">Workspace settings</h2>
						<div className="flex items-center gap-2">
							<Link className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline transition-colors" href={`/workspaces/${workspaceId}/members`}>
								<Users size={16} />
								Manage members
							</Link>
							<button onClick={() => setShowSettings(false)} className="text-sm px-3 py-1 rounded border">Close</button>
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Details</h3>
							<form onSubmit={saveWorkspace} className="space-y-3">
								<div>
									<label className="block text-sm mb-1">Name</label>
									<input className="w-full border rounded px-3 py-2" value={editName} onChange={(e) => setEditName(e.target.value)} />
								</div>
								<div>
									<label className="block text-sm mb-1">Description</label>
									<textarea className="w-full border rounded px-3 py-2" rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
								</div>
								<div className="grid grid-cols-1 gap-2 text-sm text-zinc-700 dark:text-zinc-300">
									<p><strong>ID:</strong> {workspace?.id}</p>
									<p><strong>Owner:</strong> {workspace?.owner?.name || workspace?.owner?.email || workspace?.ownerId}</p>
									{workspace?.createdAt && <p><strong>Created:</strong> {new Date(workspace.createdAt).toLocaleString()}</p>}
									{workspace?.updatedAt && <p><strong>Updated:</strong> {new Date(workspace.updatedAt).toLocaleString()}</p>}
								</div>
								<div className="flex gap-2">
									<button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">Save</button>
									<button type="button" onClick={() => setIsEditingWs(false)} className="px-4 py-2 rounded border">Cancel</button>
								</div>
							</form>
						</div>
						<div>
							<h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Danger zone</h3>
							{userRole === "OWNER" ? (
								<button onClick={deleteWorkspace} className="text-sm px-3 py-2 rounded bg-red-600 text-white w-full md:w-auto">Delete workspace</button>
							) : (
								<p className="text-xs text-zinc-500">Only the owner can delete this workspace.</p>
							)}
						</div>
					</div>
				</div>
			)}

			{canCreateProject && (
				<form onSubmit={onCreate} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mb-6">
					<h2 className="font-semibold mb-3">Create New Project</h2>
					<div className="flex flex-col sm:flex-row gap-2">
						<input
							className="flex-1 border rounded px-3 py-2"
							placeholder="Project name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							disabled={loading}
						/>
						<input
							className="flex-1 border rounded px-3 py-2"
							placeholder="Description (optional)"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={loading}
						/>
						<button className="px-4 py-2 rounded bg-black text-white disabled:opacity-50 transition-colors" type="submit" disabled={loading}>
							{loading ? "Creating..." : "Create"}
						</button>
					</div>
				</form>
			)}

			{!canCreateProject && (
				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
					<p className="text-sm text-blue-800 dark:text-blue-300">
						You don't have permission to create projects. Contact an admin or owner to get started.
					</p>
				</div>
			)}

			{error && <p className="text-red-600 mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-900">{error}</p>}

			<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{projects.length === 0 ? (
					<div className="col-span-full text-center py-12 text-zinc-500 dark:text-zinc-400">
						<p>No projects yet. {canCreateProject ? "Create your first project above." : "Ask an admin to create one."}</p>
					</div>
				) : (
					projects.map((p) => (
						<div key={p.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:shadow-md transition-shadow">
							<div className="flex items-center justify-between mb-2">
								<h3 className="font-medium">{p.name}</h3>
								<Link className="text-blue-600 hover:underline text-sm" href={`/projects/${p.id}`}>
									Open →
								</Link>
							</div>
							{p.description && <p className="text-sm text-zinc-500 dark:text-zinc-400">{p.description}</p>}
						</div>
					))
				)}
			</div>
		</div>
	);
}
