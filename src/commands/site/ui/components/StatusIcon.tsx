import React from 'react';
import { Text } from 'ink';

interface StatusIconProps {
  status: 'included' | 'ignored';
}

export const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  if (status === 'included') {
    return <Text color="green">✔ </Text>;
  }
  return <Text color="gray">- </Text>;
};
