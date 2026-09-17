import type { IncomingMessage, ServerResponse } from 'node:http'
import { type NodeIncomingMessageLike, toNodeHandler } from '@modelcontextprotocol/node'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import type { ToolName } from '@web-harness/protocol'
import * as z from 'zod/v4'

export type ExecuteTool = (
  tool: ToolName,
  input: Record<string, unknown>,
  surface: 'mcp',
) => Promise<{ result: unknown; durationMs: number }>

export type McpHttpHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>

export function createMcpHttpHandler(executeTool: ExecuteTool): McpHttpHandler {
  const handler = createMcpHandler(() => buildMcpServer(executeTool))
  const nodeHandler = toNodeHandler(handler)

  return async (request, response) => {
    const nodeRequest: NodeIncomingMessageLike = {
      headers: request.headers,
      [Symbol.asyncIterator]: () => request[Symbol.asyncIterator](),
      ...(request.method !== undefined ? { method: request.method } : {}),
      ...(request.url !== undefined ? { url: request.url } : {}),
    }
    await nodeHandler(nodeRequest, response)
  }
}

function buildMcpServer(executeTool: ExecuteTool): McpServer {
  const call = async (tool: ToolName, input: Record<string, unknown>) => {
    try {
      return toMcpResult(await executeTool(tool, input, 'mcp'))
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      }
    }
  }

  const server = new McpServer(
    {
      name: 'web-harness',
      version: '0.1.0',
    },
    {
      capabilities: { tools: {} },
    },
  )

  server.registerTool(
    'project_info',
    {
      title: 'Project info',
      description: 'Return metadata for the configured local project.',
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => call('project.info', {}),
  )

  server.registerTool(
    'fs_list',
    {
      title: 'List project directory',
      description: 'List up to 500 entries in a directory inside the configured project root.',
      inputSchema: z.object({ path: z.string().default('.') }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ path }) => call('fs.list', { path }),
  )

  server.registerTool(
    'fs_read',
    {
      title: 'Read project file',
      description: 'Read a UTF-8 file inside the configured project root, up to 2 MiB.',
      inputSchema: z.object({ path: z.string().min(1) }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ path }) => call('fs.read', { path }),
  )

  server.registerTool(
    'fs_write',
    {
      title: 'Write project file',
      description: 'Replace a UTF-8 file inside the configured project root, up to 2 MiB.',
      inputSchema: z.object({ path: z.string().min(1), content: z.string() }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ path, content }) => call('fs.write', { path, content }),
  )

  server.registerTool(
    'git_status',
    {
      title: 'Git status',
      description: 'Return concise Git working-tree and branch status.',
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => call('git.status', {}),
  )

  server.registerTool(
    'git_diff',
    {
      title: 'Git diff',
      description: 'Return the unstaged Git diff, optionally limited to project-relative paths.',
      inputSchema: z.object({ paths: z.array(z.string()).default([]) }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ paths }) => call('git.diff', { paths }),
  )

  server.registerTool(
    'process_run',
    {
      title: 'Run project command',
      description:
        'Run one executable directly with argv inside the project. No implicit shell is used.',
      inputSchema: z.object({
        command: z.string().min(1),
        args: z.array(z.string()).default([]),
        cwd: z.string().default('.'),
        timeoutMs: z.number().int().min(100).max(120_000).default(30_000),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ command, args, cwd, timeoutMs }) =>
      call('process.run', { command, args, cwd, timeoutMs }),
  )

  return server
}

function toMcpResult(value: { result: unknown; durationMs: number }) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ result: value.result, durationMs: value.durationMs }),
      },
    ],
  }
}
