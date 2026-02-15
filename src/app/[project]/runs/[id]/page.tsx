export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ project: string; id: string }>;
}) {
  const { project, id } = await params;
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <h1 className="text-2xl font-semibold">Run Detail</h1>
      <p className="text-gray-400 mt-2">Project: {project}</p>
      <p className="text-gray-400">Run ID: {id}</p>
    </div>
  );
}