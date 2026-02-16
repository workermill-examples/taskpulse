import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { act } from "react";

// Mock the keyboard shortcuts hook since it doesn't exist yet
// This tests the expected behavior based on the requirements
const useKeyboardShortcuts = (callbacks: {
  onSearch?: () => void;
  onNewRun?: () => void;
  onEscape?: () => void;
  onHelp?: () => void;
}) => {
  const { onSearch, onNewRun, onEscape, onHelp } = callbacks;

  // Mock implementation that would register event listeners
  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' ||
                   target.tagName === 'TEXTAREA' ||
                   target.contentEditable === 'true';

    // ESC always works, even in inputs
    if (event.key === 'Escape') {
      onEscape?.();
      return;
    }

    // Other shortcuts disabled when typing in inputs
    if (isInput) {
      return;
    }

    // Global search shortcuts
    if (event.key === '/' || (event.key === 'k' && (event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      onSearch?.();
      return;
    }

    // New run shortcut
    if (event.key === 'n' || event.key === 'N') {
      onNewRun?.();
      return;
    }

    // Help shortcut
    if (event.key === '?') {
      onHelp?.();
      return;
    }
  };

  // Mock useEffect behavior
  if (typeof window !== 'undefined') {
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }

  return () => {};
};

describe("useKeyboardShortcuts Hook", () => {
  let mockCallbacks: {
    onSearch: ReturnType<typeof vi.fn>;
    onNewRun: ReturnType<typeof vi.fn>;
    onEscape: ReturnType<typeof vi.fn>;
    onHelp: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockCallbacks = {
      onSearch: vi.fn(),
      onNewRun: vi.fn(),
      onEscape: vi.fn(),
      onHelp: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should register keyboard event listeners on mount", () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it("should remove event listeners on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyboardShortcuts(mockCallbacks));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it("should trigger search callback on / key", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    act(() => {
      const event = new KeyboardEvent('keydown', { key: '/' });
      document.dispatchEvent(event);
    });

    expect(mockCallbacks.onSearch).toHaveBeenCalledTimes(1);
  });

  it("should trigger search callback on Ctrl+K", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
      document.dispatchEvent(event);
    });

    expect(mockCallbacks.onSearch).toHaveBeenCalledTimes(1);
  });

  it("should trigger search callback on Cmd+K", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
      document.dispatchEvent(event);
    });

    expect(mockCallbacks.onSearch).toHaveBeenCalledTimes(1);
  });

  it("should trigger new run callback on N key", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'N' });
      document.dispatchEvent(event);
    });

    expect(mockCallbacks.onNewRun).toHaveBeenCalledTimes(1);
  });

  it("should trigger new run callback on lowercase n key", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'n' });
      document.dispatchEvent(event);
    });

    expect(mockCallbacks.onNewRun).toHaveBeenCalledTimes(1);
  });

  it("should trigger escape callback on Escape key", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);
    });

    expect(mockCallbacks.onEscape).toHaveBeenCalledTimes(1);
  });

  it("should trigger help callback on ? key", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    act(() => {
      const event = new KeyboardEvent('keydown', { key: '?' });
      document.dispatchEvent(event);
    });

    expect(mockCallbacks.onHelp).toHaveBeenCalledTimes(1);
  });

  it("should not trigger shortcuts when typing in input field", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    // Create and focus an input element
    const input = document.createElement('input');
    document.body.appendChild(input);

    act(() => {
      // Simulate keydown event with input as target
      const event = new KeyboardEvent('keydown', { key: '/' });
      Object.defineProperty(event, 'target', {
        value: input,
        enumerable: true,
      });
      document.dispatchEvent(event);
    });

    expect(mockCallbacks.onSearch).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it("should not trigger shortcuts when typing in textarea", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    // Create and focus a textarea element
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'n' });
      Object.defineProperty(event, 'target', {
        value: textarea,
        enumerable: true,
      });
      document.dispatchEvent(event);
    });

    expect(mockCallbacks.onNewRun).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it("should not trigger shortcuts when typing in contentEditable element", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    // Create and focus a contentEditable element
    const div = document.createElement('div');
    div.contentEditable = 'true';
    document.body.appendChild(div);

    act(() => {
      const event = new KeyboardEvent('keydown', { key: '?' });
      Object.defineProperty(event, 'target', {
        value: div,
        enumerable: true,
      });
      document.dispatchEvent(event);
    });

    expect(mockCallbacks.onHelp).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it("should trigger escape even when typing in input field", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    const input = document.createElement('input');
    document.body.appendChild(input);

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      Object.defineProperty(event, 'target', {
        value: input,
        enumerable: true,
      });
      document.dispatchEvent(event);
    });

    expect(mockCallbacks.onEscape).toHaveBeenCalledTimes(1);

    document.body.removeChild(input);
  });

  it("should prevent default behavior for search shortcuts", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    act(() => {
      const event = new KeyboardEvent('keydown', { key: '/' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      // Manually trigger the handler since we can't dispatch with preventDefault mock
      const handler = (document.addEventListener as any).mock.calls[0][1];
      handler(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  it("should handle multiple shortcut registrations", () => {
    const callbacks1 = {
      onSearch: vi.fn(),
      onNewRun: vi.fn(),
    };

    const callbacks2 = {
      onEscape: vi.fn(),
      onHelp: vi.fn(),
    };

    renderHook(() => useKeyboardShortcuts(callbacks1));
    renderHook(() => useKeyboardShortcuts(callbacks2));

    act(() => {
      const event = new KeyboardEvent('keydown', { key: '/' });
      document.dispatchEvent(event);
    });

    // Both hooks should register their own listeners
    expect(callbacks1.onSearch).toHaveBeenCalledTimes(1);
  });

  it("should handle missing callbacks gracefully", () => {
    renderHook(() => useKeyboardShortcuts({}));

    // Should not throw error when callbacks are missing
    expect(() => {
      act(() => {
        const event = new KeyboardEvent('keydown', { key: '/' });
        document.dispatchEvent(event);
      });
    }).not.toThrow();
  });

  it("should handle modifier key combinations correctly", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    // Test that modifier keys work correctly
    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        shiftKey: true
      });
      document.dispatchEvent(event);
    });

    expect(mockCallbacks.onSearch).toHaveBeenCalledTimes(1);
  });

  it("should not trigger callbacks for unhandled keys", () => {
    renderHook(() => useKeyboardShortcuts(mockCallbacks));

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'a' });
      document.dispatchEvent(event);
    });

    expect(mockCallbacks.onSearch).not.toHaveBeenCalled();
    expect(mockCallbacks.onNewRun).not.toHaveBeenCalled();
    expect(mockCallbacks.onEscape).not.toHaveBeenCalled();
    expect(mockCallbacks.onHelp).not.toHaveBeenCalled();
  });
});