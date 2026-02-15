export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ project: string; id: string }>;
}) {
  const { project, id } = await params;
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <h1 className="text-2xl font-semibold">Task Detail</h1>
      <p className="text-gray-400 mt-2">Project: {project}</p>
      <p className="text-gray-400">Task ID: {id}</p>
    </div>
  );
}