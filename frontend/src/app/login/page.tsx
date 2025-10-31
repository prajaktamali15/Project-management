"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";


export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			const res = await apiFetch<{ accessToken: string; refreshToken: string; user: any }>("/api/auth/login", {
				method: "POST",
				body: JSON.stringify({ email, password }),
			});
			localStorage.setItem("accessToken", res.accessToken);
			localStorage.setItem("refreshToken", res.refreshToken);
			localStorage.setItem("user", JSON.stringify(res.user));
			router.push("/dashboard");
		} catch (err: any) {
			setError(err.message || "Login failed");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center px-4 py-12">
			<div className="w-full max-w-[340px] space-y-4">
				<div className="text-center">
					<h1 className="text-2xl font-semibold tracking-tight mb-2">ProjectManager</h1>
					<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">Manage your projects efficiently</p>
				</div>

				<form onSubmit={onSubmit} className="space-y-4">
					<div>
						<label htmlFor="email" className="block text-sm font-medium mb-1">
							Email address
						</label>
						<input
							id="email"
							type="email"
							required
							className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
							placeholder="you@example.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={loading}
						/>
					</div>

					<div>
						<label htmlFor="password" className="block text-sm font-medium mb-1">
							Password
						</label>
						<input
							id="password"
							type="password"
							required
							className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
							placeholder="••••••••"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={loading}
						/>
					</div>

					{error && <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-900">{error}</div>}

					<button
						type="submit"
						disabled={loading}
						className="w-full py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loading ? "Signing in..." : "Sign in"}
					</button>
				</form>

				<div className="text-sm text-center space-x-1">
					<span className="text-zinc-500 dark:text-zinc-400">New to ProjectManager?</span>
					<Link href="/register" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline">
						Create an account
					</Link>
				</div>
			</div>
		</div>
	);
}
