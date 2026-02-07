import React from 'react';
import { Box, Text, useStdout } from 'ink';
import type { UIScreen } from './types.js';
import { StatusIcon } from './components/StatusIcon.js';

interface ScreenListProps {
  items: { screen: UIScreen; sourceIndex: number }[];
  activeIndex: number;
}

export const ScreenList: React.FC<ScreenListProps> = ({ items, activeIndex }) => {
  const { stdout } = useStdout();
  const height = stdout ? stdout.rows : 20; // Default to 20 if unavailable
  const LIST_HEIGHT = Math.max(5, height - 10); // Reserve space for header/footer

  // Adjust start to keep active item in view
  let start = 0;
  if (activeIndex >= LIST_HEIGHT) {
    start = activeIndex - LIST_HEIGHT + 1;
  }
  start = Math.max(0, activeIndex - Math.floor(LIST_HEIGHT / 2));
  const end = Math.min(items.length, start + LIST_HEIGHT);

  // Correction if near end
  if (end - start < LIST_HEIGHT && items.length > LIST_HEIGHT) {
    start = Math.max(0, items.length - LIST_HEIGHT);
  }

  const visibleItems = items.slice(start, end);

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="blue">
      {start > 0 && (
        <Box paddingLeft={1}>
          <Text color="gray">... {start} more above ...</Text>
        </Box>
      )}

      {visibleItems.map((item, i) => {
        const index = start + i;
        const isActive = index === activeIndex;
        const { screen } = item;

        return (
          <Box key={screen.id}>
            <Text color={isActive ? 'cyan' : undefined}>
              {isActive ? '> ' : '  '}
            </Text>
            <StatusIcon status={screen.status} />
            <Text color={isActive ? 'cyan' : undefined} wrap="truncate">
              {screen.title}
            </Text>
            {screen.route && (
              <Text color="gray">{' -> '}{screen.route}</Text>
            )}
          </Box>
        );
      })}

      {end < items.length && (
        <Box paddingLeft={1}>
          <Text color="gray">... {items.length - end} more below ...</Text>
        </Box>
      )}
    </Box>
  );
};
