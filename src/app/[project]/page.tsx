import { redirect } from "next/navigation";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;

  // Redirect to runs page as specified in the ticket
  redirect(`/${project}/runs`);
}