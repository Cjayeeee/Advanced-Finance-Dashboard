import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import * as D from '@radix-ui/react-dialog'
import {
  Bell,
  Check,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  CircleHelp,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  UserRound,
  X,
} from 'lucide-react'
import { useApp, useActiveWorkspace } from '@/store/app-store'
import { NAV, RANGE_PAGES, titleFor } from './nav'
import { Logo, LogoMark } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tip } from '@/components/ui/tooltip'
import { DateRangePicker } from '@/components/date-range-picker'
import { PageSkeleton } from '@/components/page'
import { useTransactionDialog } from '@/features/transactions/transaction-dialog'
import { useNotifications } from '@/hooks/use-notifications'
import { useMedia } from '@/hooks/use-media'
import { CommandPalette } from './command-palette'
import { HelpDialog } from './help-dialog'
import { cn } from '@/lib/utils'
import { useSeo } from '@/lib/seo'

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/* ───────────────────────── Sidebar ───────────────────────── */

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { ws } = useActiveWorkspace()
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map((item) => {
        const label = item.to === '/income' && ws.type === 'startup' ? 'Revenue' : item.label
        const link = (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group relative flex h-11 items-center gap-3 rounded-full px-3.5 text-[14px] font-medium transition-all duration-200 ease-[var(--ease-out)]',
                collapsed && 'justify-center px-0',
                isActive ? 'bg-ink text-white shadow-[0_8px_20px_-10px_rgb(22_22_21/0.7)]' : 'text-ink-3 hover:bg-white/70 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('size-[18px] shrink-0 transition-colors', isActive ? 'text-sun' : 'text-muted group-hover:text-ink')} strokeWidth={1.9} />
                {!collapsed && <span className="truncate">{label}</span>}
              </>
            )}
          </NavLink>
        )
        return collapsed ? (
          <Tip key={item.to} content={label} side="right">
            {link}
          </Tip>
        ) : (
          link
        )
      })}
    </nav>
  )
}

function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { state, switchWorkspace } = useApp()
  const { ws } = useActiveWorkspace()
  const navigate = useNavigate()
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          className={cn('flex w-full items-center gap-2.5 rounded-[18px] bg-white/60 p-2 text-left ring-1 ring-line transition hover:bg-white', collapsed && 'justify-center p-1.5')}
          aria-label={`Workspace: ${ws.name}. Switch workspace`}
        >
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl text-[12px] font-semibold', ws.type === 'startup' ? 'bg-sun text-ink' : 'bg-ink text-white')}>{initials(ws.name)}</span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{ws.name}</span>
                <span className="block text-[11.5px] capitalize text-muted">
                  {ws.type} · {ws.currency}
                </span>
              </span>
              <ChevronsUpDown className="size-4 text-muted" />
            </>
          )}
        </button>
      </DropdownTrigger>
      <DropdownContent side="top" align="start" className="w-64">
        <DropdownLabel>Workspaces</DropdownLabel>
        {state!.workspaces.map((w) => (
          <DropdownItem key={w.id} onSelect={() => switchWorkspace(w.id)}>
            <span className={cn('grid size-6 place-items-center rounded-lg text-[10px] font-semibold', w.type === 'startup' ? 'bg-sun text-ink' : 'bg-ink text-white')}>{initials(w.name)}</span>
            <span className="min-w-0 flex-1 truncate">{w.name}</span>
            {w.isSample && <span className="text-[10.5px] text-subtle">sample</span>}
            {w.id === ws.id && <Check className="!text-ink" />}
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownItem onSelect={() => navigate('/onboarding?new=1')}>
          <Plus /> New workspace
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  )
}

function UserMenu({ collapsed, onHelp }: { collapsed: boolean; onHelp: () => void }) {
  const { user, logout } = useApp()
  const navigate = useNavigate()
  if (!user) return null
  return (
    <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
      <Dropdown>
        <DropdownTrigger asChild>
          <button className={cn('flex min-w-0 flex-1 items-center gap-2.5 rounded-full p-1 pr-2 text-left transition hover:bg-white/70', collapsed && 'flex-none pr-1')} aria-label="Account menu">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sun-soft text-[12px] font-semibold text-ink ring-2 ring-white">{initials(user.name)}</span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{user.name}</span>
                <span className="block truncate text-[11.5px] text-muted">{user.email}</span>
              </span>
            )}
          </button>
        </DropdownTrigger>
        <DropdownContent side="top" align="start" className="w-56">
          <DropdownItem onSelect={() => navigate('/settings/profile')}>
            <UserRound /> Profile
          </DropdownItem>
          <DropdownItem onSelect={() => navigate('/settings')}>
            <Settings /> Settings
          </DropdownItem>
          <DropdownItem onSelect={onHelp}>
            <CircleHelp /> Help & support
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem
            onSelect={() => {
              logout()
              navigate('/login')
            }}
          >
            <LogOut /> Sign out
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
      {!collapsed && (
        <Tip content="Help & support">
          <Button variant="ghost" size="icon-sm" onClick={onHelp} aria-label="Help & support">
            <CircleHelp />
          </Button>
        </Tip>
      )}
    </div>
  )
}

function Sidebar({ collapsed, onToggle, onHelp }: { collapsed: boolean; onToggle: () => void; onHelp: () => void }) {
  return (
    <aside
      className={cn(
        'sticky top-3 z-30 m-3 mr-0 hidden h-[calc(100dvh-24px)] shrink-0 flex-col rounded-[30px] bg-white/45 p-3 ring-1 ring-white/70 backdrop-blur-xl transition-[width] duration-300 ease-[var(--ease-out)] md:flex',
        collapsed ? 'w-[76px]' : 'w-[248px]',
      )}
    >
      <div className={cn('flex items-center justify-between px-1.5 pt-1 pb-5', collapsed && 'flex-col gap-3 px-0')}>
        <Link to="/" aria-label="Monetra home" className="rounded-xl">
          <Logo collapsed={collapsed} />
        </Link>
        <Tip content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="right">
          <button onClick={onToggle} className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-white hover:text-ink" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        </Tip>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className="flex flex-col gap-2 pt-3">
        <WorkspaceSwitcher collapsed={collapsed} />
        <UserMenu collapsed={collapsed} onHelp={onHelp} />
      </div>
    </aside>
  )
}

/* ───────────────────────── Mobile ───────────────────────── */

function MobileDrawer({ open, onOpenChange, onHelp }: { open: boolean; onOpenChange: (v: boolean) => void; onHelp: () => void }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-ink/25 backdrop-blur-[2px] data-[state=open]:animate-fade md:hidden" />
        <D.Content className="fixed inset-y-0 left-0 z-[70] flex w-[min(300px,86vw)] flex-col bg-paper p-4 shadow-[var(--shadow-pop)] outline-none data-[state=open]:animate-[drawer-l_0.3s_var(--ease-out)] md:hidden">
          <style>{`@keyframes drawer-l{from{transform:translateX(-100%)}to{transform:none}}`}</style>
          <D.Title className="sr-only">Navigation</D.Title>
          <D.Description className="sr-only">Main navigation and account</D.Description>
          <div className="flex items-center justify-between pb-5">
            <Logo />
            <D.Close className="grid size-9 place-items-center rounded-full hover:bg-ink/5" aria-label="Close menu">
              <X className="size-[18px]" />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav collapsed={false} onNavigate={() => onOpenChange(false)} />
          </div>
          <div className="flex flex-col gap-2 pt-3">
            <WorkspaceSwitcher collapsed={false} />
            <UserMenu collapsed={false} onHelp={onHelp} />
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const tx = useTransactionDialog()
  const items = [NAV[0], NAV[1], null, NAV[4]] as const
  return (
    <nav aria-label="Quick" className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 flex h-16 items-center justify-around rounded-full bg-ink px-2 text-white shadow-[var(--shadow-ink)] md:hidden">
      {items.map((item, i) =>
        item ? (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => cn('flex size-12 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] transition', isActive ? 'text-sun' : 'text-white/60')}>
            <item.icon className="size-5" strokeWidth={1.8} />
            <span>{item.label === 'Transactions' ? 'Activity' : item.label}</span>
          </NavLink>
        ) : (
          <button key={i} onClick={() => tx.open()} className="grid size-12 place-items-center rounded-full bg-sun text-ink shadow-[0_6px_20px_-6px_rgb(245_203_60/0.9)] transition active:scale-95" aria-label="Add transaction">
            <Plus className="size-6" strokeWidth={2.2} />
          </button>
        ),
      )}
      <button onClick={onMore} className="flex size-12 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] text-white/60" aria-label="More navigation">
        <MoreHorizontal className="size-5" />
        <span>More</span>
      </button>
    </nav>
  )
}

/* ───────────────────────── Top bar ───────────────────────── */

function NotificationCenter() {
  const { items, unread, read } = useNotifications()
  const { markNotificationsRead } = useApp()
  const navigate = useNavigate()
  const dot = { overdue: 'bg-loss', 'due-soon': 'bg-sun', budget: 'bg-sun-deep', recurring: 'bg-ink' } as const
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative grid size-10 place-items-center rounded-full bg-white/80 ring-1 ring-line transition hover:bg-white" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell className="size-[18px]" strokeWidth={1.8} />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-sun px-1 text-[10px] font-semibold text-ink ring-2 ring-canvas num">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(380px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <p className="font-display text-[17px]">Notifications</p>
          {unread > 0 && (
            <button className="text-[12.5px] text-muted hover:text-ink" onClick={() => markNotificationsRead(items.map((n) => n.id))}>
              Mark all read
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 pb-6 pt-4 text-center text-[13px] text-muted">You're all caught up. Overdue invoices, budget alerts and recurring reminders will appear here.</p>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto px-2 pb-2 scrollbar-thin">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => {
                    markNotificationsRead([n.id])
                    navigate(n.to)
                  }}
                  className="flex w-full items-start gap-3 rounded-2xl p-2.5 text-left transition hover:bg-ink/[0.04]"
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', dot[n.kind], read.has(n.id) && 'opacity-25')} />
                  <span className="min-w-0">
                    <span className={cn('block text-[13.5px]', read.has(n.id) ? 'text-muted' : 'font-medium')}>{n.title}</span>
                    <span className="block text-[12px] text-muted">{n.detail}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line px-4 py-2.5 text-[11.5px] text-subtle">These alerts appear here in the app only. Email and push notifications aren't available yet.</p>
      </PopoverContent>
    </Popover>
  )
}

function TopBar({ onSearch, onMenu }: { onSearch: () => void; onMenu: () => void }) {
  const { pathname } = useLocation()
  const { ws } = useActiveWorkspace()
  const tx = useTransactionDialog()
  const { title, crumb } = titleFor(pathname, ws.type === 'startup')
  const showRange = RANGE_PAGES.includes(pathname)
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-2 flex items-center gap-2 bg-gradient-to-b from-canvas via-canvas/85 to-transparent px-4 pt-3 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <button onClick={onMenu} className="grid size-10 place-items-center rounded-full bg-white/80 ring-1 ring-line md:hidden" aria-label="Open menu">
        <Menu className="size-[18px]" />
      </button>
      <Link to="/" className="md:hidden" aria-label="Monetra home">
        <LogoMark className="size-9" />
      </Link>
      <div className="hidden min-w-0 md:block">
        {crumb ? (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-muted">
            <Link to={`/${crumb.toLowerCase()}`} className="hover:text-ink">
              {crumb}
            </Link>
            <span aria-hidden>/</span>
            <span className="truncate font-medium text-ink" aria-current="page">
              {title}
            </span>
          </nav>
        ) : (
          <p className="text-[13px] font-medium text-ink-3">{title}</p>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onSearch}
          className="flex h-10 items-center gap-2 rounded-full bg-white/80 px-3 text-[13px] text-muted ring-1 ring-line transition hover:bg-white sm:w-56 lg:w-72"
          aria-label="Search"
        >
          <Search className="size-4" />
          <span className="hidden sm:inline">Search records…</span>
          <kbd className="ml-auto hidden rounded-md bg-ink/[0.06] px-1.5 py-0.5 font-sans text-[11px] text-muted sm:inline">{mac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        {showRange && <DateRangePicker compact className="max-sm:hidden" />}
        <NotificationCenter />
        <Button onClick={() => tx.open()} className="hidden h-10 md:inline-flex" aria-label="Add transaction">
          <Plus /> <span className="hidden lg:inline">Add transaction</span>
        </Button>
      </div>
    </header>
  )
}

/* ───────────────────────── Shell ───────────────────────── */

export function AppShell() {
  const { state, setSidebarCollapsed } = useApp()
  const { pathname } = useLocation()
  const tablet = useMedia('(min-width: 768px) and (max-width: 1100px)')
  const [menu, setMenu] = useState(false)
  const [search, setSearch] = useState(false)
  const [help, setHelp] = useState(false)
  const tx = useTransactionDialog()
  const collapsed = tablet || state!.sidebarCollapsed
  const { ws } = useActiveWorkspace()
  // Private app pages: descriptive tab titles, never indexed.
  useSeo({ title: titleFor(pathname, ws.type === 'startup').title, noindex: true })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = /input|textarea|select/i.test(target.tagName) || target.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearch(true)
      } else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n' && !document.querySelector('[role=dialog]')) {
        e.preventDefault()
        tx.open()
      } else if (!typing && e.key === '?' && !document.querySelector('[role=dialog]')) {
        setHelp(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tx])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={() => setSidebarCollapsed(!state!.sidebarCollapsed)} onHelp={() => setHelp(true)} />
      <div className="min-w-0 flex-1 px-4 pb-28 sm:px-6 md:pb-10 lg:px-8">
        <TopBar onSearch={() => setSearch(true)} onMenu={() => setMenu(true)} />
        <main id="main" tabIndex={-1} className="mx-auto max-w-[1480px] outline-none">
          <Suspense fallback={<PageSkeleton />}>
            <div key={pathname.split('/').slice(0, 2).join('/')} className="animate-rise">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
      <BottomNav onMore={() => setMenu(true)} />
      <MobileDrawer open={menu} onOpenChange={setMenu} onHelp={() => setHelp(true)} />
      <CommandPalette open={search} onOpenChange={setSearch} />
      <HelpDialog open={help} onOpenChange={setHelp} />
    </div>
  )
}
