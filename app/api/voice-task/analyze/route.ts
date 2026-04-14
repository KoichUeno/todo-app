import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabase = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// 指示書で指定された担当者候補 (profiles テーブルに無くてもプロンプトに含める)
const ASSIGNEE_CANDIDATES = ['堀', '芦谷', '柏木', '三井', '田中', '黒田', '鄭', '安田']

type VoiceAnalysis = {
  title: string
  client: string | null
  assignee: string | null
  dueDate: string | null
  priority: 'high' | 'medium' | 'low'
  subTasks: string[]
}

// Anthropic Messages API のレスポンス型 (必要な部分だけ)
type AnthropicMessageResponse = {
  content: Array<{ type: string; text?: string }>
  usage: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const text: unknown = body?.text
    if (typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ ok: false, error: 'text is required' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { ok: false, error: 'ANTHROPIC_API_KEY is not set' },
        { status: 500 }
      )
    }

    // 顧客と担当者リストを取得
    const supabase = getSupabase()
    const [clientsRes, profilesRes] = await Promise.all([
      supabase.from('clients').select('name').order('name'),
      supabase.from('profiles').select('name').order('name'),
    ])

    const clientNames = (clientsRes.data || [])
      .map((c: { name: string | null }) => c.name)
      .filter((n): n is string => typeof n === 'string' && n.length > 0)

    const profileNames = (profilesRes.data || [])
      .map((p: { name: string | null }) => p.name)
      .filter((n): n is string => typeof n === 'string' && n.length > 0)

    // DB の担当者 + 指示書の候補 (重複排除)
    const assigneeNames = Array.from(new Set([...profileNames, ...ASSIGNEE_CANDIDATES]))

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][today.getDay()]

    const systemPrompt = `あなたはタスク管理システムのアシスタントです。ユーザーが音声で話した自然言語のメモから、構造化されたタスク情報を抽出してJSONで返してください。

# 今日の日付
${todayStr} (${dayOfWeek}曜日)

# 既存の顧客一覧
${clientNames.length > 0 ? clientNames.join('、') : '(なし)'}

# 既存の担当者一覧
${assigneeNames.join('、')}

# 抽出ルール
- タイトルは簡潔に (体言止め推奨)
- クライアント名は必ず既存リストから選ぶ。リストにない/判断できない場合は null
- 担当者は既存リストから選ぶ。リストにない/判断できない場合は null
- 期限は YYYY-MM-DD 形式。相対表現は今日を基準に解決する
  - 「明日」→ 翌日
  - 「来週月曜」→ 次の月曜日
  - 「今週中」「今週末」→ 今週金曜
  - 「月末」→ 当月末日
  - 「来月5日」→ 翌月5日
  - 期限が不明なら null
- 優先度: high (緊急・最優先) / medium (通常) / low (後回し可)
  - 「急ぎ」「至急」「最優先」→ high
  - 「余裕あり」「後でいい」→ low
  - それ以外 → medium
- サブタスクは箇条書きで話された項目や「〜と〜と〜」を分解。無ければ空配列
- 不要な前置きや敬語を除去してタイトルを作る

# 出力形式 (これ以外のテキストは一切含めない)
{
  "title": "タスク名",
  "client": "クライアント名 or null",
  "assignee": "担当者名 or null",
  "dueDate": "YYYY-MM-DD or null",
  "priority": "high",
  "subTasks": ["サブタスク1", "サブタスク2"]
}`

    // Anthropic Messages API を直接呼ぶ (SDK不要)
    const anthropicRes = await fetch('<https://api.anthropic.com/v1/messages>', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: text }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      return NextResponse.json(
        { ok: false, error: `Anthropic API error: ${anthropicRes.status}`, detail: errText },
        { status: 500 }
      )
    }

    const response = (await anthropicRes.json()) as AnthropicMessageResponse

    // レスポンスから text ブロックを抽出
    const textBlock = response.content.find((b) => b.type === 'text' && typeof b.text === 'string')
    if (!textBlock || !textBlock.text) {
      return NextResponse.json(
        { ok: false, error: 'Claude API returned no text' },
        { status: 500 }
      )
    }

    // JSON をパース (コードフェンスで囲まれていれば剥がす)
    let parsed: VoiceAnalysis
    try {
      let jsonText = textBlock.text.trim()
      const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (fenceMatch) jsonText = fenceMatch[1]
      parsed = JSON.parse(jsonText)
    } catch {
      return NextResponse.json(
        { ok: false, error: 'JSON parse error', raw: textBlock.text },
        { status: 500 }
      )
    }

    // 最低限のバリデーション
    if (!parsed || typeof parsed.title !== 'string' || !parsed.title.trim()) {
      return NextResponse.json(
        { ok: false, error: 'title is missing in analysis', raw: parsed },
        { status: 500 }
      )
    }
    if (!['high', 'medium', 'low'].includes(parsed.priority)) {
      parsed.priority = 'medium'
    }
    if (!Array.isArray(parsed.subTasks)) {
      parsed.subTasks = []
    }

    return NextResponse.json({
      ok: true,
      analysis: parsed,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
        cache_create_tokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
