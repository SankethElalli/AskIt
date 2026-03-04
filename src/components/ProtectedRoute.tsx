import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Sparkles } from 'lucide-react'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-black flex items-center justify-center shadow-lg">
          <Sparkles className="h-6 w-6 text-[#EAE4D5]" />
        </div>
        <Loader2 className="h-5 w-5 text-[#B6B09F] animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
