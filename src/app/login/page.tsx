"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const callbackUrl = searchParams.get("callbackUrl") || "/projects";

    // Validate callback URL to prevent open redirect
    const isValidCallback = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//");
    const finalCallbackUrl = isValidCallback ? callbackUrl : "/projects";

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: finalCallbackUrl,
      redirect: false,
    });

    if (result && "error" in result && result.error) {
      setError("Invalid email or password");
      setIsLoading(false);
    } else if (result && "ok" in result && result.ok) {
      // Success - redirect manually
      window.location.href = finalCallbackUrl;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold">
            Sign in to TaskPulse
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Monitor your background tasks with real-time observability
          </p>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-800 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="relative block w-full px-3 py-3 border border-gray-700 placeholder-gray-500 text-gray-100 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                placeholder="Email address"
              />
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="relative block w-full px-3 py-3 border border-gray-700 placeholder-gray-500 text-gray-100 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                placeholder="Password"
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center">{error}</div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-400">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-xs text-gray-500 text-center">
              Demo credentials: demo@workermill.com / demo1234
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}