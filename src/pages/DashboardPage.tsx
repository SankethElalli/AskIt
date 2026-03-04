import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sparkles, Plus, FileText, Clock, CheckCircle2, AlertCircle,
  Upload, BookOpen, ArrowRight, LogOut, User, Loader2, Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getRuns, getRefDocs, deleteRun } from '@/lib/api'

type Run = {
  id: string
  name: string
  status: string
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default' }> = {
  completed: { label: 'Completed', variant: 'success' },
  processing: { label: 'Processing', variant: 'warning' },
  pending: { label: 'Pending', variant: 'secondary' },
  failed: { label: 'Failed', variant: 'destructive' },
}

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  const [runs, setRuns] = useState<Run[]>([])
  const [docCount, setDocCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmRunId, setConfirmRunId] = useState<string | null>(null)

  const confirmRun = confirmRunId ? runs.find(r => r.id === confirmRunId) : null

  const requestDelete = (e: React.MouseEvent, runId: string) => {
    e.stopPropagation()
    setConfirmRunId(runId)
  }

  const handleDelete = async () => {
    if (!confirmRunId) return
    const runId = confirmRunId
    setConfirmRunId(null)
    setDeletingId(runId)
    try {
      await deleteRun(runId)
      setRuns(prev => prev.filter(r => r.id !== runId))
    } catch {
      // re-open with an error could be added; for now just clear
    } finally {
      setDeletingId(null)
    }
  }

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [runsData, docsData] = await Promise.all([
        getRuns(user.id),
        getRefDocs(user.id),
      ])
      setRuns(runsData as Run[])
      setDocCount((docsData as unknown[]).length)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const completed = runs.filter(r => r.status === 'completed').length
  const inProgress = runs.filter(r => r.status === 'processing' || r.status === 'pending').length

  const stats = [
    { label: 'Total Runs', value: loading ? '…' : String(runs.length), icon: FileText, color: 'text-black', bg: 'bg-[#EAE4D5]' },
    { label: 'Completed', value: loading ? '…' : String(completed), icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'In Progress', value: loading ? '…' : String(inProgress), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Ref Documents', value: loading ? '…' : String(docCount), icon: BookOpen, color: 'text-[#B6B09F]', bg: 'bg-[#EAE4D5]' },
  ]

  const recentRuns = runs.slice(0, 10)

  return (
    <div className="min-h-screen bg-[#F2F2F2]">

      {/* ── Delete confirmation modal ─────────────────────────────────── */}
      {confirmRunId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setConfirmRunId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full mx-4 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete run?</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  This will permanently delete
                </p>
              </div>
            </div>

            {/* Run name pill */}
            <div className="rounded-lg bg-gray-50 border px-4 py-3">
              <p className="text-sm font-medium text-gray-800 truncate">{confirmRun?.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {confirmRun ? new Date(confirmRun.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              All questions and AI-generated answers for this run will be removed. This action cannot be undone.
            </p>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmRunId(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete run
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold text-black">AskIt</span>
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-8 w-8 rounded-full bg-[#EAE4D5] flex items-center justify-center">
                  <User className="h-4 w-4 text-black" />
                </div>
                <span className="hidden sm:block font-medium text-foreground">{displayName}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:block">Sign out</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-1">
            Good to see you, {displayName.split(' ')[0]} 👋
          </h1>
          <p className="text-muted-foreground">
            Manage your questionnaire runs and reference documents.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 gap-6 mb-10">
          <Card
            className="border-dashed border-2 border-[#B6B09F]/50 bg-[#EAE4D5]/20 hover:border-[#B6B09F] hover:bg-[#EAE4D5]/50 transition-all cursor-pointer group"
            onClick={() => navigate('/runs/new')}
          >
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-2xl bg-[#EAE4D5] group-hover:bg-[#B6B09F]/40 transition-colors flex items-center justify-center mb-4">
                <Plus className="h-7 w-7 text-black" />
              </div>
              <h3 className="font-semibold text-lg mb-2">New Questionnaire Run</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Upload a questionnaire and let AI generate cited answers from your reference documents.
              </p>
              <Button variant="gradient" size="sm">
                <Upload className="h-4 w-4" />
                Upload questionnaire
              </Button>
            </CardContent>
          </Card>

          <Card
            className="border-dashed border-2 border-[#B6B09F]/50 bg-[#EAE4D5]/20 hover:border-[#B6B09F] hover:bg-[#EAE4D5]/50 transition-all cursor-pointer group"
            onClick={() => navigate('/references')}
          >
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-2xl bg-[#EAE4D5] group-hover:bg-[#B6B09F]/40 transition-colors flex items-center justify-center mb-4">
                <BookOpen className="h-7 w-7 text-[#B6B09F]" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Manage Reference Docs</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Upload and manage the internal documents used as the source of truth for AI answers.
              </p>
              <Button variant="outline" size="sm" className="border-[#B6B09F] text-black hover:bg-[#EAE4D5]">
                <Upload className="h-4 w-4" />
                Upload reference docs
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Runs */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent Runs</CardTitle>
              <CardDescription>Your questionnaire processing history</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/runs/new')}>
              <Plus className="h-4 w-4" />
              New Run
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[#B6B09F]" />
              </div>
            ) : recentRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="font-medium text-gray-900 mb-2">No runs yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-6">
                  Upload a questionnaire to get started. Your runs will appear here once you create one.
                </p>
                <Button variant="gradient" size="sm" onClick={() => navigate('/runs/new')}>
                  <Plus className="h-4 w-4" />
                  Start your first run
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRuns.map(run => {
                  const cfg = STATUS_CONFIG[run.status] ?? { label: run.status, variant: 'default' as const }
                  return (
                    <div
                      key={run.id}
                      className="flex items-center gap-4 p-3 rounded-lg border bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/runs/${run.id}/review`)}
                    >
                      <div className="h-9 w-9 rounded-lg bg-[#EAE4D5] flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-black" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{run.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(run.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                      <button
                        onClick={e => requestDelete(e, run.id)}
                        disabled={deletingId === run.id}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 flex-shrink-0"
                        title="Delete run"
                      >
                        {deletingId === run.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                      </button>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info banner */}
        <div className="mt-6 rounded-xl bg-[#EAE4D5] border border-[#B6B09F]/30 p-5 flex items-start gap-4">
          <div className="h-9 w-9 rounded-lg bg-[#B6B09F]/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-black" />
          </div>
          <div>
            <p className="font-medium text-sm text-black mb-0.5">Quick tip</p>
            <p className="text-sm text-black/60">
              Upload your reference documents first so the AI has a knowledge base to draw from.
              Then create a new run to answer a questionnaire automatically.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
