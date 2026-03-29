# MCP File Upload Sample

MCP 経由でファイルを MinIO（S3 互換）にアップロードするサンプルです。MCP 実装は公式 [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) を使用しています。

サーバーはクライアントがペイロードとして送り込んだデータ（Base64 または multipart）のみを処理し、ローカルディスクのファイルを読み出すことはありません。

## 前提

- Node.js 20+
- Yarn 1.x（`packageManager: yarn@1.22.22`）
- Docker（MinIO 用）

### 動作確認済みバージョン

| ソフトウェア | バージョン |
|-------------|-----------|
| Claude Desktop | 0.9.5 |
| Claude Code | 2.1.80 |
| `@modelcontextprotocol/sdk` | 1.27.1 |

## セットアップ

### MinIO の起動

```bash
docker compose up -d
```

- API: `http://127.0.0.1:9000`
- コンソール: `http://127.0.0.1:9001`（認証情報は `docker-compose.yml` の `MINIO_ROOT_*`）

### アプリの起動

```bash
yarn install
yarn build

# サーバー起動
yarn dev
```

### 環境変数

`.env.example` を参考に `.env` を作成してください。デフォルト値が設定されているため、MinIO をそのまま使う場合は `.env` なしでも動作します。

### エンドポイント（HTTP モード）

| パス | 用途 |
|------|------|
| `GET /health` | ヘルスチェック |
| `POST /upload` | HTTP マルチパートアップロード（フィールド名 `file`） |
| `POST /mcp` | MCP（Streamable HTTP） |

## MCP ツール

| ツール | デフォルト | 用途 |
|--------|------|------|
| `upload_file` | 有効 | Base64 エンコードされたファイルを MinIO にアップロード |
| `upload_via_curl` | コメントアウト | HTTP `POST /upload` への curl コマンドを返す |

`upload_via_curl` を有効にするには `src/mcpServer.ts` の `registerUploadViaCurl(server, config)` のコメントを外してビルドしてください。

## Claude Desktop の設定

`claude_desktop_config.json` に Stdio 設定を記述します。

```json
{
  "mcpServers": {
    "file-upload-sample": {
      "command": "/Users/YOURNAME/.nvm/versions/node/v22.x.x/bin/node",
      "args": [
        "/Users/YOURNAME/project/mcp-file-upload-sample/dist/index.js",
        "--stdio"
      ],
      "env": {
        "MINIO_ENDPOINT": "http://127.0.0.1:9000",
        "MINIO_ROOT_USER": "minioadmin",
        "MINIO_ROOT_PASSWORD": "minioadmin"
      }
    }
  }
}
```

- `command` には Node.js 20+ の**フルパス**を指定してください（`command -v node` で確認）。
- `args` のスクリプトパスには **`~` を使わない絶対パス**を指定してください（Desktop はシェルを経由しないため `~` が展開されません）。
- パスの取得: リポジトリルートで `echo "$(pwd -P)/dist/index.js"` を実行し、出力をそのまま `args[0]` に使います。

## Claude Code の設定

```bash
claude mcp add file-upload-sample \
  -s user \
  -e MINIO_ENDPOINT=http://127.0.0.1:9000 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -- node /Users/YOURNAME/project/mcp-file-upload-sample/dist/index.js --stdio
```

```bash
claude mcp list                        # 一覧
claude mcp remove file-upload-sample   # 削除
```

## 注意

サンプル用途のコードです。オープンな環境では使わないようにしてください。
