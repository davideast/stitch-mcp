import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { getHandler, type CopyResult } from './copy-behaviors/index.js';
import { getNavigationTarget, type NavigationResult } from './navigation-behaviors/index.js';

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
  depth: number = 0,
  rootLabel?: string
): TreeNode[] {
  const nodes: TreeNode[] = [];
  const type = getType(data);

  // If rootLabel is provided and we're at the root level, add a root node
  if (rootLabel && prefix === '' && depth === 0) {
    const isExpanded = expandedIds.has(rootLabel);
    nodes.push({
      id: rootLabel,
      key: rootLabel,
      value: data,
      depth: 0,
      isLeaf: false,
      isExpanded,
      hasChildren: true,
    });

    if (isExpanded) {
      nodes.push(...buildVisibleTree(data, expandedIds, rootLabel, 1));
    }
    return nodes;
  }

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

interface JsonTreeProps {
  data: any;
  /** Optional label for root object - when set, root is selectable for copying */
  rootLabel?: string;
  /** Called when user navigates into a resource (Enter on screenInstances) */
  onNavigate?: (result: NavigationResult) => void;
  /** Called when user wants to go back (Backspace/Delete) */
  onBack?: () => void;
}

export const JsonTree = ({ data, rootLabel, onNavigate, onBack }: JsonTreeProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    if (rootLabel) {
      ids.add(rootLabel);
    } else if (data && typeof data === 'object') {
      Object.keys(data).forEach((key) => ids.add(key));
    }
    return ids;
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const lastCPressTime = useRef<number>(0);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleNodes = useMemo(() => {
    return buildVisibleTree(data, expandedIds, '', 0, rootLabel);
  }, [data, expandedIds, rootLabel]);

  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q') {
      exit();
    }

    // Handle 'c' key for copy
    if (input === 'c') {
      const node = visibleNodes[selectedIndex];
      if (!node) return;

      const now = Date.now();
      const timeSinceLastC = now - lastCPressTime.current;
      lastCPressTime.current = now;

      // Double-tap detection (within 300ms = 'cc')
      const isDoubleTap = timeSinceLastC < 300;

      const handler = getHandler(node.id);

      // Progress callback for immediate feedback during async operations
      const onProgress = (message: string) => {
        if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
        setFeedbackMessage(message);
      };

      const ctx = { key: node.key, value: node.value, path: node.id, onProgress };

      const showFeedback = (result: CopyResult) => {
        if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
        setFeedbackMessage(result.message);
        feedbackTimeout.current = setTimeout(() => setFeedbackMessage(null), 3000);
      };

      if (isDoubleTap) {
        handler.copyExtended(ctx).then(showFeedback);
      } else {
        // Wait briefly to see if it's a double-tap
        setTimeout(() => {
          if (Date.now() - lastCPressTime.current >= 280) {
            handler.copy(ctx).then(showFeedback);
          }
        }, 300);
      }
      return;
    }

    // Handle 'o' key to open project in Stitch web app
    if (input === 'o') {
      const node = visibleNodes[selectedIndex];
      if (!node) return;

      // Try to extract project ID from various sources
      let projectId: string | undefined;

      // Check if path contains 'projects' and extract the ID
      const projectsMatch = node.id.match(/projects\.(\d+)/);
      if (projectsMatch && projectsMatch[1]) {
        // We're somewhere inside a project in the list view
        // Need to find the actual project name from the data
        const projectIndex = parseInt(projectsMatch[1], 10);
        const project = data.projects?.[projectIndex];
        if (project?.name) {
          projectId = project.name.replace('projects/', '');
        }
      }

      // Check if we're in a single project/resource view
      if (!projectId && typeof node.value === 'object' && node.value?.name) {
        const nameMatch = node.value.name.match(/projects\/(\d+)/);
        if (nameMatch) {
          projectId = nameMatch[1];
        }
      }

      // Check if the node's name property contains a project ID
      if (!projectId && node.key === 'name' && typeof node.value === 'string') {
        const nameMatch = node.value.match(/projects\/(\d+)/);
        if (nameMatch) {
          projectId = nameMatch[1];
        }
      }

      // Check if rootLabel is 'screen' or 'resource' and data has a name
      if (!projectId && (rootLabel === 'screen' || rootLabel === 'resource')) {
        const nameMatch = data.name?.match(/projects\/(\d+)/);
        if (nameMatch) {
          projectId = nameMatch[1];
        }
      }

      if (projectId) {
        const url = `https://stitch.withgoogle.com/projects/${projectId}`;
        // Open in browser using platform command
        const openCmd = process.platform === 'darwin' ? 'open' :
          process.platform === 'win32' ? 'start' : 'xdg-open';
        Bun.spawn([openCmd, url]);

        if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
        setFeedbackMessage(`🔗 Opened project in browser`);
        feedbackTimeout.current = setTimeout(() => setFeedbackMessage(null), 3000);
      } else {
        if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
        setFeedbackMessage(`⚠️ No project found at this path`);
        feedbackTimeout.current = setTimeout(() => setFeedbackMessage(null), 3000);
      }
      return;
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

      // Check for navigation on Enter (not rightArrow)
      if (key.return && node && onNavigate) {
        const navResult = getNavigationTarget({ path: node.id, value: node.value, key: node.key });
        if (navResult.shouldNavigate) {
          onNavigate(navResult);
          return;
        }
      }
    }

    // Backspace/Delete for back navigation
    if ((key.delete || key.backspace) && onBack) {
      onBack();
      return;
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
            const itemCount = Object.keys(node.value).length;
            // Try to show a meaningful label for objects (title, name, id, etc.)
            const label = node.value.title || node.value.name || node.value.displayName || node.value.id || null;
            if (label && typeof label === 'string') {
              valueDisplay = `${type} "${label}" (${itemCount})`;
            } else {
              valueDisplay = `${type} ${itemCount} items`;
            }
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
        Selected Path: {visibleNodes[selectedIndex]?.id || 'none'} | Press 'c' to copy, 'cc' for extended
      </Text>
      {feedbackMessage && (
        <Text color="cyan" bold>{feedbackMessage}</Text>
      )}
    </Box>
  );
};
