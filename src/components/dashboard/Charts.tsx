"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";
import { DashboardStats } from "@/types";
import { formatDuration } from "@/lib/utils";

interface ChartsProps {
  stats: DashboardStats;
}

export function Charts({ stats }: ChartsProps) {
  // Status colors matching the design system
  const statusColors = {
    COMPLETED: "#34d399", // emerald-400 (green)
    FAILED: "#f87171", // red-400
    QUEUED: "#60a5fa", // blue-400
    EXECUTING: "#fbbf24", // yellow-400
    CANCELLED: "#6b7280", // gray-500
    TIMED_OUT: "#fb923c", // orange-400
  };

  // Prepare data for runs by status donut chart
  const statusData = Object.entries(stats.runsByStatus)
    .filter(([_, count]) => count > 0) // Only show statuses with runs
    .map(([status, count]) => ({
      name: status,
      value: count,
      color: statusColors[status as keyof typeof statusColors],
    }));

  // Prepare data for runs by task bar chart
  const taskData = stats.runsByTask
    .slice(0, 10) // Top 10 tasks
    .map((item) => ({
      name: item.taskDisplayName, // Use display name for better UX
      count: item.count,
    }));

  // Calculate success rate color
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return "#34d399"; // emerald-400
    if (rate >= 70) return "#fbbf24"; // amber-400
    return "#f87171"; // red-400
  };

  // Custom tooltip for dark theme
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 text-gray-100 p-2 rounded shadow-lg">
          {label && <p className="font-medium">{label}</p>}
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm">
              <span style={{ color: entry.color }}>{entry.name}: </span>
              {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom label for pie chart center
  const renderCustomLabel = () => {
    const total = Object.values(stats.runsByStatus).reduce((a, b) => a + b, 0);
    return (
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-gray-100 text-lg font-semibold"
      >
        {total}
      </text>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Runs by Status - Donut Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Runs by Status</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {statusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {renderCustomLabel()}
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {statusData.map((entry) => (
            <div key={entry.name} className="flex items-center text-sm">
              <div
                className="w-3 h-3 rounded mr-2"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-300">{entry.name}</span>
              <span className="ml-auto text-gray-100">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Runs by Task - Horizontal Bar Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Runs by Task</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={taskData}
            layout="horizontal"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              type="number"
              tick={{ fill: "#9ca3af", fontSize: 12 }}
              axisLine={{ stroke: "#1f2937" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "#9ca3af", fontSize: 12 }}
              axisLine={{ stroke: "#1f2937" }}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Runs Over Time - Area Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Runs Over Time</h3>
        <p className="text-sm text-gray-400 mb-4">Last 30 days</p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={stats.runsOverTime}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#9ca3af", fontSize: 12 }}
              axisLine={{ stroke: "#1f2937" }}
              tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 12 }}
              axisLine={{ stroke: "#1f2937" }}
            />
            <Tooltip
              content={<CustomTooltip />}
              labelFormatter={(date) => new Date(date).toLocaleDateString()}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#8b5cf6"
              fillOpacity={1}
              fill="url(#colorCount)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Success Rate - Large Number Display */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Success Rate</h3>
        <div className="text-center">
          <div
            className="text-6xl font-bold mb-2"
            style={{ color: getSuccessRateColor(stats.successRate) }}
          >
            {stats.successRate.toFixed(1)}%
          </div>
          <p className="text-gray-400 text-sm mb-4">Last 30 days</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-100 font-medium">{stats.totalRuns}</div>
              <div className="text-gray-400">Total runs</div>
            </div>
            <div>
              <div className="text-red-400 font-medium">{stats.failedRuns}</div>
              <div className="text-gray-400">Failed (24h)</div>
            </div>
          </div>
          {stats.avgDuration && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="text-gray-100 font-medium">
                {formatDuration(stats.avgDuration)}
              </div>
              <div className="text-gray-400 text-sm">Avg duration</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}