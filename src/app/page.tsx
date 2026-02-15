"use client";

import { signIn } from "next-auth/react";

export default function LandingPage() {
  const handleTryDemo = () => {
    signIn("credentials", {
      email: "demo@workermill.com",
      password: "demo1234",
      callbackUrl: "/projects"
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Hero Section */}
      <div className="relative">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-gray-950 to-gray-950"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
              Background Tasks,{" "}
              <span className="text-violet-400">Monitored.</span>
            </h1>

            <p className="text-xl sm:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto">
              Real-time observability for your background jobs. Track execution,
              debug failures, and optimize performance with TaskPulse.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <button
                onClick={handleTryDemo}
                className="px-8 py-4 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg transition-colors text-lg"
              >
                Try the Demo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-violet-600/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Task Registry</h3>
            <p className="text-gray-400">Centralized catalog of all your background tasks and their configurations.</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-violet-600/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Real-time Traces</h3>
            <p className="text-gray-400">Follow execution paths with detailed tracing and performance metrics.</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-violet-600/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Log Streaming</h3>
            <p className="text-gray-400">Live log aggregation with filtering, search, and structured output.</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-violet-600/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Scheduling</h3>
            <p className="text-gray-400">Cron-based scheduling with timezone support and failure handling.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-400">
            Built by{" "}
            <a
              href="https://workermill.com"
              className="text-violet-400 hover:text-violet-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              WorkerMill
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}