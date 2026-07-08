import "@testing-library/jest-dom";

// ponytail: stub mínimo pra Radix no jsdom (sem ResizeObserver nativo)
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as never;
