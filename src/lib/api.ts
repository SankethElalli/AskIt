import { supabase } from './supabase'

const DATASTORE_WEBHOOK = import.meta.env.VITE_N8N_DATASTORE_WEBHOOK_URL as string
const QUESTIONNAIRE_WEBHOOK = import.meta.env.VITE_N8N_QUESTIONNAIRE_WEBHOOK_URL as string
const DELETE_WEBHOOK = import.meta.env.VITE_N8N_DELETE_WEBHOOK_URL as string

// ─── Supabase Storage ────────────────────────────────────────────────────────

/**
 * Upload a file to Supabase Storage under `documents/{userId}/{folder}/{filename}`
 * Returns a signed URL valid for 1 hour.
 */
export async function uploadDocumentToStorage(
  file: File,
  userId: string,
  folder: 'reference' | 'questionnaires'
): Promise<{ storagePath: string; signedUrl: string }> {
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const storagePath = `${userId}/${folder}/${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, { upsert: false, contentType: file.type })

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const { data: signedData, error: signedError } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 60 * 60) // 1 hour

  if (signedError || !signedData?.signedUrl)
    throw new Error(`Signed URL failed: ${signedError?.message}`)

  return { storagePath, signedUrl: signedData.signedUrl }
}

// ─── n8n: Data Store Webhook ─────────────────────────────────────────────────

/**
 * Send a single reference doc signed URL to n8n DataStore webhook.
 */
export async function sendToDataStoreWebhook(payload: {
  signed_url: string
  file_name: string
  user_id: string
  doc_id: string
}): Promise<void> {
  const res = await fetch(DATASTORE_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`DataStore webhook failed: ${res.status} ${res.statusText}`)
}

/**
 * Send ALL reference doc signed URLs in one batch call to n8n DataStore webhook.
 *
 * Each document entry includes a `metadata` object with user_id, doc_id, and
 * file_name so the n8n Supabase Vector Store node can forward them as row
 * metadata. The DB trigger then promotes those values into the indexed columns.
 *
 * n8n receives:
 * {
 *   user_id: string,
 *   documents: [{
 *     signed_url, file_name, doc_id,
 *     metadata: { user_id, doc_id, file_name }
 *   }, ...]
 * }
 *
 * In n8n, set the Supabase Vector Store "Metadata" field to:
 *   {{ $json.metadata }}
 */
export async function sendToDataStoreWebhookBatch(payload: {
  user_id: string
  documents: Array<{ signed_url: string; file_name: string; doc_id: string }>
}): Promise<void> {
  const enriched = {
    user_id: payload.user_id,
    documents: payload.documents.map(doc => ({
      ...doc,
      metadata: {
        user_id: payload.user_id,
        doc_id: doc.doc_id,
        file_name: doc.file_name,
      },
    })),
  }

  const res = await fetch(DATASTORE_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enriched),
  })
  if (!res.ok) throw new Error(`DataStore webhook batch failed: ${res.status} ${res.statusText}`)
}

// ─── n8n: Delete Webhook ────────────────────────────────────────────────────

/**
 * Notify n8n to delete all vector rows for a specific user + file combination.
 * Calls the RPC function `rpc_delete_user_file_vectors` via the DeleteData webhook.
 */
export async function sendToDeleteWebhook(payload: {
  user_id: string
  file_name: string
}): Promise<void> {
  const res = await fetch(DELETE_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Delete webhook failed: ${res.status} ${res.statusText}`)
}

// ─── n8n: Questionnaire Webhook ──────────────────────────────────────────────

export type AnswerFromN8N = {
  question_index: number
  answer_text: string
  citations?: string[]
  confidence_score?: number
  evidence_snippets?: string[]
}

/**
 * Send parsed questions to n8n QuestionBot; returns answers array.
 * questions is an array of { index, text } objects (no DB ids needed yet).
 */
export async function sendToQuestionnaireWebhook(payload: {
  run_id: string
  user_id: string
  questions: Array<{ index: number; text: string }>
  questionnaire_url?: string
}): Promise<AnswerFromN8N[]> {
  const res = await fetch(QUESTIONNAIRE_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Questionnaire webhook failed: ${res.status} ${res.statusText}`)
  const data = await res.json()

  // n8n "Respond to Webhook (allIncomingItems)" wraps the AI Agent output as:
  //   [{ "output": "<JSON string or raw array>" }]
  // We need to unwrap and parse that string into our AnswerFromN8N[].
  const extractAnswers = (raw: unknown): AnswerFromN8N[] => {
    // Already a proper array of answer objects
    if (Array.isArray(raw)) {
      const first = raw[0]
      if (!first) return []
      // Unwrap n8n envelope: [{ output: "..." }]
      if (typeof first.output === 'string') {
        return extractAnswers(parseJsonFromText(first.output))
      }
      // Direct array of answer objects
      if (typeof first.question_index === 'number') return raw as AnswerFromN8N[]
      // Maybe wrapped differently: [{ answers: [...] }]
      if (Array.isArray(first.answers)) return first.answers as AnswerFromN8N[]
    }
    // Plain object with answers key
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>
      if (Array.isArray(obj.answers)) return obj.answers as AnswerFromN8N[]
      if (typeof obj.output === 'string') return extractAnswers(parseJsonFromText(obj.output))
    }
    return []
  }

  return extractAnswers(data)
}

/** Strip markdown code fences and parse the first JSON array/object found in text. */
function parseJsonFromText(text: string): unknown {
  // Remove ```json ... ``` or ``` ... ``` fences
  const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(stripped)
  } catch {
    // Try to extract just the array portion
    const match = stripped.match(/\[[\s\S]*\]/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { /* fall through */ }
    }
    return []
  }
}

// ─── Supabase DB helpers ─────────────────────────────────────────────────────

export async function createRun(payload: { user_id: string; name: string; status: string }) {
  const { data, error } = await supabase
    .from('questionnaire_runs')
    .insert({ user_id: payload.user_id, title: payload.name, name: payload.name, status: payload.status })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string; name: string; status: string; created_at: string }
}

/** Insert questions as plain strings; returns inserted rows with their DB ids. */
export async function insertQuestions(runId: string, questionTexts: string[]) {
  const rows = questionTexts.map((text, i) => ({
    run_id: runId,
    question_text: text,
    order_index: i,
    question_index: i,
  }))
  const { data, error } = await supabase.from('questions').insert(rows).select()
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{ id: string; question_index: number; question_text: string }>
}

export async function updateRunStatus(
  runId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed'
) {
  const { error } = await supabase
    .from('questionnaire_runs')
    .update({ status })
    .eq('id', runId)
  if (error) throw new Error(error.message)
}

/**
 * Save answers returned from n8n into the questions table.
 * Matches by question_index within the run.
 */
export async function saveAnswers(runId: string, answers: AnswerFromN8N[]) {
  const updates = answers.map(a =>
    supabase
      .from('questions')
      .update({
        generated_answer: a.answer_text,
        answer_text: a.answer_text,
        citations: a.citations ?? [],
        confidence_score: a.confidence_score ?? null,
        evidence_snippets: a.evidence_snippets ?? [],
      })
      .eq('run_id', runId)
      .eq('question_index', a.question_index)
  )
  await Promise.all(updates)
}

export async function saveRefDocMeta(payload: {
  user_id: string
  name: string
  storage_path: string
  signed_url: string
  file_size: number
  mime_type: string
}) {
  const { data, error } = await supabase
    .from('reference_documents')
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string }
}

export async function getRuns(userId: string) {
  const { data, error } = await supabase
    .from('questionnaire_runs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function deleteRun(runId: string) {
  // Questions are deleted via ON DELETE CASCADE on the FK, so only the run row needs deleting.
  const { error } = await supabase
    .from('questionnaire_runs')
    .delete()
    .eq('id', runId)
  if (error) throw new Error(error.message)
}

export async function getQuestions(runId: string) {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('run_id', runId)
    .order('question_index')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getRefDocs(userId: string) {
  const { data, error } = await supabase
    .from('reference_documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function updateEditedAnswer(questionId: string, editedAnswer: string) {
  const { error } = await supabase
    .from('questions')
    .update({ edited_answer: editedAnswer })
    .eq('id', questionId)
  if (error) throw new Error(error.message)
}
