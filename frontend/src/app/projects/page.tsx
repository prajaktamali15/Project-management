"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { FolderKanban, Briefcase } from "lucide-react";

type Project = { id: string; name: string; description?: string | null; workspaceId: string; status?: string };

export default function ProjectsPage() {
	const [projects, setProjects] = useState<Project[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	async function load() {
    try {
        setLoading(true);
        // Fetch projects across all accessible workspaces directly
        const data = await apiFetch<{ projects: Project[] }>("/api/projects");
        setProjects(data.projects);
        setError(null);
    } catch (err: any) {
			setError(err.message || "Failed to load projects");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
	}, []);

	if (loading) {
		return (
			<div className="max-w-7xl mx-auto p-8">
				<div className="text-center py-12">Loading projects...</div>
			</div>
		);
	}

	return (
		<div className="max-w-7xl mx-auto p-8">
			<div className="flex items-center gap-3 mb-6">
				<Briefcase className="w-8 h-8 text-blue-600" />
				<h1 className="text-3xl font-bold">My Projects</h1>
			</div>

			{error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600">{error}</div>}

			<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{projects.length === 0 ? (
					<div className="col-span-full text-center py-12">
						<FolderKanban className="w-16 h-16 text-zinc-400 mx-auto mb-4" />
						<p className="text-zinc-600 dark:text-zinc-400 mb-4 text-lg">No projects yet</p>
						<p className="text-zinc-500 dark:text-zinc-500 mb-6">You haven't been added to any projects. Ask a workspace admin to add you to a project.</p>
						<Link href="/workspaces" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
							View Workspaces
						</Link>
					</div>
				) : (
					projects.map((p) => (
						<Link key={p.id} href={`/projects/${p.id}`} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all">
							<div className="flex items-start justify-between mb-3">
									<div className="flex items-center gap-2">
									<FolderKanban className="w-5 h-5 text-blue-600" />
									<h3 className="font-semibold text-lg">{p.name}</h3>
								</div>
								{p.status && (
									<span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded">
										{p.status}
									</span>
								)}
							</div>
							{p.description && <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-2">{p.description}</p>}
							<div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
								<span className="text-blue-600 hover:underline text-sm font-medium">Open project →</span>
							</div>
						</Link>
					))
				)}
			</div>
		</div>
	);
}
