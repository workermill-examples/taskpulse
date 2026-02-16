import React from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { ProjectLayoutClient } from "./ProjectLayoutClient";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project: projectSlug } = await params;

  // Check authentication
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Fetch project data and verify access
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      members: {
        where: { userId: session.user.id },
        select: { role: true }
      }
    }
  });

  if (!project) {
    notFound();
  }

  // Check if user is a member
  if (project.members.length === 0) {
    redirect("/projects");
  }

  const projectData = {
    id: project.id,
    name: project.name,
    slug: project.slug,
  };

  return (
    <ProjectLayoutClient project={projectData}>
      {children}
    </ProjectLayoutClient>
  );
}