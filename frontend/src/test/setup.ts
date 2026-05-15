import '@testing-library/jest-dom'

// ResizeObserver is not available in jsdom — provide a no-op stub so components
// that use it (e.g. Canvas) mount without errors. Tests that need layout-driven
// behaviour can set containerSizeRef manually or spy on the mock.
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
