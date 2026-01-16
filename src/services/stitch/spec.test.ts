import { describe, test, expect } from 'bun:test';
import type { StitchService } from './spec.js';
import { StitchHandler } from './handler.js';

describe('StitchService Contract', () => {
  test('StitchHandler should implement StitchService', () => {
    // This is a type-level test. If the following line compiles,
    // it means StitchHandler correctly implements the StitchService interface.
    const handler: StitchService = new StitchHandler();

    // The expect is trivial, but it makes the test runner happy.
    // The real test is the static type check during compilation.
    expect(handler).toBeInstanceOf(StitchHandler);
  });
});
