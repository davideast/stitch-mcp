import { describe, it, expect } from 'bun:test';
import { suggestRoute } from './suggestRoute.js';

describe('suggestRoute', () => {
  it('maps "Home" to /', () => {
    expect(suggestRoute('Home')).toBe('/');
  });

  it('maps "About Us" to /about-us', () => {
    expect(suggestRoute('About Us')).toBe('/about-us');
  });

  it('maps "Landing" to /', () => {
    expect(suggestRoute('Landing')).toBe('/');
  });

  it('maps "Landing Page" to /', () => {
    expect(suggestRoute('Landing Page')).toBe('/');
  });

  it('maps "Index" to /', () => {
    expect(suggestRoute('Index')).toBe('/');
  });

  it('strips special characters and collapses hyphens', () => {
    expect(suggestRoute('Terms & Conditions!')).toBe('/terms-conditions');
  });

  it('collapses multiple spaces', () => {
    expect(suggestRoute('Our  Team')).toBe('/our-team');
  });

  it('maps a single-word title', () => {
    expect(suggestRoute('Pricing')).toBe('/pricing');
  });
});
