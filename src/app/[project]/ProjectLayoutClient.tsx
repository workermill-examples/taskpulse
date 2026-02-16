'use client';

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import GlobalSearch from "@/components/shared/GlobalSearch";
import KeyboardShortcutsHelp from "@/components/shared/KeyboardShortcutsHelp";
import TriggerRunDialog from "@/components/runs/TriggerRunDialog";

interface ProjectLayoutClientProps {
  project: {
    id: string;
    name: string;
    slug: string;
  };
  children: React.ReactNode;
}

export function ProjectLayoutClient({ project, children }: ProjectLayoutClientProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isTriggerRunOpen, setIsTriggerRunOpen] = useState(false);
  const pathname = usePathname();

  // Extract current page from pathname
  const currentPage = pathname.split('/').pop() || 'overview';

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Set up keyboard shortcuts
  const { shortcuts } = useKeyboardShortcuts({
    onGlobalSearch: () => setIsGlobalSearchOpen(true),
    onTriggerRun: () => setIsTriggerRunOpen(true),
    onHelp: () => {}, // Help is handled internally by KeyboardShortcutsHelp
    onEscape: () => {
      // Close any open modals/dialogs
      if (isGlobalSearchOpen) {
        setIsGlobalSearchOpen(false);
      } else if (isTriggerRunOpen) {
        setIsTriggerRunOpen(false);
      }
    },
  });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <Sidebar
          project={project}
          isMobileOpen={isMobileMenuOpen}
          onMobileToggle={toggleMobileMenu}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col md:ml-0">
          {/* Header */}
          <Header
            project={project}
            currentPage={currentPage}
            onMobileMenuToggle={toggleMobileMenu}
          />

          {/* Page content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>

      {/* Global Components */}
      <GlobalSearch
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        projectSlug={project.slug}
      />

      <KeyboardShortcutsHelp shortcuts={shortcuts} />

      <TriggerRunDialog
        isOpen={isTriggerRunOpen}
        onClose={() => setIsTriggerRunOpen(false)}
        projectSlug={project.slug}
      />
    </div>
  );
}