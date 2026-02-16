"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { MemberWithUser, MemberRole } from "@/types";

interface ProjectData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface CurrentUserMembership {
  id: string;
  role: MemberRole;
  userId: string;
}

interface SettingsClientProps {
  project: ProjectData;
  currentUserMembership: CurrentUserMembership;
  members: MemberWithUser[];
  canEditSettings: boolean;
}

interface InviteMember {
  email: string;
  role: MemberRole;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  keyPreview: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface CreateApiKeyRequest {
  name: string;
  expiresAt?: string;
}

interface ApiKeyWithFullKey extends ApiKey {
  key: string;
}

export default function SettingsClient({
  project,
  currentUserMembership,
  members: initialMembers,
  canEditSettings,
}: SettingsClientProps) {
  const router = useRouter();
  const [members, setMembers] = useState<MemberWithUser[]>(initialMembers);

  // Project settings state
  const [editingProject, setEditingProject] = useState(false);
  const [projectName, setProjectName] = useState(project.name);
  const [projectDescription, setProjectDescription] = useState(project.description || "");
  const [projectLoading, setProjectLoading] = useState(false);

  // Member invite state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteData, setInviteData] = useState<InviteMember>({
    email: "",
    role: "MEMBER",
  });
  const [inviteLoading, setInviteLoading] = useState(false);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [showCreateKeyForm, setShowCreateKeyForm] = useState(false);
  const [createKeyData, setCreateKeyData] = useState<CreateApiKeyRequest>({
    name: "",
    expiresAt: undefined,
  });
  const [createKeyLoading, setCreateKeyLoading] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showDeleteKeyConfirm, setShowDeleteKeyConfirm] = useState<string | null>(null);
  const [deleteKeyLoading, setDeleteKeyLoading] = useState(false);

  // Helper functions
  const isOwner = currentUserMembership.role === "OWNER";
  const canManageMembers = currentUserMembership.role === "ADMIN" || currentUserMembership.role === "OWNER";
  const canManageApiKeys = currentUserMembership.role === "ADMIN" || currentUserMembership.role === "OWNER";

  const roleColors = {
    OWNER: "text-violet-400 bg-violet-400/10",
    ADMIN: "text-blue-400 bg-blue-400/10",
    MEMBER: "text-green-400 bg-green-400/10",
    VIEWER: "text-gray-400 bg-gray-400/10",
  };

  // Load API keys on mount
  useEffect(() => {
    if (canManageApiKeys) {
      loadApiKeys();
    }
  }, [canManageApiKeys]);

  // Load API keys
  const loadApiKeys = async () => {
    if (!canManageApiKeys) return;

    setApiKeysLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.slug}/api-keys`);
      if (!response.ok) {
        throw new Error("Failed to load API keys");
      }

      const result = await response.json();
      setApiKeys(result.data || []);
    } catch (error) {
      console.error("Error loading API keys:", error);
      alert("Failed to load API keys. Please try again.");
    } finally {
      setApiKeysLoading(false);
    }
  };

  // Save project settings
  const handleSaveProject = async () => {
    if (!canEditSettings) return;

    setProjectLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.slug}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update project");
      }

      const updatedProject = await response.json();

      // If the slug changed, redirect to the new URL
      if (updatedProject.slug !== project.slug) {
        router.push(`/${updatedProject.slug}/settings`);
        return;
      }

      setEditingProject(false);
      router.refresh();
    } catch (error) {
      console.error("Error updating project:", error);
      alert("Failed to update project. Please try again.");
    } finally {
      setProjectLoading(false);
    }
  };

  // Delete project
  const handleDeleteProject = async () => {
    if (!isOwner) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.slug}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      router.push("/projects");
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Failed to delete project. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Invite member
  const handleInviteMember = async () => {
    if (!canManageMembers || !inviteData.email.trim()) return;

    setInviteLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.slug}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inviteData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to invite member");
      }

      const newMember = await response.json();
      setMembers([...members, newMember]);
      setInviteData({ email: "", role: "MEMBER" });
      setShowInviteForm(false);
    } catch (error) {
      console.error("Error inviting member:", error);
      alert(error instanceof Error ? error.message : "Failed to invite member. Please try again.");
    } finally {
      setInviteLoading(false);
    }
  };

  // Update member role
  const handleUpdateMemberRole = async (memberId: string, newRole: MemberRole) => {
    if (!canManageMembers) return;

    try {
      const response = await fetch(`/api/projects/${project.slug}/members/${memberId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update member role");
      }

      const updatedMember = await response.json();
      setMembers(members.map(m => m.id === memberId ? updatedMember : m));
    } catch (error) {
      console.error("Error updating member role:", error);
      alert(error instanceof Error ? error.message : "Failed to update member role. Please try again.");
    }
  };

  // Remove member
  const handleRemoveMember = async (memberId: string) => {
    if (!canManageMembers) return;

    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const response = await fetch(`/api/projects/${project.slug}/members/${memberId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove member");
      }

      setMembers(members.filter(m => m.id !== memberId));
    } catch (error) {
      console.error("Error removing member:", error);
      alert(error instanceof Error ? error.message : "Failed to remove member. Please try again.");
    }
  };

  // Self-remove
  const handleSelfRemove = async () => {
    if (!confirm("Are you sure you want to leave this project?")) return;

    try {
      const response = await fetch(`/api/projects/${project.slug}/members/${currentUserMembership.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to leave project");
      }

      router.push("/projects");
    } catch (error) {
      console.error("Error leaving project:", error);
      alert(error instanceof Error ? error.message : "Failed to leave project. Please try again.");
    }
  };

  // Create API key
  const handleCreateApiKey = async () => {
    if (!canManageApiKeys || !createKeyData.name.trim()) return;

    setCreateKeyLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.slug}/api-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createKeyData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create API key");
      }

      const newKey: ApiKeyWithFullKey = await response.json();
      setApiKeys([newKey, ...apiKeys]);
      setNewApiKey(newKey.key);
      setCreateKeyData({ name: "", expiresAt: undefined });
      setShowCreateKeyForm(false);
    } catch (error) {
      console.error("Error creating API key:", error);
      alert(error instanceof Error ? error.message : "Failed to create API key. Please try again.");
    } finally {
      setCreateKeyLoading(false);
    }
  };

  // Delete/revoke API key
  const handleDeleteApiKey = async (keyId: string) => {
    if (!canManageApiKeys) return;

    setDeleteKeyLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.slug}/api-keys/${keyId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to revoke API key");
      }

      setApiKeys(apiKeys.filter(k => k.id !== keyId));
      setShowDeleteKeyConfirm(null);
    } catch (error) {
      console.error("Error revoking API key:", error);
      alert(error instanceof Error ? error.message : "Failed to revoke API key. Please try again.");
    } finally {
      setDeleteKeyLoading(false);
    }
  };

  // Copy key to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("API key copied to clipboard!");
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      alert("Failed to copy to clipboard. Please copy manually.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Project Settings Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-100">Project Settings</h2>
          {canEditSettings && !editingProject && (
            <button
              onClick={() => setEditingProject(true)}
              className="px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-100 rounded-md border border-gray-700 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {editingProject ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="Enter project name"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="Enter project description (optional)"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveProject}
                disabled={projectLoading || !projectName.trim()}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
              >
                {projectLoading ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingProject(false);
                  setProjectName(project.name);
                  setProjectDescription(project.description || "");
                }}
                disabled={projectLoading}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Project Name
              </label>
              <div className="text-gray-100">{project.name}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Slug
              </label>
              <div className="text-gray-400 font-mono text-sm">{project.slug}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <div className="text-gray-100">
                {project.description || <span className="text-gray-500 italic">No description</span>}
              </div>
            </div>

            {isOwner && (
              <div className="pt-4 border-t border-gray-800">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded-md transition-colors"
                >
                  Delete Project
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Members Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-100">Members</h2>
          {canManageMembers && (
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="px-3 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-md transition-colors"
            >
              {showInviteForm ? "Cancel" : "Invite Member"}
            </button>
          )}
        </div>

        {/* Invite Form */}
        {showInviteForm && (
          <div className="mb-6 p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <h3 className="text-lg font-medium text-gray-100 mb-4">Invite Member</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="member@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Role
                </label>
                <select
                  value={inviteData.role}
                  onChange={(e) => setInviteData({ ...inviteData, role: e.target.value as MemberRole })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                  {isOwner && <option value="OWNER">Owner</option>}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleInviteMember}
                disabled={inviteLoading || !inviteData.email.trim()}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
              >
                {inviteLoading ? "Inviting..." : "Send Invite"}
              </button>
            </div>
          </div>
        )}

        {/* Members List */}
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-300">
                    {member.user.name?.[0]?.toUpperCase() || member.user.email[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-gray-100">
                    {member.user.name || "Unnamed User"}
                    {member.user.id === currentUserMembership.userId && (
                      <span className="ml-2 text-sm text-gray-400">(You)</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">{member.user.email}</div>
                  <div className="text-xs text-gray-500">
                    Joined {new Date(member.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Role Badge/Dropdown */}
                {canManageMembers &&
                 member.user.id !== currentUserMembership.userId &&
                 (member.role !== "OWNER" || isOwner) ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleUpdateMemberRole(member.id, e.target.value as MemberRole)}
                    className="px-2 py-1 text-xs bg-gray-900 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                    {isOwner && <option value="OWNER">Owner</option>}
                  </select>
                ) : (
                  <span className={`px-2 py-1 text-xs rounded-full ${roleColors[member.role]}`}>
                    {member.role}
                  </span>
                )}

                {/* Remove Button */}
                {member.user.id === currentUserMembership.userId ? (
                  <button
                    onClick={handleSelfRemove}
                    className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors"
                  >
                    Leave
                  </button>
                ) : canManageMembers && (member.role !== "OWNER" || isOwner) ? (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="px-3 py-1 text-xs bg-red-900 hover:bg-red-800 text-red-100 rounded-md transition-colors"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Keys Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-100">API Keys</h2>
          {canManageApiKeys && (
            <button
              onClick={() => setShowCreateKeyForm(!showCreateKeyForm)}
              className="px-3 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-md transition-colors"
            >
              {showCreateKeyForm ? "Cancel" : "Create API Key"}
            </button>
          )}
        </div>

        {!canManageApiKeys ? (
          <p className="text-gray-400">
            Contact a project admin to manage API keys.
          </p>
        ) : (
          <>
            {/* Create API Key Form */}
            {showCreateKeyForm && (
              <div className="mb-6 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                <h3 className="text-lg font-medium text-gray-100 mb-4">Create API Key</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={createKeyData.name}
                      onChange={(e) => setCreateKeyData({ ...createKeyData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      placeholder="e.g., Production API, CI/CD Pipeline"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Expiration Date (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={createKeyData.expiresAt || ""}
                      onChange={(e) => setCreateKeyData({ ...createKeyData, expiresAt: e.target.value || undefined })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <button
                      onClick={handleCreateApiKey}
                      disabled={createKeyLoading || !createKeyData.name.trim()}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
                    >
                      {createKeyLoading ? "Creating..." : "Create API Key"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* New API Key Display (shown once after creation) */}
            {newApiKey && (
              <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 text-yellow-400 mt-0.5">
                    ⚠️
                  </div>
                  <div className="flex-1">
                    <h3 className="text-yellow-400 font-medium mb-2">
                      API Key Created Successfully
                    </h3>
                    <p className="text-yellow-200 text-sm mb-3">
                      This key won't be shown again. Copy it now.
                    </p>
                    <div className="flex items-center gap-2 p-3 bg-gray-900 border border-gray-700 rounded-md">
                      <code className="flex-1 text-gray-100 font-mono text-sm break-all">
                        {newApiKey}
                      </code>
                      <button
                        onClick={() => copyToClipboard(newApiKey)}
                        className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-100 rounded transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <button
                      onClick={() => setNewApiKey(null)}
                      className="mt-3 text-sm text-yellow-400 hover:text-yellow-300 underline"
                    >
                      I've copied the key, dismiss this message
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* API Keys List */}
            {apiKeysLoading ? (
              <div className="text-center py-8 text-gray-400">
                Loading API keys...
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No API keys created yet.
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-100 mb-1">
                        {key.name}
                      </div>
                      <div className="text-sm text-gray-400 font-mono mb-1">
                        {key.keyPrefix}...{key.keyPreview}
                      </div>
                      <div className="text-xs text-gray-500">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                        {key.lastUsedAt && (
                          <> • Last used {new Date(key.lastUsedAt).toLocaleDateString()}</>
                        )}
                        {key.expiresAt && (
                          <> • Expires {new Date(key.expiresAt).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => setShowDeleteKeyConfirm(key.id)}
                        className="px-3 py-1 text-xs bg-red-900 hover:bg-red-800 text-red-100 rounded-md transition-colors"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Usage Example */}
            <div className="mt-8 p-4 bg-gray-800 border border-gray-700 rounded-lg">
              <h3 className="text-lg font-medium text-gray-100 mb-3">Usage Example</h3>
              <pre className="text-sm text-gray-300 bg-gray-900 p-3 rounded border border-gray-600 overflow-x-auto">
{`curl -X POST https://taskpulse.workermill.com/api/trigger \\
  -H "Authorization: Bearer tp_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"task": "send-welcome-email", "input": {"email": "user@example.com"}}'`}
              </pre>
            </div>
          </>
        )}
      </div>

      {/* Delete Project Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Delete Project</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this project? This action cannot be undone.
              All tasks, runs, and data will be permanently deleted.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteProject}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
              >
                {deleteLoading ? "Deleting..." : "Delete Project"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete API Key Confirmation Modal */}
      {showDeleteKeyConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Revoke API Key</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to revoke this API key? This action cannot be undone.
              Any applications using this key will lose access immediately.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDeleteApiKey(showDeleteKeyConfirm)}
                disabled={deleteKeyLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
              >
                {deleteKeyLoading ? "Revoking..." : "Revoke API Key"}
              </button>
              <button
                onClick={() => setShowDeleteKeyConfirm(null)}
                disabled={deleteKeyLoading}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}