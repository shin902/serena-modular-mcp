# Modular MCP

複数の MCP サーバーを効率的に管理するための Model Context Protocol (MCP) プロキシサーバーです。ツールをグループ化し、必要に応じてツールスキーマをオンデマンドで読み込むことで、大規模なツールコレクションを扱えます。

## コンセプト

従来の MCP セットアップでは、複数のサーバーから多数のツールを扱う際に LLM のコンテキストが圧迫されてしまいます。Modular MCP は以下の方法でこの問題を解決します：

- **コンテキスト効率化**: グループ情報をツールの説明に埋め込むことで、LLM はツール呼び出しなしで利用可能なグループを発見できます
- **オンデマンド読み込み**: 特定のグループに必要な詳細なツールスキーマのみを取得します
- **関心の分離**: ツールの発見フェーズと実行フェーズを明確に区別します
- **プロキシアーキテクチャ**: 複数のアップストリーム MCP サーバーを管理する単一の MCP エンドポイントとして機能します

## 仕組み

### 1. 設定ファイルの作成

管理したいアップストリーム MCP サーバーの設定ファイル（例：`modular-mcp.json`）を作成します。標準的な MCP サーバー設定フォーマットに、各サーバーの `description` フィールドを追加するだけです。

Context7 と Playwright MCP サーバーを使用する例：

```diff
{
+ "$schema": "https://raw.githubusercontent.com/shin902/serena-modular-mcp/refs/heads/main/config-schema.json",
  "mcpServers": {
    "context7": {
+     "description": "ライブラリのドキュメント検索が必要な場合に使用",
-     "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"],
      "env": {}
    },
    "playwright": {
+     "description": "Web ブラウザの制御や自動化が必要な場合に使用",
-     "type": "stdio",
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": {}
    }
  }
}
```

`description` フィールドが標準 MCP 設定への唯一の拡張です。これにより、LLM は詳細なツールスキーマを読み込むことなく、各ツールグループの目的を理解できます。

**注意**: `type` フィールドは指定しない場合、デフォルトで `"stdio"` になります。`stdio` タイプのサーバーでは、`type` フィールドを省略してよりシンプルな設定にできます。

### 2. Modular MCP の登録

MCP クライアントの設定ファイル（Claude Code の場合は `.mcp.json`）に Modular MCP を登録します：

```json
{
  "mcpServers": {
    "modular-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "serena-modular-mcp", "modular-mcp.json"],
      "env": {}
    }
  }
}
```

### 3. 2つのツールの登録

Modular MCP が起動すると、LLM には2つのツールのみが登録されます：

- `get-modular-tools`: 特定のグループのツール名とスキーマを取得
- `call-modular-tool`: 特定のグループのツールを実行

`get-modular-tools` ツールの説明には、利用可能なグループの情報が含まれます：

```
modular-mcp は複数の MCP サーバーを整理されたグループとして管理し、すべてのツール説明で LLM を圧倒する代わりに、必要なグループのツール説明のみをオンデマンドで提供します。

このツールを使用して特定のグループで利用可能なツールを取得し、その後 call-modular-tool を使用してそれらを実行します。

利用可能なグループ:
- context7: ライブラリのドキュメント検索が必要な場合に使用
- playwright: Web ブラウザの制御や自動化が必要な場合に使用
```

この説明はシステムプロンプトの一部として LLM に渡されるため、ツール呼び出しなしで利用可能なグループを発見できます。

### 4. オンデマンドでのツール読み込み

LLM はグループ単位でツールを読み込んで使用できるようになります：

1. **発見**: LLM はツールの説明で利用可能なグループを確認（ツール呼び出し不要）
2. **探索**: LLM が playwright ツールを必要とする場合、`group="playwright"` で `get-modular-tools` を呼び出す
3. **実行**: LLM は `call-modular-tool` を使用して `browser_navigate` などの特定のツールを実行

例えば、Web ブラウザを自動化する場合：
```
get-modular-tools(group="playwright")
→ すべての playwright ツールスキーマが返される

call-modular-tool(group="playwright", name="browser_navigate", args={"url": "https://example.com"})
→ playwright MCP サーバーを通じてナビゲーションを実行
```

このワークフローにより、コンテキスト使用量を最小限に抑えながら、必要なときにすべてのツールへのアクセスを提供します。

## 利点

- **コンテキスト使用量の削減**: 実際に必要なときのみツール情報を読み込む
- **スケーラブル**: コンテキストを圧迫することなく、数十の MCP サーバーを管理可能
- **柔軟性**: 他に影響を与えずにツールグループを簡単に追加・削除
- **透過性**: ツールはアップストリームサーバーで直接呼び出されたかのように実行される

## 開発

```bash
# 依存関係のインストール
pnpm install

# ビルド
pnpm build

# リント
pnpm lint

# 自動修正
pnpm fix

# 型チェック
pnpm typecheck
```

## ライセンス

MIT
