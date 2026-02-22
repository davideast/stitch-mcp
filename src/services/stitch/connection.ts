import {
  type ConnectionTestResult,
  type TestConnectionInput,
  type TestConnectionWithApiKeyInput,
} from './spec.js';

export class StitchConnectionService {
  async testConnectionWithApiKey(input: TestConnectionWithApiKeyInput): Promise<ConnectionTestResult> {
    try {
      const url = process.env.STITCH_HOST || 'https://stitch.googleapis.com/mcp';

      const payload = {
        method: 'tools/call',
        jsonrpc: '2.0',
        params: {
          name: 'list_projects',
          arguments: {},
        },
        id: 1,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'X-Goog-Api-Key': input.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorDetails = '';
        let errorMessage = `API request failed with status ${response.status}`;

        try {
          const errorBody = await response.json() as any;
          errorDetails = JSON.stringify(errorBody, null, 2);

          if (errorBody?.error?.message) {
            errorMessage = errorBody.error.message;
          }
        } catch {
          try {
            errorDetails = await response.text();
          } catch {
            errorDetails = `Status ${response.status}: ${response.statusText}`;
          }
        }

        return {
          success: false,
          error: {
            code: response.status === 403 ? 'PERMISSION_DENIED' : 'CONNECTION_TEST_FAILED',
            message: errorMessage,
            suggestion:
              response.status === 403
                ? 'Check that your API key is valid and has access to the Stitch API'
                : 'Verify API key configuration and try again',
            recoverable: true,
            details: errorDetails,
          },
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          connected: true,
          statusCode: response.status,
          url,
          response: data,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_TEST_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  async testConnection(input: TestConnectionInput): Promise<ConnectionTestResult> {
    try {
      const url = process.env.STITCH_HOST || 'https://stitch.googleapis.com/mcp';

      const payload = {
        method: 'tools/call',
        jsonrpc: '2.0',
        params: {
          name: 'list_projects',
          arguments: {},
        },
        id: 1,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${input.accessToken}`,
          'X-Goog-User-Project': input.projectId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Capture full error response which may contain helpful URLs
        let errorDetails = '';
        let errorMessage = `API request failed with status ${response.status}`;

        try {
          const errorBody = await response.json() as any;
          errorDetails = JSON.stringify(errorBody, null, 2);

          // Extract error message if available
          if (errorBody?.error?.message) {
            errorMessage = errorBody.error.message;
          }
        } catch {
          // If response isn't JSON, try to get text
          try {
            errorDetails = await response.text();
          } catch {
            errorDetails = `Status ${response.status}: ${response.statusText}`;
          }
        }

        return {
          success: false,
          error: {
            code: response.status === 403 ? 'PERMISSION_DENIED' : 'CONNECTION_TEST_FAILED',
            message: errorMessage,
            suggestion:
              response.status === 403
                ? 'Check IAM permissions and ensure API is enabled'
                : 'Verify project configuration and try again',
            recoverable: true,
            details: errorDetails,
          },
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          connected: true,
          statusCode: response.status,
          url,
          response: data,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_TEST_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }
}
