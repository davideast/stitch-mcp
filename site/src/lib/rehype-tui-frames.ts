import { visit } from "unist-util-visit";
import type { Root, Element, ElementContent } from "hast";

const TERMINAL_LANGUAGES = new Set(["bash", "sh", "shell", "zsh"]);
const NO_LABEL_LANGUAGES = new Set(["plaintext"]);

function getLabel(language: string): string | null {
  if (NO_LABEL_LANGUAGES.has(language)) return null;
  if (TERMINAL_LANGUAGES.has(language)) return "TERMINAL";
  return language.toUpperCase();
}

function createCopyButton(): Element {
  return {
    type: "element",
    tagName: "button",
    properties: {
      className: ["tui-frame-copy"],
      dataRole: "tui-copy",
      type: "button",
    },
    children: [{ type: "text", value: "COPY" }],
  };
}

/** Extract raw text from a hast node tree. */
function extractText(node: ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element" && node.children) {
    return node.children.map(extractText).join("");
  }
  return "";
}

/** Build structured terminal HTML from raw lines of a bash code block. */
function buildTerminalLines(lines: string[]): ElementContent[] {
  const result: ElementContent[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Skip trailing empty line
    if (i === lines.length - 1 && line === "") continue;

    if (line.startsWith("$ ")) {
      // Command line: $ command
      const cmd = line.slice(2);
      const div: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["tui-cmd"] },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["tui-prompt"] },
            children: [{ type: "text", value: "$" }],
          },
          {
            type: "element",
            tagName: "span",
            properties: { className: ["tui-cmd-text"] },
            children: [{ type: "text", value: cmd }],
          },
        ],
      };
      result.push(div);
      result.push({ type: "text", value: "\n" });
    } else if (line.startsWith("# ")) {
      // Comment line
      const span: Element = {
        type: "element",
        tagName: "span",
        properties: { className: ["tui-comment"] },
        children: [{ type: "text", value: line }],
      };
      result.push(span);
      result.push({ type: "text", value: "\n" });
    } else {
      // Output line
      const div: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["tui-output"] },
        children: [{ type: "text", value: line }],
      };
      result.push(div);
      result.push({ type: "text", value: "\n" });
    }
  }

  // Remove trailing newline
  const last = result[result.length - 1];
  if (last && last.type === "text") {
    result.pop();
  }

  return result;
}

/** Process a bash code block's <code> element to use structured terminal markup. */
function structureBashBlock(preNode: Element): void {
  const codeNode = preNode.children.find(
    (c): c is Element => c.type === "element" && c.tagName === "code"
  );
  if (!codeNode) return;

  // Extract raw text from all children (Shiki line spans)
  const rawText = codeNode.children.map(extractText).join("");
  const lines = rawText.split("\n");

  // Only restructure if there's at least one command line
  const hasCommand = lines.some((l) => l.startsWith("$ "));
  if (!hasCommand) return;

  codeNode.children = buildTerminalLines(lines);
}

/**
 * Rehype plugin that wraps Shiki code blocks in a TUI-style frame
 * with a labeled header bar, decorative dots, and a copy button.
 * For bash/shell blocks, also restructures content into command/output/comment markup.
 */
export function rehypeTuiFrames() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (
        node.tagName !== "pre" ||
        !node.properties?.dataLanguage ||
        !parent ||
        index === undefined
      )
        return;

      const language = String(node.properties.dataLanguage);
      const label = getLabel(language);

      // Restructure bash blocks before wrapping in frame
      if (TERMINAL_LANGUAGES.has(language)) {
        structureBashBlock(node);
      }

      const headerRight: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["tui-frame-actions"] },
        children: [
          createCopyButton(),
          {
            type: "element",
            tagName: "div",
            properties: { className: ["tui-frame-dots"] },
            children: [
              { type: "element", tagName: "div", properties: {}, children: [] },
              { type: "element", tagName: "div", properties: {}, children: [] },
            ],
          },
        ],
      };

      const headerChildren: Element[] = [
        {
          type: "element",
          tagName: "span",
          properties: { className: ["tui-frame-label"] },
          children: label ? [{ type: "text", value: label }] : [],
        },
        headerRight,
      ];

      const header: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["tui-frame-header"] },
        children: headerChildren,
      };

      const wrapper: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["tui-frame"] },
        children: [header, node],
      };

      parent.children[index] = wrapper;
    });
  };
}
