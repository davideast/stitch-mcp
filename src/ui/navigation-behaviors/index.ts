/**
 * Navigation behaviors for the JSON viewer.
 * Handles drill-down navigation into screens and back navigation.
 */

export interface NavigationContext {
  /** Current selected path */
  path: string;
  /** Current node value */
  value: any;
  /** The key of the node */
  key: string;
}

export interface NavigationResult {
  /** Whether navigation should occur */
  shouldNavigate: boolean;
  /** Target resource to navigate to */
  target?: string;
  /** Type of navigation (e.g., 'screen', 'project') */
  type?: string;
}

export type NavigationHandler = (ctx: NavigationContext) => NavigationResult;

/**
 * Detects if the current node is within screenInstances and can navigate to a screen.
 * When on screenInstances[x] or screenInstances[x].sourceScreen, extract the sourceScreen value.
 */
export function screenInstanceNavigationHandler(ctx: NavigationContext): NavigationResult {
  // Check if we're in a screenInstances path
  if (!ctx.path.includes('screenInstances')) {
    return { shouldNavigate: false };
  }

  // If value is an object with sourceScreen, use that
  if (ctx.value && typeof ctx.value === 'object' && ctx.value.sourceScreen) {
    return {
      shouldNavigate: true,
      target: ctx.value.sourceScreen,
      type: 'screen',
    };
  }

  // If we're on the sourceScreen property itself
  if (ctx.key === 'sourceScreen' && typeof ctx.value === 'string') {
    return {
      shouldNavigate: true,
      target: ctx.value,
      type: 'screen',
    };
  }

  return { shouldNavigate: false };
}

/**
 * Registry of navigation handlers.
 * Handlers are checked in order, first match wins.
 */
const navigationHandlers: NavigationHandler[] = [
  screenInstanceNavigationHandler,
];

/**
 * Get navigation result for a given context.
 */
export function getNavigationTarget(ctx: NavigationContext): NavigationResult {
  for (const handler of navigationHandlers) {
    const result = handler(ctx);
    if (result.shouldNavigate) {
      return result;
    }
  }
  return { shouldNavigate: false };
}

/**
 * Register a custom navigation handler.
 */
export function registerNavigationHandler(handler: NavigationHandler): void {
  navigationHandlers.unshift(handler); // Add at start for priority
}
