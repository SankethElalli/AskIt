import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft, Sparkles, Loader2, Download, CheckCircle2, AlertCircle,
  BookOpen, ChevronDown, ChevronUp, Edit3, Save, X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getQuestions, updateEditedAnswer } from '@/lib/api'
import { supabase } from '@/lib/supabase'

type QuestionRow = {
  id: string
  run_id: string
  question_text: string
  answer_text: string | null
  edited_answer: string | null
  confidence_score: number | null
  citations: string[] | null
  evidence_snippets: string[] | null
  status: string | null
  question_index: number
}

type RunRow = {
  id: string
  name: string
  status: string
  created_at: string
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return null
  const pct = Math.round(score * 100)
  const variant = pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'destructive'
  const label = pct >= 70 ? 'High' : pct >= 40 ? 'Medium' : 'Low'
  return (
    <Badge variant={variant as 'success'} className="text-xs">
      {label} ({pct}%)
    </Badge>
  )
}

function QuestionCard({ q, onSave }: { q: QuestionRow; onSave: (id: string, val: string) => Promise<void> }) {
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(q.edited_answer ?? q.answer_text ?? '')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const displayAnswer = q.edited_answer ?? q.answer_text

  const save = async () => {
    setSaving(true)
    await onSave(q.id, draft)
    setSaving(false)
    setEditing(false)
  }

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader
        className="pb-3 cursor-pointer select-none hover:bg-gray-50/50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-start gap-3">
          <span className="text-xs font-mono text-muted-foreground mt-0.5 w-6 flex-shrink-0">{q.question_index + 1}.</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{q.question_text}</p>
            {!open && displayAnswer && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{displayAnswer}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {q.edited_answer && <Badge variant="secondary" className="text-xs">Edited</Badge>}
            <ConfidenceBadge score={q.confidence_score} />
            {!displayAnswer && <Badge variant="destructive" className="text-xs">No Answer</Badge>}
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="pt-0 pl-9 space-y-3">
          {/* Answer */}
          {editing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="w-full text-sm border rounded-lg p-3 min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-black"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(q.edited_answer ?? q.answer_text ?? '') }}>
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="group relative">
              {displayAnswer ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap pr-8">{displayAnswer}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No answer generated.</p>
              )}
              <button
                onClick={() => { setEditing(true); setTimeout(() => textareaRef.current?.focus(), 50) }}
                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-black"
                title="Edit answer"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Citations */}
          {q.citations && q.citations.length > 0 && (
            <div className="text-xs">
              <p className="font-medium text-muted-foreground mb-1">Sources</p>
              <div className="flex flex-wrap gap-1">
                {q.citations.map((c, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-[#EAE4D5] text-black border border-[#B6B09F]/30">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Evidence snippets */}
          {q.evidence_snippets && q.evidence_snippets.length > 0 && (
            <div className="text-xs">
              <p className="font-medium text-muted-foreground mb-1">Evidence</p>
              <div className="space-y-1.5">
                {q.evidence_snippets.map((s, i) => (
                  <blockquote key={i} className="border-l-2 border-[#B6B09F] pl-2 text-muted-foreground italic line-clamp-3">
                    {s}
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export default function ReviewPage() {
  const { user } = useAuth()
  const { runId } = useParams<{ runId: string }>()
  const [run, setRun] = useState<RunRow | null>(null)
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const loadData = useCallback(async () => {
    if (!user || !runId) return
    setLoading(true)
    try {
      const [runRes, qs] = await Promise.all([
        supabase.from('questionnaire_runs').select('*').eq('id', runId).single(),
        getQuestions(runId),
      ])
      if (runRes.data) setRun(runRes.data as RunRow)
      setQuestions((qs as QuestionRow[]).sort((a, b) => a.question_index - b.question_index))
    } finally {
      setLoading(false)
    }
  }, [user, runId])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async (id: string, val: string) => {
    await updateEditedAnswer(id, val)
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, edited_answer: val } : q))
  }

  // Export as plain text
  const exportTxt = async () => {
    setExporting(true)
    const lines: string[] = [`${run?.name ?? 'Questionnaire Run'}\n`, `Exported: ${new Date().toLocaleString()}\n`, '='.repeat(60), '']
    for (const q of questions) {
      lines.push(`Q${q.question_index + 1}. ${q.question_text}`)
      const ans = q.edited_answer ?? q.answer_text ?? '(No answer)'
      lines.push(`A: ${ans}`)
      if (q.citations?.length) lines.push(`Sources: ${q.citations.join(', ')}`)
      lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${run?.name ?? 'questionnaire'}-answers.txt`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  // Stats
  const answered = questions.filter(q => q.answer_text || q.edited_answer).length
  const edited = questions.filter(q => q.edited_answer).length
  const total = questions.length

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-black flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold gradient-text">AskIt</span>
            </div>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-sm truncate max-w-[200px]">{run?.name ?? 'Review'}</span>
          </div>
          <Button variant="outline" size="sm" onClick={exportTxt} disabled={exporting || loading}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        {loading ? (
          /* ── Full-page skeleton while answers load ── */
          <div className="space-y-6 animate-pulse">
            {/* Title skeleton */}
            <div className="space-y-2">
              <div className="h-7 w-64 bg-gray-200 rounded-lg" />
              <div className="h-4 w-40 bg-gray-100 rounded" />
            </div>
            {/* Stats cards skeleton */}
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl border-0 shadow-sm bg-white p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gray-100 flex-shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-5 w-8 bg-gray-200 rounded" />
                    <div className="h-3 w-14 bg-gray-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
            {/* Progress bar skeleton */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <div className="h-3 w-14 bg-gray-100 rounded" />
                <div className="h-3 w-8 bg-gray-100 rounded" />
              </div>
              <div className="h-2 bg-gray-100 rounded-full" />
            </div>
            {/* Question card skeletons */}
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-4 w-5 bg-gray-200 rounded flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-full bg-gray-200 rounded" />
                    <div className="h-4 w-3/4 bg-gray-100 rounded" />
                  </div>
                  <div className="h-5 w-16 bg-gray-100 rounded-full flex-shrink-0" />
                </div>
                <div className="pl-8 space-y-1.5">
                  <div className="h-3 w-full bg-gray-100 rounded" />
                  <div className="h-3 w-5/6 bg-gray-100 rounded" />
                  <div className="h-3 w-2/3 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
            {/* Loading label */}
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-[#B6B09F]" />
              Loading your answers…
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">{run?.name ?? 'Questionnaire Run'}</h1>
                <p className="text-sm text-muted-foreground">
                  {run && new Date(run.created_at).toLocaleString()} · {total} questions
                </p>
              </div>
              {run?.status === 'completed' && (
                <Badge variant="success" className="mt-1">Completed</Badge>
              )}
              {run?.status === 'failed' && (
                <Badge variant="destructive" className="mt-1">Failed</Badge>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total', value: total, icon: BookOpen, color: 'text-black bg-[#EAE4D5]' },
                { label: 'Answered', value: answered, icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
                { label: 'Edited', value: edited, icon: Edit3, color: 'text-amber-600 bg-amber-50' },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="border-0 shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Coverage bar */}
            {total > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Coverage</span>
                  <span>{Math.round((answered / total) * 100)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#B6B09F] to-black rounded-full transition-all"
                    style={{ width: `${(answered / total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Questions */}
            {questions.length === 0 ? (
              <div className="text-center py-16">
                <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No questions found for this run.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map(q => (
                  <QuestionCard key={q.id} q={q} onSave={handleSave} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
