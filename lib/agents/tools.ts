import { tool, zodSchema } from 'ai'
import { z } from 'zod'

/**
 * Tool definitions for the agentic pipeline (AI SDK v7).
 * These tools allow the AI to explicitly call file operations and commands
 * during generation, with each tool call streaming as a distinct event.
 *
 * Provider-agnostic: works with any model that supports tool calling.
 * For models that don't support tools, the agent-runner falls back to
 * structured JSON output and the pipeline infers actions from the output.
 */

export const agentTools = {
  read_file: tool({
    description: 'Read the contents of a file in the project workspace',
    inputSchema: zodSchema(z.object({
      path: z.string().describe('The file path to read, relative to project root'),
    })),
  }),

  create_file: tool({
    description: 'Create a new file in the project workspace',
    inputSchema: zodSchema(z.object({
      path: z.string().describe('The file path to create, relative to project root'),
      content: z.string().describe('The complete file content'),
    })),
  }),

  edit_file: tool({
    description: 'Edit an existing file by replacing a section of its content',
    inputSchema: zodSchema(z.object({
      path: z.string().describe('The file path to edit, relative to project root'),
      oldContent: z.string().describe('The exact old content to replace'),
      newContent: z.string().describe('The new content to replace it with'),
    })),
  }),

  run_command: tool({
    description: 'Run a shell command in the project workspace (e.g., npm install, build, test)',
    inputSchema: zodSchema(z.object({
      command: z.string().describe('The shell command to execute'),
    })),
  }),
}

export type AgentToolName = keyof typeof agentTools
