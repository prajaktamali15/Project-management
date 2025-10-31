"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Plus, Building2, Users } from "lucide-react";

type Workspace = { id: string; name: string; createdAt: string; owner?: { id: string; name?: string | null; email: string } };

export default function WorkspacesPage() {
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [wsName, setWsName] = useState("");

	async function load() {
		try {
			setLoading(true);
			const data = await apiFetch<{ workspaces: Workspace[] }>("/api/workspaces");
			setWorkspaces(data.workspaces);
			setError(null);
		} catch (err: any) {
			setError(err.message || "Failed to load workspaces");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
	}, []);

	async function createWorkspace(e: React.FormEvent) {
		e.preventDefault();
		if (!wsName.trim()) return;
		try {
			await apiFetch("/api/workspaces", { method: "POST", body: JSON.stringify({ name: wsName.trim() }) });
			setWsName("");
			setCreating(false);
			await load();
		} catch (err: any) {
			setError(err.message || "Failed to create workspace");
		}
	}

	if (loading) {
		return (
			<div className="max-w-7xl mx-auto p-8">
				<div className="text-center py-12">Loading workspaces...</div>
			</div>
		);
	}

	return (
		<div className="max-w-7xl mx-auto p-8">
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<Building2 className="w-8 h-8 text-blue-600" />
					<h1 className="text-3xl font-bold">My Workspaces</h1>
				</div>
				<button onClick={() => setCreating(!creating)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
					<Plus size={20} />
					Create Workspace
				</button>
			</div>

			{creating && (
				<div className="mb-6 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
					<form onSubmit={createWorkspace} className="flex items-center gap-2">
						<input className="flex-1 border rounded px-3 py-2" placeholder="Enter workspace name..." value={wsName} onChange={(e) => setWsName(e.target.value)} />
						<button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors" type="submit">Create</button>
						<button type="button" onClick={() => { setCreating(false); setWsName(""); }} className="px-4 py-2 rounded border">Cancel</button>
					</form>
				</div>
			)}

			{error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600">{error}</div>}

			<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{workspaces.length === 0 ? (
					<div className="col-span-full text-center py-12">
						<Building2 className="w-16 h-16 text-zinc-400 mx-auto mb-4" />
						<p className="text-zinc-600 dark:text-zinc-400 mb-4 text-lg">No workspaces yet</p>
						<p className="text-zinc-500 dark:text-zinc-500 mb-6">Create your first workspace to get started with project management</p>
						<Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
							<Plus size={20} />
							Create your first workspace
						</Link>
					</div>
				) : (
					workspaces.map((w) => (
						<Link key={w.id} href={`/workspaces/${w.id}`} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all">
							<div className="flex items-start justify-between mb-3">
								<div className="flex items-center gap-2">
									<Building2 className="w-5 h-5 text-blue-600" />
									<h3 className="font-semibold text-lg">{w.name}</h3>
								</div>
								<Users className="w-4 h-4 text-zinc-400" />
							</div>
							<div className="space-y-2 text-sm">
								<p className="text-zinc-500 dark:text-zinc-400">
									Created {new Date(w.createdAt).toLocaleDateString()}
								</p>
								{w.owner && (
									<p className="text-zinc-400 dark:text-zinc-500 text-xs">
										Owner: {w.owner.name || w.owner.email.split("@")[0]}
									</p>
								)}
							</div>
							<div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
								<span className="text-blue-600 hover:underline text-sm font-medium">View workspace →</span>
							</div>
						</Link>
					))
				)}
			</div>
		</div>
	);
}

