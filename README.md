# AskIt — AI-Powered Questionnaire Answering Tool

AskIt automates the process of answering questionnaires by combining document upload, RAG (Retrieval-Augmented Generation) via an n8n AI agent, and a clean review/export workflow.

---

## How It Works

1. **Upload Reference Documents** — PDF, DOCX, or plain-text files are stored in Supabase Storage and vectorised into a Supabase Vector Store via an n8n pipeline.
2. **Create a Run** — Upload a questionnaire file; AskIt extracts all questions client-side and sends them to the n8n QuestionBot webhook.
3. **AI Answers** — The n8n RAG agent retrieves relevant chunks from the vector store and returns answers with citations, confidence scores, and evidence snippets.
4. **Review & Export** — Answers are displayed per-question with expandable evidence. Users can inline-edit any answer and export the final document.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 18.3.1 |
| Language | TypeScript | 5.8.3 |
| Build tool | Vite | 6.3.4 |
| Styling | Tailwind CSS | 3.4.17 |
| Component library | Radix UI (headless) | various |
| Icons | Lucide React | 0.503.0 |
| Routing | React Router DOM | 7.5.3 |
| Auth & Database | Supabase JS | 2.49.2 |
| PDF parsing | pdfjs-dist | 5.5.207 |
| DOCX parsing | mammoth | 1.11.0 |
| Automation / AI | n8n (self-hosted) | — |
| Utility | clsx + tailwind-merge, class-variance-authority | 2.1.1 / 3.3.0 / 0.7.1 |

---

## Pages & Features

### `/` — Home
Landing page describing the four-step workflow (Upload → Analyse → Verify → Export).

### `/login` & `/signup`
Email/password authentication backed by Supabase Auth. Full name is stored in `user_metadata`.

### `/dashboard` (protected)
- Lists all questionnaire runs with status badges (`pending`, `processing`, `completed`, `failed`).
- Delete a run (cascade-deletes questions via FK).
- Quick links to References and New Run.

### `/references` (protected)
- Drag-and-drop or click-to-upload multi-file uploader (PDF / DOCX / TXT).
- Files are uploaded to Supabase Storage (`documents/{userId}/reference/`).
- Metadata saved to `reference_documents` table.
- Batch webhook call to n8n DataStore pipeline for chunking + embedding into the vector store.
- Shows animated chunking progress stages during indexing.
- Delete a document (removes from storage + triggers n8n delete webhook to clean vector rows).

### `/runs/new` (protected)
- Name the run, upload a questionnaire file.
- Client-side text extraction (PDF via pdfjs-dist, DOCX via mammoth, plain-text fallback).
- Questions are parsed line-by-line and displayed for user confirmation.
- On submit: creates a `questionnaire_runs` row, inserts `questions` rows, calls n8n QuestionBot webhook, saves returned answers + metadata, marks run `completed`.

### `/runs/:runId/review` (protected)
- Loads all questions for a run, sorted by `question_index`.
- `ConfidenceBadge` shows High / Medium / Low with percentage.
- Expandable evidence snippets and citations per question.
- Inline answer editing saved back to `questions.edited_answer`.
- Export button (generates a downloadable text document).

---

## Database Schema (Supabase)

| Table | Key Columns |
|---|---|
| `questionnaire_runs` | `id`, `user_id`, `name`, `title`, `status`, `created_at` |
| `questions` | `id`, `run_id`, `question_text`, `order_index`, `question_index`, `answer_text`, `edited_answer`, `citations`, `confidence_score`, `evidence_snippets`, `status` |
| `reference_documents` | `id`, `user_id`, `name`, `storage_path`, `signed_url`, `file_size`, `mime_type`, `created_at` |

Foreign key `questions.run_id → questionnaire_runs.id` with `ON DELETE CASCADE`.

---

## n8n Webhooks

| Env Variable | Purpose |
|---|---|
| `VITE_N8N_DATASTORE_WEBHOOK_URL` | Receives reference documents (batch), chunks + embeds into vector store |
| `VITE_N8N_QUESTIONNAIRE_WEBHOOK_URL` | Receives questions + questionnaire URL, returns answers with citations |
| `VITE_N8N_DELETE_WEBHOOK_URL` | Deletes all vector rows for a given user + file via `rpc_delete_user_file_vectors` |

---

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_N8N_DATASTORE_WEBHOOK_URL=http://localhost:5678/webhook/...
VITE_N8N_QUESTIONNAIRE_WEBHOOK_URL=http://localhost:5678/webhook/...
VITE_N8N_DELETE_WEBHOOK_URL=http://localhost:5678/webhook/...
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (proxies /n8n → http://localhost:5678)
npm run dev

# Type-check + production build
npm run build

# Preview production build
npm run preview
```

TypeScript target: **ES2020**, strict mode enabled, path alias `@/` → `src/`.

---

## Supported File Formats

| Format | Parsed by |
|---|---|
| `.pdf` | pdfjs-dist (bundled worker, no CDN) |
| `.docx` / `.doc` | mammoth |
| `.txt` and others | FileReader plain-text fallback |
