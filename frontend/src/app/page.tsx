"use client";
import Link from "next/link";
import { Code, Zap, Shield, Users } from "lucide-react";

export default function Home() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
			{/* Hero Section */}
			<div className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
				{/* Logo/Brand */}
				<div className="flex items-center justify-center mb-8">
					<div className="flex items-center gap-2">
						<div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
							<Code className="text-white w-6 h-6" />
						</div>
						<span className="text-2xl font-bold tracking-tight">ProjectHub</span>
					</div>
				</div>

				{/* Hero Content */}
				<div className="text-center mb-12">
					<h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-zinc-100 dark:to-zinc-400">
						Project Management Made Simple
					</h1>
					<p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
						Collaborate with your team, manage tasks, and deliver projects faster with our powerful project management platform.
					</p>
					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						<Link
							href="/register"
							className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
						>
							Get Started
						</Link>
						<Link
							href="/login"
							className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-zinc-900 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 transition-colors"
						>
							Sign In
						</Link>
					</div>
				</div>

				{/* Features */}
				<div className="grid md:grid-cols-3 gap-8 mt-20">
					<div className="text-center p-6">
						<div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg mb-4">
							<Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
						</div>
						<h3 className="text-lg font-semibold mb-2">Team Collaboration</h3>
						<p className="text-zinc-600 dark:text-zinc-400 text-sm">
							Work seamlessly with your team members with role-based access control and real-time updates.
						</p>
					</div>

					<div className="text-center p-6">
						<div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg mb-4">
							<Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
						</div>
						<h3 className="text-lg font-semibold mb-2">Lightning Fast</h3>
						<p className="text-zinc-600 dark:text-zinc-400 text-sm">
							Built for speed and efficiency. Manage your projects without the bloat.
						</p>
					</div>

					<div className="text-center p-6">
						<div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg mb-4">
							<Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
						</div>
						<h3 className="text-lg font-semibold mb-2">Secure & Reliable</h3>
						<p className="text-zinc-600 dark:text-zinc-400 text-sm">
							Your data is safe with enterprise-grade security and reliability.
						</p>
					</div>
				</div>

				{/* Footer */}
				<div className="mt-20 text-center text-sm text-zinc-600 dark:text-zinc-400">
					<p>© 2024 ProjectHub. Built for modern teams.</p>
				</div>
			</div>
		</div>
	);
}
