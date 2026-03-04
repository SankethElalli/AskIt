import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

export type Database = {
  public: {
    Tables: {
      questionnaire_runs: {
        Row: {
          id: string
          user_id: string
          title: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          questionnaire_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['questionnaire_runs']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['questionnaire_runs']['Insert']>
      }
      questions: {
        Row: {
          id: string
          run_id: string
          order_index: number
          question_text: string
          generated_answer: string | null
          citations: string[] | null
          confidence_score: number | null
          is_edited: boolean
          edited_answer: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['questions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['questions']['Insert']>
      }
      reference_documents: {
        Row: {
          id: string
          user_id: string
          name: string
          storage_path: string
          signed_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['reference_documents']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['reference_documents']['Insert']>
      }
    }
  }
}
