import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Upload,
  Sparkles,
  Download,
  CheckCircle2,
  ArrowRight,
  Brain,
  Shield,
  Zap,
  BookOpen,
  ChevronRight,
  Star,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const features = [
  {
    icon: Upload,
    title: 'Upload Documents',
    description:
      'Upload your questionnaire and reference documents. We support PDF, DOCX, and spreadsheet formats.',
    color: 'text-black',
    bg: 'bg-[#EAE4D5]',
  },
  {
    icon: Brain,
    title: 'AI-Powered Analysis',
    description:
      'Our RAG agent retrieves relevant context from your reference docs and generates accurate, grounded answers.',
    color: 'text-black',
    bg: 'bg-[#EAE4D5]',
  },
  {
    icon: Shield,
    title: 'Cited & Verified',
    description:
      'Every answer includes citations pointing to the exact source document. No hallucinations — only grounded responses.',
    color: 'text-black',
    bg: 'bg-[#EAE4D5]',
  },
  {
    icon: Download,
    title: 'Export & Share',
    description:
      'Review answers, make edits, then export a fully formatted document with questions, answers, and citations.',
    color: 'text-black',
    bg: 'bg-[#EAE4D5]',
  },
]

const steps = [
  { step: '01', title: 'Sign up & log in', description: 'Create your account in seconds.' },
  { step: '02', title: 'Upload questionnaire', description: 'Drop in your PDF or DOCX questionnaire file.' },
  { step: '03', title: 'Add reference docs', description: 'Upload the internal documents that contain answers.' },
  { step: '04', title: 'Generate answers', description: 'Click generate — AI does the heavy lifting.' },
  { step: '05', title: 'Review & edit', description: 'Check each answer and make any adjustments.' },
  { step: '06', title: 'Export document', description: 'Download a clean, cited output document.' },
]

const useCases = [
  { icon: Shield, label: 'Security Reviews' },
  { icon: BookOpen, label: 'Vendor Assessments' },
  { icon: CheckCircle2, label: 'Compliance Forms' },
  { icon: FileText, label: 'Operational Audits' },
  { icon: Star, label: 'Due Diligence' },
  { icon: Zap, label: 'RFP Responses' },
]

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold text-black">AskIt</span>
            </div>

            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
              <a href="#use-cases" className="hover:text-foreground transition-colors">Use cases</a>
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <Button variant="gradient" size="sm" asChild>
                  <Link to="/dashboard">
                    Go to Dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/login">Log in</Link>
                  </Button>
                  <Button variant="gradient" size="sm" asChild>
                    <Link to="/signup">Get started free</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        {/* Background gradients */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#B6B09F]/20 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-[#EAE4D5]/60 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 w-64 h-64 bg-[#B6B09F]/15 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="animate-fade-in">
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium">
              <Sparkles className="h-3 w-3 mr-1.5 text-[#B6B09F]" />
              Powered by RAG — Retrieval Augmented Generation
            </Badge>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
              Answer questionnaires
              <br />
              <span className="gradient-text">10× faster with AI</span>
            </h1>

            <p className="max-w-2xl mx-auto text-xl text-muted-foreground mb-10 leading-relaxed">
              Upload your questionnaire and reference documents. AskIt automatically finds relevant content,
              generates accurate answers, and cites every source, so your team ships faster with full confidence.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="gradient" size="xl" asChild>
                <Link to={user ? '/dashboard' : '/signup'}>
                  Start for free
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="xl" asChild>
                <a href="#how-it-works">
                  See how it works
                  <ChevronRight className="h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>

          {/* Hero visual / mock UI card */}
          <div className="mt-16 max-w-4xl mx-auto animate-fade-in">
              <div className="rounded-2xl border bg-[#F2F2F2] shadow-2xl shadow-black/10 overflow-hidden">
              {/* Mock browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-[#EAE4D5]">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-4 h-6 rounded-md bg-gray-200 flex items-center px-3">
                  <span className="text-xs text-[#B6B09F]">askit.app/dashboard</span>
                </div>
              </div>

              {/* Mock dashboard */}
              <div className="p-6 bg-[#EAE4D5]/40">
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {['12 Questions', '11 Answered', '1 Not found'].map((stat, i) => (
                    <div key={i} className="bg-white rounded-lg border p-4 text-center shadow-sm">
                      <div className={`text-2xl font-bold ${i === 0 ? 'text-black' : i === 1 ? 'text-green-600' : 'text-amber-500'}`}>
                        {stat.split(' ')[0]}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{stat.split(' ').slice(1).join(' ')}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {[
                    { q: 'Does the company maintain SOC 2 Type II certification?', status: 'answered' },
                    { q: 'What is the data retention policy for customer records?', status: 'answered' },
                    { q: 'Describe your incident response process and SLA timelines.', status: 'answered' },
                    { q: 'What third-party sub-processors does the company use?', status: 'not-found' },
                  ].map((item, i) => (
                    <div key={i} className="bg-white rounded-lg border p-4 shadow-sm flex items-start gap-3">
                      <div className={`mt-0.5 h-5 w-5 rounded-full flex-shrink-0 flex items-center justify-center ${item.status === 'answered' ? 'bg-green-100' : 'bg-amber-100'}`}>
                        {item.status === 'answered'
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          : <span className="text-amber-600 text-xs font-bold">?</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.q}</p>
                        {item.status === 'answered' && (
                          <p className="text-xs text-muted-foreground mt-1">Answer generated · Source: security-policy.pdf</p>
                        )}
                        {item.status === 'not-found' && (
                          <p className="text-xs text-amber-600 mt-1">Not found in references</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-[#EAE4D5]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Features</Badge>
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              Everything you need to automate questionnaires
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From document upload to cited export — AskIt handles the entire workflow so your team can focus on decisions, not data entry.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="bg-[#F2F2F2] rounded-xl border p-6 hover:shadow-md transition-shadow group"
              >
                <div className={`h-12 w-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">How it works</Badge>
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              From upload to export in minutes
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              A simple, repeatable workflow designed for teams that handle questionnaires at scale.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="relative group">
                <div className="bg-[#F2F2F2] rounded-xl border p-6 hover:border-[#B6B09F] hover:shadow-md transition-all h-full">
                  <div className="text-5xl font-black text-[#EAE4D5] group-hover:text-[#B6B09F]/40 transition-colors mb-3 leading-none">
                    {step.step}
                  </div>
                  <h3 className="font-semibold text-base mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                {i < steps.length - 1 && i % 3 !== 2 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                    <ArrowRight className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-24 bg-[#EAE4D5]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">Use cases</Badge>
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              Built for every type of questionnaire
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              From security reviews to RFP responses, AskIt adapts to your workflow.
            </p>
          </div>

          <div className="flex flex-nowrap justify-center gap-2">
            {useCases.map((uc, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-[#F2F2F2] border rounded-full px-6 py-3 shadow-sm hover:shadow-md hover:border-[#B6B09F] transition-all cursor-default shrink-0"
              >
                <uc.icon className="h-3.5 w-3.5 text-[#B6B09F] shrink-0" />
                <span className="text-xs font-medium">{uc.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-2xl bg-black p-12 shadow-2xl">
            <h2 className="text-4xl font-bold text-[#F2F2F2] mb-4">
              Ready to automate your questionnaires?
            </h2>
            <p className="text-[#B6B09F] text-lg mb-8 max-w-xl mx-auto">
              Join teams that use AskIt to answer structured questionnaires faster, with full citation traceability.
            </p>
            <Button
              size="xl"
              className="bg-[#EAE4D5] text-black hover:bg-[#B6B09F] shadow-lg font-semibold"
              asChild
            >
              <Link to={user ? '/dashboard' : '/signup'}>
                Get started for free
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-black flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-[#EAE4D5]" />
              </div>
              <span className="font-bold text-black">AskIt</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 AskIt · Built for the Almabase GTM Engineering Assignment
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
