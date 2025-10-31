"use client";
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const passwordErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (passwordError && passwordErrorRef.current) {
      passwordErrorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [passwordError]);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordSaving) return;

    // Client-side validation
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password must match");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      setPasswordSaving(true);
      setPasswordError(null);
      setPasswordSuccess(false);

      await apiFetch("/api/user/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("Current password is incorrect")) {
        setPasswordError("Current password is incorrect");
      } else if (msg.includes("must match")) {
        setPasswordError("New password and confirm password must match");
      } else {
        setPasswordError(msg || "Failed to update password");
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  async function deleteAccount() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    if (deleteConfirmText !== "DELETE") {
      setDeleteError("Please type DELETE to confirm");
      return;
    }

    if (!confirm("Are you absolutely sure? This action cannot be undone and will delete all your workspaces, projects, and tasks.")) {
      return;
    }

    try {
      setDeleting(true);
      setDeleteError(null);

      await apiFetch("/api/user", {
        method: "DELETE",
      });

      // Clear local storage and redirect
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      router.push("/login");
    } catch (e: any) {
      setDeleteError(e.message || "Failed to delete account");
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Password Change */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Change Password</h2>

          <form onSubmit={updatePassword} className="space-y-4">
            {passwordError && (
              <div
                ref={passwordErrorRef}
                className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm text-center"
                aria-live="polite"
              >
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-400 text-sm text-center">
                Password updated successfully!
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Current Password
              </label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-xs text-zinc-500 mt-1">Must be at least 6 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={passwordSaving || newPassword !== confirmPassword}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordSaving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>

        {/* Delete Account */}
        <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/30 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2 text-red-600 dark:text-red-400">Danger Zone</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>

          {deleteConfirm && (
            <div className="space-y-3 mb-4">
              {deleteError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {deleteError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Type <strong>DELETE</strong> to confirm
                </label>
                <input
                  type="text"
                  className="w-full border border-red-300 dark:border-red-700 rounded px-3 py-2 bg-white dark:bg-zinc-900"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                />
              </div>
            </div>
          )}

          <button
            onClick={deleteAccount}
            disabled={deleting || (deleteConfirm && deleteConfirmText !== "DELETE")}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting..." : deleteConfirm ? "Confirm Delete Account" : "Delete Account"}
          </button>

          {deleteConfirm && (
            <button
              onClick={() => {
                setDeleteConfirm(false);
                setDeleteConfirmText("");
                setDeleteError(null);
              }}
              className="ml-3 px-6 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
