'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Loader2, Mic, Square, X } from 'lucide-react'

type Analysis = {
  title: string
  client: string | null
  assignee: string | null
  dueDate: string | null
  priority: 'high' | 'medium' | 'low'
  subTasks: string[]
}

type Phase = 'idle' | 'recording' | 'analyzing' | 'confirm' | 'saving' | 'done'

const PRIORITY_TO_IMPORTANCE: Record<Analysis['priority'], string> = {
  high: '高',
  medium: '通常',
  low: '低',
}

// --- Web Speech API の最小型定義 (iOS Safari の webkitSpeechRecognition) ---
type SpeechRecognitionResult = {
  readonly length: number
  readonly isFinal: boolean
  readonly [index: number]: { readonly transcript: string; readonly confidence: number }
}
type SpeechRecognitionResultList = {
  readonly length: number
  readonly [index: number]: SpeechRecognitionResult
}
type SpeechRecognitionEventLike = Event & { readonly results: SpeechRecognitionResultList }
type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: Event & { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export default function VoicePage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    if (!getSpeechRecognition()) setSupported(false)
  }, [])

  const startRecording = useCallback(() => {
    setError(null)
    setTranscript('')
    setInterim('')

    const SR = getSpeechRecognition()
    if (!SR) {
      setError('このブラウザは音声認識に対応していません')
      return
    }

    const recognition = new SR()
    recognition.lang = 'ja-JP'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }
      if (finalText) setTranscript((prev) => prev + finalText)
      setInterim(interimText)
    }

    recognition.onerror = (event) => {
      setError(`音声認識エラー: ${event.error || '不明なエラー'}`)
      setPhase('idle')
    }

    recognition.onend = () => {
      setInterim('')
      setPhase((current) => (current === 'recording' ? 'idle' : current))
    }

    recognition.start()
    recognitionRef.current = recognition
    setPhase('recording')
  }, [])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const analyze = useCallback(async () => {
    if (!transcript.trim()) {
      setError('テキストがありません')
      return
    }
    setPhase('analyzing')
    setError(null)
    try {
      const res = await fetch('/api/voice-task/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '解析に失敗しました')
      }
      setAnalysis(data.analysis as Analysis)
      setPhase('confirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('idle')
    }
  }, [transcript])

  const save = useCallback(async () => {
    if (!analysis) return
    setPhase('saving')
    setError(null)
    try {
      // 1. 顧客名から client_id を解決
      let clientId: string | null = null
      let projectName = ''
      if (analysis.client) {
        const clientsRes = await fetch('/api/clients')
        if (clientsRes.ok) {
          const clients = (await clientsRes.json()) as Array<{ id: string; name: string }>
          const matched = clients.find((c) => c.name === analysis.client)
          if (matched) {
            clientId = <matched.id>
            projectName = matched.name
          } else {
            projectName = analysis.client
          }
        }
      }

      // 2. タスク作成
      const taskRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: analysis.title,
          description: transcript,
          due_date: analysis.dueDate || null,
          assignee: analysis.assignee || '',
          importance: PRIORITY_TO_IMPORTANCE[analysis.priority] || '通常',
          project_name: projectName,
          client_id: clientId,
          task_type: 'スポット',
          is_recurring: false,
        }),
      })
      if (!taskRes.ok) {
        const err = await taskRes.json().catch(() => ({}))
        throw new Error(err.error || 'タスク作成に失敗しました')
      }
      const task = (await taskRes.json()) as { id: string }

      // 3. サブタスク作成 (順番を保持するため直列で実行)
      for (let i = 0; i < analysis.subTasks.length; i++) {
        const title = analysis.subTasks[i]
        if (!title.trim()) continue
        await fetch('/api/subtasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_id: <task.id>,
            title,
            order_num: i + 1,
            assignee: analysis.assignee || '',
          }),
        })
      }

      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('confirm')
    }
  }, [analysis, transcript])

  const reset = () => {
    setPhase('idle')
    setTranscript('')
    setInterim('')
    setAnalysis(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/')}
          className="text-gray-500 hover:text-gray-700"
          aria-label="戻る"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-gray-800">音声でタスク入力</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {!supported && (
          <div className="max-w-md text-center text-red-600 bg-red-50 p-4 rounded-lg">
            このブラウザは音声認識に対応していません。
            <br />
            Safari または Chrome をお試しください。
          </div>
        )}

        {supported && phase === 'idle' && (
          <div className="w-full max-w-md flex flex-col items-center">
            <button
              onClick={startRecording}
              className="w-40 h-40 rounded-full bg-blue-500 hover:bg-blue-600 active:scale-95 text-white shadow-lg flex items-center justify-center transition-all"
              aria-label="録音開始"
            >
              <Mic size={64} />
            </button>
            <p className="mt-6 text-sm text-gray-500">タップして話してください</p>

            {transcript && (
              <div className="mt-6 w-full bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-400 mb-1">認識したテキスト</p>
                <p className="text-gray-800 whitespace-pre-wrap text-sm">{transcript}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={reset}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg font-semibold text-sm"
                  >
                    クリア
                  </button>
                  <button
                    onClick={analyze}
                    className="flex-[2] py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm"
                  >
                    解析する
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg w-full">
                {error}
              </div>
            )}
          </div>
        )}

        {phase === 'recording' && (
          <div className="w-full max-w-md flex flex-col items-center">
            <button
              onClick={stopRecording}
              className="w-40 h-40 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg flex items-center justify-center animate-pulse"
              aria-label="録音停止"
            >
              <Square size={56} />
            </button>
            <p className="mt-6 text-sm text-red-500 font-semibold">録音中... タップして停止</p>

            {(transcript || interim) && (
              <div className="mt-6 w-full bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-400 mb-1">認識中...</p>
                <p className="text-gray-800 whitespace-pre-wrap text-sm">
                  {transcript}
                  <span className="text-gray-400">{interim}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {phase === 'analyzing' && (
          <div className="flex flex-col items-center">
            <Loader2 size={48} className="text-blue-500 animate-spin" />
            <p className="mt-4 text-sm text-gray-500">解析中...</p>
          </div>
        )}

        {phase === 'confirm' && analysis && (
          <ConfirmForm
            analysis={analysis}
            transcript={transcript}
            onChange={setAnalysis}
            onSave={save}
            onCancel={reset}
            error={error}
          />
        )}

        {phase === 'saving' && (
          <div className="flex flex-col items-center">
            <Loader2 size={48} className="text-blue-500 animate-spin" />
            <p className="mt-4 text-sm text-gray-500">タスクを登録中...</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <Check size={40} className="text-green-500" />
            </div>
            <p className="mt-4 text-lg font-semibold text-gray-800">タスクを登録しました</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={reset}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold"
              >
                もう一つ追加
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold"
              >
                タスク一覧を見る
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function ConfirmForm({
  analysis,
  transcript,
  onChange,
  onSave,
  onCancel,
  error,
}: {
  analysis: Analysis
  transcript: string
  onChange: (a: Analysis) => void
  onSave: () => void
  onCancel: () => void
  error: string | null
}) {
  return (
    <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        内容を確認
      </h2>

      <label className="block mb-3">
        <span className="text-xs text-gray-500">タスク名</span>
        <input
          type="text"
          value={analysis.title}
          onChange={(e) => onChange({ ...analysis, title: e.target.value })}
          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </label>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="block">
          <span className="text-xs text-gray-500">クライアント</span>
          <input
            type="text"
            value={analysis.client ?? ''}
            onChange={(e) => onChange({ ...analysis, client: e.target.value || null })}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">担当者</span>
          <input
            type="text"
            value={analysis.assignee ?? ''}
            onChange={(e) => onChange({ ...analysis, assignee: e.target.value || null })}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="block">
          <span className="text-xs text-gray-500">期限</span>
          <input
            type="date"
            value={analysis.dueDate ?? ''}
            onChange={(e) => onChange({ ...analysis, dueDate: e.target.value || null })}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">重要度</span>
          <select
            value={analysis.priority}
            onChange={(e) =>
              onChange({ ...analysis, priority: e.target.value as Analysis['priority'] })
            }
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="high">高</option>
            <option value="medium">通常</option>
            <option value="low">低</option>
          </select>
        </label>
      </div>

      {analysis.subTasks.length > 0 && (
        <div className="mb-3">
          <span className="text-xs text-gray-500">サブタスク</span>
          <ul className="mt-1 space-y-1">
            {analysis.subTasks.map((st, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={st}
                  onChange={(e) => {
                    const next = [...analysis.subTasks]
                    next[i] = e.target.value
                    onChange({ ...analysis, subTasks: next })
                  }}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={() => {
                    const next = analysis.subTasks.filter((_, j) => j !== i)
                    onChange({ ...analysis, subTasks: next })
                  }}
                  className="text-red-400 hover:text-red-600"
                  aria-label="サブタスクを削除"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="mb-4">
        <summary className="text-xs text-gray-400 cursor-pointer">元の音声テキスト</summary>
        <p className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded whitespace-pre-wrap">
          {transcript}
        </p>
      </details>

      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg font-semibold"
        >
          やり直し
        </button>
        <button
          onClick={onSave}
          className="flex-[2] py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold"
        >
          登録する
        </button>
      </div>
    </div>
  )
}
