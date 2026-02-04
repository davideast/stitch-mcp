/**
 * Interactive viewer with navigation support.
 * Wraps JsonTree to handle drill-down navigation and back navigation.
 */
import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { JsonTree } from './JsonTree.js';
import type { NavigationResult } from './navigation-behaviors/index.js';

export interface ViewerState {
  data: any;
  rootLabel?: string;
  resourcePath?: string;
}

interface InteractiveViewerProps {
  initialData: any;
  initialRootLabel?: string;
  /** Pre-populated navigation history (for back navigation from deep links) */
  initialHistory?: ViewerState[];
  /** Fetch function to load new resource data */
  onFetch: (resourceName: string) => Promise<any>;
  /** Called when exiting the viewer */
  onExit?: () => void;
}

export const InteractiveViewer = ({
  initialData,
  initialRootLabel,
  initialHistory,
  onFetch,
  onExit,
}: InteractiveViewerProps) => {
  // Use initialHistory if provided, otherwise start with just the initial data
  const [history, setHistory] = useState<ViewerState[]>(() => {
    if (initialHistory && initialHistory.length > 0) {
      return [...initialHistory, { data: initialData, rootLabel: initialRootLabel }];
    }
    return [{ data: initialData, rootLabel: initialRootLabel }];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentState = history[history.length - 1];

  const handleNavigate = useCallback(async (result: NavigationResult) => {
    if (!result.target) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await onFetch(result.target);

      // Determine rootLabel based on navigation type
      let rootLabel: string | undefined;
      if (result.type === 'screen') {
        rootLabel = 'screen';
      } else if (result.type === 'project') {
        rootLabel = 'project';
      } else {
        rootLabel = 'resource';
      }

      setHistory(prev => [...prev, { data, rootLabel, resourcePath: result.target }]);
    } catch (err) {
      setError(`Navigation failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }, [onFetch]);

  const handleBack = useCallback(() => {
    if (history.length > 1) {
      setHistory(prev => prev.slice(0, -1));
      setError(null);
    }
  }, [history.length]);

  if (isLoading) {
    return (
      <Box flexDirection="column">
        <Text color="blue">Loading...</Text>
      </Box>
    );
  }

  // Should never happen since we initialize with one item, but satisfies TypeScript
  if (!currentState) {
    return <Text color="red">No data to display</Text>;
  }

  return (
    <Box flexDirection="column">
      {history.length > 1 && (
        <Text color="gray" dimColor>
          ← Press Backspace to go back ({history.length - 1} level{history.length > 2 ? 's' : ''} deep)
        </Text>
      )}
      {error && <Text color="red">{error}</Text>}
      <JsonTree
        key={history.length}
        data={currentState.data}
        rootLabel={currentState.rootLabel}
        onNavigate={handleNavigate}
        onBack={history.length > 1 ? handleBack : undefined}
      />
    </Box>
  );
};
