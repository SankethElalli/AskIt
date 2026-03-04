import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft, Upload, FileText, Sparkles, Loader2, Plus, Trash2,
  AlertCircle, ChevronRight, HelpCircle, Brain,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  uploadDocumentToStorage,
  createRun,
  insertQuestions,
  sendToQuestionnaireWebhook,
  saveAnswers,
  updateRunStatus,
} from '@/lib/api'

// --- Robust text extraction: PDF via pdfjs-dist, DOCX via mammoth, plain text fallback ---
async function extractText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  // ── PDF ──────────────────────────────────────────────────────────────────
  if (ext === 'pdf') {
    const pdfjsLib = await import('pdfjs-dist')
    // Use the bundled legacy worker to avoid CDN dependency
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pages: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      // Group items into lines using their vertical position (transform[5] = y)
      const lineMap = new Map<number, string[]>()
      for (const item of content.items as Array<{ str: string; transform: number[] }>) {
        const y = Math.round(item.transform[5])
        if (!lineMap.has(y)) lineMap.set(y, [])
        lineMap.get(y)!.push(item.str)
      }
      // Sort lines top-to-bottom (higher y = higher on page in PDF coords)
      const sortedLines = [...lineMap.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, parts]) => parts.join(' ').trim())
        .filter(Boolean)
      pages.push(sortedLines.join('\n'))
    }
    return pages.join('\n')
  }

  // ── DOCX ─────────────────────────────────────────────────────────────────
  if (ext === 'docx' || ext === 'doc') {
    try {
      const mammoth = await import('mammoth')
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      return result.value
    } catch {
      // mammoth not installed — fall through to plain text
    }
  }

  // ── Plain text / CSV / fallback ───────────────────────────────────────────
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// Heuristic: extract questions from text, handling both line-per-question and
// inline-numbered formats ("1. Q one 2. Q two" on a single line).
function parseQuestionsFromText(text: string): string[] {
  // Pre-split on inline numbered boundaries so "1. Foo 2. Bar" becomes two lines
  const normalised = text
    .replace(/([.?!])\s+((?:Q?\d{1,3}|[A-Z])[.)\s])/g, '$1\n$2') // split after sentence end + numbering
    .replace(/(\s)((?:Q?\d{1,3})[.)\s]+[A-Z])/g, '\n$2')           // split before numbered items mid-line

  const lines = normalised.split('\n').map(l => l.trim()).filter(Boolean)
  const qs: string[] = []

  for (const line of lines) {
    // Numbered: "1. Question", "Q1:", "Q1.", "1) Question"
    const numbered = line.match(/^(?:Q?\d{1,3}[.):\s]+)(.+)/i)
    if (numbered) {
      const q = numbered[1].trim()
      if (q.length > 5) { qs.push(q); continue }
    }
    // Ends with question mark
    if (line.endsWith('?') && line.length > 10) { qs.push(line); continue }
    // Starts with interrogative word
    if (/^(Do|Is|Are|Does|Can|How|What|Why|When|Where|Which|Describe|Explain|List|Please)\b/i.test(line) && line.length > 15) {
      qs.push(line); continue
    }
  }

  // Fallback: return non-trivial lines if nothing matched
  return qs.length ? qs : lines.filter(l => l.length > 20).slice(0, 50)
}

type Step = 'setup' | 'questions' | 'processing' | 'done'

// Processing stages cycled through during the AI overlay
const PROCESSING_STAGES = [
  'Setting up your run…',
  'Uploading questionnaire file…',
  'Saving questions…',
  'Sending to AI agent…',
  'Searching your documents…',
  'Saving answers…',
]

function ProcessingOverlay({
  stageIndex,
  totalQuestions,
}: {
  stageIndex: number
  totalQuestions: number
}) {
  const [progress, setProgress] = useState(8)

  useEffect(() => {
    const id = setInterval(() => {
      setProgress(p => {
        if (p >= 90) return p
        const step = p < 40 ? 4 : p < 70 ? 2 : 0.8
        return Math.min(p + step, 90)
      })
    }, 600)
    return () => clearInterval(id)
  }, [])

  // Jump progress forward with each stage
  useEffect(() => {
    setProgress(Math.min(8 + stageIndex * 14, 90))
  }, [stageIndex])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-5">
        {/* Animated icon */}
        <div className="relative mx-auto h-20 w-20">
          <div className="h-20 w-20 rounded-2xl bg-black flex items-center justify-center shadow-lg">
            <Brain className="h-10 w-10 text-[#EAE4D5]" />
          </div>
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[#F2F2F2] flex items-center justify-center shadow-md">
            <Loader2 className="h-4 w-4 animate-spin text-black" />
          </div>
          <div className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-[#B6B09F]" style={{ animationDuration: '2s' }} />
        </div>

        <div>
          <h3 className="text-lg font-bold mb-1">
            AI is working on {totalQuestions} question{totalQuestions !== 1 ? 's' : ''}…
          </h3>
          <p className="text-sm text-muted-foreground">
            Searching your documents and generating answers. This can take a minute.
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#B6B09F] to-black rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-[#B6B09F] font-medium animate-pulse">
            {PROCESSING_STAGES[Math.min(stageIndex, PROCESSING_STAGES.length - 1)]}
          </p>
        </div>

        {/* Bouncing dots */}
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: Math.min(totalQuestions, 8) }).map((_, i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-[#B6B09F] animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground">Do not close or navigate away.</p>
      </div>
    </div>
  )
}

export default function NewRunPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('setup')
  const [runName, setRunName] = useState('')
  const [qFile, setQFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [questions, setQuestions] = useState<string[]>([])
  const [newQ, setNewQ] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')

  const [processingStage, setProcessingStage] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')
  const [error, setError] = useState('')
  const [runId, setRunId] = useState<string | null>(null)

  // ---- File handling ----
  const handleFile = useCallback(async (file: File) => {
    setQFile(file)
    setParsing(true)
    setParseError('')
    try {
      const text = await extractText(file)
      const parsed = parseQuestionsFromText(text)
      setQuestions(parsed)
      if (parsed.length === 0) setParseError('No questions detected. You can add them manually below.')
    } catch {
      setParseError('Could not read file. Add questions manually.')
    }
    setParsing(false)
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const addQuestion = () => {
    if (!newQ.trim()) return
    setQuestions(q => [...q, newQ.trim()])
    setNewQ('')
  }

  const removeQuestion = (i: number) => setQuestions(q => q.filter((_, idx) => idx !== i))

  const editQuestion = (i: number, val: string) =>
    setQuestions(q => q.map((item, idx) => idx === i ? val : item))

  // ---- Submit ----
  const startRun = async () => {
    if (!user || questions.length === 0) return
    setStep('processing')
    setProcessingStage(0)
    setError('')
    let currentRunId: string | null = null
    try {
      // Stage 0: Create run record
      setProcessingStage(0)
      const fileFallback = qFile
        ? qFile.name.replace(/\.[^/.]+$/, '') // strip extension
        : `Run ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      const name = runName.trim() || fileFallback
      const run = await createRun({ user_id: user.id, name, status: 'pending' })
      currentRunId = run.id
      setRunId(run.id)

      // Stage 1: Optionally upload the questionnaire file
      setProcessingStage(1)
      let questionnaireUrl: string | undefined
      if (qFile && (qFile.type === 'application/pdf' || qFile.name.toLowerCase().endsWith('.pdf'))) {
        const { signedUrl } = await uploadDocumentToStorage(qFile, user.id, 'questionnaires')
        questionnaireUrl = signedUrl
      }

      // Stage 2: Save questions to DB
      setProcessingStage(2)
      await insertQuestions(run.id, questions)

      // Stage 3 & 4: Send to n8n — AI retrieval happens here (long wait)
      setProcessingStage(3)
      await updateRunStatus(run.id, 'processing')
      setProcessingStage(4)
      const answers = await sendToQuestionnaireWebhook({
        run_id: run.id,
        user_id: user.id,
        questions: questions.map((text, i) => ({ index: i, text })),
        questionnaire_url: questionnaireUrl,
      })

      // Stage 5: Save answers
      setProcessingStage(5)
      await saveAnswers(run.id, answers)
      await updateRunStatus(run.id, 'completed')

      setStep('done')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error'
      setError(msg)
      if (currentRunId) await updateRunStatus(currentRunId, 'failed').catch(() => {})
    }
  }

  return (
      <div className="min-h-screen bg-[#F2F2F2]">
      {/* Overlay shown during AI processing */}
      {step === 'processing' && !error && (
        <ProcessingOverlay stageIndex={processingStage} totalQuestions={questions.length} />
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 glass border-b">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          {step === 'processing' ? (
            <span className="text-muted-foreground/40 cursor-not-allowed">
              <ArrowLeft className="h-5 w-5" />
            </span>
          ) : (
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-black flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-black">AskIt</span>
          </div>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-sm">New Run</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* Step: setup + questions */}
        {(step === 'setup' || step === 'questions') && (
          <>
            <div>
              <h1 className="text-2xl font-bold mb-1">New Questionnaire Run</h1>
              <p className="text-sm text-muted-foreground">
                Upload a questionnaire file or paste questions manually, then let the AI answer them from your reference documents.
              </p>
            </div>

            {/* Run name */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Run Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="run-name">Run Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="run-name"
                    placeholder="e.g. Acme Security Review Q3 2024"
                    value={runName}
                    onChange={e => setRunName(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* File upload */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Upload Questionnaire File</CardTitle>
                <CardDescription className="text-xs">
                  PDF, DOCX, or TXT — we'll extract the questions automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all
                    ${dragging ? 'border-[#B6B09F] bg-[#EAE4D5]' : 'border-gray-200 hover:border-[#B6B09F] hover:bg-[#EAE4D5]/30'}`}
                >
                  <input ref={inputRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                  {qFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="h-5 w-5 text-[#B6B09F]" />
                      <span className="font-medium text-sm">{qFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-medium">Drop questionnaire file or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF · DOCX · TXT</p>
                    </>
                  )}
                </div>
                {parsing && (
                  <div className="flex items-center gap-2 text-sm text-[#B6B09F] mt-3">
                    <Loader2 className="h-4 w-4 animate-spin" /> Extracting questions…
                  </div>
                )}
                {parseError && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 mt-3">
                    <AlertCircle className="h-4 w-4" /> {parseError}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Questions list */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Questions</CardTitle>
                  <CardDescription className="text-xs">
                    {questions.length} question(s). Edit, remove, or add more.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {questions.length === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    <HelpCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No questions yet. Upload a file or add them manually.
                  </div>
                )}
                {questions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground w-6 pt-2 flex-shrink-0 text-right">{i + 1}.</span>
                    <Input
                      value={q}
                      onChange={e => editQuestion(i, e.target.value)}
                      className="flex-1 text-sm"
                    />
                    <button onClick={() => removeQuestion(i)}
                      className="mt-2 text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {/* Add new */}
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Add a question…"
                    value={newQ}
                    onChange={e => setNewQ(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addQuestion() }}
                    className="flex-1 text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                variant="gradient"
                size="lg"
                onClick={startRun}
                disabled={questions.length === 0}
              >
                Generate Answers
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* Step: processing error (overlay handles the non-error state) */}
        {step === 'processing' && error && (
          <div className="flex flex-col items-center justify-center py-32 gap-5 text-center">
            <div className="h-16 w-16 rounded-2xl bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1 text-red-600">Something went wrong</h2>
              <p className="text-sm text-muted-foreground">The AI agent returned an error.</p>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 max-w-md text-left">
              <AlertCircle className="h-4 w-4 inline mr-2" />
              {error}
            </div>
            <Button variant="outline" size="sm" onClick={() => { setStep('setup'); setError('') }}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Go Back
            </Button>
          </div>
        )}

        {/* Step: done */}
        {step === 'done' && runId && (
          <div className="flex flex-col items-center justify-center py-32 gap-5 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Answers Ready!</h2>
              <p className="text-sm text-muted-foreground">The AI has processed all {questions.length} questions.</p>
            </div>
            <Button variant="gradient" size="lg" onClick={() => navigate(`/runs/${runId}/review`)}>
              Review Answers
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
