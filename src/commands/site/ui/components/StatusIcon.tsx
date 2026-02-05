import React from 'react';
import { Text } from 'ink';

interface StatusIconProps {
  status: 'included' | 'ignored';
  warning?: string;
  isArtifact?: boolean;
  isObsolete?: boolean;
}

export const StatusIcon: React.FC<StatusIconProps> = ({ status, warning, isArtifact, isObsolete }) => {
  if (warning) {
    return <Text color="yellow">⚠️ </Text>;
  }
  if (isArtifact) {
    return <Text color="gray">🖼️ </Text>;
  }
  if (isObsolete) {
    return <Text color="gray">🏚️ </Text>;
  }

  if (status === 'included') {
    return <Text color="green">✔ </Text>;
  }
  return <Text color="gray">✖ </Text>;
};
