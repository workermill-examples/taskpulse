export default async function TasksPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <h1 className="text-2xl font-semibold">Tasks</h1>
      <p className="text-gray-400 mt-2">Project: {project}</p>
    </div>
  );
}