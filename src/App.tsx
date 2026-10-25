import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, HashRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppProvider, useApp, useWorkspace } from '@/store/app-store'
import { RangeProvider } from '@/store/range'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TransactionDialogProvider } from '@/features/transactions/transaction-dialog'
import { AppShell } from '@/layout/app-shell'
import { PageSkeleton } from '@/components/page'
import { LoginPage, SignupPage, ForgotPage, ResetPasswordPage } from '@/pages/auth/auth-pages'
import { OnboardingPage } from '@/pages/auth/onboarding'
import LandingPage from '@/pages/landing'
import { useSeo } from '@/lib/seo'
import { hasStoredCloudSession } from '@/lib/supabase'

// Pages are code-split so the public landing page doesn't download chart code.
const OverviewPage = lazy(() => import('@/pages/overview'))
const TransactionsPage = lazy(() => import('@/pages/transactions'))
const IncomePage = lazy(() => import('@/pages/income'))
const ExpensesPage = lazy(() => import('@/pages/expenses'))
const InvoicesPage = lazy(() => import('@/pages/invoices'))
const InvoiceEditorPage = lazy(() => import('@/pages/invoice-editor'))
const InvoiceDetailPage = lazy(() => import('@/pages/invoice-detail'))
const BudgetsPage = lazy(() => import('@/pages/budgets'))
const ReportsPage = lazy(() => import('@/pages/reports'))
const SettingsPage = lazy(() => import('@/pages/settings'))

// 'memory' is for embedded/hosted demos where the page can't own the address bar.
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter

function Restoring() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Signing you in">
      <div className="flex items-center gap-3 text-[13.5px] text-muted">
        <span className="size-2 animate-ping rounded-full bg-sun-deep" /> Signing you in…
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useApp()
  const loc = useLocation()
  if (!ready) return <Restoring />
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <>{children}</>
}

/** "/" is the public landing page for visitors and the dashboard for signed-in users. */
function HomeOrApp() {
  const { user, ready } = useApp()
  const loc = useLocation()
  if (!user && !ready) return loc.pathname === '/' && !hasStoredCloudSession() ? <LandingPage /> : <Restoring />
  if (!user) return loc.pathname === '/' ? <LandingPage /> : <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <RequireWorkspace />
}

function Seo({ title, path, noindex, children }: { title: string; path: string; noindex?: boolean; children: ReactNode }) {
  useSeo({ title, path, noindex })
  return <>{children}</>
}

function RequireWorkspace() {
  const { ws, data } = useWorkspace()
  if (!ws || !data) return <Navigate to="/onboarding" replace />
  const earliest = data.transactions.reduce<string | undefined>((m, t) => (!m || t.date < m ? t.date : m), undefined)
  return (
    <RangeProvider earliest={earliest}>
      <TransactionDialogProvider>
        <AppShell />
      </TransactionDialogProvider>
    </RangeProvider>
  )
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useApp()
  if (!ready) return <Restoring />
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AppProvider>
      <TooltipProvider>
        <Router>
          <Suspense fallback={<div className="p-8"><PageSkeleton /></div>}>
            <Routes>
              <Route path="/login" element={<PublicOnly><Seo title="Sign in" path="/login" noindex><LoginPage /></Seo></PublicOnly>} />
              <Route path="/signup" element={<PublicOnly><Seo title="Create your free account" path="/signup"><SignupPage /></Seo></PublicOnly>} />
              <Route path="/forgot" element={<PublicOnly><Seo title="Reset password" path="/forgot" noindex><ForgotPage /></Seo></PublicOnly>} />
              <Route path="/reset-password" element={<Seo title="Choose a new password" path="/reset-password" noindex><ResetPasswordPage /></Seo>} />
              <Route path="/onboarding" element={<RequireAuth><Seo title="Set up your workspace" path="/onboarding" noindex><OnboardingPage /></Seo></RequireAuth>} />
              <Route element={<HomeOrApp />}>
                <Route index element={<OverviewPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="income" element={<IncomePage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="invoices" element={<InvoicesPage />} />
                <Route path="invoices/new" element={<InvoiceEditorPage />} />
                <Route path="invoices/:id" element={<InvoiceDetailPage />} />
                <Route path="invoices/:id/edit" element={<InvoiceEditorPage />} />
                <Route path="budgets" element={<BudgetsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="settings/:tab" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </Router>
        <Toaster
          position="bottom-right"
          offset={20}
          mobileOffset={{ bottom: 96 }}
          toastOptions={{
            classNames: {
              toast: '!rounded-[20px] !bg-ink !text-white !border-0 !shadow-[var(--shadow-ink)] !font-sans',
              description: '!text-white/65',
              actionButton: '!bg-sun !text-ink !rounded-full !font-medium',
              success: '[&_[data-icon]]:!text-sun',
              error: '[&_[data-icon]]:!text-[#ff9a8a]',
            },
          }}
        />
      </TooltipProvider>
    </AppProvider>
  )
}
