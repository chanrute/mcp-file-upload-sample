import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "./config.js";
import type { ObjectStorage } from "./storage.js";
import { registerUploadFile, registerUploadViaCurl } from "./tools.js";

const INSTRUCTIONS = [
  "ツールを使用して、ファイルアップロードを行ってください。",
].join("\n");

/** MCP ツールを登録した {@link McpServer} を組み立てる。 */
export function createMcpServer(
  config: AppConfig,
  storage: ObjectStorage,
): McpServer {
  const server = new McpServer(
    {
      name: "file-upload-sample",
      version: "0.1.0",
    },
    {
      capabilities: { tools: {} },
      instructions: INSTRUCTIONS,
    },
  );

  // NOTE: ここで必要なツールの登録を行う
  // MCPでのファイルアップロード
  registerUploadFile(server, storage);
  // HTTPでのファイルアップロード
  // registerUploadViaCurl(server, config);

  return server;
}
