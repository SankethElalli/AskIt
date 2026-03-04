import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft, Upload, FileText, Trash2, Loader2, CheckCircle2,
  AlertCircle, BookOpen, Sparkles, RefreshCw, Brain,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  uploadDocumentToStorage,
  sendToDataStoreWebhookBatch,
  sendToDeleteWebhook,
  saveRefDocMeta,
  getRefDocs,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'

type RefDoc = {
  id: string
  name: string
  storage_path: string
  signed_url: string | null
  file_size: number | null
  mime_type: string | null
  created_at: string
}

type UploadState = 'idle' | 'uploading' | 'indexing' | 'done' | 'error'

type FileItem = {
  file: File
  state: UploadState
  error?: string
  docId?: string
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mime }: { mime: string | null }) {
  return <FileText className="h-5 w-5 text-[#B6B09F] flex-shrink-0" />
}

// Chunking stages shown during the indexing phase
const CHUNKING_STAGES = [
  'Fetching file from storage…',
  'Extracting text content…',
  'Splitting into chunks…',
  'Generating embeddings…',
  'Writing to vector store…',
  'Finalising index…',
]

function ChunkingOverlay({ fileCount }: { fileCount: number }) {
  const [stageIndex, setStageIndex] = useState(0)
  const [progress, setProgress] = useState(8)

  useEffect(() => {
    // Advance stages roughly every 4 seconds (n8n chunking is slow)
    const stageInterval = setInterval(() => {
      setStageIndex(s => Math.min(s + 1, CHUNKING_STAGES.length - 1))
    }, 4000)
    // Smoothly grow progress bar but never reach 100 (real completion does that)
    const progressInterval = setInterval(() => {
      setProgress(p => {
        if (p >= 90) return p
        // Accelerate fast early, slow down near end
        const step = p < 40 ? 4 : p < 70 ? 2 : 0.8
        return Math.min(p + step, 90)
      })
    }, 600)
    return () => { clearInterval(stageInterval); clearInterval(progressInterval) }
  }, [])

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
          {/* Pulse rings */}
          <div className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-[#B6B09F]" style={{ animationDuration: '2s' }} />
        </div>

        <div>
          <h3 className="text-lg font-bold mb-1">
            Indexing {fileCount} {fileCount === 1 ? 'file' : 'files'}…
          </h3>
          <p className="text-sm text-muted-foreground">
            Please wait while the AI chunks and embeds your documents. This can take a minute.
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
            {CHUNKING_STAGES[stageIndex]}
          </p>
        </div>

        {/* File dots */}
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: Math.min(fileCount, 8) }).map((_, i) => (
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

export default function ReferencesPage() {
  const { user } = useAuth()
  const [docs, setDocs] = useState<RefDoc[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [queue, setQueue] = useState<FileItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [indexingCount, setIndexingCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadDocs = useCallback(async () => {
    if (!user) return
    setLoadingDocs(true)
    try {
      const data = await getRefDocs(user.id)
      setDocs(data as RefDoc[])
    } finally {
      setLoadingDocs(false)
    }
  }, [user])

  useEffect(() => { loadDocs() }, [loadDocs])

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain']
    const items: FileItem[] = Array.from(files)
      .filter(f => allowed.includes(f.type) || f.name.match(/\.(pdf|docx|doc|xlsx|txt)$/i))
      .map(f => ({ file: f, state: 'idle' }))
    setQueue(q => [...q, ...items])
  }

  const processQueue = async () => {
    if (!user || isProcessing) return

    const idleIndices = queue.map((item, i) => item.state === 'idle' ? i : -1).filter(i => i >= 0)
    if (idleIndices.length === 0) return

    setIsProcessing(true)

    // ── Phase 1: Upload all idle files to Storage + save DB metadata in parallel ──
    setQueue(q => q.map((item, i) => idleIndices.includes(i) ? { ...item, state: 'uploading' } : item))

    type UploadResult = { index: number; signed_url: string; file_name: string; doc_id: string }
    const succeeded: UploadResult[] = []

    await Promise.all(
      idleIndices.map(async (i) => {
        try {
          const { storagePath, signedUrl } = await uploadDocumentToStorage(
            queue[i].file, user.id, 'reference'
          )
          const doc = await saveRefDocMeta({
            user_id: user.id,
            name: queue[i].file.name,
            storage_path: storagePath,
            signed_url: signedUrl,
            file_size: queue[i].file.size,
            mime_type: queue[i].file.type,
          })
          succeeded.push({ index: i, signed_url: signedUrl, file_name: queue[i].file.name, doc_id: doc.id })
          // Mark as indexing while we wait for the batch webhook
          setQueue(q => q.map((item, idx) => idx === i ? { ...item, state: 'indexing', docId: doc.id } : item))
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          setQueue(q => q.map((item, idx) => idx === i ? { ...item, state: 'error', error: msg } : item))
        }
      })
    )

    if (succeeded.length === 0) { setIsProcessing(false); loadDocs(); return }

    // ── Phase 2: Show chunking overlay + send ALL signed URLs in one batch webhook call ──
    setIndexingCount(succeeded.length)

    try {
      await sendToDataStoreWebhookBatch({
        user_id: user.id,
        documents: succeeded.map(({ signed_url, file_name, doc_id }) => ({ signed_url, file_name, doc_id })),
      })
      // Mark all successfully uploaded files as done
      setQueue(q => q.map((item, i) =>
        succeeded.some(s => s.index === i) ? { ...item, state: 'done' } : item
      ))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Webhook error'
      // Mark all indexing files as error if the batch call fails
      setQueue(q => q.map((item, i) =>
        succeeded.some(s => s.index === i) ? { ...item, state: 'error', error: msg } : item
      ))
    }

    setIsProcessing(false)
    setIndexingCount(0)
    loadDocs()
  }

  const removeFromQueue = (i: number) =>
    setQueue(q => q.filter((_, idx) => idx !== i))

  const deleteDoc = async (doc: RefDoc) => {
    // Notify n8n to delete vectors for this specific file
    if (user?.id) {
      try {
        await sendToDeleteWebhook({ user_id: user.id, file_name: doc.name })
      } catch (err) {
        console.error('DeleteData webhook failed:', err)
      }
    }

    await supabase.storage.from('documents').remove([doc.storage_path])
    await supabase.from('reference_documents').delete().eq('id', doc.id)
    setDocs(d => d.filter(d => d.id !== doc.id))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const hasIdleFiles = queue.some(f => f.state === 'idle')

  return (
      <div className="min-h-screen bg-[#F2F2F2]">
      {/* Chunking overlay — blocks UI until n8n finishes embedding */}
      {isProcessing && indexingCount > 0 && <ChunkingOverlay fileCount={indexingCount} />}

      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-black flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold text-black">AskIt</span>
            </div>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-sm">Reference Documents</span>
          </div>
          <Button variant="ghost" size="sm" onClick={loadDocs}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Reference Documents</h1>
          <p className="text-muted-foreground text-sm">
            Upload your internal documents. Each file is stored in Supabase and indexed into the AI knowledge base via n8n.
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={e => { if (!isProcessing) { e.preventDefault(); setDragging(true) } }}
          onDragLeave={() => setDragging(false)}
          onDrop={isProcessing ? undefined : onDrop}
          onClick={() => { if (!isProcessing) inputRef.current?.click() }}
          className={`rounded-xl border-2 border-dashed p-10 text-center transition-all
            ${isProcessing
              ? 'border-gray-200 bg-[#F2F2F2] opacity-50 cursor-not-allowed'
              : dragging
                ? 'border-[#B6B09F] bg-[#EAE4D5] cursor-pointer'
                : 'border-gray-200 bg-[#F2F2F2] hover:border-[#B6B09F] hover:bg-[#EAE4D5]/30 cursor-pointer'
            }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.xlsx,.txt"
            className="hidden"
            onChange={e => addFiles(e.target.files)}
          />
          <div className="h-12 w-12 rounded-xl bg-[#EAE4D5] flex items-center justify-center mx-auto mb-3">
            <Upload className="h-6 w-6 text-black" />
          </div>
          <p className="font-medium mb-1">Drop files here or click to browse</p>
          <p className="text-sm text-muted-foreground">Supports PDF, DOCX, DOC, XLSX, TXT · Max 50 MB per file</p>
        </div>

        {/* Upload Queue */}
        {queue.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Upload Queue</CardTitle>
                <CardDescription className="text-xs">{queue.length} file(s) selected</CardDescription>
              </div>
              {hasIdleFiles && (
                <Button variant="gradient" size="sm" onClick={processQueue} disabled={isProcessing}>
                  {isProcessing
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
                    : <><Upload className="h-4 w-4" /> Upload & Index All</>
                  }
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {queue.map((item, i) => (
                <div key={i} className="relative flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 border hover:bg-white transition-colors text-center group">
                  {/* Remove button */}
                  {item.state === 'idle' && !isProcessing && (
                    <button
                      onClick={() => removeFromQueue(i)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {/* File icon */}
                  <div className="h-10 w-10 rounded-lg bg-[#EAE4D5] flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-black" />
                  </div>
                  <div className="w-full min-w-0">
                    <p className="text-xs font-medium truncate w-full">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
                  </div>
                  {/* State badge */}
                  {item.state === 'idle' && (
                    <Badge variant="secondary" className="text-xs">Pending</Badge>
                  )}
                  {item.state === 'uploading' && (
                    <div className="flex items-center gap-1 text-xs text-[#B6B09F]">
                      <Loader2 className="h-3 w-3 animate-spin" />Uploading…
                    </div>
                  )}
                  {item.state === 'indexing' && (
                    <div className="flex items-center gap-1 text-xs text-black">
                      <Loader2 className="h-3 w-3 animate-spin" />Indexing…
                    </div>
                  )}
                  {item.state === 'done' && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3 w-3" />Indexed
                    </div>
                  )}
                  {item.state === 'error' && (
                    <div className="flex items-center gap-1 text-xs text-red-600" title={item.error}>
                      <AlertCircle className="h-3 w-3" />Failed
                    </div>
                  )}
                </div>
              ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing Docs */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Indexed Documents</CardTitle>
              <CardDescription className="text-xs">{docs.length} document(s) in your knowledge base</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDocs ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-[#B6B09F]" />
              </div>
            ) : docs.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="h-6 w-6 text-gray-400" />
                </div>
                <p className="font-medium text-sm text-gray-700">No documents yet</p>
                <p className="text-xs text-muted-foreground mt-1">Upload files above to build your knowledge base.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {docs.map(doc => (
                  <div key={doc.id} className="relative flex flex-col items-center gap-2 p-4 rounded-xl border bg-gray-50/50 hover:bg-white transition-colors text-center group">
                    {/* Delete button */}
                    <button
                      onClick={() => deleteDoc(doc)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {/* File icon */}
                    <div className="h-10 w-10 rounded-lg bg-[#EAE4D5] flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-black" />
                    </div>
                    <div className="w-full min-w-0">
                      <p className="text-xs font-medium truncate w-full">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="success" className="text-xs">Indexed</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
