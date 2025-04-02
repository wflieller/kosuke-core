/// <reference types="jest" />
import '@testing-library/jest-dom';

// Mock IntersectionObserver which is not available in jsdom
if (typeof window !== 'undefined') {
  window.IntersectionObserver = class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = '0px';
    readonly thresholds: ReadonlyArray<number> = [0];

    constructor() {}
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  };
}

// Suppress console errors/warnings in test output
beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});
