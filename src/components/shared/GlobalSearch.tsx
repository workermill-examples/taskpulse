"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogPanel } from "@headlessui/react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: 'run' | 'task';
  title: string;
  subtitle: string;
  status?: string;
  url: string;
}

interface Task {
  id: string;
  name: string;
  displayName: string;
  description?: string;
}

interface Run {
  id: string;
  status: string;
  task: {
    id: string;
    displayName: string;
    name: string;
  };
  createdAt: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  projectSlug: string;
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

const STORAGE_KEY = 'taskpulse-recent-searches';
const MAX_RECENT_SEARCHES = 5;

export default function GlobalSearch({ isOpen, onClose, projectSlug }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setRecentSearches(JSON.parse(saved));
        }
      } catch (error) {
        console.warn('Failed to load recent searches:', error);
      }
    }
  }, []);

  // Save recent search
  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setRecentSearches(prev => {
      const updated = [searchQuery, ...prev.filter(s => s !== searchQuery)]
        .slice(0, MAX_RECENT_SEARCHES);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (error) {
          console.warn('Failed to save recent search:', error);
        }
      }

      return updated;
    });
  }, []);

  // Debounced search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      // Search runs and tasks in parallel
      const [runsResponse, tasksResponse] = await Promise.all([
        fetch(`/api/projects/${projectSlug}/runs?limit=10`),
        fetch(`/api/projects/${projectSlug}/tasks?limit=10`)
      ]);

      const [runsData, tasksData] = await Promise.all([
        runsResponse.ok ? runsResponse.json() : { data: [] },
        tasksResponse.ok ? tasksResponse.json() : { data: [] }
      ]);

      const runs: Run[] = runsData.data || [];
      const tasks: Task[] = tasksData.data || [];

      // Filter results based on search query
      const searchLower = searchQuery.toLowerCase();

      const filteredRuns = runs
        .filter(run =>
          run.task.displayName.toLowerCase().includes(searchLower) ||
          run.task.name.toLowerCase().includes(searchLower) ||
          run.status.toLowerCase().includes(searchLower) ||
          run.id.toLowerCase().includes(searchLower)
        )
        .slice(0, 5);

      const filteredTasks = tasks
        .filter(task =>
          task.displayName.toLowerCase().includes(searchLower) ||
          task.name.toLowerCase().includes(searchLower) ||
          (task.description && task.description.toLowerCase().includes(searchLower))
        )
        .slice(0, 5);

      // Transform to search results
      const searchResults: SearchResult[] = [
        ...filteredRuns.map(run => ({
          id: run.id,
          type: 'run' as const,
          title: run.task.displayName,
          subtitle: `Run ${run.id.slice(0, 8)} • ${run.status}`,
          status: run.status,
          url: `/${projectSlug}/runs/${run.id}`
        })),
        ...filteredTasks.map(task => ({
          id: task.id,
          type: 'task' as const,
          title: task.displayName,
          subtitle: task.description || task.name,
          url: `/${projectSlug}/tasks/${task.id}`
        }))
      ];

      setResults(searchResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [projectSlug]);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!results.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && results[selectedIndex]) {
      event.preventDefault();
      handleSelectResult(results[selectedIndex]);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    saveRecentSearch(query);
    onClose();
    router.push(result.url);
  };

  const handleClose = () => {
    setQuery('');
    setResults([]);
    setSelectedIndex(0);
    onClose();
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return 'text-green-400 bg-green-500/20';
      case 'FAILED':
        return 'text-red-400 bg-red-500/20';
      case 'EXECUTING':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'QUEUED':
        return 'text-blue-400 bg-blue-500/20';
      case 'CANCELLED':
        return 'text-gray-400 bg-gray-500/20';
      case 'TIMED_OUT':
        return 'text-orange-400 bg-orange-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm" />

      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-start justify-center pt-[10vh] p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full">
          {/* Search Input */}
          <div className="bg-gray-900 border border-gray-800 rounded-t-lg p-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search tasks and runs..."
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-gray-100 font-mono text-lg placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
              />
            </div>
          </div>

          {/* Search Results */}
          {(query || recentSearches.length > 0) && (
            <div className="bg-gray-900 border-l border-r border-gray-800 max-h-96 overflow-auto">
              {/* Recent Searches */}
              {!query && recentSearches.length > 0 && (
                <div className="p-3 border-b border-gray-800">
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                    Recent Searches
                  </h3>
                  {recentSearches.map((recent, index) => (
                    <button
                      key={index}
                      onClick={() => setQuery(recent)}
                      className="block w-full text-left px-3 py-2 text-gray-300 hover:bg-gray-800 rounded text-sm"
                    >
                      {recent}
                    </button>
                  ))}
                </div>
              )}

              {/* Search Results */}
              {query && (
                <>
                  {isSearching && (
                    <div className="p-4 text-center text-gray-400">
                      Searching...
                    </div>
                  )}

                  {!isSearching && results.length === 0 && query && (
                    <div className="p-4 text-center text-gray-400">
                      No results found for "{query}"
                    </div>
                  )}

                  {!isSearching && results.length > 0 && (
                    <div className="divide-y divide-gray-800">
                      {results.map((result, index) => (
                        <button
                          key={result.id}
                          onClick={() => handleSelectResult(result)}
                          className={cn(
                            "w-full px-4 py-3 text-left hover:bg-gray-800 focus:bg-gray-800 outline-none transition-colors",
                            index === selectedIndex && "bg-gray-800"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-100">
                                {result.title}
                              </div>
                              <div className="text-sm text-gray-400">
                                {result.subtitle}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {result.status && (
                                <span className={cn(
                                  "px-2 py-1 rounded-full text-xs font-medium",
                                  getStatusBadgeColor(result.status)
                                )}>
                                  {result.status}
                                </span>
                              )}
                              <span className="text-xs text-gray-500 uppercase tracking-wide">
                                {result.type}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-900 border border-gray-800 rounded-b-lg px-4 py-3">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span>Esc Close</span>
              </div>
              {results.length > 0 && (
                <span>
                  {results.length} result{results.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}