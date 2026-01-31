import React, { useState, useMemo, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

type TreeNode = {
  id: string; // Unique path identifier
  key: string;
  value: any;
  depth: number;
  isLeaf: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
};

function getType(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function buildVisibleTree(
  data: any,
  expandedIds: Set<string>,
  prefix: string = '',
  depth: number = 0
): TreeNode[] {
  const nodes: TreeNode[] = [];
  const type = getType(data);

  if (type === 'object' || type === 'array') {
    const keys = Object.keys(data);

    for (const key of keys) {
      const value = data[key];
      const id = prefix ? `${prefix}.${key}` : key;
      const valueType = getType(value);
      const isLeaf = valueType !== 'object' && valueType !== 'array';
      const hasChildren = !isLeaf && Object.keys(value).length > 0;
      const isExpanded = expandedIds.has(id);

      nodes.push({
        id,
        key,
        value,
        depth,
        isLeaf,
        isExpanded,
        hasChildren,
      });

      if (hasChildren && isExpanded) {
        nodes.push(...buildVisibleTree(value, expandedIds, id, depth + 1));
      }
    }
  }

  return nodes;
}

export const JsonTree = ({ data }: { data: any }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Initial expansion of root if needed?
  // Let's start collapsed or maybe expand top level?
  // If data is an object, we want to see its keys.
  // The root itself isn't a node in my builder, the keys are.
  // If we want to see the root object's properties, they are the top level nodes.

  const visibleNodes = useMemo(() => {
    return buildVisibleTree(data, expandedIds);
  }, [data, expandedIds]);

  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q') {
      exit();
    }

    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }

    if (key.downArrow) {
      setSelectedIndex(Math.min(visibleNodes.length - 1, selectedIndex + 1));
    }

    if (key.rightArrow || key.return) {
      const node = visibleNodes[selectedIndex];
      if (node && node.hasChildren) {
        if (!node.isExpanded) {
          const newExpanded = new Set(expandedIds);
          newExpanded.add(node.id);
          setExpandedIds(newExpanded);
        }
      }
    }

    if (key.leftArrow) {
      const node = visibleNodes[selectedIndex];
      if (node) {
        if (node.isExpanded) {
          const newExpanded = new Set(expandedIds);
          newExpanded.delete(node.id);
          setExpandedIds(newExpanded);
        } else {
            // Move to parent
            // Find parent ID by removing last segment
            const lastDot = node.id.lastIndexOf('.');
            if (lastDot !== -1) {
                const parentId = node.id.substring(0, lastDot);
                const parentIndex = visibleNodes.findIndex(n => n.id === parentId);
                if (parentIndex !== -1) {
                    setSelectedIndex(parentIndex);
                    // Optional: Collapse parent when moving back to it?
                    // Usually Left arrow on a collapsed node moves to parent.
                }
            } else {
                // Top level, do nothing?
            }
        }
      }
    }
  });

  // Adjust scroll/window logic if list is long?
  // For simplicity, we render a slice around the cursor if needed, or rely on terminal scrolling.
  // Ink handles output, but if it's longer than screen height, it might be weird.
  // Let's just render all for now, typical terminals scroll.
  // But a static UI at bottom is better.
  // "Arrow through" implies a viewport.

  // Let's implement a simple viewport
  const viewportHeight = 20; // Configurable?
  const startRow = Math.max(0, Math.min(selectedIndex - 2, visibleNodes.length - viewportHeight));
  const endRow = Math.min(startRow + viewportHeight, visibleNodes.length);
  const viewportNodes = visibleNodes.slice(startRow, endRow);

  if (!data || typeof data !== 'object') {
      return <Text>Invalid data: {String(data)}</Text>;
  }

  if (Object.keys(data).length === 0) {
      return <Text>Empty object</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text color="blue" bold>JSON Viewer (Use Arrows to Navigate, 'q' to Quit)</Text>
      <Box flexDirection="column" borderStyle="single">
        {viewportNodes.map((node, index) => {
          const absoluteIndex = startRow + index;
          const isSelected = absoluteIndex === selectedIndex;
          const indentation = '  '.repeat(node.depth);

          let prefixChar = ' ';
          if (node.hasChildren) {
            prefixChar = node.isExpanded ? '▼' : '▶';
          }

          let valueDisplay = '';
          if (node.isLeaf) {
            const valType = getType(node.value);
            if (valType === 'string') valueDisplay = `"${node.value}"`;
            else valueDisplay = String(node.value);
          } else {
            const type = Array.isArray(node.value) ? '[]' : '{}';
            valueDisplay = `${type} ${Object.keys(node.value).length} items`;
          }

          return (
            <Box key={node.id}>
              <Text backgroundColor={isSelected ? 'blue' : undefined} color={isSelected ? 'white' : undefined} wrap="truncate">
                {indentation}
                <Text color="green">{prefixChar} {node.key}</Text>
                <Text>: </Text>
                <Text color="yellow">{valueDisplay}</Text>
              </Text>
            </Box>
          );
        })}
        {visibleNodes.length > viewportHeight && (
            <Text color="gray">... {visibleNodes.length - endRow} more items ...</Text>
        )}
      </Box>
      <Text color="gray">
          Selected Path: {visibleNodes[selectedIndex]?.id || 'none'}
      </Text>
    </Box>
  );
};
