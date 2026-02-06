import React from 'react';
import { Box, Text } from 'ink';
import type { UIStack } from './types.js';
import { StatusIcon } from './components/StatusIcon.js';

interface ScreenListProps {
  stacks: UIStack[];
  activeIndex: number;
}

export const ScreenList: React.FC<ScreenListProps> = ({ stacks, activeIndex }) => {
  const VISIBLE_ITEMS = 20;
  // Adjust start to keep active item in view
  let start = 0;
  if (activeIndex >= VISIBLE_ITEMS) {
      start = activeIndex - VISIBLE_ITEMS + 1;
  }
  // Ideally center it:
  // start = Math.max(0, activeIndex - Math.floor(VISIBLE_ITEMS / 2));
  // But strictly keeping it in view is also fine.
  // Using the centered approach from thought process:
  start = Math.max(0, activeIndex - Math.floor(VISIBLE_ITEMS / 2));
  const end = Math.min(stacks.length, start + VISIBLE_ITEMS);

  // Correction if near end
  if (end - start < VISIBLE_ITEMS && stacks.length > VISIBLE_ITEMS) {
      start = Math.max(0, stacks.length - VISIBLE_ITEMS);
  }

  const visibleStacks = stacks.slice(start, end);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" width="30%" minWidth={30}>
      <Box paddingBottom={1} paddingLeft={1}>
        <Text bold>Screens ({stacks.length})</Text>
      </Box>
      {visibleStacks.map((stack, i) => {
        const index = start + i;
        const isActive = index === activeIndex;
        return (
          <Box key={stack.id}>
            <Text color={isActive ? 'cyan' : undefined}>
              {isActive ? '> ' : '  '}
            </Text>
            <StatusIcon
                status={stack.status}
                warning={stack.warning}
                isArtifact={stack.isArtifact}
                isObsolete={stack.isObsolete}
            />
            <Text color={isActive ? 'cyan' : undefined} wrap="truncate">
              {stack.title}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
