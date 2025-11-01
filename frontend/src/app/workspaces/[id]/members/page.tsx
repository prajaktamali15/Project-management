"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Workspace = { id: string; name: string; ownerId?: string };
type Member = { userId: string; role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"; user: { id: string; name?: string | null; email: string; avatar?: string | null } };
type User = { id: string; email: string; name?: string | null; avatar?: string | null };

const ROLE_COLORS: Record<string, string> = {
	OWNER: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
	ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
	MEMBER: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	VIEWER: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
	OWNER: "Full control over workspace",
	ADMIN: "Can manage projects and members",
	MEMBER: "Can work on tasks in assigned projects",
	VIEWER: "Read-only access",
};

function Avatar({ name, email, src, size = 32 }: { name?: string | null; email: string; src?: string | null; size?: number }) {
	const initials = (name || email.split("@")[0] || "?")
		.split(" ")
		.map((s) => s[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
	const dimension = `${size}px`;
	if (src) {
		return <img src={src} alt={name || email} width={size} height={size} className="rounded-full object-cover" style={{ width: dimension, height: dimension }} />;
	}
	return (
		<div
			className="rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 flex items-center justify-center font-medium"
			style={{ width: dimension, height: dimension }}
		>
			{initials}
		</div>
	);
}

export default function WorkspaceMembersPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const workspaceId = params.id;

	const [workspace, setWorkspace] = useState<Workspace | null>(null);
	const [members, setMembers] = useState<Member[]>([]);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER" | "VIEWER">("MEMBER");
	const [suggestions, setSuggestions] = useState<User[]>([]);
	const [showSuggestions, setShowSuggestions] = useState(false);

	const [selectedMember, setSelectedMember] = useState<Member | null>(null);
	const [showMemberModal, setShowMemberModal] = useState(false);

	async function load() {
		try {
			const ws = await apiFetch<{ workspace: Workspace }>(`/api/workspaces/${workspaceId}`);
			setWorkspace(ws.workspace);

			const mems = await apiFetch<{ members: Member[] }>(`/api/workspaces/${workspaceId}/members`);
			setMembers(mems.members);
			setError(null);
		} catch (e: any) {
			setError(e.message || "Failed to load workspace");
		}
	}

	useEffect(() => {
		if (workspaceId) load();
		// Get current user ID from localStorage
		const userStr = localStorage.getItem("user");
		if (userStr) {
			const user = JSON.parse(userStr);
			setCurrentUserId(user.id);
		}
	}, [workspaceId]);

	async function searchUsers(query: string) {
		if (!query.trim() || query.length < 2) {
			setSuggestions([]);
			return;
		}

		try {
			const userData = await apiFetch<{ users: User[] }>(`/api/users/search?email=${encodeURIComponent(query)}`);
			if (userData.users && userData.users.length > 0) {
				// Filter out users who are already members
				const availableUsers = userData.users.filter(user => !members.some((m) => m.userId === user.id));
				setSuggestions(availableUsers);
			} else {
				setSuggestions([]);
			}
		} catch (e) {
			// User not found
			setSuggestions([]);
		}
	}

	async function inviteMember(e: React.FormEvent) {
		e.preventDefault();
		if (!inviteEmail.trim() || loading) return;

		setLoading(true);
		try {
			// Look up user(s) by email substring; prefer exact match
			const res = await apiFetch<{ users: User[] }>(`/api/users/search?email=${encodeURIComponent(inviteEmail)}`);
			const users = res.users || [];
			if (!users.length) {
				throw new Error("No user found with that email");
			}
			const exact = users.find(u => u.email.toLowerCase() === inviteEmail.toLowerCase());
			const target = exact || users[0];
			const userId = target.id;

			await apiFetch(`/api/workspaces/${workspaceId}/members`, {
				method: "POST",
				body: JSON.stringify({ userId, role: inviteRole }),
			});

			setInviteEmail("");
			setSuggestions([]);
			setShowSuggestions(false);
			await load();
		} catch (e: any) {
			setError(e.message || "Failed to invite member");
		} finally {
			setLoading(false);
		}
	}

	async function removeMember(userId: string) {
		if (!confirm("Are you sure you want to remove this member?")) return;

		try {
			await apiFetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
				method: "DELETE",
			});

			await load();
			setShowMemberModal(false);
			setSelectedMember(null);
		} catch (e: any) {
			// If the member was already removed, just refresh the list
			if (typeof e.message === "string" && e.message.includes("Member not found")) {
				await load();
				return;
			}
			setError(e.message || "Failed to remove member");
		}
	}

	async function changeRole(userId: string, role: "ADMIN" | "MEMBER" | "VIEWER") {
		try {
			await apiFetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
				method: "PUT",
				body: JSON.stringify({ role }),
			});
			await load();
		} catch (e: any) {
			setError(e.message || "Failed to update role");
		}
	}

	const handleEmailChange = (value: string) => {
		setInviteEmail(value);
		if (value.trim()) {
			searchUsers(value);
			setShowSuggestions(true);
		} else {
			setShowSuggestions(false);
			setSuggestions([]);
		}
	};

	const selectSuggestion = (user: User) => {
		setInviteEmail(user.email);
		setSuggestions([]);
		setShowSuggestions(false);
	};

	return (
		<div className="max-w-7xl mx-auto p-8">
			<div className="flex items-center justify-between mb-6">
				<div>
					<Link href={`/workspaces/${workspaceId}`} className="text-blue-600 mb-2 inline-block hover:underline">
						← Back to workspace
					</Link>
					<h1 className="text-2xl font-bold">{workspace?.name ?? "Workspace"} - Team Members</h1>
				</div>
			</div>

			{error && <p className="text-red-600 mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-900">{error}</p>}

			<form onSubmit={inviteMember} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mb-6">
				<h2 className="font-semibold mb-3">Invite Team Member</h2>
				<div className="flex gap-2 relative">
					<div className="flex-1 relative">
						<input
							className="w-full border rounded px-3 py-2"
							placeholder="User email"
							value={inviteEmail}
							onChange={(e) => handleEmailChange(e.target.value)}
							onFocus={() => setShowSuggestions(true)}
						/>
						{showSuggestions && suggestions.length > 0 && (
							<div className="absolute top-full mt-1 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded shadow-lg z-10">
								{suggestions.map((user) => (
									<button
										key={user.id}
										type="button"
										className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700"
										onClick={() => selectSuggestion(user)}
									>
										<div className="font-medium">{user.name || user.email}</div>
										{user.name && <div className="text-sm text-zinc-500">{user.email}</div>}
									</button>
								))}
							</div>
						)}
					</div>
					<select
						className="border rounded px-3 py-2 bg-white dark:bg-zinc-900"
						value={inviteRole}
						onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
					>
						<option value="MEMBER">Member</option>
						<option value="ADMIN">Admin</option>
						<option value="VIEWER">Viewer</option>
					</select>
					<button type="submit" disabled={loading} className="px-4 py-2 bg-black text-white rounded hover:bg-zinc-800 disabled:opacity-50 transition-colors">
						{loading ? "Inviting..." : "Invite"}
					</button>
				</div>
			</form>

			{/* Current User's Role Highlight */}
			{currentUserId && (
				<div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
					<h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Your Role in This Workspace</h3>
					{(() => {
						const myMember = members.find(m => m.userId === currentUserId);
						const isOwner = workspace?.ownerId === currentUserId;
						const role = isOwner ? "OWNER" : (myMember?.role || "NOT A MEMBER");
						return (
							<div className="flex items-center gap-3">
								<span className={`text-base font-semibold px-4 py-2 rounded ${ROLE_COLORS[role]}`}>{role}</span>
								<span className="text-sm text-blue-800 dark:text-blue-300">{ROLE_DESCRIPTIONS[role]}</span>
							</div>
						);
					})()}
				</div>
			)}

			<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{members.map((m) => (
					<button
						key={m.userId}
						onClick={() => { setSelectedMember(m); setShowMemberModal(true); }}
						className={`text-left border rounded-lg p-3 hover:shadow-md transition-shadow ${
							m.userId === currentUserId
								? "border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20"
								: "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
						}`}
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<Avatar name={m.user.name} email={m.user.email} src={m.user.avatar} size={32} />
								<div>
									<p className="font-medium">{m.user.name || m.user.email}</p>
									<p className="text-sm text-zinc-500 dark:text-zinc-400">{m.user.email}</p>
								</div>
							</div>
							<span className={`text-xs px-2 py-0.5 rounded ${ROLE_COLORS[m.role]}`}>{m.role}</span>
						</div>
						<p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{ROLE_DESCRIPTIONS[m.role]}</p>
						{m.userId === currentUserId && (
							<p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">(You)</p>
						)}
					</button>
				))}
			</div>

			{showMemberModal && selectedMember && (
				<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMemberModal(false)}>
					<div className="bg-white dark:bg-zinc-900 rounded-lg max-w-md w-full p-5 border border-zinc-200 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
						<div className="flex items-start justify-between mb-3">
							<div className="flex items-center gap-3">
								<Avatar name={selectedMember.user.name} email={selectedMember.user.email} src={selectedMember.user.avatar} size={40} />
								<div>
									<h3 className="font-semibold">{selectedMember.user.name || selectedMember.user.email}</h3>
									<p className="text-sm text-zinc-500">{selectedMember.user.email}</p>
								</div>
							</div>
							<button className="text-zinc-500" onClick={() => setShowMemberModal(false)}>×</button>
						</div>
						<div className="space-y-3">
							<div>
								<label className="block text-sm mb-1">Role</label>
								<select
									className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900"
									value={selectedMember.role}
									onChange={(e) => changeRole(selectedMember.userId, e.target.value as any)}
									disabled={selectedMember.role === "OWNER"}
								>
									<option value="ADMIN">Admin</option>
									<option value="MEMBER">Member</option>
									<option value="VIEWER">Viewer</option>
								</select>
							</div>
							{selectedMember.role !== "OWNER" ? (
								<button onClick={() => removeMember(selectedMember.userId)} className="w-full px-4 py-2 rounded bg-red-600 text-white">Remove from workspace</button>
							) : (
								<p className="text-xs text-zinc-500">Owner cannot be removed.</p>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}


