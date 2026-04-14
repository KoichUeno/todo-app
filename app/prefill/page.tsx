'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const CATEGORIES = ['総務', '帳簿入力', '帳簿確認', '申告', 'コンサルティング', 'その他']

type Client = {
  id: string
  name: string
  client_type?: string | null
}

// /prefill?prefill_title=...&prefill_client_name=...&prefill_due=...
//
// Google Calendar → Apps Script → メール → deep link の着地点。
// URL クエリを localStorage の taskDraft に書き込んでから / にリダイレクトする。
// メインページ (app/page.tsx) は既存の taskDraft 復元機構でフォームを初期化する。
function PrefillContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('準備中...')

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const get = (key: string) => searchParams.get(`prefill_${key}`) || undefined

      const title = get('title')
      const description = get('description')
      const due = get('due')
      const assignee = get('assignee')
      const importance = get('importance')
      const clientType = get('client_type')
      const taskType = get('task_type')
      const importantNote = get('important_note')
      const category = get('category')
      const dataLocation = get('data_location')
      let clientId = get('client_id')
      let projectName: string | undefined
      let resolvedClientType: string | undefined = clientType
      const clientName = get('client_name')

      // 顧客名から /api/clients で ID を解決
      if (clientName || clientId) {
        try {
          setStatus('顧客情報を取得中...')
          const res = await fetch('/api/clients')
          if (res.ok) {
            const clients: Client[] = await res.json()
            const matched =
              (clientId && clients.find((c) => c.id === clientId)) ||
              (clientName && clients.find((c) => c.name === clientName)) ||
              (clientName && clients.find((c) => clientName.includes(c.name))) ||
              undefined
            if (matched) {
              clientId = matched.id
              projectName = matched.name
              if (!resolvedClientType && matched.client_type) {
                resolvedClientType = matched.client_type
              }
            }
          }
        } catch {
          // 失敗してもプリフィルは続行
        }
      }

      if (cancelled) return

      const draft: Record<string, string | boolean> = {}
      if (title) draft.title = title
      if (description) draft.description = description
      if (due) draft.dueDate = due
      if (assignee) draft.assignee = assignee
      if (importance) draft.importance = importance
      if (resolvedClientType) draft.clientType = resolvedClientType
      if (taskType) draft.taskType = taskType
      if (importantNote) draft.importantNote = importantNote
      if (dataLocation) draft.dataLocation = dataLocation
      if (clientId) draft.clientId = clientId
      if (projectName) draft.projectName = projectName
      if (category) {
        if (CATEGORIES.includes(category)) {
          draft.category = category
        } else {
          draft.category = 'その他'
          draft.categoryOther = category
        }
      }

      if (Object.keys(draft).length > 0) {
        try {
          localStorage.setItem('taskDraft', JSON.stringify(draft))
        } catch {}
      }

      setStatus('タスク画面に移動します...')
      router.replace('/')
    }

    run()
    return () => {
      cancelled = true
    }
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-3xl mb-3">📅</div>
        <div className="text-sm text-gray-500">{status}</div>
      </div>
    </div>
  )
}

export default function PrefillPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-400">
          読み込み中...
        </div>
      }
    >
      <PrefillContent />
    </Suspense>
  )
}
