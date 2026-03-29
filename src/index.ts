import { createServer, type Server } from "node:http";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Request, RequestHandler, Response } from "express";
import { loadConfig } from "./config.js";
import { createMcpServer } from "./mcpServer.js";
import { ObjectStorage } from "./storage.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import multer from "multer";

// Claude Desktop は .bashrc を経由せず子プロセスを起動するため、
// ビルド済み JS の位置から .env を解決して読み込む。
// dotenv パッケージは v17 で stdout に出力して MCP Stdio を壊すため使わない。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
try {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
} catch {
  // .env が無ければ環境変数 or claude_desktop_config.json の env ブロックに頼る
}

const NODE_MIN_MAJOR = 20;
const nodeMajor = Number.parseInt(
  process.versions.node.split(".")[0] ?? "0",
  10,
);
if (nodeMajor < NODE_MIN_MAJOR) {
  console.error(
    `[mcp-file-upload-sample] Node.js ${NODE_MIN_MAJOR}+ が必要です（現在 ${process.version}）。` +
      `claude_desktop_config.json の "command" に Node 20+ のフルパスを指定してください。` +
      `例: "/Users/.../.nvm/versions/node/v22.20.0/bin/node"`,
  );
  process.exit(1);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function wantsStdio(): boolean {
  return process.argv.includes("--stdio");
}

async function runStdio(): Promise<void> {
  const config = loadConfig();
  const storage = new ObjectStorage(config);
  await storage.ensureBucket();
  const mcp = createMcpServer(config, storage);
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
  console.error("[mcp-file-upload-sample] ready (stdio)");
}

async function runHttp(): Promise<void> {
  const config = loadConfig();
  const storage = new ObjectStorage(config);
  await storage.ensureBucket();

  const app = createMcpExpressApp({
    host: "0.0.0.0",
    allowedHosts: ["localhost", "127.0.0.1"],
  });
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "mcp-file-upload-sample" });
  });

  const uploadHandler = upload.single("file") as unknown as RequestHandler;
  app.post("/upload", uploadHandler, async (req, res) => {
    try {
      const f = req.file;
      if (!f?.buffer) {
        res
          .status(400)
          .json({ error: 'multipart フィールド "file" が必要です' });
        return;
      }
      const name = f.originalname || "upload.bin";
      const { key, url } = await storage.putObject(name, f.buffer, f.mimetype);
      res.json({
        ok: true,
        key,
        objectUrl: url,
        bytes: f.size,
        contentType: f.mimetype,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  const handleMcp = async (req: Request, res: Response): Promise<void> => {
    const mcp: McpServer = createMcpServer(config, storage);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    try {
      await mcp.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        void transport.close();
        void mcp.close();
      });
    } catch (error) {
      console.error("[mcp-http] handleRequest failed:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "内部サーバーエラー" },
          id: null,
        });
      }
    }
  };

  app.post("/mcp", (req, res) => {
    void handleMcp(req, res);
  });

  app.get("/mcp", (req, res) => {
    void handleMcp(req, res);
  });

  const httpServer: Server = createServer(app);
  await new Promise<void>((resolve) => {
    httpServer.listen(config.port, "0.0.0.0", () => resolve());
  });

  console.error(
    `[mcp-file-upload-sample] Listening http://0.0.0.0:${config.port}  MCP: POST|GET /mcp  HTTP upload: POST /upload`,
  );
}

void (async () => {
  try {
    if (wantsStdio()) {
      await runStdio();
    } else {
      await runHttp();
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
