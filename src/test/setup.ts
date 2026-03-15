// Vitest test setup
// Add global test utilities and matchers here as needed

// Mock scrollIntoView — not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = () => {}

// Mock window.matchMedia — not implemented in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
