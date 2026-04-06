import type { StitchToolClient, Stitch } from '@google/stitch-sdk';
import type { VirtualTool } from '../spec.js';

// Maximum serialized JSON size in characters (~100KB)
const MAX_DATA_LENGTH = 100_000;

// Serializes jsonData to a normalized JSON string.
// Always round-trips through JSON.parse/stringify to validate inputs,
// escape characters that could break prompt fencing, and detect circular references.
function serializeJsonData(jsonData: unknown): string {
  if (typeof jsonData === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonData);
    } catch {
      throw new Error('jsonData string is not valid JSON');
    }
    return JSON.stringify(parsed, null, 2);
  }
  try {
    return JSON.stringify(jsonData, null, 2);
  } catch {
    throw new Error(
      'jsonData could not be serialized to JSON (circular reference or non-serializable value)',
    );
  }
}

// Builds an enhanced prompt that instructs Stitch to generate
// a screen whose HTML renders the provided JSON data.
function buildDataBoundPrompt(designPrompt: string, dataStr: string): string {
  return [
    designPrompt,
    '',
    'DATA BINDING REQUIREMENTS:',
    'The generated HTML must display the following live data inline.',
    'Render every field from the JSON below in the appropriate UI component.',
    'Use semantic HTML elements. Do not fetch external data — embed the values directly.',
    '',
    '```json',
    dataStr,
    '```',
    '',
    'IMPORTANT: The HTML must be self-contained with all data rendered inline.',
    'Use the data values above as the actual content in the UI components.',
  ].join('\n');
}

// Extracts top-level keys from the data for response metadata.
// For arrays, returns the keys of the first element.
function extractTopLevelKeys(data: unknown): string[] {
  let parsed = data;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return Object.keys(parsed);
  }
  if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
    return Object.keys(parsed[0]);
  }
  return [];
}

export const generateScreenFromJsonTool: VirtualTool = {
  name: 'generate_screen_from_json',
  description: '(Virtual) Generates a new screen from a design prompt with live JSON data embedded. Combines a design description with actual API/app data so the generated HTML renders real content.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Required. The project ID to generate the screen in.',
      },
      prompt: {
        type: 'string',
        description: 'Required. The design prompt describing the desired screen layout and style.',
      },
      jsonData: {
        type: 'object',
        description: 'Required. The JSON data to bind into the generated screen. Accepts an object, array, or JSON string. All values will be rendered inline in the HTML.',
      },
    },
    required: ['projectId', 'prompt', 'jsonData'],
  },
  execute: async (client: StitchToolClient, args: any, stitch?: Stitch) => {
    const { projectId, prompt, jsonData } = args;

    if (!projectId || typeof projectId !== 'string') {
      throw new Error('projectId is required and must be a string');
    }
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('prompt is required and must be a string');
    }
    if (jsonData === undefined || jsonData === null) {
      throw new Error('jsonData is required');
    }

    const dataStr = serializeJsonData(jsonData);

    if (dataStr.length > MAX_DATA_LENGTH) {
      throw new Error(
        `jsonData is too large (${dataStr.length} chars). Maximum allowed: ${MAX_DATA_LENGTH}`,
      );
    }

    const enhancedPrompt = buildDataBoundPrompt(prompt, dataStr);

    const result = await client.callTool('generate_screen_from_text', {
      projectId,
      prompt: enhancedPrompt,
    });

    return {
      generateResult: result,
      dataBound: true,
      originalPrompt: prompt,
      dataKeys: extractTopLevelKeys(jsonData),
    };
  },
};
