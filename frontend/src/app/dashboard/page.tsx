"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useApiData } from "@/hooks/useApiData";

type OverviewItem = { id: string; name: string; role: string; projects: number; activeTasks: number };
type RoleCounts = Record<string, number>;
type Activity = { id: string; action: string; targetType: string; createdAt: string; workspace: { id: string; name: string }; user: { name?: string | null; email: string } };
type MyTask = { id: string; title: string; status: string; dueDate?: string | null; project: { id: string; name: string; workspace: { id: string; name: string } } };

export default function DashboardPage() {
    const [overview, setOverview] = useState<OverviewItem[]>([]);
    const [roleCounts, setRoleCounts] = useState<RoleCounts>({});
    const [stats, setStats] = useState<{ workspaces: number; projects: number; activeTasks: number; completedTasks: number; assignedToMe: number; overdueTasks: number } | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [myTasks, setMyTasks] = useState<MyTask[]>([]);
    const [error, setError] = useState<string | null>(null);

    async function loadAll() {
        try {
            const [ov, st, act, mine] = await Promise.all([
                apiFetch<{ workspaces: OverviewItem[]; roleCounts: RoleCounts }>("/api/dashboard/overview"),
                apiFetch<{ workspaces: number; projects: number; activeTasks: number; completedTasks: number; assignedToMe: number; overdueTasks: number }>("/api/dashboard/stats"),
                apiFetch<{ activities: Activity[] }>("/api/dashboard/activities"),
                apiFetch<{ tasks: MyTask[] }>("/api/dashboard/my-tasks"),
            ]);
            setOverview(ov.workspaces);
            setRoleCounts(ov.roleCounts || {});
            setStats(st);
            setActivities(act.activities || []);
            setMyTasks(mine.tasks || []);
            setError(null);
        } catch (err: any) {
            setError(err.message || "Failed to load dashboard");
        }
    }

    useEffect(() => { loadAll(); }, []);

	return (
		<div className="max-w-7xl mx-auto p-8">
            {/* Welcome */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2">Welcome back!</h1>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                    You’re part of {overview.length} workspaces
                    {roleCounts["OWNER"] ? ` — ${roleCounts["OWNER"]} as Owner` : ""}
                    {roleCounts["MEMBER"] ? `, ${roleCounts["MEMBER"]} as Member` : ""}
                    {roleCounts["VIEWER"] ? `, ${roleCounts["VIEWER"]} as Viewer` : ""}
                </p>
                <Link className="inline-block mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors" href="/workspaces">+ Create Workspace</Link>
            </div>
			{error && <p className="text-red-600 mb-4">{error}</p>}

            {/* Quick Stats */}
            {stats && (
                <div className="mb-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Workspaces", val: stats.workspaces },
                            { label: "Projects", val: stats.projects },
                            { label: "Active Tasks", val: stats.activeTasks },
                            { label: "Completed", val: stats.completedTasks },
                        ].map((c) => (
                            <div key={c.label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded p-4">
                                <div className="text-2xl font-bold">{c.val}</div>
                                <div className="text-sm text-zinc-500">{c.label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                        Assigned to Me: {stats.assignedToMe} • Overdue: {stats.overdueTasks}
                    </div>
                </div>
            )}

            {/* Workspaces Overview */}
            <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">My Workspaces</h2>
                <div className="overflow-x-auto border rounded">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-900">
                            <tr className="text-left">
                                <th className="px-3 py-2">Workspace</th>
                                <th className="px-3 py-2">Role</th>
                                <th className="px-3 py-2">Projects</th>
                                <th className="px-3 py-2">Active Tasks</th>
                                <th className="px-3 py-2">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overview.slice(0, 5).map((w) => (
                                <tr key={w.id} className="border-t">
                                    <td className="px-3 py-2 font-medium">{w.name}</td>
                                    <td className="px-3 py-2">{w.role}</td>
                                    <td className="px-3 py-2">{w.projects}</td>
                                    <td className="px-3 py-2">{w.activeTasks}</td>
                                    <td className="px-3 py-2">
                                        <Link className="text-blue-600 hover:underline" href={`/workspaces/${w.id}`}>Open →</Link>
                                    </td>
                                </tr>
                            ))}
                            {overview.length === 0 && (
                                <tr><td className="px-3 py-3 text-zinc-500" colSpan={5}>No workspaces yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {overview.length > 5 && (
                    <div className="mt-2 text-right">
                        <Link className="text-sm text-blue-600 hover:underline" href="/workspaces">View All →</Link>
                    </div>
                )}
            </div>

            {/* Recent Activities + My Tasks */}
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <h2 className="text-lg font-semibold mb-3">Recent Activities</h2>
                    <ul className="space-y-2 max-h-80 overflow-y-auto">
                        {activities.slice(0, 6).map((a) => (
                            <li key={a.id} className="text-sm border rounded p-2">
                                <div className="text-zinc-500 text-xs">{new Date(a.createdAt).toLocaleString()} • {a.workspace.name}</div>
                                <div>
                                    <span className="mr-1" aria-hidden>
                                        {a.targetType === "task" ? "📝" : a.targetType === "project" ? "🧱" : "🔁"}
                                    </span>
                                    <span className="font-medium">{a.user.name || a.user.email}</span> — {a.action}
                                </div>
                            </li>
                        ))}
                        {activities.length === 0 && <li className="text-zinc-500 text-sm">No recent activity.</li>}
                    </ul>
                </div>
                <div>
                    <h2 className="text-lg font-semibold mb-3">My Active Tasks</h2>
                    <ul className="space-y-2 max-h-80 overflow-y-auto">
                        {myTasks.slice(0, 6).map((t) => {
                            const now = Date.now();
                            const dueMs = t.dueDate ? new Date(t.dueDate).getTime() : null;
                            const isOverdue = dueMs !== null && dueMs < now && t.status !== "DONE";
                            const isDueSoon = dueMs !== null && dueMs >= now && (dueMs - now) < 3 * 24 * 60 * 60 * 1000; // 3 days
                            return (
                                <li key={t.id} className="text-sm border rounded p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                                    <Link href={`/projects/${t.project.id}?taskId=${t.id}`} className="block">
                                        <div className="font-medium flex items-center gap-2">
                                            {t.title}
                                            {isOverdue && (<span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Overdue</span>)}
                                            {!isOverdue && isDueSoon && (<span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">Due soon</span>)}
                                        </div>
                                        <div className="text-xs text-zinc-500">{t.project.name} • {t.project.workspace.name} • {t.status} {t.dueDate ? `• Due: ${new Date(t.dueDate).toLocaleDateString()}` : ""}</div>
                                    </Link>
                                </li>
                            );
                        })}
                        {myTasks.length === 0 && <li className="text-zinc-500 text-sm">No active tasks assigned to you.</li>}
                    </ul>
                </div>
            </div>
		</div>
	);
}



