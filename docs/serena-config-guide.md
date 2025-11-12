# Serena MCP 設定ガイド

このドキュメントでは、Modular MCP で本家 Serena MCP を使用するための設定方法を説明します。

## 概要

このプロジェクトには2つの Serena 実装が存在します：

1. **本家 Serena MCP**（推奨）: Python 製、LSP ベースのセマンティックなコード操作ツール
   - リポジトリ: https://github.com/oraios/serena
   - 30+ 言語をサポート
   - Language Server Protocol (LSP) を使用した高精度な解析
   - プロフェッショナルな実装

2. **packages/serena-mcp**（デモ用）: TypeScript 製の簡易実装
   - 正規表現ベースの基本的なツールのみ
   - Modular MCP のデモンストレーション用
   - 本番環境での使用は非推奨

## 本家 Serena MCP の設定

### 前提条件

1. **Python 環境**
   - Python 3.8 以上がインストールされていること
   - `uvx` コマンドが利用可能であること（または `pip` でインストール）

2. **uvx のインストール**（推奨）
   ```bash
   pip install uv
   ```

### serena-config.json の設定

`serena-config.json` で本家 Serena を参照するように設定します：

```json
{
  "$schema": "https://raw.githubusercontent.com/shin902/serena-modular-mcp/refs/heads/main/config-schema.json",
  "mcpServers": {
    "serena": {
      "description": "本家 Serena MCP - LSP ベースのセマンティックなコード操作ツール（30+ 言語対応）。",
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/oraios/serena",
        "serena",
        "start-mcp-server"
      ],
      "env": {}
    }
  },
  "categories": {
    ...
  }
}
```

### 主要な設定項目

#### `mcpServers.serena`

- **`description`**: サーバーの説明。LLM がこのサーバーを選択する際のヒントになります
- **`command`**: `uvx` を使用して Python パッケージを実行
- **`args`**:
  - `--from git+https://github.com/oraios/serena`: GitHub から直接インストール
  - `serena`: パッケージ名
  - `start-mcp-server`: MCP サーバーを起動するコマンド
- **`env`**: 環境変数（必要に応じて追加）

## 本家 Serena vs 簡易実装の比較

| 項目 | 本家 Serena | packages/serena-mcp |
|------|------------|---------------------|
| **実装** | Python + LSP | TypeScript + 正規表現 |
| **精度** | 高（セマンティック解析） | 低（テキストマッチング） |
| **言語サポート** | 30+ 言語 | JavaScript/TypeScript のみ |
| **シンボル検索** | LSP による正確な定義・参照検索 | 正規表現による簡易検索 |
| **型情報** | サポート | 非サポート |
| **リファクタリング** | 安全なリネーム・変更 | 基本的なテキスト置換のみ |
| **用途** | 本番環境 | デモ・学習用 |

## 本家 Serena の主な機能

### 1. セマンティックなコード操作

- **`find_symbol`**: シンボル（関数、クラス、変数など）の定義を検索
- **`find_referencing_symbols`**: シンボルの参照箇所を検索
- **`insert_after_symbol`**: シンボルの後にコードを挿入
- **`insert_before_symbol`**: シンボルの前にコードを挿入
- **`rename_symbol`**: シンボルを安全にリネーム

### 2. LSP ベースの解析

Language Server Protocol を使用することで：
- **正確な定義位置の特定**: コメントや文字列内の一致を誤検知しない
- **型情報の取得**: 変数や関数の型を理解
- **スコープの理解**: ネストした関数やクラスを正しく解析
- **クロスファイル解析**: プロジェクト全体の依存関係を把握

### 3. 多言語サポート

以下の言語をサポート：
- Python, JavaScript, TypeScript, Java, C++, Rust, Go
- C#, PHP, Ruby, Kotlin, Swift, Scala
- Bash, Clojure, Dart, Elixir, その他 20+ 言語

## カテゴリ設定について

`serena-config.json` の `categories` セクションは、Modular MCP のツールグループ機能を使用しています。

```json
"categories": {
  "fs": {
    "description": "ファイル/ディレクトリの読み書きと検索。",
    "server": "serena",
    "tools": {
      "includeNames": [
        "mcp__serena__read_file",
        "mcp__serena__find_file",
        ...
      ]
    }
  },
  "code": {
    "description": "シンボル探索とコード編集。",
    "server": "serena",
    "tools": {
      "includeNames": [
        "mcp__serena__find_symbol",
        "mcp__serena__find_referencing_symbols",
        ...
      ]
    }
  }
}
```

### 注意事項

**重要**: `categories` セクションで指定されているツール名（例: `mcp__serena__read_file`）は、**簡易実装版のツール名**です。

本家 Serena MCP を使用する場合：
1. 本家 Serena が提供する実際のツール名を確認する
2. `categories` の `includeNames` を本家のツール名に合わせる
3. または、`categories` セクションを削除して、すべてのツールを直接使用する

本家 Serena のツール名を確認するには：
```bash
# Serena MCP サーバーを起動してツール一覧を取得
uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

## トラブルシューティング

### uvx コマンドが見つからない

```bash
# uv をインストール
pip install uv

# または pipx を使用
pipx install uv
```

### Python 環境が見つからない

本家 Serena は Python で実装されているため、Python 環境が必要です：

```bash
# Python バージョン確認
python --version

# 3.8 以上が必要
# インストールされていない場合は、pyenv などを使用してインストール
```

### MCP サーバーが起動しない

1. GitHub からのインストールを確認：
   ```bash
   uvx --from git+https://github.com/oraios/serena serena --help
   ```

2. ログを確認してエラーメッセージをチェック

3. ネットワーク接続を確認（GitHub へのアクセスが必要）

## 簡易実装版を使用する場合

デモや学習目的で簡易実装版を使用する場合の設定：

```json
{
  "mcpServers": {
    "serena-demo": {
      "description": "簡易実装版 Serena MCP（デモ用）",
      "command": "node",
      "args": [
        "/path/to/serena-modular-mcp/packages/serena-mcp/dist/index.js"
      ],
      "env": {}
    }
  }
}
```

**注意**: この実装は正規表現ベースの簡易版であり、以下の制限があります：
- コメントや文字列内のパターンも誤検知
- 型情報なし
- スコープの理解なし
- JavaScript/TypeScript のみ対応

## まとめ

- **本番環境**: 本家 Serena MCP を使用（LSP ベース、高精度）
- **デモ・学習**: 簡易実装版を使用可能（制限あり）
- **設定ファイル**: `serena-config.json` でサーバーとツールを管理
- **カテゴリ**: Modular MCP のグループ機能でツールを整理

## 参考リンク

- [本家 Serena MCP](https://github.com/oraios/serena)
- [Modular MCP README](../README.md)
- [トラブルシューティング](./troubleshooting-connection-issues.md)
