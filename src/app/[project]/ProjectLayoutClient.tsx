'use client';

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

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
  const pathname = usePathname();

  // Extract current page from pathname
  const currentPage = pathname.split('/').pop() || 'overview';

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

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
    </div>
  );
}