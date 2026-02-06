import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { UIStack } from './types.js';

interface DetailPaneProps {
  stack: UIStack | undefined;
  isEditing: boolean;
  onRouteChanged: (value: string) => void;
  onSubmit: () => void;
}

export const DetailPane: React.FC<DetailPaneProps> = ({ stack, isEditing, onRouteChanged, onSubmit }) => {
  if (!stack) {
    return (
        <Box borderStyle="single" borderColor="white" flexDirection="column" width="70%" padding={1}>
            <Text>No screen selected</Text>
        </Box>
    );
  }

  return (
    <Box borderStyle="single" borderColor="white" flexDirection="column" width="70%" padding={1}>
      <Box marginBottom={1}>
          <Text bold underline>{stack.title}</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray">ID: {stack.id}</Text>
        <Text color="gray">Versions: {stack.versions.length}</Text>
        {stack.isArtifact && <Text color="yellow">Detected as Artifact</Text>}
        {stack.isObsolete && <Text color="yellow">Detected as Obsolete</Text>}
      </Box>

      {stack.warning && (
          <Box borderStyle="single" borderColor="yellow" padding={1} marginBottom={1}>
              <Text color="yellow">⚠️  {stack.warning}</Text>
          </Box>
      )}

      <Box flexDirection="column">
          <Text bold>Route:</Text>
          <Box borderStyle="round" borderColor={isEditing ? 'green' : 'gray'}>
             {isEditing ? (
                 <TextInput
                    value={stack.route}
                    onChange={onRouteChanged}
                    onSubmit={onSubmit}
                 />
             ) : (
                 <Text>{stack.route}</Text>
             )}
          </Box>
          <Text color="gray" dimColor>
              {isEditing ? 'Press Enter to confirm' : 'Press Enter to edit'}
          </Text>
      </Box>

      <Box marginTop={1}>
          <Text>Status: </Text>
          <Text color={stack.status === 'included' ? 'green' : 'red'}>
              {stack.status.toUpperCase()}
          </Text>
          <Text color="gray" dimColor> (Press Space to toggle)</Text>
      </Box>
    </Box>
  );
};
