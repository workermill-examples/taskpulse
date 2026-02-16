import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  callback: () => void;
  description: string;
}

export interface UseKeyboardShortcutsOptions {
  onGlobalSearch?: () => void;
  onTriggerRun?: () => void;
  onHelp?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const {
    onGlobalSearch,
    onTriggerRun,
    onHelp,
    onEscape,
  } = options;

  const isInputElement = useCallback((element: Element): boolean => {
    const tagName = element.tagName.toLowerCase();
    const isInput = tagName === 'input' ||
                   tagName === 'textarea' ||
                   element.getAttribute('contenteditable') === 'true';

    // Also check if it's a select or has role of textbox
    const isInteractive = tagName === 'select' ||
                         element.getAttribute('role') === 'textbox';

    return isInput || isInteractive;
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as Element;
    const isTypingInInput = isInputElement(target);

    // Always allow Escape to work, even in inputs
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      onEscape();
      return;
    }

    // Skip other shortcuts when typing in inputs
    if (isTypingInInput) {
      return;
    }

    // Global search shortcuts: / or Ctrl/Cmd+K
    if ((event.key === '/' ||
         (event.key === 'k' && (event.metaKey || event.ctrlKey))) &&
        onGlobalSearch) {
      event.preventDefault();
      onGlobalSearch();
      return;
    }

    // Trigger run: N
    if (event.key === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey && onTriggerRun) {
      event.preventDefault();
      onTriggerRun();
      return;
    }

    // Help: ?
    if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey && onHelp) {
      event.preventDefault();
      onHelp();
      return;
    }
  }, [onGlobalSearch, onTriggerRun, onHelp, onEscape, isInputElement]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Return the available shortcuts for display in help
  const shortcuts: KeyboardShortcut[] = [
    {
      key: '/',
      callback: onGlobalSearch || (() => {}),
      description: 'Open global search'
    },
    {
      key: 'k',
      metaKey: true,
      callback: onGlobalSearch || (() => {}),
      description: 'Open global search (Cmd+K)'
    },
    {
      key: 'k',
      ctrlKey: true,
      callback: onGlobalSearch || (() => {}),
      description: 'Open global search (Ctrl+K)'
    },
    {
      key: 'n',
      callback: onTriggerRun || (() => {}),
      description: 'Open trigger run dialog'
    },
    {
      key: 'Escape',
      callback: onEscape || (() => {}),
      description: 'Close modal/dialog/search'
    },
    {
      key: '?',
      callback: onHelp || (() => {}),
      description: 'Show keyboard shortcuts help'
    }
  ].filter(shortcut => {
    // Only include shortcuts that have callbacks
    if (shortcut.key === '/' || (shortcut.key === 'k' && (shortcut.metaKey || shortcut.ctrlKey))) {
      return !!onGlobalSearch;
    }
    if (shortcut.key === 'n') {
      return !!onTriggerRun;
    }
    if (shortcut.key === 'Escape') {
      return !!onEscape;
    }
    if (shortcut.key === '?') {
      return !!onHelp;
    }
    return false;
  });

  return { shortcuts };
}