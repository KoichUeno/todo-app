# 機能設計書

---

## 1. ユースケース図

```mermaid
graph LR
  GuestUser["👤 ゲストユーザー（未ログイン）"]
  AuthUser["👤 認証済みユーザー（ログイン済み）"]
  AI["🤖 Claude AI（PHASE4）"]

  GuestUser --> UC1["サインアップ"]
  GuestUser --> UC2["ログイン"]

  AuthUser --> UC3["タスクを追加する"]
  AuthUser --> UC4["タスクを30分単位に分解する"]
  AuthUser --> UC5["サブタスクを完了にする"]
  AuthUser --> UC6["タスクを完了にする"]
  AuthUser --> UC7["タスクを削除する"]
  AuthUser --> UC8["ログアウト"]

  UC4 --> UC9["サブタスクを自動生成する（PHASE4）"]
  UC5 --> UC10["全完了で親タスクも自動完了"]

  AI --> UC9
```

---

## 2. 画面遷移図

```mermaid
stateDiagram-v2
  [*] --> ログイン画面: アクセス

  ログイン画面 --> メイン画面: ログイン成功
  ログイン画面 --> ログイン画面: サインアップ後（同じ画面）

  メイン画面 --> サブタスク表示: 「分解する」ボタン押下\n（インライン展開）
  サブタスク表示 --> メイン画面: 折りたたむ

  メイン画面 --> ログイン画面: ログアウト

  メイン画面 --> ログイン画面: 未ログインでアクセス\n（middleware.tsがリダイレクト）
```

---

## 3. ワイヤーフレーム

### メイン画面（/）

```
┌────────────────────────────────────┐
│  タスク管理                         │
│  タスクを30分単位に分解して今すぐ着手  │
├────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │ 新しいタスクを追加              │  │
│  │ [タスク名を入力............]  │  │
│  │ [日付      ]  [ 追加 ]       │  │
│  └──────────────────────────────┘  │
│                                    │
│  進行中 (2)                         │
│  ┌──────────────────────────────┐  │
│  │ 企画書を書く    締切: 3/25    │  │
│  │ [分解する] [完了] [削除]      │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ 請求書を送る   締切: 3/22    │  │
│  │ [1/4]  [完了] [削除]         │  │
│  │  ─────────────────────────  │  │
│  │  ● 【30分】内容を整理する ✓  │  │
│  │  ○ 【30分】素材を集める      │  │
│  │  ○ 【30分】ドラフトを作る    │  │
│  │  ○ 【30分】見直して仕上げる  │  │
│  └──────────────────────────────┘  │
│                                    │
│  完了済み (1)                        │
│  ┌──────────────────────────────┐  │
│  │ ~~会議の準備~~        [削除]  │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### ログイン・サインアップ画面（/auth）

```
┌────────────────────────────────────┐
│  ログイン / サインアップ              │
│                                    │
│  [メールアドレス.................]  │
│  [パスワード...................]   │
│                                    │
│  [ ログイン ]                       │
│  [ サインアップ ]                    │
└────────────────────────────────────┘
```

---

## 4. コンポーネント設計

### ファイル構成

```mermaid
graph TD
  App["app/"]
  App --> Page["page.tsx\nメイン画面（タスク一覧）"]
  App --> Auth["auth/"]
  Auth --> AuthPage["page.tsx\nログイン・サインアップ画面"]
  App --> Api["api/"]
  Api --> Tasks["tasks/"]
  Tasks --> TasksRoute["route.ts\nタスクのCRUD API"]
  Tasks --> Subtasks["subtasks/"]
  Subtasks --> SubtasksRoute["route.ts\nサブタスクのCRUD API"]
```

### コンポーネント構成（画面の部品の組み立て方）

> 画面は「部品（コンポーネント）」の組み合わせで作られています。
> レゴブロックのように、小さな部品を組み合わせて1つの画面を作るイメージです。

```mermaid
graph TD
  Home["🖥️ メイン画面（全体の枠）"]

  Home --> Form
  Home --> TaskList["📋 タスク一覧\n（進行中＋完了済みをまとめた表示エリア）"]
  TaskList --> ActiveList
  TaskList --> CompletedList

  subgraph CAT1["📝 カテゴリー①：タスク追加エリア"]
    Form["タスク追加フォーム"]
    Form --> Input["✏️ タスク名の入力欄"]
    Form --> Date["📅 締め切り日の入力欄"]
    Form --> AddBtn["➕ 追加ボタン"]
  end

  subgraph CAT2["📋 カテゴリー②：進行中タスク"]
    ActiveList["進行中タスクの一覧"]
    ActiveList --> TaskCard["🗂️ タスクカード（タスクの数だけ繰り返し）"]
    TaskCard --> TaskTitle["📌 タスク名・締め切り日"]
    TaskCard --> DecomposeBtn["⚡ 「分解する」ボタン または 進捗表示"]
    TaskCard --> ActionBtns["✅ 完了ボタン　🗑️ 削除ボタン"]
  end

  subgraph CAT3["📂 カテゴリー③：サブタスク（分解後）"]
    SubtaskList["サブタスク一覧（「分解する」を押すと展開）"]
    SubtaskList --> SubtaskItem["☑️ 30分単位の作業 × 個数分"]
  end

  subgraph CAT4["✅ カテゴリー④：完了済みタスク"]
    CompletedList["完了済みタスクの一覧"]
    CompletedList --> CompletedCard["🗂️ 完了タスクカード（完了した数だけ）"]
  end

  TaskCard --> SubtaskList
```

---

## 5. データモデル定義

### tasks テーブル

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | uuid | PK, default: gen_random_uuid() | 一意のID |
| user_id | uuid | FK → auth.users.id | 所有ユーザー（RLS用） |
| title | text | NOT NULL | タスク名 |
| due_date | date | NULL許容 | 締め切り日 |
| is_completed | boolean | default: false | 完了フラグ |
| created_at | timestamp | default: now() | 作成日時 |

### subtasks テーブル

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | uuid | PK, default: gen_random_uuid() | 一意のID |
| task_id | uuid | FK → tasks.id | 親タスクのID |
| title | text | NOT NULL | サブタスク名（30分単位） |
| is_completed | boolean | default: false | 完了フラグ |
| order | integer | NOT NULL | 表示順 |

### リレーション

```
auth.users
  └── 1対多 ── tasks
                 └── 1対多 ── subtasks
```

---

## 6. API設計

### タスク API（/api/tasks）

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/tasks | タスク一覧を取得 |
| POST | /api/tasks | タスクを新規追加 |
| PATCH | /api/tasks?id={id} | タスクを更新（完了フラグなど） |
| DELETE | /api/tasks?id={id} | タスクを削除 |

### サブタスク API（/api/tasks/subtasks）

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/tasks/subtasks?task_id={id} | サブタスク一覧を取得 |
| POST | /api/tasks/subtasks | サブタスクをまとめて登録 |
| PATCH | /api/tasks/subtasks?id={id} | サブタスクを更新（完了フラグ） |

### リクエスト／レスポンス例

**POST /api/tasks**
```json
// リクエスト
{ "title": "企画書を書く", "due_date": "2026-03-25" }

// レスポンス
{ "id": "uuid", "title": "企画書を書く", "due_date": "2026-03-25", "is_completed": false }
```

**POST /api/tasks/subtasks**
```json
// リクエスト
{
  "task_id": "uuid",
  "subtasks": [
    { "title": "【30分】内容を整理する", "order": 1 },
    { "title": "【30分】素材を集める", "order": 2 }
  ]
}
```

---

## 7. 機能ごとのアーキテクチャ

### タスク追加フロー

```
ユーザー入力
  → フロントエンド（page.tsx）
  → POST /api/tasks
  → Supabase（tasks テーブルに INSERT）
  → レスポンス受け取り
  → 画面に即時反映
```

### タスク分解フロー（PHASE1：仮データ）

```
「分解する」ボタン押下
  → フロントエンドで固定の4ステップを生成
  → 画面にインライン表示
```

### タスク分解フロー（PHASE4：AI連携後）

```
「分解する」ボタン押下
  → POST /api/tasks/decompose
  → Claude API にタスク名を送信
  → AIが30分単位のサブタスクを返答
  → Supabase（subtasks テーブルに INSERT）
  → 画面にインライン表示
```

### ログイン・認証フロー

```
ユーザーがログイン画面でメール・パスワードを入力
  → Supabase Auth でセッション発行
  → middleware.ts が全ページのアクセス時にセッションをチェック
  → 未ログイン → /auth にリダイレクト
  → ログイン済み → そのままページを表示
```

---

## 8. システム構成図

```
[ブラウザ]
    │
    │ HTTPS
    ▼
[Vercel] ── Next.js アプリ
    │            ├── app/page.tsx         （メイン画面）
    │            ├── app/auth/page.tsx    （ログイン画面）
    │            ├── app/api/tasks/       （APIルート）
    │            └── middleware.ts        （認証チェック）
    │
    │ HTTPS（Supabase SDK）
    ▼
[Supabase]
    ├── PostgreSQL DB
    │     ├── tasks テーブル
    │     └── subtasks テーブル
    ├── Auth（メール・パスワード認証）
    └── RLS（ユーザーごとのデータ分離）

    │ HTTPS（PHASE4）
    ▼
[Anthropic Claude API]
    └── タスク分解の提案を生成
```
