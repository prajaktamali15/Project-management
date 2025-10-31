"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Users, Plus, Shield, Crown, User, Eye } from "lucide-react";

type Member = {
	userId: string;
	projectId: string;
	role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
	user: { id: string; name: string | null; email: string };
};

const ROLE_COLORS = {
	OWNER: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	ADMIN: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	MEMBER: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	VIEWER: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const ROLE_ICONS = {
	OWNER: Crown,
	ADMIN: Shield,
	MEMBER: User,
	VIEWER: Eye,
};

const ROLE_DESCRIPTIONS = {
	OWNER: "Full control over the project. Can manage all aspects including deletion.",
	ADMIN: "Can manage projects, members, and all tasks within this project.",
	MEMBER: "Can work on assigned tasks and change their status. Limited edit rights.",
	VIEWER: "Can only view the project and tasks. No edit permissions.",
};

export default function ProjectMembersPage() {
	const params = useParams<{ id: string }>();
	const projectId = params.id;

	const [members, setMembers] = useState<Member[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER" | "VIEWER">("MEMBER");
	const [inviting, setInviting] = useState(false);

	async function loadMembers() {
		try {
			setLoading(true);
			const data = await apiFetch<{ members: Member[] }>(`/api/projects/${projectId}/members`);
			setMembers(data.members);
			setError(null);
		} catch (err: any) {
			setError(err.message || "Failed to load members");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		loadMembers();
	}, [projectId]);

	async function handleInvite(e: React.FormEvent) {
		e.preventDefault();
		if (!inviteEmail.trim()) return;

		try {
			setInviting(true);
			// Search for user by email
			const users = await apiFetch<{ users: Array<{ id: string; email: string }> }>(
				`/api/users/search?email=${inviteEmail}`
			);

			if (users.users.length === 0) {
				setError("User not found with this email");
				return;
			}

			const userId = users.users[0].id;
			await apiFetch(`/api/projects/${projectId}/members`, {
				method: "POST",
				body: JSON.stringify({ userId, role: inviteRole }),
			});

			setInviteEmail("");
			setInviteRole("MEMBER");
			loadMembers();
		} catch (err: any) {
			setError(err.message || "Failed to invite member");
		} finally {
			setInviting(false);
		}
	}

	if (loading) {
		return (
			<div className="max-w-4xl mx-auto p-8">
				<div className="text-center py-12">Loading members...</div>
			</div>
		);
	}

	return (
		<div className="max-w-4xl mx-auto p-8">
			<div className="flex items-center gap-3 mb-6">
				<Users className="w-8 h-8 text-blue-600" />
				<h1 className="text-3xl font-bold">Project Members</h1>
			</div>

			{error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600">{error}</div>}

			<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 mb-6">
				<h2 className="font-semibold mb-4 flex items-center gap-2">
					<Plus size={20} />
					Invite Member
				</h2>
				<form onSubmit={handleInvite} className="space-y-4">
					<div className="grid sm:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium mb-2">Email</label>
							<input
								type="email"
								className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900"
								placeholder="user@example.com"
								value={inviteEmail}
								onChange={(e) => setInviteEmail(e.target.value)}
								required
								disabled={inviting}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-2">Role</label>
							<select
								className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900"
								value={inviteRole}
								onChange={(e) => setInviteRole(e.target.value as any)}
								disabled={inviting}
							>
								<option value="MEMBER">Member</option>
								<option value="ADMIN">Admin</option>
								<option value="VIEWER">Viewer</option>
							</select>
						</div>
					</div>
					<button
						type="submit"
						className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
						disabled={inviting}
					>
						{inviting ? "Inviting..." : "Invite Member"}
					</button>
				</form>
			</div>

			<div className="space-y-3">
				<h2 className="font-semibold text-lg mb-4">Team Members ({members.length})</h2>
				{members.length === 0 ? (
					<div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
						<p>No members yet. Invite your first team member above.</p>
					</div>
				) : (
					members.map((member) => {
						const Icon = ROLE_ICONS[member.role];
						return (
							<div
								key={member.userId}
								className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
							>
								<div className="flex items-center gap-3">
									<div className={`p-2 rounded-lg ${ROLE_COLORS[member.role]}`}>
										<Icon size={20} />
									</div>
									<div>
										<p className="font-medium">{member.user.name || member.user.email.split("@")[0]}</p>
										<p className="text-sm text-zinc-500 dark:text-zinc-400">{member.user.email}</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<span
										className={`text-xs px-3 py-1 rounded ${ROLE_COLORS[member.role]}`}
										title={ROLE_DESCRIPTIONS[member.role]}
									>
										{member.role}
									</span>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

