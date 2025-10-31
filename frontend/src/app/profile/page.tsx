"use client";
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

type User = { 
  id: string; 
  email: string; 
  name?: string | null; 
  avatar?: string | null;
  bio?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const errorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backendBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  useEffect(() => {
    if (avatarFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(avatarFile);
    } else {
      setAvatarPreview(null);
    }
  }, [avatarFile]);

  async function loadProfile() {
    try {
      setLoading(true);
      const data = await apiFetch<{ user: User }>("/api/user/profile");
      setUser(data.user);
      setName(data.user.name || "");
      setAvatar(data.user.avatar || "");
      setBio(data.user.bio || "");
      // Update localStorage user if needed
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        localStorage.setItem("user", JSON.stringify({ ...parsed, name: data.user.name, avatar: data.user.avatar }));
      }
      setError(null);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("Internal Server Error")) {
        setError("Failed to load profile. Please refresh the page.");
      } else {
        setError(msg || "Failed to load profile");
      }
    } finally {
      setLoading(false);
    }
  }

  async function uploadAvatar() {
    if (!avatarFile) return;

    try {
      setUploading(true);
      setError(null);

      const form = new FormData();
      form.append("avatar", avatarFile);

      const result = await apiFetch<{ url: string }>("/api/user/avatar", {
        method: "POST",
        body: form,
      });

      setAvatar(result.url);
      setAvatarFile(null);
      setAvatarPreview(null);
      // Update user state
      if (user) {
        setUser({ ...user, avatar: result.url });
      }
      // Update localStorage
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        localStorage.setItem("user", JSON.stringify({ ...parsed, avatar: result.url }));
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("Only image files")) {
        setError("Please upload a valid image file (JPEG, PNG, GIF, or WebP)");
      } else if (msg.includes("File size")) {
        setError("Image size must be less than 5MB");
      } else {
        setError(msg || "Failed to upload avatar");
      }
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const updated = await apiFetch<{ user: User }>("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim() || undefined,
          avatar: avatar.trim() || null,
          bio: bio.trim() || null,
        }),
      });

      setUser(updated.user);
      // Update localStorage
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        localStorage.setItem("user", JSON.stringify({ ...parsed, name: updated.user.name, avatar: updated.user.avatar }));
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      let msg = "";
      try {
        const errorData = JSON.parse(e.message || "{}");
        if (errorData.error) {
          msg = typeof errorData.error === "string" ? errorData.error : JSON.stringify(errorData.error);
        } else {
          msg = e.message || "";
        }
      } catch {
        msg = String(e?.message || "");
      }
      
      if (msg.includes("Internal Server Error")) {
        setError("Failed to update profile. Please check your input and try again.");
      } else if (msg.includes("Validation failed")) {
        setError(msg);
      } else {
        setError(msg || "Failed to update profile");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return;
      }
      setAvatarFile(file);
      setError(null);
    }
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto p-8"><div className="text-center py-12">Loading...</div></div>;
  }

  const displayAvatar = avatarPreview || (avatar ? `${backendBase}${avatar}` : null);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Profile</h1>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <form onSubmit={saveProfile} className="space-y-6">
          {/* Error/Success Messages */}
          {error && (
            <div
              ref={errorRef}
              className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm text-center"
              aria-live="polite"
            >
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-400 text-sm text-center">
              Profile updated successfully!
            </div>
          )}

          {/* Avatar Upload */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Profile Photo
            </label>
            <div className="flex items-start gap-4">
              {/* Avatar Preview */}
              <div className="flex-shrink-0">
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt="Avatar"
                    className="w-24 h-24 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-700"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}&size=96`;
                    }}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-semibold">
                    {name ? name.charAt(0).toUpperCase() : "?"}
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Choose File
                  </button>
                  {avatarFile && (
                    <>
                      <button
                        type="button"
                        onClick={uploadAvatar}
                        disabled={uploading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploading ? "Uploading..." : "Upload"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarFile(null);
                          setAvatarPreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
                {avatarFile && (
                  <p className="text-xs text-zinc-500">
                    Selected: {avatarFile.name} ({(avatarFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                <p className="text-xs text-zinc-500">Supported: JPEG, PNG, GIF, WebP (max 5MB)</p>
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Email
            </label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
              value={user?.email || ""}
              readOnly
              disabled
            />
            <p className="text-xs text-zinc-500 mt-1">Email cannot be changed</p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Bio
            </label>
            <textarea
              className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              maxLength={500}
            />
            <p className="text-xs text-zinc-500 mt-1">{bio.length}/500 characters</p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
