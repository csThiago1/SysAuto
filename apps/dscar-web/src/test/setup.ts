import "@testing-library/jest-dom";

// ponytail: stub mínimo pra Radix no jsdom (sem ResizeObserver nativo)
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as never;

// ponytail: jsdom não implementa URL.createObjectURL/revokeObjectURL
if (!URL.createObjectURL) URL.createObjectURL = () => "blob:mock";
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
