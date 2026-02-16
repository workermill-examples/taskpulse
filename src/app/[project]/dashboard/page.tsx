import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getUserProjectMembership } from "@/lib/middleware";
import { Charts } from "@/components/dashboard/Charts";
import { formatDuration } from "@/lib/utils";
import type { DashboardStats } from "@/types";

async function fetchDashboardStats(projectSlug: string): Promise<DashboardStats> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/projects/${projectSlug}/stats`, {
      cache: "no-store", // Always fetch fresh data
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    // Return empty stats as fallback
    return {
      runsByStatus: {
        QUEUED: 0,
        EXECUTING: 0,
        COMPLETED: 0,
        FAILED: 0,
        CANCELLED: 0,
        TIMED_OUT: 0,
      },
      runsByTask: [],
      runsOverTime: [],
      avgDuration: null,
      successRate: 0,
      totalRuns: 0,
      failedRuns: 0,
    };
  }
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: projectSlug } = await params;

  // Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check project access
  const membership = await getUserProjectMembership(projectSlug, session.user.id);
  if (!membership) {
    notFound();
  }

  // Fetch dashboard stats
  const stats = await fetchDashboardStats(projectSlug);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-100 mb-8">Dashboard</h1>

        {/* Summary Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Runs Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Total Runs</p>
                <p className="text-2xl font-bold text-gray-100">{stats.totalRuns}</p>
              </div>
              <div className="p-2 bg-violet-500/20 rounded-lg">
                <svg
                  className="w-6 h-6 text-violet-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Success Rate Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Success Rate</p>
                <p className="text-2xl font-bold text-gray-100">{stats.successRate.toFixed(1)}%</p>
              </div>
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <svg
                  className="w-6 h-6 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Average Duration Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Avg Duration</p>
                <p className="text-2xl font-bold text-gray-100">
                  {stats.avgDuration ? formatDuration(stats.avgDuration) : "N/A"}
                </p>
              </div>
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <svg
                  className="w-6 h-6 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Failed (Last 24h) Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Failed (24h)</p>
                <p className={`text-2xl font-bold ${stats.failedRuns > 0 ? 'text-red-400' : 'text-gray-100'}`}>
                  {stats.failedRuns}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${stats.failedRuns > 0 ? 'bg-red-500/20' : 'bg-gray-500/20'}`}>
                <svg
                  className={`w-6 h-6 ${stats.failedRuns > 0 ? 'text-red-400' : 'text-gray-400'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 15.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <Charts stats={stats} />
      </div>
    </div>
  );
}