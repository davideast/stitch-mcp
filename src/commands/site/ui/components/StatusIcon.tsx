import React from 'react';
import { Text } from 'ink';

interface StatusIconProps {
  status: 'included' | 'ignored' | 'discarded';
}

export const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  if (status === 'included') {
    return <Text color="green">✔ </Text>;
  }
  if (status === 'discarded') {
    return <Text color="red">✖ </Text>;
  }
  return <Text color="gray">- </Text>;
};
