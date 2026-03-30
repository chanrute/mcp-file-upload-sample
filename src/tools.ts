import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppConfig } from "./config.js";
import type { ObjectStorage } from "./storage.js";

type UploadFileArgs = {
  fileBase64: string;
  fileName: string;
};

type UploadViaCurlArgs = {
  filePath: string;
  fileName?: string | undefined;
};

/** Base64 でファイルを受け取り MinIO にアップロードするツールを登録する。 */
export function registerUploadFile(
  server: McpServer,
  storage: ObjectStorage,
): void {
  server.registerTool(
    "upload_file",
    {
      description:
        "Base64 エンコードされたファイルを MinIO（S3 互換）にアップロードする。",
      inputSchema: {
        fileBase64: z.string().describe("ファイルの Base64 エンコード文字列。"),
        fileName: z
          .string()
          .default("upload.bin")
          .describe("元のファイル名。"),
      },
    },
    // @ts-expect-error TS2589: MCP SDK + Zod の型推論が深すぎるため抑制
    async (args: UploadFileArgs) => {
      const { fileBase64, fileName } = args;
      const normalized = fileBase64.replace(/\s+/g, "");
      const buffer = Buffer.from(normalized, "base64");
      const resolvedName = fileName;

      const { key, url } = await storage.putObject(resolvedName, buffer);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                key,
                objectUrl: url,
                bytes: buffer.length,
                fileName: resolvedName,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

/** curl で HTTP POST /upload にアップロードするコマンドを返すツールを登録する。 */
export function registerUploadViaCurl(
  server: McpServer,
  config: AppConfig,
): void {
  server.registerTool(
    "upload_via_curl",
    {
      description:
        "ファイルを HTTP POST /upload エンドポイントに curl で送信するコマンドを返す。" +
        "返されたコマンドをシェルで実行すると MinIO にアップロードされる。",
      inputSchema: {
        filePath: z
          .string()
          .describe(
            "アップロードするファイルのパス（curl を実行するマシン上のパス）。",
          ),
        fileName: z
          .string()
          .optional()
          .describe(
            "MinIO に保存するファイル名。未指定時は filePath のベース名。",
          ),
      },
    },
    async (args: UploadViaCurlArgs) => {
      const { filePath, fileName } = args;
      const uploadUrl = `http://127.0.0.1:${config.port}/upload`;
      const nameFlag = fileName ? `;filename="${fileName}"` : "";
      const cmd = `curl -sS -F "file=@${filePath}${nameFlag}" ${uploadUrl}`;
      return {
        content: [
          {
            type: "text",
            text: [
              "以下の curl コマンドを実行してください:",
              "",
              cmd,
              "",
              `エンドポイント: ${uploadUrl}`,
            ].join("\n"),
          },
        ],
      };
    },
  );
}
