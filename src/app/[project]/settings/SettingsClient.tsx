"use client";

import { useState } from "react";
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

  // Helper functions
  const isOwner = currentUserMembership.role === "OWNER";
  const canManageMembers = currentUserMembership.role === "ADMIN" || currentUserMembership.role === "OWNER";

  const roleColors = {
    OWNER: "text-violet-400 bg-violet-400/10",
    ADMIN: "text-blue-400 bg-blue-400/10",
    MEMBER: "text-green-400 bg-green-400/10",
    VIEWER: "text-gray-400 bg-gray-400/10",
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

      {/* API Keys Section - Placeholder */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">API Keys</h2>
        <p className="text-gray-400">
          API key management coming in the next update.
        </p>
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
    </div>
  );
}