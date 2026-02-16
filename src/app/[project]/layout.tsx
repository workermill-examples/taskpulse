import React from "react";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {children}
    </div>
  );
}