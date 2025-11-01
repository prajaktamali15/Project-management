"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
	DndContext,
	DragEndEvent,
	DragOverlay,
	DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	closestCorners,
	useDroppable,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import React from "react";

type Task = {
	id: string;
	number?: number;
	title: string;
	description?: string | null;
	status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
	priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	dueDate?: string | null;
	assignee?: { id: string; name?: string | null; email: string } | null;
};

type Project = { id: string; name: string; workspaceId: string; status?: "PLANNED" | "ACTIVE" | "COMPLETED" | "ON_HOLD"; description?: string | null; createdAt?: string; updatedAt?: string; workspace?: { ownerId?: string } };

const statuses: Task["status"][] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];

function TaskCard({ task, onClick, canDrag }: { task: Task; onClick: () => void; canDrag: boolean }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
		id: task.id,
		disabled: !canDrag
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const priorityColors = {
		LOW: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
		MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
		HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
		URGENT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...(canDrag ? { ...attributes, ...listeners } : {})}
			onClick={onClick}
			className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
		>
			<div className="flex items-start justify-between mb-2">
				<h4 className="font-medium text-sm flex-1 line-clamp-2">
					{task.number ? `#${task.number} ` : ""}{task.title}
				</h4>
				<span className={`text-xs px-2 py-0.5 rounded ml-2 ${priorityColors[task.priority]}`}>{task.priority}</span>
			</div>
			{task.description && <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2 line-clamp-2">{task.description}</p>}
			<div className="flex items-center justify-between mt-2">
				{task.assignee && (
					<span className="text-xs text-zinc-500 dark:text-zinc-400">
						{task.assignee.name || task.assignee.email.split("@")[0]}
					</span>
				)}
				{task.dueDate && (
					<span className="text-xs text-zinc-500 dark:text-zinc-400">{new Date(task.dueDate).toLocaleDateString()}</span>
				)}
			</div>
		</div>
	);
}

function TaskColumn({ title, tasks, status, onTaskClick, canDrag }: { title: string; tasks: Task[]; status: Task["status"]; onTaskClick: (task: Task) => void; canDrag: boolean }) {
	const { setNodeRef, isOver } = useDroppable({
		id: status,
	});

	return (
		<div ref={setNodeRef} className={`flex-1 min-w-0 ${isOver ? "bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-2" : ""}`}>
			<h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
				{title} ({tasks.length})
			</h3>
			<SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
				<div className="space-y-2 min-h-[100px]">
					{tasks.map((task) => (
						<TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} canDrag={canDrag} />
					))}
				</div>
			</SortableContext>
		</div>
	);
}

// Helper for search/multi-select - define above Component
function TaskDependencySelector({
  tasks,
  selected,
  setSelected,
  excludeTaskId,
  placeholder
}: {
  tasks: Task[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  excludeTaskId?: string;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filteredTasks = tasks.filter(t => t.id !== excludeTaskId && (
    t.title.toLowerCase().includes(search.toLowerCase()) || String(t.number ?? "").includes(search)
  ));

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (inputRef.current && !inputRef.current.parentElement?.contains(e.target as any)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick, { capture: true });
    return () => document.removeEventListener("mousedown", onDocClick, { capture: true });
  }, [open]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        tabIndex={0}
        className="w-full border rounded-t px-3 py-2 bg-white dark:bg-zinc-900 text-sm"
        placeholder={placeholder || "Search tasks..."}
        value={search}
        onFocus={() => setOpen(true)}
        onChange={e => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') e.preventDefault();
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      />
      {(open && (search.length > 0 || filteredTasks.length > 0)) && (
        <div className="max-h-40 overflow-y-auto border border-t-0 rounded-b bg-white dark:bg-zinc-900 shadow-md absolute z-10 w-full" aria-label="Task dependencies" tabIndex={-1} role="listbox">
          {filteredTasks.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-400">No tasks match</div>
          )}
          {filteredTasks.map(t => (
            <div
              key={t.id}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-zinc-800 ${selected.includes(t.id) ? "bg-blue-50 dark:bg-blue-900/40" : ""}`}
              role="option"
              aria-selected={selected.includes(t.id)}
              tabIndex={0}
              onClick={() => {
                setSelected(
                  selected.includes(t.id)
                    ? selected.filter(id => id !== t.id)
                    : [...selected, t.id]
                );
                setTimeout(() => { setOpen(false); }, 40);
                if (inputRef.current) inputRef.current.blur();
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(
                    selected.includes(t.id)
                      ? selected.filter(id => id !== t.id)
                      : [...selected, t.id]
                  );
                  setTimeout(() => { setOpen(false); }, 40);
                  if (inputRef.current) inputRef.current.blur();
                }
              }}
            >
              <input type="checkbox" className="accent-blue-600" checked={selected.includes(t.id)} readOnly tabIndex={-1} />
              <span className="text-xs font-mono text-zinc-500">{t.number ? `#${t.number}` : ""}</span>
              <span className="font-medium text-sm flex-1">{t.title}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${t.status === "DONE" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}`}>{t.status}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1 mt-2">
        {selected.map(selId => {
          const t = tasks.find(t => t.id === selId);
          if (!t) return null;
          return (
            <span key={t.id} className="inline-flex items-center text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded px-2 py-0.5 mr-1 mb-1">
              {(t.number ? `#${t.number} ` : "") + t.title}
              <button type="button" className="ml-2 text-blue-600 hover:text-blue-800" onClick={() => setSelected(selected.filter(id => id !== t.id))}>×</button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function ProjectPage() {
	const params = useParams<{ id: string }>();
	const projectId = params.id;
    const searchParams = useSearchParams();
    const router = useRouter();

    function closeTaskModalAndClearQuery() {
        const taskId = searchParams.get("taskId");
        if (taskId) {
            const current = new URL(window.location.href);
            current.searchParams.delete("taskId");
            router.replace(current.toString());
        }
        setShowTaskModal(false);
    }

	const [project, setProject] = useState<Project | null>(null);
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [showTaskModal, setShowTaskModal] = useState(false);
	const [selectedTask, setSelectedTask] = useState<Task | null>(null);
	const [completeFiles, setCompleteFiles] = useState<FileList | null>(null);
	const [isCreating, setIsCreating] = useState(false);
    const [membersForAssignee, setMembersForAssignee] = useState<Array<{ id: string; email: string; name?: string | null }>>([]);
    const [stats, setStats] = useState<{ totalTasks: number; completedTasks: number; completionPercent: number } | null>(null);

	const [createFiles, setCreateFiles] = useState<FileList | null>(null);

	const [newTask, setNewTask] = useState({
		title: "",
		description: "",
		status: "TODO" as Task["status"],
		priority: "MEDIUM" as Task["priority"],
		dueDate: "",
		assigneeId: "",
	});

	const [activeTask, setActiveTask] = useState<Task | null>(null);

	const [showSettings, setShowSettings] = useState(false);
	const [canEditProject, setCanEditProject] = useState(false);
	const [canCreateTask, setCanCreateTask] = useState(false);
	const [editName, setEditName] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [editStatus, setEditStatus] = useState<Project["status"]>("PLANNED");
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [taskAttachments, setTaskAttachments] = useState<Array<{ id: string; url: string; fileName: string; uploaderId?: string | null }>>([]);
	const backendBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

	// Review request state for assignee
	const [reviewMessage, setReviewMessage] = useState("");
	const [reviewFiles, setReviewFiles] = useState<FileList | null>(null);
	const [latestReviewMsg, setLatestReviewMsg] = useState<string>("");
	const [showHistory, setShowHistory] = useState(false);
	const [historyItems, setHistoryItems] = useState<Array<{ id: string; action: string; createdAt?: string; user?: { id: string; name?: string | null; email: string }; metadata?: any }>>([]);

	// Dependencies state
	const [currentTaskDependencies, setCurrentTaskDependencies] = useState<Array<{ dependsOn: { id: string; title: string; status: string; number?: number | null } }>>([]);
	const [editDependencies, setEditDependencies] = useState<string[]>([]);
	const [createDependencies, setCreateDependencies] = useState<string[]>([]);

	// Derived review decision/banner data
	const [taskCommentsForModal, setTaskCommentsForModal] = useState<Array<{ id: string; content: string; createdAt?: string; author: { id: string; name?: string | null; email: string } }>>([]);
	const [lastAssigneeReviewAt, setLastAssigneeReviewAt] = useState<number | null>(null);
	const [lastReviewerDecision, setLastReviewerDecision] = useState<null | {
		type: "approved" | "changes";
		message: string;
		reviewerName: string;
		timestamp: number;
	}>(null);

	// Task editing state (for OWNER/ADMIN)
	const [isEditingTask, setIsEditingTask] = useState(false);
	const [editTaskTitle, setEditTaskTitle] = useState("");
	const [editTaskDescription, setEditTaskDescription] = useState("");
	const [editTaskPriority, setEditTaskPriority] = useState<Task["priority"]>("MEDIUM");
	const [editTaskDueDate, setEditTaskDueDate] = useState<string>("");
	const [editTaskAssigneeId, setEditTaskAssigneeId] = useState<string>("");
	const [editTaskStatus, setEditTaskStatus] = useState<Task["status"]>("TODO");

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	async function loadProject() {
		try {
			const data = await apiFetch<{ project: Project }>(`/api/projects/${projectId}`);
			setProject(data.project);
			setEditName(data.project.name || "");
			setEditDescription(data.project.description || "");
			setEditStatus((data.project.status as any) || "PLANNED");

			// Determine permission: owner/admin can edit
			const userStr = localStorage.getItem("user");
			let canEdit = false;
			let canCreate = false;
			if (userStr) {
				const user = JSON.parse(userStr);
				if (data.project.workspace?.ownerId === user.id) {
					canEdit = true;
					canCreate = true;
				} else {
					try {
						const wsMembers = await apiFetch<{ members: Array<{ userId: string; role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" }> }>(`/api/workspaces/${data.project.workspaceId}/members`);
						const me = wsMembers.members.find((m) => m.userId === user.id);
						if (me && (me.role === "OWNER" || me.role === "ADMIN")) {
							canEdit = true;
							canCreate = true;
						} else if (me && me.role === "ADMIN") {
							// Check project admin too
							try {
								const members = await apiFetch<{ members: Array<{ userId: string; role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" }> }>(`/api/projects/${projectId}/members`);
								const projMe = members.members.find((m) => m.userId === user.id);
								if (projMe && projMe.role === "ADMIN") canEdit = true;
							} catch {}
						}
					} catch {}
				}
			}
			setCanEditProject(canEdit);
			setCanCreateTask(canCreate);

			// Load workspace members for assignee select
			try {
				if (data.project.workspaceId) {
					const wsMembers = await apiFetch<{ members: Array<{ userId: string; user: { id: string; email: string; name?: string | null } }> }>(`/api/workspaces/${data.project.workspaceId}/members`);
					setMembersForAssignee(wsMembers.members.map(m => ({ id: m.user.id, email: m.user.email, name: m.user.name })));
				}
			} catch {}

			// Load stats
			try {
				const s = await apiFetch<{ totalTasks: number; completedTasks: number; completionPercent: number }>(`/api/projects/${projectId}/stats`);
				setStats(s);
			} catch {}

		} catch (e: any) {
			setError(e.message || "Failed to load project");
		}
	}

	async function requestReview() {
		if (!selectedTask) return;
		try {
			// Upload files if any
			if (reviewFiles && reviewFiles.length > 0) {
				const form = new FormData();
				for (const f of Array.from(reviewFiles)) {
					form.append("files", f);
					// @ts-ignore
					if (f.webkitRelativePath) form.append("paths", f.webkitRelativePath as string);
					else form.append("paths", f.name);
				}
				await apiFetch(`/api/tasks/${selectedTask.id}/attachments`, { method: "POST", body: form });
			}

			// Post review message as a comment (optional)
			if (reviewMessage.trim()) {
				await apiFetch(`/api/tasks/${selectedTask.id}/comments`, { method: "POST", body: JSON.stringify({ content: reviewMessage.trim() }) });
			}

			// Ensure backend transition respects constraint: REVIEW only from IN_PROGRESS
			if (selectedTask.status === "REVIEW") {
				await apiFetch(`/api/tasks/${selectedTask.id}`, { method: "PUT", body: JSON.stringify({ status: "IN_PROGRESS" }) });
			}
			await apiFetch(`/api/tasks/${selectedTask.id}`, { method: "PUT", body: JSON.stringify({ status: "REVIEW" }) });
			setReviewFiles(null);
			setReviewMessage("");
			// Mark new review request time so prior decisions hide until a new decision
			setLastAssigneeReviewAt(Date.now());
			setLastReviewerDecision(null);
			await loadTasks();
			// refresh attachments and comments
			try {
				const data = await apiFetch<{ attachments: Array<{ id: string; url: string; fileName: string; uploaderId?: string | null }> }>(`/api/tasks/${selectedTask.id}/attachments`);
				setTaskAttachments(data.attachments || []);
			} catch {}
		} catch (e: any) {
			const msg = String(e?.message || "");
			if (msg.includes("Can request review only from In Progress")) {
				setError("Please re-submit review after addressing feedback. We moved it back to In Progress automatically if needed.");
			} else if (msg.includes("Blocked by dependencies")) {
				const details = msg.split(":")[1]?.trim() || "prerequisite tasks first";
				setError(`This task is blocked by dependencies. Please complete ${details}.`);
			} else if (msg.includes("Circular dependency detected")) {
				setError("Cannot create circular dependency. Please check your task chain and remove loops.");
			} else {
				setError(msg || "Failed to request review");
			}
		}
	}

	async function postOwnerComment(text: string) {
		if (!selectedTask || !text.trim()) return;
		try {
			await apiFetch(`/api/tasks/${selectedTask.id}/comments`, { method: "POST", body: JSON.stringify({ content: text.trim() }) });
		} catch {}
	}

	async function loadTasks() {
		try {
			const data = await apiFetch<{ items: Task[] }>(`/api/tasks?projectId=${projectId}`);
			setTasks(data.items);
			setError(null);
		} catch (e: any) {
			setError(e.message || "Failed to load tasks");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
		if (userStr) {
			try { setCurrentUserId(JSON.parse(userStr).id); } catch {}
		}
		loadProject();
		loadTasks();
	}, [projectId]);

	// Auto-open task modal if taskId is present in URL
	useEffect(() => {
		const taskId = searchParams.get("taskId");
		if (taskId && !showTaskModal && tasks && tasks.length) {
			const t = tasks.find((x) => x.id === taskId);
			if (t) {
				setSelectedTask(t);
				setShowTaskModal(true);
			}
		}
	}, [searchParams, tasks, showTaskModal]);

	// Load attachments whenever we open the modal for a task
	useEffect(() => {
		async function loadAttachments(taskId: string) {
			try {
				const data = await apiFetch<{ attachments: Array<{ id: string; url: string; fileName: string; uploaderId?: string | null }> }>(`/api/tasks/${taskId}/attachments`);
				setTaskAttachments(data.attachments || []);
			} catch {
				setTaskAttachments([]);
			}
		}
		if (showTaskModal && selectedTask) {
			loadAttachments(selectedTask.id);
			// load dependencies
			(async () => {
				try {
					const data = await apiFetch<{ dependencies: Array<{ dependsOn: { id: string; title: string; status: string; number?: number | null } }> }>(`/api/tasks/${selectedTask.id}/dependencies`);
					setCurrentTaskDependencies(data.dependencies || []);
					setEditDependencies((data.dependencies || []).map(d => d.dependsOn.id));
				} catch { setCurrentTaskDependencies([]); setEditDependencies([]); }
			})();
		} else {
			setTaskAttachments([]);
			setCurrentTaskDependencies([]);
			setEditDependencies([]);
		}
	}, [showTaskModal, selectedTask]);

	// When in REVIEW and user can review, load the latest assignee review message
	useEffect(() => {
		async function loadLatestAssigneeComment(taskId: string, assigneeId?: string) {
			if (!assigneeId) { setLatestReviewMsg(""); return; }
			try {
				const data = await apiFetch<{ comments: Array<{ id: string; content: string; createdAt?: string; author: { id: string } }> }>(`/api/tasks/${taskId}/comments`);
				const mine = data.comments?.filter(c => c.author.id === assigneeId) || [];
				const latest = mine[mine.length - 1];
				setLatestReviewMsg(latest?.content || "");
			} catch { setLatestReviewMsg(""); }
		}
		if (showTaskModal && selectedTask && canEditProject && selectedTask.status === "REVIEW") {
			loadLatestAssigneeComment(selectedTask.id, selectedTask.assignee?.id);
		} else {
			setLatestReviewMsg("");
		}
	}, [showTaskModal, selectedTask, canEditProject]);

	// Load comments for current task to compute reviewer decisions and timestamps
	useEffect(() => {
		async function loadCommentsForModal(taskId: string) {
			try {
				const data = await apiFetch<{ comments: Array<{ id: string; content: string; createdAt?: string; author: { id: string; name?: string | null; email: string } }> }>(`/api/tasks/${taskId}/comments`);
				setTaskCommentsForModal(data.comments || []);
			} catch {
				setTaskCommentsForModal([]);
			}
		}
		if (showTaskModal && selectedTask) {
			loadCommentsForModal(selectedTask.id);
		} else {
			setTaskCommentsForModal([]);
		}
	}, [showTaskModal, selectedTask]);

	// Compute last assignee review time and latest reviewer decision
	useEffect(() => {
		if (!selectedTask) { setLastAssigneeReviewAt(null); setLastReviewerDecision(null); return; }
		
		// If task is not in REVIEW, clear decision state
		if (selectedTask.status !== "REVIEW") {
			setLastAssigneeReviewAt(null);
			setLastReviewerDecision(null);
			return;
		}
		
		const assigneeId = selectedTask.assignee?.id;
		let lastAssigneeTs: number | null = null;
		let latestDecision: typeof lastReviewerDecision = null;

		// IMPORTANT: Only consider decisions that come AFTER an assignee review comment
		// AND only consider RECENT decisions (within last 5 minutes) to ignore old approvals
		// First, find the latest assignee review comment
		let latestAssigneeReviewTime: number | null = null;
		const now = Date.now();
		const fiveMinutesAgo = now - (5 * 60 * 1000); // 5 minutes - very recent only
		
		for (const c of taskCommentsForModal) {
			const ts = c.createdAt ? new Date(c.createdAt).getTime() : 0;
			if (assigneeId && c.author.id === assigneeId) {
				lastAssigneeTs = Math.max(lastAssigneeTs ?? 0, ts);
				latestAssigneeReviewTime = Math.max(latestAssigneeReviewTime ?? 0, ts);
			}
		}

		// Now find decisions - consider ALL recent decisions (within last 5 minutes)
		// This ensures freshly clicked Approve/Request Changes is detected immediately
		for (const c of taskCommentsForModal) {
			const ts = c.createdAt ? new Date(c.createdAt).getTime() : 0;
			const content = c.content || "";
			
			// Consider decision comments from non-assignee (admin/owner)
			if (!assigneeId || c.author.id !== assigneeId) {
				if ((/^approved\b/i.test(content) || /\bapproved\b/i.test(content)) || 
					(/^changes needed:/i.test(content) || /\bchanges requested\b/i.test(content))) {
					
					// Include decision if it's RECENT (within last 5 minutes)
					// OR if there's assignee review and decision is after it
					const isRecent = ts > fiveMinutesAgo;
					const isAfterAssigneeReview = latestAssigneeReviewTime !== null && ts > latestAssigneeReviewTime;
					
					// Accept decision if recent OR after assignee review
					if (isRecent || isAfterAssigneeReview) {
						if (!latestDecision || ts > latestDecision.timestamp) {
							const isApproved = /^approved\b/i.test(content) || /\bapproved\b/i.test(content);
							latestDecision = {
								type: isApproved ? "approved" : "changes",
								message: content,
								reviewerName: c.author.name || c.author.email,
								timestamp: ts,
							};
						}
					}
				}
			}
		}

		setLastAssigneeReviewAt(lastAssigneeTs);
		setLastReviewerDecision(latestDecision);
	}, [taskCommentsForModal, selectedTask]);

	// Load history when toggled
	useEffect(() => {
		async function loadHistory(taskId: string) {
			try {
				const data = await apiFetch<{ activities: typeof historyItems }>(`/api/tasks/${taskId}/history`);
				setHistoryItems(data.activities || []);
			} catch { setHistoryItems([]); }
		}
		if (showTaskModal && selectedTask && showHistory) {
			loadHistory(selectedTask.id);
		}
	}, [showHistory, showTaskModal, selectedTask]);

	async function updateProject(e: React.FormEvent) {
		e.preventDefault();
		if (!canEditProject || !project) return;
		try {
			await apiFetch(`/api/projects/${project.id}`, { method: "PUT", body: JSON.stringify({ name: editName.trim() || undefined, description: editDescription, status: editStatus }) });
			await loadProject();
			setShowSettings(false);
		} catch (e: any) {
			setError(e.message || "Failed to update project");
		}
	}

	async function deleteProject() {
		if (!canEditProject || !project) return;
		if (!confirm("Delete this project? This cannot be undone.")) return;
		try {
			await apiFetch(`/api/projects/${project.id}`, { method: "DELETE" });
			window.location.href = "/projects";
		} catch (e: any) {
			setError(e.message || "Failed to delete project");
		}
	}

	async function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;

		if (!over) {
			setActiveTask(null);
			return;
		}

		if (active.id === over.id) {
			setActiveTask(null);
			return;
		}

		const task = tasks.find((t) => t.id === active.id);
		if (!task) {
			setActiveTask(null);
			return;
		}

		// Check if dropping on a status column or on another task
		const newStatus = over.id as Task["status"];
		if (!statuses.includes(newStatus)) {
			// Might be dropping on another task, ignore for now
			setActiveTask(null);
			return;
		}

		if (task.status === newStatus) {
			setActiveTask(null);
				return;
			}

		// Only owners/admins can change task status via drag-and-drop
		// Regular assignees cannot change status this way (they must use workflow buttons)
		if (!canEditProject) {
			setError("Only workspace owners and admins can change task status.");
			setActiveTask(null);
				return;
		}

		try {
			// If moving into IN_PROGRESS/REVIEW/DONE, enforce dependencies are done
			if (["IN_PROGRESS", "REVIEW", "DONE"].includes(newStatus)) {
				try {
					const deps = await apiFetch<{ dependencies: Array<{ dependsOn: { id: string; title: string; status: string } }> }>(`/api/tasks/${task.id}/dependencies`);
					const open = (deps.dependencies || []).filter(d => d.dependsOn.status !== "DONE");
					if (open.length) {
						setError("Blocked by dependencies: complete prerequisite tasks first.");
						return;
					}
				} catch {}
			}
			// Optimistically update the UI first
			const updatedTasks = tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t));
			setTasks(updatedTasks);

			// Then update on the server
			await apiFetch(`/api/tasks/${task.id}`, {
				method: "PUT",
				body: JSON.stringify({ status: newStatus }),
			});

			// Reload tasks to ensure consistency
			await loadTasks();
			setError(null); // Clear any previous errors on success
			
			// If task was moved to REVIEW, refresh comments to ensure fresh review state
			if (newStatus === "REVIEW" && selectedTask?.id === task.id) {
				try {
					const data = await apiFetch<{ comments: Array<{ id: string; content: string; createdAt?: string; author: { id: string; name?: string | null; email: string } }> }>(`/api/tasks/${task.id}/comments`);
					setTaskCommentsForModal(data.comments || []);
				} catch {}
			}
		} catch (e: any) {
			// Rollback on error - reload original tasks
			await loadTasks();
			const errorMsg = e.message || e.error || "Unknown error";
			setError("Failed to update task status: " + errorMsg);
			console.error("Drag drop error:", e);
		} finally {
			setActiveTask(null);
		}
	}

	function handleDragStart(event: DragStartEvent) {
		const task = tasks.find((t) => t.id === event.active.id);
		setActiveTask(task || null);
	}

	async function completeTaskWithUploads() {
		if (!selectedTask) return;
		try {
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
            closeTaskModalAndClearQuery();
			await loadTasks();
		} catch (e: any) {
			const msg = String(e?.message || "");
			if (msg.includes("Completion requires approval")) {
				setError("Completion requires approval by owner or admin. Please wait for approval after review.");
			} else if (msg.includes("Blocked by dependencies")) {
				const details = msg.split(":")[1]?.trim() || "prerequisite tasks first";
				setError(`This task is blocked by dependencies. Please complete ${details}.`);
			} else if (msg.includes("Circular dependency detected")) {
				setError("Cannot create circular dependency. Please check your task chain and remove loops.");
			} else {
				setError(msg || "Failed to complete task");
			}
		}
	}

	async function saveTaskEdits() {
		if (!selectedTask) return;
		try {
			// Build payload
			const payload: any = {};
			if (editTaskTitle.trim() && editTaskTitle.trim() !== selectedTask.title) payload.title = editTaskTitle.trim();
			if (editTaskDescription.trim() !== (selectedTask.description || "")) payload.description = editTaskDescription.trim();
			if (editTaskPriority !== selectedTask.priority) payload.priority = editTaskPriority;
			if (editTaskAssigneeId !== (selectedTask.assignee?.id || "")) payload.assigneeId = editTaskAssigneeId || null;
			if (editTaskDueDate !== (selectedTask.dueDate ? new Date(selectedTask.dueDate).toISOString().slice(0, 10) : "")) {
				payload.dueDate = editTaskDueDate ? new Date(editTaskDueDate).toISOString() : null;
			}
			if (editTaskStatus !== selectedTask.status) payload.status = editTaskStatus;

			await apiFetch(`/api/tasks/${selectedTask.id}`, { method: "PUT", body: JSON.stringify(payload) });
			// Sync dependencies (add/remove)
			const existingDepIds = new Set(currentTaskDependencies.map(d => d.dependsOn.id));
			const nextDepIds = new Set(editDependencies);
			for (const idDep of Array.from(existingDepIds)) {
				if (!nextDepIds.has(idDep)) {
					await apiFetch(`/api/tasks/${selectedTask.id}/dependencies?dependsOnTaskId=${idDep}`, { method: "DELETE" });
				}
			}
			for (const idDep of Array.from(nextDepIds)) {
				if (!existingDepIds.has(idDep)) {
					await apiFetch(`/api/tasks/${selectedTask.id}/dependencies`, { method: "POST", body: JSON.stringify({ dependsOnTaskId: idDep }) });
				}
			}
			setIsEditingTask(false);
			await loadTasks();
			// Refresh selectedTask from latest list
			const refreshed = (await apiFetch<{ items: Task[] }>(`/api/tasks?projectId=${projectId}`)).items.find(t => t.id === selectedTask.id);
			if (refreshed) setSelectedTask(refreshed);
		} catch (e: any) {
			const msg = String(e?.message || "");
			if (msg.includes("Circular dependency detected")) {
				setError("Cannot create circular dependency. Please check your task chain and remove loops.");
			} else {
				setError(msg || "Failed to update task");
			}
		}
	}

	async function deleteTask(taskId: string) {
		try {
			await apiFetch(`/api/tasks/${taskId}`, { method: "DELETE" });
            closeTaskModalAndClearQuery();
			await loadTasks();
		} catch (e: any) {
			setError(e.message || "Failed to delete task");
		}
	}

	async function createTask(e: React.FormEvent) {
		e.preventDefault();
		if (!newTask.title.trim()) return;

		try {
			// Convert date to ISO format if provided
			let dueDate: string | undefined = undefined;
			if (newTask.dueDate && newTask.dueDate.trim()) {
				const date = new Date(newTask.dueDate);
				if (!isNaN(date.getTime())) {
					dueDate = date.toISOString();
				}
			}
			
			const payload: any = {
				title: newTask.title.trim(),
				projectId,
				status: newTask.status || "TODO",
				priority: newTask.priority || "MEDIUM",
			};

			if (newTask.description && newTask.description.trim()) {
				payload.description = newTask.description.trim();
			}

			if (newTask.assigneeId && newTask.assigneeId.trim()) {
				payload.assigneeId = newTask.assigneeId;
			}

			if (dueDate) {
				payload.dueDate = dueDate;
			}
			
			const result = await apiFetch<{ task: Task }>("/api/tasks", {
				method: "POST",
				body: JSON.stringify(payload),
			});
			// Add dependencies
			for (const depId of createDependencies) {
				try { await apiFetch(`/api/tasks/${result.task.id}/dependencies`, { method: "POST", body: JSON.stringify({ dependsOnTaskId: depId }) }); } catch {}
			}

			// Upload attachments if any
			if (createFiles && createFiles.length > 0) {
				const form = new FormData();
				const filesArray = Array.from(createFiles);
				for (const f of filesArray) {
					form.append("files", f);
					// @ts-ignore webkitRelativePath exists in browsers
					if (f.webkitRelativePath) form.append("paths", f.webkitRelativePath as string);
					else form.append("paths", f.name);
				}
				await apiFetch(`/api/tasks/${result.task.id}/attachments`, {
					method: "POST",
					body: form,
				});
			}

			setTasks([...tasks, result.task]);
			setNewTask({ title: "", description: "", status: "TODO", priority: "MEDIUM", dueDate: "", assigneeId: "" });
			setCreateFiles(null);
			setCreateDependencies([]);
			setIsCreating(false);
			await loadTasks();
			await loadProject(); // Refresh stats
		} catch (e: any) {
			const msg = String(e?.message || "");
			if (msg.includes("Circular dependency detected")) {
				setError("Cannot create circular dependency. Please check your task chain and remove loops.");
			} else {
				setError(msg || "Failed to create task");
			}
		}
	}

	const tasksByStatus = {
		TODO: tasks.filter((t) => t.status === "TODO"),
		IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS"),
		REVIEW: tasks.filter((t) => t.status === "REVIEW"),
		DONE: tasks.filter((t) => t.status === "DONE"),
	};

	if (loading) return <div className="text-center py-12">Loading...</div>;

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-bold">{project?.name ?? "Project"}</h1>
				<div className="flex items-center gap-2">
					{project?.status && (
						<span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded">{project.status}</span>
					)}
					{canEditProject && (
						<button onClick={() => setShowSettings(!showSettings)} className="px-3 py-1 rounded bg-zinc-900 text-white text-sm">Settings</button>
					)}
					{canCreateTask && (
						<button onClick={() => setIsCreating(true)} className="px-3 py-1 rounded border text-sm">New Task</button>
					)}
				</div>
			</div>

			{showSettings && project && (
				<div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mb-6">
					<div className="flex items-center justify-between mb-3">
						<h2 className="font-semibold">Project settings</h2>
						<div className="flex items-center gap-2">
							<Link className="text-sm text-blue-600 hover:underline" href={`/projects/${projectId}/members`}>Manage members</Link>
							<button onClick={() => setShowSettings(false)} className="text-sm px-3 py-1 rounded border">Close</button>
						</div>
					</div>
					<form onSubmit={updateProject} className={`grid gap-4 md:grid-cols-2 ${canEditProject ? "" : "opacity-60 pointer-events-none"}`}>
						<div className="space-y-3">
							<div>
								<label className="block text-sm mb-1">Name</label>
								<input className="w-full border rounded px-3 py-2" value={editName} onChange={(e) => setEditName(e.target.value)} />
							</div>
							<div>
								<label className="block text-sm mb-1">Description</label>
								<textarea className="w-full border rounded px-3 py-2" rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
							</div>
							{stats && (
								<div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
									<p className="text-sm text-zinc-500 mb-2">Project Completion</p>
									<div className="flex items-center justify-between mb-2">
										<div className="text-2xl font-semibold">{stats.completionPercent}%</div>
										<p className="text-xs text-zinc-500">{stats.completedTasks}/{stats.totalTasks} tasks done</p>
									</div>
									<div className="h-2 w-full bg-zinc-200 dark:bg-zinc-700 rounded overflow-hidden">
										<div className="h-full bg-emerald-500 rounded transition-all" style={{ width: `${stats.completionPercent}%` }} />
									</div>
								</div>
							)}
						</div>
						<div className="space-y-3">
							<div>
								<label className="block text-sm mb-1">Status</label>
								<select className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900" value={editStatus} onChange={(e) => setEditStatus(e.target.value as Project["status"]) }>
									<option value="PLANNED">Planned</option>
									<option value="ACTIVE">Active</option>
									<option value="COMPLETED">Completed</option>
									<option value="ON_HOLD">On hold</option>
								</select>
							</div>
							<div className="grid grid-cols-1 gap-1 text-sm text-zinc-700 dark:text-zinc-300">
								<p><strong>ID:</strong> {project.id}</p>
								{project.createdAt && <p><strong>Created:</strong> {new Date(project.createdAt).toLocaleString()}</p>}
								{project.updatedAt && <p><strong>Updated:</strong> {new Date(project.updatedAt).toLocaleString()}</p>}
							</div>
							{canEditProject && (
								<div className="flex gap-2">
									<button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">Save</button>
									<button type="button" onClick={deleteProject} className="px-4 py-2 rounded bg-red-600 text-white">Delete project</button>
								</div>
							)}
						</div>
					</form>
				</div>
			)}


			{error && <p className="text-red-600 mb-4">{error}</p>}

			<DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<TaskColumn title="To Do" tasks={tasksByStatus.TODO} status="TODO" onTaskClick={(task) => (setSelectedTask(task), setShowTaskModal(true))} canDrag={canEditProject} />
					<TaskColumn title="In Progress" tasks={tasksByStatus.IN_PROGRESS} status="IN_PROGRESS" onTaskClick={(task) => (setSelectedTask(task), setShowTaskModal(true))} canDrag={canEditProject} />
					<TaskColumn title="Review" tasks={tasksByStatus.REVIEW} status="REVIEW" onTaskClick={(task) => (setSelectedTask(task), setShowTaskModal(true))} canDrag={canEditProject} />
					<TaskColumn title="Done" tasks={tasksByStatus.DONE} status="DONE" onTaskClick={(task) => (setSelectedTask(task), setShowTaskModal(true))} canDrag={canEditProject} />
				</div>

				<DragOverlay>{activeTask && <TaskCard task={activeTask} onClick={() => {}} canDrag={true} />}</DragOverlay>
			</DndContext>

			{showTaskModal && selectedTask && (() => {
				const isAssignedToMe = selectedTask.assignee?.id === currentUserId;
				const canComplete = isAssignedToMe || canEditProject;
				const canDelete = canEditProject;
				// Admin/owner can always review tasks (even if they're the assignee)
				// This ensures buttons show for admin assignees too
				const canReview = canEditProject;
				
				return (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeTaskModalAndClearQuery}>
						<div className="bg-white dark:bg-zinc-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
								<div className="flex justify-between items-start mb-4">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-2">
										<h2 className="text-xl font-bold">{selectedTask.title}</h2>
										{isAssignedToMe && (
											<span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded font-semibold">
												Assigned to You
											</span>
										)}
									</div>
								{selectedTask.description && <p className="text-zinc-600 dark:text-zinc-400">{selectedTask.description}</p>}
								</div>
									<div className="flex items-center gap-2">
										<button onClick={() => setShowHistory(!showHistory)} className="px-3 py-1 rounded border text-sm">{showHistory ? "Hide History" : "History"}</button>
									{canEditProject && (
										<button
											onClick={() => {
												setIsEditingTask((v) => {
													const next = !v;
													if (!v && selectedTask) {
														setEditTaskTitle(selectedTask.title || "");
														setEditTaskDescription(selectedTask.description || "");
														setEditTaskPriority(selectedTask.priority);
														setEditTaskAssigneeId(selectedTask.assignee?.id || "");
														setEditTaskDueDate(selectedTask.dueDate ? new Date(selectedTask.dueDate).toISOString().slice(0, 10) : "");
														setEditTaskStatus(selectedTask.status);
													}
													return next;
												});
											}}
											className="px-3 py-1 rounded border text-sm"
										>
											{isEditingTask ? "Close Edit" : "Edit"}
										</button>
									)}
                                    <button onClick={closeTaskModalAndClearQuery} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 text-2xl">
										×
									</button>
								</div>
							</div>

							<div className="grid md:grid-cols-2 gap-4 mb-6 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
								<div>
									<p className="text-xs text-zinc-500 mb-1">Status</p>
									{canEditProject ? (
										<select 
											className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900 text-sm font-medium"
											value={selectedTask.status}
											onChange={async (e) => {
												const newStatus = e.target.value as Task["status"];
												try {
													await apiFetch(`/api/tasks/${selectedTask.id}`, {
														method: "PUT",
														body: JSON.stringify({ status: newStatus }),
													});
													await loadTasks();
													setSelectedTask({ ...selectedTask, status: newStatus });
												} catch (err: any) {
													setError(err.message || "Failed to update status");
												}
											}}
										>
											<option value="TODO">TODO</option>
											<option value="IN_PROGRESS">IN_PROGRESS</option>
											<option value="REVIEW">REVIEW</option>
											<option value="DONE">DONE</option>
										</select>
									) : (
									<p className="font-medium">{selectedTask.status}</p>
									)}
								</div>
								<div>
									<p className="text-xs text-zinc-500 mb-1">Priority</p>
									<p className="font-medium">{selectedTask.priority}</p>
								</div>
								{selectedTask.assignee && (
									<div>
										<p className="text-xs text-zinc-500 mb-1">Assignee</p>
										<p className="font-medium">{selectedTask.assignee.name || selectedTask.assignee.email}</p>
									</div>
								)}
								{selectedTask.dueDate && (
									<div>
										<p className="text-xs text-zinc-500 mb-1">Due Date</p>
										<p className="font-medium">{new Date(selectedTask.dueDate).toLocaleDateString()}</p>
									</div>
								)}
							</div>

					{/* Dependencies display for current task */}
					{selectedTask && currentTaskDependencies.length > 0 && (
						<div className="mb-6 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
							<h3 className="font-semibold mb-2">Dependencies</h3>
							<ul className="text-sm space-y-1">
								{currentTaskDependencies.map((d) => (
									<li key={d.dependsOn.id}>
										<span className="font-medium">{d.dependsOn.title}</span> {" "}
										<span className={`text-xs px-2 py-0.5 rounded ${d.dependsOn.status === "DONE" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}`}>
											{d.dependsOn.status}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{/* Assignee review status banner */}
					{isAssignedToMe && (selectedTask.status === "REVIEW" || selectedTask.status === "IN_PROGRESS") && lastReviewerDecision && (
						<div className={`mb-6 p-4 border rounded-lg ${lastReviewerDecision.type === "approved" ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"}`}>
							<div className="flex items-start gap-2">
								<span className="text-xl" aria-hidden>{lastReviewerDecision.type === "approved" ? "✔️" : "🛑"}</span>
								<div>
									<p className="font-semibold mb-1">
										{lastReviewerDecision.type === "approved"
												? "Your work was reviewed and approved."
												: "Changes have been requested."}
									</p>
									<p className="text-sm text-zinc-700 dark:text-zinc-300">{lastReviewerDecision.message}</p>
									<p className="text-xs text-zinc-500 mt-1">Last reviewed by {lastReviewerDecision.reviewerName} on {new Date(lastReviewerDecision.timestamp).toLocaleString()}</p>
									{selectedTask.status === "REVIEW" && lastReviewerDecision.type === "approved" && (
										<p className="text-sm font-medium mt-2">You may mark this task as complete.</p>
									)}
									{lastReviewerDecision.type === "changes" && (
										<p className="text-sm font-medium mt-2">Please address feedback and re-request review.</p>
									)}
								</div>
							</div>
						</div>
					)}

							{showHistory && (
								<div className="mb-6 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
									<h3 className="font-semibold mb-2">History</h3>
									<ul className="space-y-1 text-sm max-h-56 overflow-y-auto">
										{historyItems.map((h) => (
											<li key={h.id} className="flex items-start gap-2">
												<span className="text-zinc-500">{new Date(h.createdAt || '').toLocaleString()}</span>
												<span className="font-medium">{h.user?.name || h.user?.email}</span>
												<span>— {h.action}</span>
											</li>
										))}
										{!historyItems.length && <li className="text-zinc-500">No history yet.</li>}
									</ul>
								</div>
							)}

							{/* Attachments list (visible to all roles) */}
				{taskAttachments.length > 0 && (
								<div className="mb-6">
									<h3 className="font-semibold mb-2">Attachments</h3>
						<div className="grid md:grid-cols-2 gap-3">
							<div>
								<p className="text-sm font-medium mb-1">From assignee</p>
								<ul className="space-y-1 text-sm">
									{taskAttachments.filter(a => a.uploaderId && a.uploaderId === (selectedTask.assignee?.id || "")).map((a) => (
										<li key={a.id}>
											<a className="text-blue-600 hover:underline" href={`${backendBase}${a.url}`} target="_blank" rel="noreferrer">{a.fileName}</a>
										</li>
									))}
								</ul>
							</div>
							<div>
								<p className="text-sm font-medium mb-1">Other uploads</p>
								<ul className="space-y-1 text-sm">
									{taskAttachments.filter(a => !a.uploaderId || a.uploaderId !== (selectedTask.assignee?.id || "")).map((a) => (
										<li key={a.id}>
											<a className="text-blue-600 hover:underline" href={`${backendBase}${a.url}`} target="_blank" rel="noreferrer">{a.fileName}</a>
										</li>
									))}
								</ul>
							</div>
						</div>
								</div>
							)}

							{isAssignedToMe && selectedTask.status === "REVIEW" && (
								<div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
									<h3 className="font-semibold text-emerald-900 dark:text-emerald-300 mb-3">Complete This Task</h3>
									<div className="space-y-3">
										<div>
											<label className="block text-sm font-medium mb-2 text-emerald-900 dark:text-emerald-300">
												Upload files/folders (optional)
											</label>
                                            <input
                                                type="file"
                                                multiple
                                                accept="*/*"
                                                className="w-full border border-emerald-300 dark:border-emerald-700 rounded px-3 py-2 bg-white dark:bg-zinc-900 text-sm"
                                                onChange={(e) => setCompleteFiles(e.target.files)}
                                            />
										</div>
										<button 
											onClick={completeTaskWithUploads} 
											className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
										>
											✓ Mark as Complete
										</button>
									</div>
								</div>
							)}

					{/* Assignee: Request Review while In Progress, or after Changes Requested */}
					{isAssignedToMe && (selectedTask.status === "IN_PROGRESS" || (selectedTask.status === "REVIEW" && lastReviewerDecision?.type === "changes")) && (
								<div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
									<h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">Request Review</h3>
									<div className="space-y-3">
										<div>
											<label className="block text-sm font-medium mb-2 text-blue-900 dark:text-blue-300">Upload files/folders (optional)</label>
                                            <input type="file" multiple accept="*/*" className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900 text-sm"
                                                onChange={(e) => setReviewFiles(e.target.files)} />
										</div>
										<div>
											<label className="block text-sm font-medium mb-2">Message to reviewer</label>
											<textarea className="w-full border rounded px-3 py-2" rows={3} placeholder="Describe the changes…"
												value={reviewMessage} onChange={(e) => setReviewMessage(e.target.value)} />
										</div>
								<button onClick={requestReview} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
											Submit for Review
										</button>
									</div>
								</div>
							)}

					{/* Owner/Admin: Review section when in REVIEW */}
					{/* IMPORTANT: Once ANY admin/owner approves/requests changes, banner shows for ALL (avoid conflicts) */}
					{canReview && selectedTask.status === "REVIEW" && (
						(() => {
							// CRITICAL LOGIC:
							// 1. Buttons show by default when task is in REVIEW
							// 2. Banner shows ONLY if a VERY RECENT decision was made (within last 3 minutes)
							// 3. This completely ignores old approvals from previous review cycles
							// 4. Once recent decision is made, BOTH admin and owner see banner (buttons hidden)
							
							const now = Date.now();
							const threeMinutesAgo = now - (3 * 60 * 1000); // 3 minutes - very recent only
							
							// Banner shows ONLY if:
							// 1. A decision exists
							// 2. Decision was made within last 3 minutes (VERY RECENT - ignores old approvals)
							// This ensures old approvals from hours/days ago are completely ignored
							const isVeryRecentDecision = lastReviewerDecision !== null && 
														lastReviewerDecision.timestamp > threeMinutesAgo;
							
							const shouldShowBanner = isVeryRecentDecision;
							
							// CRITICAL: If ANY admin/owner has made a decision after assignee review, 
							// show banner for ALL admins/owners (buttons hidden for everyone to avoid conflicts)
							if (shouldShowBanner && lastReviewerDecision) {
								// Decision was made by ANY admin/owner - show banner to ALL
								// This ensures both admin and owner see the same state (banner, no buttons)
								// Prevents conflicts where multiple people try to approve simultaneously
								return (
									<div className={`mb-6 p-4 border rounded-lg ${lastReviewerDecision.type === "approved" ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"}`}>
										<div className="flex items-start gap-2">
											<span className="text-xl" aria-hidden> {lastReviewerDecision.type === "approved" ? "✔️" : "🛑"} </span>
											<div>
												<p className="font-semibold mb-1">
													{lastReviewerDecision.type === "approved" 
														? "✓ Approved by " + lastReviewerDecision.reviewerName + " (Decision made)"
														: "Changes requested by " + lastReviewerDecision.reviewerName + " (Decision made)"}
												</p>
												<p className="text-sm text-zinc-700 dark:text-zinc-300">{lastReviewerDecision.message}</p>
												<p className="text-xs text-zinc-500 mt-1">Reviewed on {new Date(lastReviewerDecision.timestamp).toLocaleString()}</p>
												<p className="text-xs text-zinc-500 mt-1 italic">Buttons are hidden for all admins/owners to prevent conflicts.</p>
												{lastReviewerDecision.type === "approved" && (
													<p className="text-sm font-medium mt-2 text-emerald-700 dark:text-emerald-300">The assignee can now mark this task as complete.</p>
												)}
												{lastReviewerDecision.type === "changes" && (
													<p className="text-sm font-medium mt-2 text-red-700 dark:text-red-300">The assignee should address the feedback and resubmit for review.</p>
												)}
											</div>
										</div>
									</div>
								);
							}

							// NO decision made yet - SHOW BUTTONS to all admins/owners
							// Both admin and owner can see and use these buttons
							// Once ANYONE clicks approve/request changes, buttons disappear for EVERYONE
							return (
								<div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
									<h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-3">
										Review Actions {isAssignedToMe && canEditProject ? "(You are both assignee and admin)" : ""}
									</h3>
									<div className="mb-3 space-y-2">
										<p className="text-sm text-zinc-700 dark:text-zinc-300">
											<span className="font-medium">Review message:</span> {latestReviewMsg || "—"}
										</p>
										<div>
											<p className="text-sm font-medium mb-1">Review files (from assignee)</p>
											<ul className="space-y-1 text-sm">
												{taskAttachments.filter(a => a.uploaderId === (selectedTask.assignee?.id || "")).map(a => (
													<li key={a.id}>
														<a className="text-blue-700 hover:underline" href={`${backendBase}${a.url}`} target="_blank" rel="noreferrer">{a.fileName}</a>
													</li>
												))}
												{!taskAttachments.some(a => a.uploaderId === (selectedTask.assignee?.id || "")) && (<li className="text-zinc-500">No files</li>)}
											</ul>
										</div>
									</div>
									<div className="flex flex-col md:flex-row gap-2">
										<button onClick={async () => {
											if (!selectedTask) return;
											try {
												// Post approval comment
												await postOwnerComment("Approved. You can mark as complete.");
												
												// Wait a moment for backend to process
												await new Promise(resolve => setTimeout(resolve, 100));
												
												// CRITICAL: Immediately reload comments to detect new approval
												const data = await apiFetch<{ comments: Array<{ id: string; content: string; createdAt?: string; author: { id: string; name?: string | null; email: string } }> }>(`/api/tasks/${selectedTask.id}/comments`);
												setTaskCommentsForModal(data.comments || []);
												setLatestReviewMsg("");
												
												// Force re-render by updating selected task
												// The useEffect for computing decisions will run and detect the new approval
												const updated = (await apiFetch<{ items: Task[] }>(`/api/tasks?projectId=${projectId}`)).items.find(t => t.id === selectedTask.id);
												if (updated) {
													setSelectedTask(updated);
												}
												
												// Reload tasks list
												await loadTasks();
											} catch (err) {
												console.error("Error approving:", err);
											}
										}} className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
											Approve
										</button>
										<button onClick={async () => {
											if (!selectedTask) return;
											try {
												const t = prompt("Describe required changes for the assignee:");
												if (t) {
													// Post changes request comment
													await postOwnerComment("Changes needed: " + t);
												}
												
												// Change status to IN_PROGRESS
												await apiFetch(`/api/tasks/${selectedTask.id}`, { method: "PUT", body: JSON.stringify({ status: "IN_PROGRESS" }) }).catch(()=>{});
												
												// Wait a moment for backend to process
												await new Promise(resolve => setTimeout(resolve, 100));
												
												// CRITICAL: Immediately reload comments to detect new decision
												const data = await apiFetch<{ comments: Array<{ id: string; content: string; createdAt?: string; author: { id: string; name?: string | null; email: string } }> }>(`/api/tasks/${selectedTask.id}/comments`);
												setTaskCommentsForModal(data.comments || []);
												
												// Force re-render by updating selected task
												const updated = (await apiFetch<{ items: Task[] }>(`/api/tasks?projectId=${projectId}`)).items.find(t => t.id === selectedTask.id);
												if (updated) {
													setSelectedTask(updated);
												}
												
												// Reload tasks list
												await loadTasks();
											} catch (err) {
												console.error("Error requesting changes:", err);
											}
										}} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition-colors">
											Request Changes
										</button>
									</div>
								</div>
							);
						})()
					)}

							{/* Comments */}
							<TaskComments taskId={selectedTask.id} />

							{canEditProject && (
								<div className="flex flex-col gap-3">
									{isEditingTask && (
										<form onSubmit={(e) => { e.preventDefault(); saveTaskEdits(); }} className="space-y-3">
											<div className="grid md:grid-cols-2 gap-4">
												<div className="md:col-span-2">
													<label className="block text-sm mb-1">Title</label>
													<input className="w-full border rounded px-3 py-2" value={editTaskTitle} onChange={(e) => setEditTaskTitle(e.target.value)} required />
												</div>
												<div className="md:col-span-2">
													<label className="block text-sm mb-1">Description</label>
													<textarea className="w-full border rounded px-3 py-2" rows={3} value={editTaskDescription} onChange={(e) => setEditTaskDescription(e.target.value)} />
												</div>
												<div>
													<label className="block text-sm mb-1">Priority</label>
													<select className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900" value={editTaskPriority} onChange={(e) => setEditTaskPriority(e.target.value as any)}>
														<option value="LOW">Low</option>
														<option value="MEDIUM">Medium</option>
														<option value="HIGH">High</option>
														<option value="URGENT">Urgent</option>
													</select>
												</div>
												<div>
													<label className="block text-sm mb-1">Assignee</label>
													<select className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900" value={editTaskAssigneeId} onChange={(e) => setEditTaskAssigneeId(e.target.value)}>
														<option value="">Unassigned</option>
														{membersForAssignee.map((m) => (
															<option key={m.id} value={m.id}>{m.name || m.email}</option>
														))}
													</select>
												</div>
												<div>
													<label className="block text-sm mb-1">Due date</label>
													<input type="date" className="w-full border rounded px-3 py-2" value={editTaskDueDate} onChange={(e) => setEditTaskDueDate(e.target.value)} />
												</div>
												<div>
													<label className="block text-sm mb-1">Status</label>
													<select className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900" value={editTaskStatus} onChange={(e) => setEditTaskStatus(e.target.value as Task["status"])}>
														<option value="TODO">TODO</option>
														<option value="IN_PROGRESS">IN_PROGRESS</option>
														<option value="REVIEW">REVIEW</option>
														<option value="DONE">DONE</option>
													</select>
												</div>
											</div>
										{/* Dependencies selector */}
										<div className="md:col-span-2">
											<label className="block text-sm mb-1">Depends on</label>
											<TaskDependencySelector
												tasks={tasks.filter(t => t.id !== (selectedTask?.id || ""))}
												selected={editDependencies}
												setSelected={setEditDependencies}
												placeholder="Type to search tasks..."
												excludeTaskId={selectedTask?.id}
											/>
										</div>
											{/* Admin/Owner can add attachments while editing */}
											<div className="md:col-span-2">
												<label className="block text-sm mb-1">Add files/folders</label>
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="*/*"
                                                    className="border rounded px-2 py-1"
                                                    onChange={async (e) => {
														if (!selectedTask || !e.target.files?.length) return;
														const form = new FormData();
														for (const f of Array.from(e.target.files)) {
															form.append("files", f);
															// @ts-ignore
															if (f.webkitRelativePath) form.append("paths", f.webkitRelativePath as string);
															else form.append("paths", f.name);
														}
														await apiFetch(`/api/tasks/${selectedTask.id}/attachments`, { method: "POST", body: form });
														// reload attachments list
														try {
															const data = await apiFetch<{ attachments: Array<{ id: string; url: string; fileName: string; uploaderId?: string | null }> }>(`/api/tasks/${selectedTask.id}/attachments`);
															setTaskAttachments(data.attachments || []);
														} catch {}
													}}
												/>
											</div>
											<div className="flex gap-2 justify-end">
												<button type="button" className="px-4 py-2 rounded border" onClick={() => setIsEditingTask(false)}>Cancel</button>
												<button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">Save Changes</button>
											</div>
										</form>
									)}
									{canDelete && (
										<button 
											onClick={() => {
												if (confirm("Are you sure you want to delete this task?")) {
													deleteTask(selectedTask.id);
												}
											}} 
											className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
										>
											Delete Task
										</button>
									)}
								</div>
							)}
						</div>
					</div>
				);
			})()}

			{isCreating && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsCreating(false)}>
					<div className="bg-white dark:bg-zinc-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-start mb-4">
							<h2 className="text-xl font-bold">Create Task</h2>
							<button onClick={() => setIsCreating(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50">x</button>
						</div>
							<form onSubmit={createTask} className="space-y-4">
							<div className="grid md:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm mb-1">Title</label>
									<input className="w-full border rounded px-3 py-2" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} required />
								</div>
								<div>
									<label className="block text-sm mb-1">Assignee</label>
									<select className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900" value={newTask.assigneeId} onChange={(e) => setNewTask({ ...newTask, assigneeId: e.target.value })}>
										<option value="">Unassigned</option>
										{membersForAssignee.map((m) => (
											<option key={m.id} value={m.id}>{m.name || m.email}</option>
										))}
									</select>
								</div>
								<div className="md:col-span-2">
									<label className="block text-sm mb-1">Description</label>
									<textarea className="w-full border rounded px-3 py-2" rows={4} value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
								</div>
								<div>
									<label className="block text-sm mb-1">Priority</label>
									<select className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}>
										<option value="LOW">Low</option>
										<option value="MEDIUM">Medium</option>
										<option value="HIGH">High</option>
										<option value="URGENT">Urgent</option>
									</select>
								</div>
								<div>
									<label className="block text-sm mb-1">Due date</label>
									<input type="date" className="w-full border rounded px-3 py-2" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} />
								</div>
							</div>

							<div>
								<label className="block text-sm mb-1">Depends on</label>
								<TaskDependencySelector
									tasks={tasks}
									selected={createDependencies}
									setSelected={setCreateDependencies}
									placeholder="Type to search tasks..."
								/>
							</div>

                            <div className="flex items-center gap-2">
								<label className="text-sm text-zinc-600 dark:text-zinc-300">Add files/folders:</label>
                                <input
                                    type="file"
                                    multiple
                                    accept="*/*"
                                    className="border rounded px-2 py-1"
                                    onChange={(e) => setCreateFiles(e.target.files)}
                                />
							</div>

							<div className="flex gap-2 justify-end">
								<button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 rounded border">Cancel</button>
								<button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">Create Task</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

function TaskComments({ taskId }: { taskId: string }) {
    const [items, setItems] = useState<Array<{ id: string; content: string; createdAt?: string; author: { id: string; name?: string | null; email: string } }>>([]);
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(false);

    async function load() {
        try {
            const data = await apiFetch<{ comments: typeof items }>(`/api/tasks/${taskId}/comments`);
            setItems(data.comments || []);
        } catch {}
    }

    useEffect(() => { load(); }, [taskId]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!newComment.trim() || loading) return;
        try {
            setLoading(true);
            await apiFetch(`/api/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ content: newComment.trim() }) });
            setNewComment("");
            await load();
        } finally { setLoading(false); }
    }

    return (
        <div className="mb-6">
            <h3 className="font-semibold mb-2">Comments</h3>
            <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                {items.map((c) => (
                    <div key={c.id} className="text-sm p-2 border border-zinc-200 dark:border-zinc-800 rounded">
                        <div className="text-zinc-500 text-xs mb-1">{c.author.name || c.author.email}</div>
                        <div>{c.content}</div>
                    </div>
                ))}
                {!items.length && <p className="text-sm text-zinc-500">No comments yet.</p>}
            </div>
            <form onSubmit={submit} className="flex gap-2">
                <input className="flex-1 border rounded px-3 py-2" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." />
                <button disabled={loading || !newComment.trim()} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">Post</button>
            </form>
        </div>
    );
}

