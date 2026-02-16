'use client';

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";

interface HeaderProps {
  project: {
    id: string;
    name: string;
    slug: string;
  };
  currentPage: string;
  onMobileMenuToggle: () => void;
}

export function Header({ project, currentPage, onMobileMenuToggle }: HeaderProps) {
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <header className="bg-gray-900 border-b border-gray-800 h-16">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        {/* Left side: Mobile menu button + Breadcrumb */}
        <div className="flex items-center space-x-4">
          {/* Mobile hamburger menu */}
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Breadcrumb */}
          <nav className="flex items-center space-x-2 text-sm">
            <span className="text-gray-400">{project.name}</span>
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-200 font-medium capitalize">{currentPage}</span>
          </nav>
        </div>

        {/* Right side: User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-3 p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
          >
            {/* User avatar */}
            <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {session?.user?.name?.charAt(0)?.toUpperCase() || session?.user?.email?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>

            {/* User info */}
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-200">
                {session?.user?.name || "User"}
              </p>
              <p className="text-xs text-gray-400">
                {session?.user?.email}
              </p>
            </div>

            {/* Dropdown arrow */}
            <svg
              className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 z-50">
              {/* User info header */}
              <div className="px-4 py-3 border-b border-gray-700">
                <p className="text-sm font-medium text-gray-200">
                  {session?.user?.name || "User"}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {session?.user?.email}
                </p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Click outside to close dropdown */}
          {showUserMenu && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowUserMenu(false)}
            />
          )}
        </div>
      </div>
    </header>
  );
}