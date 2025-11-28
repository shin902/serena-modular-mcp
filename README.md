# Modular MCP

[![npm version](https://badge.fury.io/js/serena-modular-mcp.svg)](https://www.npmjs.com/package/serena-modular-mcp)

複数の MCP サーバーを効率的に管理するための Model Context Protocol (MCP) プロキシサーバーです。ツールをグループ化し、必要に応じてツールスキーマをオンデマンドで読み込むことで、大規模なツールコレクションを扱えます。

**npm**: https://www.npmjs.com/package/serena-modular-mcp

## コンセプト

従来の MCP セットアップでは、複数のサーバーから多数のツールを扱う際に LLM のコンテキストが圧迫されてしまいます。Modular MCP は以下の方法でこの問題を解決します：

- **コンテキスト効率化**: カテゴリ情報をツールの説明に埋め込むことで、LLM はツール呼び出しなしで利用可能なカテゴリを発見できます
- **オンデマンド読み込み**: 特定のカテゴリに必要な詳細なツールスキーマのみを取得します
- **関心の分離**: ツールの発見フェーズと実行フェーズを明確に区別します
- **プロキシアーキテクチャ**: 複数のアップストリーム MCP サーバーを管理する単一の MCP エンドポイントとして機能します

**注意**: 現在は [Serena](https://github.com/oraios/serena) MCP サーバーのみに対応しています。

## 仕組み

### 1. 設定ファイルの準備

まず、サンプル設定ファイルをコピーして、独自の設定ファイルを作成します：

```bash
cp serena-config-example.json serena-config.json
```

設定ファイル（`serena-config.json`）には、以下の構造があります：

```json
{
  "$schema": "./config-schema.json",
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "description": "社内コードベース操作に最適化された MCP。",
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/oraios/serena",
        "serena",
        "start-mcp-server"
      ],
      "env": {
        "_comment": "本家Serenaの設定を参照してください"
      }
    }
  },
  "categories": {
    "fs": {
      "description": "ファイル/ディレクトリの読み書きと検索。",
      "server": "serena",
      "tools": {
        "includeNames": ["read_file", "create_text_file", "list_dir", ...],
        "overrides": {
          "read_file": {
            "enabled": true,
            "description": "カスタム説明"
          }
        }
      }
    },
    ...
  }
}
```

**重要な設定項目**:
- `mcpServers`: アップストリーム MCP サーバーの設定（現在は Serena のみ対応）
- `categories`: ツールをカテゴリ別に分類し、各カテゴリの説明と含めるツールを指定
- `tools.includeNames`: そのカテゴリに含めるツール名のリスト
- `tools.overrides`: 個別ツールの有効/無効化やカスタム説明の上書き

本家 Serena の設定方法については、[公式ドキュメント](https://github.com/oraios/serena)を参照してください。

### 2. Modular MCP の登録

MCP クライアントの設定ファイル（Claude Desktop の場合は `~/Library/Application Support/Claude/claude_desktop_config.json`）に Modular MCP を登録します：

```json
{
  "mcpServers": {
    "serena-modular-mcp": {
      "command": "npx",
      "args": ["-y", "serena-modular-mcp", "/path/to/serena-config.json"]
    }
  }
}
```

**注意**: 設定ファイルのパスは絶対パスで指定してください。

### 3. 2つのツールの登録

Modular MCP が起動すると、LLM には2つのツールのみが登録されます：

- `get-modular-tools`: 特定のカテゴリのツール名とスキーマを取得
- `call-modular-tool`: 特定のカテゴリのツールを実行

`get-modular-tools` ツールの説明には、利用可能なカテゴリの情報が含まれます：

```
modular-mcp は複数の MCP サーバーを整理されたカテゴリとして管理し、すべてのツール説明で LLM を圧倒する代わりに、必要なカテゴリのツール説明のみをオンデマンドで提供します。

このツールを使用して特定のカテゴリで利用可能なツールを取得し、その後 call-modular-tool を使用してそれらを実行します。

デフォルトで利用可能なカテゴリ（コンフィグで設定可能）:
- fs: ファイル/ディレクトリの読み書きと検索。
- code: シンボル探索とコード編集。
- memory: メモリ操作。
- session: 実行・初期化・構成。
- meta: メタ思考/初期指示。
```

この説明はシステムプロンプトの一部として LLM に渡されるため、ツール呼び出しなしで利用可能なカテゴリを発見できます。

### 4. オンデマンドでのツール読み込み

LLM はカテゴリ単位でツールを読み込んで使用できるようになります：

1. **発見**: LLM はツールの説明で利用可能なカテゴリを確認（ツール呼び出し不要）
2. **探索**: LLM がファイル操作ツールを必要とする場合、`category="fs"` で `get-modular-tools` を呼び出す
3. **実行**: LLM は `call-modular-tool` を使用して `read_file` などの特定のツールを実行

例えば、ファイルを読み込む場合：
```
get-modular-tools(category="fs")
→ すべての fs カテゴリのツールスキーマが返される

call-modular-tool(category="fs", name="read_file", args={"path": "/path/to/file.txt"})
→ Serena MCP サーバーを通じてファイルを読み込む
```

このワークフローにより、コンテキスト使用量を最小限に抑えながら、必要なときにすべてのツールへのアクセスを提供します。

## 利点

- **コンテキスト使用量の削減**: 実際に必要なときのみツール情報を読み込む
- **スケーラブル**: コンテキストを圧迫することなく、多数のツールを管理可能
- **柔軟性**: 他に影響を与えずにツールカテゴリを簡単に追加・削除
- **透過性**: ツールはアップストリームサーバーで直接呼び出されたかのように実行される
- **カスタマイズ**: カテゴリごとにツールの有効/無効化や説明の上書きが可能

## プロジェクト構造

```
serena-modular-mcp/
├── src/                    # ソースコード
│   ├── index.ts           # エントリーポイント
│   ├── server.ts          # MCP サーバー実装
│   ├── client-manager.ts  # アップストリーム MCP クライアント管理
│   ├── config-loader.ts   # 設定ファイル読み込み
│   ├── transport.ts       # トランスポート層
│   ├── logger.ts          # ロガー
│   ├── types.ts           # 型定義
│   └── scripts/           # ユーティリティスクリプト
│       └── generate-schema.ts
├── packages/              # パッケージ
│   └── serena-mcp/       # サブパッケージ（将来的な拡張用）
├── docs/                  # ドキュメント
│   ├── task.md
│   └── troubleshooting-connection-issues.md
├── dist/                  # ビルド成果物
├── config-schema.json     # 設定ファイルのJSON Schema
├── serena-config.json     # 設定ファイルの例
├── package.json
├── tsconfig.json
├── biome.json             # Biome設定（リント/フォーマット）
├── pnpm-workspace.yaml    # pnpm ワークスペース設定
└── README.md
```

## 開発

### セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/shin902/serena-modular-mcp.git
cd serena-modular-mcp

# 依存関係のインストール
pnpm install

# 設定ファイルを準備
cp serena-config-example.json serena-config.json
# serena-config.json を編集して、本家 Serena の設定を行います

# ビルド
pnpm build

# ビルドの内訳
pnpm build:esbuild  # TypeScriptをバンドル
pnpm build:schema   # JSON Schemaを生成
```

### コード品質

```bash
# リント
pnpm lint

# 自動修正
pnpm fix

# 型チェック
pnpm typecheck
```

### リリース

```bash
# バージョンアップとリリース
pnpm release
```

### 要件

- Node.js >= 22.0.0
- pnpm 10.21.0

## ライセンス

MIT
