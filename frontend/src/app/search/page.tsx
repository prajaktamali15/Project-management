"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Search, FolderKanban, Briefcase, Users, FileText, ArrowRight } from "lucide-react";

type Workspace = {
  id: string;
  name: string;
  owner: { id: string; name: string | null; email: string };
  _count: { members: number; projects: number };
};

type Project = {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  workspace: { id: string; name: string };
  _count: { tasks: number; members: number };
};

type SearchResults = {
  workspaces: Workspace[];
  projects: Project[];
};

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  
  const [searchQuery, setSearchQuery] = useState(query);
  const [results, setResults] = useState<SearchResults>({ workspaces: [], projects: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearchQuery(query);
    if (query.trim()) {
      performSearch(query);
    } else {
      setResults({ workspaces: [], projects: [] });
    }
  }, [query]);

  async function performSearch(q: string) {
    if (!q.trim()) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`);
      setResults(data);
    } catch (err: any) {
      setError(err.message || "Search failed");
      setResults({ workspaces: [], projects: [] });
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const totalResults = results.workspaces.length + results.projects.length;

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Search Bar */}
      <div className="mb-8">
        <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search workspaces and projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 text-base border-2 border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-400"
            autoFocus
          />
        </form>
      </div>

      {/* Results Header */}
      {query && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">
            {loading ? "Searching..." : `Search Results for "${query}"`}
          </h1>
          {!loading && (
            <p className="text-zinc-600 dark:text-zinc-400">
              Found {totalResults} result{totalResults !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* No Query State */}
      {!query && !loading && (
        <div className="text-center py-16">
          <Search className="w-16 h-16 text-zinc-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            Search for workspaces and projects
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400">
            Enter a search term to find your workspaces and projects
          </p>
        </div>
      )}

      {/* No Results */}
      {query && !loading && totalResults === 0 && (
        <div className="text-center py-16">
          <Search className="w-16 h-16 text-zinc-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            No results found
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400">
            Try different keywords or check your spelling
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && totalResults > 0 && (
        <div className="space-y-8">
          {/* Workspaces Section */}
          {results.workspaces.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                Workspaces ({results.workspaces.length})
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.workspaces.map((workspace) => (
                  <Link
                    key={workspace.id}
                    href={`/workspaces/${workspace.id}`}
                    className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-lg">{workspace.name}</h3>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                      Owner: {workspace.owner.name || workspace.owner.email}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {workspace._count.members} members
                      </div>
                      <div className="flex items-center gap-1">
                        <FolderKanban className="w-3 h-3" />
                        {workspace._count.projects} projects
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Projects Section */}
          {results.projects.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-blue-600" />
                Projects ({results.projects.length})
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="w-5 h-5 text-green-600" />
                        <h3 className="font-semibold text-lg">{project.name}</h3>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                    {project.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Workspace: {project.workspace.name}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {project._count.tasks} tasks
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {project._count.members} members
                        </div>
                        {project.status && (
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded text-xs">
                            {project.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
