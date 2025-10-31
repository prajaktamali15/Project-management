"use client";
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { CheckCircle2, Clock, AlertCircle, FileText, Calendar } from "lucide-react";

type Task = {
	id: string;
	number?: number | null;
	title: string;
	description?: string | null;
	status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
	priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	dueDate?: string | null;
	project: {
		id: string;
		name: string;
		workspace: {
			id: string;
			name: string;
		};
	};
};

const statusColors = {
	TODO: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
	IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	DONE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const priorityColors = {
	LOW: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	URGENT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function MyTasksPage() {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filterStatus, setFilterStatus] = useState<string>("ALL");
	const [selectedTask, setSelectedTask] = useState<Task | null>(null);
	const [completeFiles, setCompleteFiles] = useState<FileList | null>(null);
	const [completing, setCompleting] = useState(false);
	const [reviewStatusByTask, setReviewStatusByTask] = useState<Record<string, { type: "approved" | "changes"; message: string; reviewerName: string; timestamp: number }>>({});
	const completeErrorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		loadTasks();
	}, [filterStatus]);

	// Auto-refresh when window gains focus and periodic polling to reflect approvals quickly
	useEffect(() => {
		function onFocus() {
			loadTasks();
		}
		if (typeof window !== "undefined") {
			window.addEventListener("focus", onFocus);
		}
		const interval = setInterval(() => {
			loadTasks();
		}, 20000);
		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener("focus", onFocus);
			}
			clearInterval(interval);
		};
	}, []);

	// Load reviewer decisions for tasks in REVIEW to show badges (Approved / Changes requested)
	useEffect(() => {
		async function loadDecisions(forTasks: Task[]) {
			const reviewTasks = forTasks.filter((t) => t.status === "REVIEW");
			if (!reviewTasks.length) { setReviewStatusByTask({}); return; }
			try {
				const results = await Promise.all(
					reviewTasks.map(async (t) => {
						try {
							const data = await apiFetch<{ comments: Array<{ id: string; content: string; createdAt?: string; author: { id: string; name?: string | null; email: string } }> }>(`/api/tasks/${t.id}/comments`);
							let latest: { type: "approved" | "changes"; message: string; reviewerName: string; timestamp: number } | null = null;
							for (const c of data.comments || []) {
								const ts = c.createdAt ? new Date(c.createdAt).getTime() : 0;
								const content = c.content || "";
								if (/^approved\b/i.test(content) || /\bapproved\b/i.test(content)) {
									if (!latest || ts > latest.timestamp) {
										latest = { type: "approved", message: content, reviewerName: c.author.name || c.author.email, timestamp: ts };
									}
								} else if (/^changes needed:/i.test(content) || /\bchanges requested\b/i.test(content)) {
									if (!latest || ts > latest.timestamp) {
										latest = { type: "changes", message: content, reviewerName: c.author.name || c.author.email, timestamp: ts };
									}
								}
							}
							return [t.id, latest] as const;
						} catch {
							return [t.id, null] as const;
						}
					})
				);
				const map: Record<string, { type: "approved" | "changes"; message: string; reviewerName: string; timestamp: number }> = {};
				for (const [taskId, decision] of results) {
					if (decision) map[taskId] = decision;
				}
				setReviewStatusByTask(map);
			} catch {
				setReviewStatusByTask({});
			}
		}
		loadDecisions(tasks);
	}, [tasks]);

	useEffect(() => {
		if (selectedTask && error && completeErrorRef.current) {
			completeErrorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}, [error, selectedTask]);

	async function loadTasks() {
		try {
			setLoading(true);
			const params = new URLSearchParams();
			if (filterStatus !== "ALL") {
				params.append("status", filterStatus);
			}
			const data = await apiFetch<{ tasks: Task[] }>(`/api/tasks/my-tasks?${params.toString()}`);
			setTasks(data.tasks || []);
			setError(null);
		} catch (err: any) {
			setError(err.message || "Failed to load tasks");
		} finally {
			setLoading(false);
		}
	}

	async function completeTask() {
		if (!selectedTask || completing) return;
		try {
			setCompleting(true);
			
			// Upload files first if any
			if (completeFiles && completeFiles.length > 0) {
				const form = new FormData();
				for (const f of Array.from(completeFiles)) {
					form.append("files", f);
					// @ts-ignore
					if (f.webkitRelativePath) form.append("paths", f.webkitRelativePath as string);
					else form.append("paths", f.name);
				}
				await apiFetch(`/api/tasks/${selectedTask.id}/attachments`, { method: "POST", body: form });
			}

			// Then mark task as DONE
			await apiFetch(`/api/tasks/${selectedTask.id}`, { method: "PUT", body: JSON.stringify({ status: "DONE" }) });
			setCompleteFiles(null);
			setSelectedTask(null);
			await loadTasks();
		} catch (e: any) {
			const msg = String(e?.message || "");
			if (msg.includes("Completion requires approval")) {
				setError("Completion requires approval by owner or admin. Please wait for approval after review.");
			} else if (msg.includes("Blocked by dependencies")) {
				const details = msg.split(":")[1]?.trim() || "prerequisite tasks first";
				setError(`This task is blocked by dependencies. Please complete ${details}.`);
			} else {
				setError(msg || "Failed to complete task");
			}
		} finally {
			setCompleting(false);
		}
	}

	function updateTaskStatus(taskId: string, newStatus: Task["status"]) {
		apiFetch(`/api/tasks/${taskId}`, {
			method: "PUT",
			body: JSON.stringify({ status: newStatus }),
		})
			.then(() => loadTasks())
			.catch((e: any) => {
				const msg = String(e?.message || "");
				if (msg.includes("Completion requires approval")) {
					setError("Completion requires approval by owner or admin. Please wait for approval after review.");
				} else if (msg.includes("Can complete only after review")) {
					setError("You can complete only after approval (in Review).");
				} else if (msg.includes("Can request review only from In Progress")) {
					setError("Please move the task back to In Progress and then submit for review again.");
				} else if (msg.includes("Blocked by dependencies")) {
					const details = msg.split(":")[1]?.trim() || "prerequisite tasks first";
					setError(`This task is blocked by dependencies. Please complete ${details}.`);
				} else {
					setError(msg || "Failed to update status");
				}
			});
	}

	async function reRequestReview(task: Task) {
		try {
			if (task.status === "REVIEW") {
				await apiFetch(`/api/tasks/${task.id}`, { method: "PUT", body: JSON.stringify({ status: "IN_PROGRESS" }) });
			}
			await apiFetch(`/api/tasks/${task.id}`, { method: "PUT", body: JSON.stringify({ status: "REVIEW" }) });
			await loadTasks();
			setError(null);
		} catch (e: any) {
			const msg = String(e?.message || "");
			if (msg.includes("Can request review only from In Progress")) {
				setError("We tried to re-submit. Please try again.");
			} else {
				setError(msg || "Failed to submit for review");
			}
		}
	}

	const filteredTasks = tasks.filter((t) => filterStatus === "ALL" || t.status === filterStatus);
	const todoCount = tasks.filter((t) => t.status === "TODO").length;
	const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;
	const reviewCount = tasks.filter((t) => t.status === "REVIEW").length;
	const doneCount = tasks.filter((t) => t.status === "DONE").length;

	if (loading) {
		return (
			<div className="max-w-6xl mx-auto p-8">
				<div className="text-center py-12">Loading your tasks...</div>
			</div>
		);
	}

	return (
		<div className="max-w-6xl mx-auto p-8">
			<div className="mb-6">
				<h1 className="text-3xl font-bold mb-2">My Tasks</h1>
				<p className="text-zinc-600 dark:text-zinc-400">Tasks assigned to you across all projects</p>
			</div>

			{error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600">{error}</div>}

			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
					<div className="flex items-center gap-2 mb-1">
						<Clock className="w-5 h-5 text-blue-600" />
						<span className="text-sm text-zinc-600 dark:text-zinc-400">To Do</span>
					</div>
					<div className="text-2xl font-bold">{todoCount}</div>
				</div>
				<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
					<div className="flex items-center gap-2 mb-1">
						<AlertCircle className="w-5 h-5 text-orange-600" />
						<span className="text-sm text-zinc-600 dark:text-zinc-400">In Progress</span>
					</div>
					<div className="text-2xl font-bold">{inProgressCount}</div>
				</div>
				<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
					<div className="flex items-center gap-2 mb-1">
						<FileText className="w-5 h-5 text-yellow-600" />
						<span className="text-sm text-zinc-600 dark:text-zinc-400">Review</span>
					</div>
					<div className="text-2xl font-bold">{reviewCount}</div>
				</div>
				<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
					<div className="flex items-center gap-2 mb-1">
						<CheckCircle2 className="w-5 h-5 text-emerald-600" />
						<span className="text-sm text-zinc-600 dark:text-zinc-400">Done</span>
					</div>
					<div className="text-2xl font-bold">{doneCount}</div>
				</div>
			</div>

			<div className="mb-4">
				<select
					className="border rounded px-3 py-2 bg-white dark:bg-zinc-900"
					value={filterStatus}
					onChange={(e) => setFilterStatus(e.target.value)}
				>
					<option value="ALL">All Tasks</option>
					<option value="TODO">To Do</option>
					<option value="IN_PROGRESS">In Progress</option>
					<option value="REVIEW">Review</option>
					<option value="DONE">Done</option>
				</select>
			</div>

			<div className="space-y-3">
				{filteredTasks.length === 0 ? (
					<div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
						<p>No tasks found.</p>
					</div>
				) : (
					filteredTasks.map((task) => (
						<div
							key={task.id}
							className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:shadow-md transition-shadow"
						>
							<div className="flex items-start justify-between mb-3">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-2">
										<h3 className="font-semibold text-lg">{task.title}</h3>
								<span className={`text-xs px-2 py-1 rounded ${statusColors[task.status]}`}>
											{task.status}
										</span>
								{task.status === "REVIEW" && reviewStatusByTask[task.id]?.type === "approved" && (
									<span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
										Approved
									</span>
								)}
								{task.status === "REVIEW" && reviewStatusByTask[task.id]?.type === "changes" && (
									<span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
										Changes requested
									</span>
								)}
										<span className={`text-xs px-2 py-1 rounded ${priorityColors[task.priority]}`}>
											{task.priority}
										</span>
									</div>
									{task.description && (
										<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{task.description}</p>
									)}
									<div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
										<span>Project: <Link href={`/projects/${task.project.id}`} className="text-blue-600 hover:underline">{task.project.name}</Link></span>
										<span>Workspace: {task.project.workspace.name}</span>
										{task.dueDate && (
											<span className="flex items-center gap-1">
												<Calendar className="w-4 h-4" />
												Due: {new Date(task.dueDate).toLocaleDateString()}
											</span>
										)}
									</div>
								</div>
							</div>
					<div className="flex items-center gap-2 mt-4">
								{task.status !== "DONE" && (
									<>
										<button
											onClick={() => updateTaskStatus(task.id, task.status === "TODO" ? "IN_PROGRESS" : task.status === "IN_PROGRESS" ? "REVIEW" : "DONE")}
											className="px-3 py-1 text-sm border rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
										>
											{task.status === "TODO" ? "Start" : task.status === "IN_PROGRESS" ? "Mark for Review" : "Complete"}
										</button>
								{task.status === "REVIEW" && (
									<button
										onClick={() => reRequestReview(task)}
										className="px-3 py-1 text-sm border rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
									>
										Re-Request Review
									</button>
								)}
										<button
											onClick={() => setSelectedTask(task)}
											className="px-3 py-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
										>
											Complete with Files
										</button>
									</>
								)}
							</div>
						</div>
					))
				)}
			</div>

			{selectedTask && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTask(null)}>
					<div className="bg-white dark:bg-zinc-900 rounded-lg max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-start mb-4">
							<h2 className="text-xl font-bold">Complete Task</h2>
							<button onClick={() => setSelectedTask(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 text-2xl">×</button>
						</div>
						<p className="mb-4 text-zinc-600 dark:text-zinc-400">{selectedTask.title}</p>
						{error && selectedTask && (
							<div
								ref={completeErrorRef}
								className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 font-semibold text-sm text-center"
								aria-live="polite"
							>
								{error}
							</div>
						)}
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium mb-2">Upload files/folders (optional)</label>
								<input
									type="file"
									multiple
									// @ts-ignore
									webkitdirectory="true"
									directory="true"
									className="w-full border rounded px-3 py-2"
									onChange={(e) => setCompleteFiles(e.target.files)}
								/>
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => setSelectedTask(null)}
									className="flex-1 px-4 py-2 border rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={completeTask}
									disabled={completing}
									className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors disabled:opacity-50"
								>
									{completing ? "Completing..." : "Mark Complete"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

