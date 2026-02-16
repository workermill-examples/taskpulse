"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import type { KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsHelpProps {
  shortcuts: KeyboardShortcut[];
}

function KeyboardIcon({ className }: { className?: string }) {
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
        d="M9 11H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2v-6a2 2 0 00-2-2h-2M9 7h6l2 2-2 2H9V7z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
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
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

export default function KeyboardShortcutsHelp({ shortcuts }: KeyboardShortcutsHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Listen for ? key to open help
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only open if not already open and not in an input
      if (event.key === '?' && !isOpen && !isInputElement(event.target as Element)) {
        event.preventDefault();
        setIsOpen(true);
      } else if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const isInputElement = (element: Element): boolean => {
    const tagName = element.tagName.toLowerCase();
    return tagName === 'input' ||
           tagName === 'textarea' ||
           element.getAttribute('contenteditable') === 'true' ||
           tagName === 'select' ||
           element.getAttribute('role') === 'textbox';
  };

  const formatShortcutKey = (shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];

    // Determine platform-specific modifier
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');

    if (shortcut.ctrlKey) {
      parts.push(isMac ? '⌃' : 'Ctrl');
    }
    if (shortcut.metaKey) {
      parts.push(isMac ? '⌘' : 'Cmd');
    }
    if (shortcut.altKey) {
      parts.push(isMac ? '⌥' : 'Alt');
    }
    if (shortcut.shiftKey) {
      parts.push(isMac ? '⇧' : 'Shift');
    }

    // Format key name
    let keyName = shortcut.key;
    if (keyName === ' ') {
      keyName = 'Space';
    } else if (keyName.length === 1) {
      keyName = keyName.toUpperCase();
    }

    parts.push(keyName);

    return parts.join(isMac ? '' : '+');
  };

  return (
    <>
      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm" />

        {/* Full-screen container */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto max-w-md w-full rounded-lg bg-gray-900 border border-gray-800 p-6 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <KeyboardIcon className="w-5 h-5 text-violet-400" />
                <DialogTitle className="text-lg font-semibold text-gray-100">
                  Keyboard Shortcuts
                </DialogTitle>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-100 transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Shortcuts list */}
            <div className="space-y-3">
              {shortcuts.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">
                    {shortcut.description}
                  </span>
                  <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">
                    {formatShortcutKey(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-500 text-center">
                Press <kbd className="px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs font-mono">Esc</kbd> to close
              </p>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}