"use client";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Menu, Moon, Sun, User, Code, Search } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Header() {
	const { setTheme, resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [profileOpen, setProfileOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [userAvatar, setUserAvatar] = useState<string | null>(null);
	const [userName, setUserName] = useState<string | null>(null);
	const router = useRouter();
	const backendBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

	useEffect(() => setMounted(true), []);

	// Load user avatar and name from localStorage and keep in sync
	useEffect(() => {
		function loadUserData() {
			const userStr = localStorage.getItem("user");
			if (userStr) {
				try {
					const parsed = JSON.parse(userStr);
					setUserAvatar(parsed.avatar || null);
					setUserName(parsed.name || null);
				} catch {}
			}
		}
		loadUserData();
		// Listen for storage changes (e.g., when profile is updated)
		window.addEventListener("storage", loadUserData);
		// Also check periodically for updates (when same tab updates localStorage)
		const interval = setInterval(() => {
			loadUserData();
		}, 2000);
		return () => {
			window.removeEventListener("storage", loadUserData);
			clearInterval(interval);
		};
	}, []);

	const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (searchQuery.trim()) {
			router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
			setSearchQuery("");
		}
	};

	const handleSignOut = () => {
		localStorage.removeItem("accessToken");
		localStorage.removeItem("refreshToken");
		localStorage.removeItem("user");
		router.push("/login");
		setProfileOpen(false);
	};

	return (
		<header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/85 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-zinc-800 dark:bg-zinc-950/85 dark:supports-[backdrop-filter]:bg-zinc-950/60">
			<div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
				<div className="flex items-center gap-3 flex-1">
					<button className="sm:hidden p-2 rounded border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
						<Menu size={18} />
					</button>
					<Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
						<div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
							<Code className="text-white w-5 h-5" />
						</div>
						<span className="hidden sm:inline">ProjectHub</span>
					</Link>
					<nav className="hidden sm:flex items-center gap-5 text-sm text-zinc-700 dark:text-zinc-300 ml-6">
						<Link href="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Dashboard</Link>
						<Link href="/workspaces" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Workspaces</Link>
						<Link href="/projects" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Projects</Link>
						<Link href="/my-tasks" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">My Tasks</Link>
					</nav>
				</div>

				{/* Search Bar */}
				<form onSubmit={handleSearch} className="hidden md:flex items-center flex-1 max-w-xl mx-4">
					<div className="relative w-full">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
						<input
							type="text"
							placeholder="Search workspaces and projects..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-10 pr-4 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
						/>
					</div>
				</form>

				<div className="flex items-center gap-2">
					<button onClick={toggleTheme} className="p-2 rounded border border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900 transition-colors" aria-label="Toggle theme">
						{mounted && resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
					</button>
					<div className="relative">
						<button onClick={() => setProfileOpen((v) => !v)} className="flex items-center gap-2 rounded border border-zinc-200 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900 transition-colors">
							{userAvatar ? (
								<img
									src={userAvatar.startsWith("http") ? userAvatar : `${backendBase}${userAvatar}`}
									alt="Profile"
									className="w-6 h-6 rounded-full object-cover border border-zinc-300 dark:border-zinc-700"
									onError={(e) => {
										// Hide image and show fallback
										(e.target as HTMLImageElement).style.display = "none";
									}}
								/>
							) : null}
							{!userAvatar && <User size={16} />}
							<span className="hidden sm:inline text-sm">{userName || "Profile"}</span>
						</button>
						{profileOpen && (
							<div className="absolute right-0 mt-2 w-48 rounded border border-zinc-200 bg-white p-1 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
								<Link className="block rounded px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" href="/profile">
									Profile
								</Link>
								<Link className="block rounded px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" href="/settings">
									Settings
								</Link>
								<button onClick={handleSignOut} className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Sign out</button>
							</div>
						)}
					</div>
				</div>
			</div>
			{menuOpen && (
				<nav className="sm:hidden border-t border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800">
					<Link className="block py-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" href="/dashboard">
						Dashboard
					</Link>
					<Link className="block py-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" href="/workspaces">
						Workspaces
					</Link>
					<Link className="block py-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" href="/projects">
						Projects
					</Link>
					<Link className="block py-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" href="/my-tasks">
						My Tasks
					</Link>
				</nav>
			)}
		</header>
	);
}
