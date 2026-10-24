/**
 * Deterministic sample workspaces, generated relative to "today" so the demo
 * always shows a recent, believable 14-month history.
 */
import type { Account, Budget, Client, Invoice, InvoiceLine, Project, Transaction, Workspace, WorkspaceData, WorkspaceType } from './types'
import { defaultCategories, newWorkspace } from './defaults'
import { addDays, addMonths, endOfMonth, parseISO, startOfMonth, todayISO } from '@/lib/dates'
import { mulberry32 } from '@/lib/id'
import { invoiceAmounts } from '@/lib/finance'

const M = (major: number) => Math.round(major * 100)

interface Ctx {
  today: string
  rnd: () => number
  txs: Transaction[]
  invoices: Invoice[]
  n: number
}

function between(rnd: () => number, a: number, b: number) {
  return Math.round(a + rnd() * (b - a))
}

function day(monthStart: string, d: number) {
  const last = Number(endOfMonth(monthStart).slice(8))
  return monthStart.slice(0, 8) + String(Math.min(d, last)).padStart(2, '0')
}

function tx(ctx: Ctx, t: Omit<Transaction, 'id' | 'createdAt' | 'tags'> & { tags?: string[] }) {
  if (t.date > ctx.today) return null
  const full: Transaction = { tags: [], ...t, id: `tx_s${(ctx.n++).toString(36)}`, createdAt: t.date + 'T09:00:00.000Z' }
  ctx.txs.push(full)
  return full
}

function invoice(
  ctx: Ctx,
  inv: Omit<Invoice, 'id' | 'createdAt' | 'number' | 'state'> & { state?: Invoice['state'] },
  prefix: string,
): Invoice | null {
  if (inv.issueDate > ctx.today) return null
  const seq = ctx.invoices.length + 1
  const full: Invoice = {
    state: 'issued',
    issuedAt: inv.issueDate,
    ...inv,
    id: `inv_s${seq}`,
    number: `${prefix}${inv.issueDate.slice(0, 4)}-${String(seq).padStart(3, '0')}`,
    createdAt: inv.issueDate + 'T08:00:00.000Z',
  }
  ctx.invoices.push(full)
  return full
}

function line(description: string, quantity: number, rateMajor: number, id: string): InvoiceLine {
  return { id, description, quantity, rate: M(rateMajor) }
}

/* ────────────────────────────── Freelancer ─────────────────────────────── */

function freelancer(today: string): { workspace: Workspace; data: WorkspaceData } {
  const workspace = newWorkspace({ name: 'Mehta Design Studio', type: 'freelancer', currency: 'INR', revenueTarget: M(200000), isSample: true })
  const ctx: Ctx = { today, rnd: mulberry32(42), txs: [], invoices: [], n: 0 }
  const { rnd } = ctx
  const accounts: Account[] = [
    { id: 'acc_bank', name: 'HDFC Current', kind: 'bank', openingBalance: M(185000) },
    { id: 'acc_card', name: 'ICICI Business Card', kind: 'card', openingBalance: 0 },
    { id: 'acc_upi', name: 'Cash & UPI', kind: 'wallet', openingBalance: M(6500) },
    { id: 'acc_save', name: 'Tax reserve (savings)', kind: 'bank', openingBalance: M(40000) },
  ]
  const clients: Client[] = [
    { id: 'cl_lumen', name: 'Lumen Labs', email: 'accounts@lumenlabs.in', address: '4th Floor, Indiranagar, Bengaluru 560038', taxId: '29AAKCL4821M1Z5' },
    { id: 'cl_northwind', name: 'Northwind Retail', email: 'ap@northwindretail.com', address: 'Lower Parel, Mumbai 400013', taxId: '27AACCN9912Q1ZK' },
    { id: 'cl_kestrel', name: 'Kestrel Studio', email: 'hello@kestrel.studio', address: 'Shoreditch, London E1 6JE, UK' },
    { id: 'cl_orbit', name: 'Orbit Health', email: 'finance@orbithealth.in', address: 'HSR Layout, Bengaluru 560102', taxId: '29AADCO7710H1ZW' },
    { id: 'cl_saffron', name: 'Saffron & Co.', email: 'team@saffronco.in', address: 'Koregaon Park, Pune 411001' },
  ]
  const projects: Project[] = [
    { id: 'pr_lumen_ds', name: 'Design system retainer', clientId: 'cl_lumen' },
    { id: 'pr_nw_app', name: 'Loyalty app redesign', clientId: 'cl_northwind' },
    { id: 'pr_nw_web', name: 'E-commerce storefront', clientId: 'cl_northwind' },
    { id: 'pr_kes_brand', name: 'Brand illustrations', clientId: 'cl_kestrel' },
    { id: 'pr_orbit_portal', name: 'Patient portal UX', clientId: 'cl_orbit' },
    { id: 'pr_saffron_pkg', name: 'Packaging refresh', clientId: 'cl_saffron' },
  ]

  const P = workspace.invoicePrefix
  for (let i = 13; i >= 0; i--) {
    const ms = addMonths(startOfMonth(today), -i)
    const monthName = parseISO(ms).toLocaleString('en-GB', { month: 'long' })
    let cardSpend = 0
    const card = (t: Transaction | null) => {
      if (t && t.accountId === 'acc_card') cardSpend += t.amount
    }

    // ── Software (card, recurring)
    card(tx(ctx, { type: 'expense', amount: M(1400), date: day(ms, 1), description: 'Google Workspace', categoryId: 'cat_software', accountId: 'acc_card', recurring: { frequency: 'monthly' }, tags: ['tools'] }))
    card(tx(ctx, { type: 'expense', amount: M(1250), date: day(ms, 3), description: 'Figma Professional', categoryId: 'cat_software', accountId: 'acc_card', recurring: { frequency: 'monthly' }, tags: ['tools'] }))
    card(tx(ctx, { type: 'expense', amount: M(4230), date: day(ms, 7), description: 'Adobe Creative Cloud', categoryId: 'cat_software', accountId: 'acc_card', recurring: { frequency: 'monthly' }, tags: ['tools'] }))
    card(tx(ctx, { type: 'expense', amount: M(800), date: day(ms, 10), description: 'Notion Plus', categoryId: 'cat_software', accountId: 'acc_card', recurring: { frequency: 'monthly' } }))
    if (i <= 8) card(tx(ctx, { type: 'expense', amount: M(1700), date: day(ms, 15), description: 'Framer Pro', categoryId: 'cat_software', accountId: 'acc_card', recurring: { frequency: 'monthly' } }))
    if (i <= 2) card(tx(ctx, { type: 'expense', amount: M(1950), date: day(ms, 12), description: 'ChatGPT Plus', categoryId: 'cat_software', accountId: 'acc_card', recurring: { frequency: 'monthly' } }))
    if (i === 0) card(tx(ctx, { type: 'expense', amount: M(2600), date: day(ms, 9), description: 'Spline Pro', categoryId: 'cat_software', accountId: 'acc_card' }))

    // ── Workspace
    tx(ctx, { type: 'expense', amount: M(9500), date: day(ms, 5), description: 'WeWork hot desk', categoryId: 'cat_workspace', accountId: 'acc_bank', recurring: { frequency: 'monthly' } })
    tx(ctx, { type: 'expense', amount: M(1180), date: day(ms, 18), description: 'Airtel Xstream fibre', categoryId: 'cat_workspace', accountId: 'acc_bank', recurring: { frequency: 'monthly' } })
    tx(ctx, { type: 'expense', amount: M(between(rnd, 1300, 2300)), date: day(ms, 22), description: 'BESCOM electricity', categoryId: 'cat_workspace', accountId: 'acc_upi' })

    // ── Contractors
    if (rnd() < 0.6 || i === 1) tx(ctx, { type: 'expense', amount: M(between(rnd, 32, 58) * 1000), date: day(ms, 20), description: 'Frontend dev — Rohan K.', categoryId: 'cat_people', accountId: 'acc_bank', projectId: rnd() < 0.5 ? 'pr_nw_app' : 'pr_orbit_portal', tags: ['contractor'] })
    if (rnd() < 0.3) tx(ctx, { type: 'expense', amount: M(12000), date: day(ms, 14), description: 'Copywriting — Ira S.', categoryId: 'cat_people', accountId: 'acc_bank', tags: ['contractor'] })

    // ── Marketing
    if (rnd() < 0.55) card(tx(ctx, { type: 'expense', amount: M(between(rnd, 4, 9) * 1000), date: day(ms, 11), description: 'LinkedIn sponsored post', categoryId: 'cat_marketing', accountId: 'acc_card', tags: ['ads'] }))
    if (i === 10) card(tx(ctx, { type: 'expense', amount: M(8200), date: day(ms, 4), description: 'Dribbble Pro (annual)', categoryId: 'cat_marketing', accountId: 'acc_card', recurring: { frequency: 'yearly' } }))

    // ── Travel
    if (i % 3 === 1) card(tx(ctx, { type: 'expense', amount: M(between(rnd, 6, 14) * 1000), date: day(ms, 16), description: 'IndiGo — BLR ⇄ BOM client visit', categoryId: 'cat_travel', accountId: 'acc_card', clientId: 'cl_northwind' }))
    for (let k = 0; k < between(rnd, 1, 4); k++) tx(ctx, { type: 'expense', amount: M(between(rnd, 280, 1400)), date: day(ms, between(rnd, 2, 27)), description: 'Uber', categoryId: 'cat_travel', accountId: 'acc_upi' })

    // ── Professional
    if (i % 3 === 0) tx(ctx, { type: 'expense', amount: M(6000), date: day(ms, 25), description: 'CA fees — quarterly GST filing', categoryId: 'cat_professional', accountId: 'acc_bank', recurring: { frequency: 'quarterly' } })
    if (i === 9) tx(ctx, { type: 'expense', amount: M(3500), date: day(ms, 8), description: 'Contract review — legal', categoryId: 'cat_professional', accountId: 'acc_bank' })

    // ── Equipment
    if (i === 9) card(tx(ctx, { type: 'expense', amount: M(189900), date: day(ms, 13), description: 'MacBook Pro 14" M4', categoryId: 'cat_equipment', accountId: 'acc_card', tags: ['asset'] }))
    if (i === 5) {
      card(tx(ctx, { type: 'expense', amount: M(7499), date: day(ms, 6), description: 'Keychron K8 keyboard', categoryId: 'cat_equipment', accountId: 'acc_card' }))
      card(tx(ctx, { type: 'expense', amount: M(7499), date: day(ms, 17), description: 'Keychron K8 keyboard — returned', categoryId: 'cat_equipment', accountId: 'acc_card', refund: true, notes: 'Refund for defective unit' }))
      cardSpend -= M(7499) * 2
    }
    if (i === 3) card(tx(ctx, { type: 'expense', amount: M(31999), date: day(ms, 19), description: 'Dell UltraSharp 27" monitor', categoryId: 'cat_equipment', accountId: 'acc_card' }))

    // ── Other
    tx(ctx, { type: 'expense', amount: M(236), date: day(ms, 28), description: 'Bank charges', categoryId: 'cat_other_exp', accountId: 'acc_bank' })

    // ── Card bill: transfer bank → card next month (not an expense!)
    const billDate = day(addMonths(ms, 1), 2)
    if (cardSpend > 0) tx(ctx, { type: 'transfer', amount: cardSpend, date: billDate, description: 'Credit card bill payment', accountId: 'acc_bank', toAccountId: 'acc_card' })

    // ── Tax reserve sweep (transfer)
    if (i % 2 === 0) tx(ctx, { type: 'transfer', amount: M(15000), date: day(ms, 27), description: 'Move to tax reserve', accountId: 'acc_bank', toAccountId: 'acc_save' })

    // ── Income: invoices + payments
    const pay = (inv: Invoice | null, afterDays: number, fraction = 1, account = 'acc_bank') => {
      if (!inv) return
      const total = invoiceAmounts(inv).total
      tx(ctx, {
        type: 'income',
        amount: Math.round(total * fraction),
        date: addDays(inv.issueDate, afterDays),
        description: `Payment — ${inv.number}`,
        categoryId: inv.projectId === 'pr_lumen_ds' ? 'cat_retainer' : 'cat_client',
        accountId: account,
        clientId: inv.clientId,
        projectId: inv.projectId,
        invoiceId: inv.id,
      })
    }

    // Lumen retainer every month
    const lumen = invoice(ctx, {
      clientId: 'cl_lumen',
      projectId: 'pr_lumen_ds',
      issueDate: day(ms, 1),
      dueDate: day(ms, 16),
      lines: [line(`Design system retainer — ${monthName}`, 1, i <= 6 ? 85000 : 75000, 'l1')],
      discount: { type: 'percent', value: 0 },
      taxRate: 18,
      taxLabel: 'GST',
      terms: workspace.defaultTerms,
    }, P)
    if (i === 0) pay(lumen, 12, 0.5)
    else pay(lumen, between(rnd, 8, 16))

    // Northwind project milestones every other month
    if (i % 2 === 1 || i === 2) {
      const nw = invoice(ctx, {
        clientId: 'cl_northwind',
        projectId: i > 6 ? 'pr_nw_web' : 'pr_nw_app',
        issueDate: day(ms, 6),
        dueDate: addDays(day(ms, 6), 30),
        lines: [line(i > 6 ? 'Storefront UX — milestone' : 'Loyalty app — design sprint', 1, between(rnd, 9, 16) * 10000, 'l1'), line('Usability testing sessions', between(rnd, 3, 6), 6500, 'l2')],
        discount: { type: 'percent', value: i === 3 ? 5 : 0 },
        taxRate: 18,
        taxLabel: 'GST',
        terms: 'Net 30',
      }, P)
      if (i === 1 || i === 2) {
        /* unpaid → overdue / outstanding */
      } else pay(nw, between(rnd, 26, 40))
    }

    // Kestrel (UK, zero-rated export) hourly work
    if (i % 2 === 0 && i <= 10) {
      const hours = between(rnd, 14, 30)
      const k = invoice(ctx, {
        clientId: 'cl_kestrel',
        projectId: 'pr_kes_brand',
        issueDate: day(ms, i === 0 ? 2 : 10),
        dueDate: addDays(day(ms, i === 0 ? 2 : 10), 21),
        lines: [line('Illustration — hourly', hours, 2800, 'l1')],
        discount: { type: 'fixed', value: 0 },
        taxRate: 0,
        taxLabel: 'Export of services (LUT)',
        terms: 'Payable within 21 days via Wise.',
      }, P)
      pay(k, i === 0 ? 17 : between(rnd, 12, 22))
    }

    // Orbit Health from 7 months ago
    if (i <= 7 && i % 2 === 0) {
      const o = invoice(ctx, {
        clientId: 'cl_orbit',
        projectId: 'pr_orbit_portal',
        issueDate: day(ms, 3),
        dueDate: day(ms, 18),
        lines: [line('Patient portal — discovery & IA', 1, 65000, 'l1'), line('High-fidelity screens', between(rnd, 8, 14), 4500, 'l2')],
        discount: { type: 'percent', value: 0 },
        taxRate: 18,
        taxLabel: 'GST',
        terms: workspace.defaultTerms,
      }, P)
      pay(o, between(rnd, 10, 14))
    }

    // Saffron small sporadic
    if (i === 11 || i === 6 || i === 4) {
      const s = invoice(ctx, {
        clientId: 'cl_saffron',
        projectId: 'pr_saffron_pkg',
        issueDate: day(ms, 9),
        dueDate: day(ms, 24),
        lines: [line('Packaging label design (SKU)', between(rnd, 3, 6), 7500, 'l1')],
        discount: { type: 'percent', value: 10 },
        taxRate: 18,
        taxLabel: 'GST',
        terms: workspace.defaultTerms,
      }, P)
      pay(s, between(rnd, 9, 20), 1, 'acc_upi')
    }

    // Non-invoiced income
    tx(ctx, { type: 'income', amount: M(between(rnd, 18, 62) * 100), date: day(ms, 26), description: 'Gumroad — UI kit sales', categoryId: 'cat_products', accountId: 'acc_upi', tags: ['passive'] })
    if (i === 8 || i === 4) tx(ctx, { type: 'income', amount: M(25000), date: day(ms, 21), description: 'Design workshop — Srishti', categoryId: 'cat_other_inc', accountId: 'acc_bank' })
    if (i % 3 === 0) tx(ctx, { type: 'income', amount: M(between(rnd, 600, 900)), date: day(ms, 30), description: 'Savings interest', categoryId: 'cat_other_inc', accountId: 'acc_save' })
  }

  // A draft invoice for the coming milestone
  ctx.invoices.push({
    id: 'inv_draft1',
    number: `${P}${today.slice(0, 4)}-${String(ctx.invoices.length + 1).padStart(3, '0')}`,
    clientId: 'cl_orbit',
    projectId: 'pr_orbit_portal',
    issueDate: today,
    dueDate: addDays(today, 15),
    lines: [line('Patient portal — usability round 2', 1, 48000, 'l1'), line('Prototype iterations', 6, 4500, 'l2')],
    discount: { type: 'percent', value: 0 },
    taxRate: 18,
    taxLabel: 'GST',
    terms: workspace.defaultTerms,
    notes: 'Thanks for the continued partnership!',
    state: 'draft',
    createdAt: new Date().toISOString(),
  })

  const budgets: Budget[] = [
    { id: 'bud_all', categoryId: null, amount: M(90000), period: 'monthly', alertAt: 80 },
    { id: 'bud_soft', categoryId: 'cat_software', amount: M(11000), period: 'monthly', alertAt: 85 },
    { id: 'bud_mkt', categoryId: 'cat_marketing', amount: M(8000), period: 'monthly', alertAt: 80 },
    { id: 'bud_trv', categoryId: 'cat_travel', amount: M(6000), period: 'monthly', alertAt: 80 },
    { id: 'bud_ppl', categoryId: 'cat_people', amount: M(50000), period: 'monthly', alertAt: 90 },
  ]

  workspace.onboarding.done = { sample: true }
  return {
    workspace,
    data: { categories: defaultCategories('freelancer'), accounts, clients, projects, transactions: ctx.txs, invoices: ctx.invoices, budgets },
  }
}

/* ────────────────────────────── Startup ────────────────────────────────── */

function startup(today: string): { workspace: Workspace; data: WorkspaceData } {
  const workspace = newWorkspace({ name: 'Tideline Labs', type: 'startup', currency: 'INR', revenueTarget: M(500000), isSample: true })
  workspace.defaultTerms = 'Net 30. Please reference the invoice number with your transfer.'
  const ctx: Ctx = { today, rnd: mulberry32(7), txs: [], invoices: [], n: 0 }
  const { rnd } = ctx
  const accounts: Account[] = [
    { id: 'acc_axis', name: 'Axis Current', kind: 'bank', openingBalance: M(26000000) },
    { id: 'acc_card', name: 'Amex Corporate', kind: 'card', openingBalance: 0 },
    { id: 'acc_rzp', name: 'Razorpay balance', kind: 'wallet', openingBalance: M(120000) },
  ]
  const clients: Client[] = [
    { id: 'cu_bright', name: 'Brightwave Logistics', email: 'finance@brightwave.in', address: 'Gurugram 122002', taxId: '06AAICB2231K1Z9' },
    { id: 'cu_meridian', name: 'Meridian Foods', email: 'ap@meridianfoods.com', address: 'Andheri East, Mumbai 400069' },
    { id: 'cu_halcyon', name: 'Halcyon Health', email: 'payables@halcyon.health', address: 'Hyderabad 500081' },
  ]
  const projects: Project[] = [
    { id: 'pr_bright_onb', name: 'Enterprise onboarding', clientId: 'cu_bright' },
    { id: 'pr_meridian_int', name: 'ERP integration', clientId: 'cu_meridian' },
    { id: 'pr_halcyon_pilot', name: 'Pilot deployment', clientId: 'cu_halcyon' },
  ]

  for (let i = 13; i >= 0; i--) {
    const ms = addMonths(startOfMonth(today), -i)
    const g = 13 - i // growth index 0..13
    let cardSpend = 0
    const card = (t: Transaction | null) => {
      if (t && t.accountId === 'acc_card') cardSpend += t.amount
    }

    // Revenue: subscription payouts weekly-ish via Razorpay
    const mrr = 150000 + g * 21000 + between(rnd, -8000, 8000)
    for (const [d, f] of [
      [5, 0.42],
      [15, 0.33],
      [25, 0.25],
    ] as const)
      tx(ctx, { type: 'income', amount: M(Math.round(mrr * f)), date: day(ms, d), description: 'Razorpay settlement — subscriptions', categoryId: 'cat_subscriptions', accountId: 'acc_rzp', tags: ['mrr'] })
    // Sweep Razorpay → bank (transfer)
    tx(ctx, { type: 'transfer', amount: M(Math.round(mrr * 0.9)), date: day(ms, 27), description: 'Razorpay payout to Axis', accountId: 'acc_rzp', toAccountId: 'acc_axis' })

    // Payroll
    const headcount = g < 4 ? 6 : g < 9 ? 7 : 8
    tx(ctx, { type: 'expense', amount: M(headcount * 105000 + between(rnd, 0, 20000)), date: day(ms, 30), description: `Payroll — ${headcount} people`, categoryId: 'cat_people', accountId: 'acc_axis', recurring: { frequency: 'monthly' }, tags: ['payroll'] })
    tx(ctx, { type: 'expense', amount: M(between(rnd, 60, 90) * 1000), date: day(ms, 20), description: 'Contract QA — Testlio', categoryId: 'cat_people', accountId: 'acc_axis' })

    // Infra
    card(tx(ctx, { type: 'expense', amount: M(52000 + g * 3200 + between(rnd, 0, 6000)), date: day(ms, 3), description: 'AWS', categoryId: 'cat_infra', accountId: 'acc_card', recurring: { frequency: 'monthly' } }))
    card(tx(ctx, { type: 'expense', amount: M(8900), date: day(ms, 4), description: 'Vercel Pro', categoryId: 'cat_infra', accountId: 'acc_card', recurring: { frequency: 'monthly' } }))
    // Software
    card(tx(ctx, { type: 'expense', amount: M(headcount * 2600), date: day(ms, 2), description: 'Google Workspace', categoryId: 'cat_software', accountId: 'acc_card', recurring: { frequency: 'monthly' } }))
    card(tx(ctx, { type: 'expense', amount: M(14200), date: day(ms, 6), description: 'Linear + Slack', categoryId: 'cat_software', accountId: 'acc_card', recurring: { frequency: 'monthly' } }))
    card(tx(ctx, { type: 'expense', amount: M(9800), date: day(ms, 9), description: 'HubSpot Starter', categoryId: 'cat_software', accountId: 'acc_card', recurring: { frequency: 'monthly' } }))
    // Marketing
    card(tx(ctx, { type: 'expense', amount: M(between(rnd, 70, 140) * 1000), date: day(ms, 12), description: 'Google Ads', categoryId: 'cat_marketing', accountId: 'acc_card', tags: ['ads'] }))
    if (rnd() < 0.4) tx(ctx, { type: 'expense', amount: M(between(rnd, 40, 90) * 1000), date: day(ms, 18), description: 'Content agency retainer', categoryId: 'cat_marketing', accountId: 'acc_axis' })
    if (i === 4) tx(ctx, { type: 'expense', amount: M(275000), date: day(ms, 10), description: 'SaaSBoomi booth & travel', categoryId: 'cat_marketing', accountId: 'acc_axis', tags: ['event'] })
    // Office
    tx(ctx, { type: 'expense', amount: M(85000), date: day(ms, 1), description: 'Office rent — Koramangala', categoryId: 'cat_workspace', accountId: 'acc_axis', recurring: { frequency: 'monthly' } })
    tx(ctx, { type: 'expense', amount: M(between(rnd, 9, 15) * 1000), date: day(ms, 21), description: 'Utilities & internet', categoryId: 'cat_workspace', accountId: 'acc_axis' })
    // Professional
    tx(ctx, { type: 'expense', amount: M(25000), date: day(ms, 24), description: 'Accounting & compliance — retainer', categoryId: 'cat_professional', accountId: 'acc_axis', recurring: { frequency: 'monthly' } })
    if (i === 11) tx(ctx, { type: 'expense', amount: M(180000), date: day(ms, 14), description: 'Legal — ESOP plan setup', categoryId: 'cat_professional', accountId: 'acc_axis' })
    // Travel
    if (rnd() < 0.6) card(tx(ctx, { type: 'expense', amount: M(between(rnd, 12, 42) * 1000), date: day(ms, 17), description: 'Customer visit — flights & stay', categoryId: 'cat_travel', accountId: 'acc_card' }))
    // Equipment
    if (i === 12) tx(ctx, { type: 'expense', amount: M(3 * 134900), date: day(ms, 8), description: 'MacBook Air ×3 (new hires)', categoryId: 'cat_equipment', accountId: 'acc_axis', tags: ['asset'] })
    if (i === 6) tx(ctx, { type: 'expense', amount: M(134900), date: day(ms, 8), description: 'MacBook Air (new hire)', categoryId: 'cat_equipment', accountId: 'acc_axis', tags: ['asset'] })

    if (cardSpend > 0) tx(ctx, { type: 'transfer', amount: cardSpend, date: day(addMonths(ms, 1), 5), description: 'Amex statement payment', accountId: 'acc_axis', toAccountId: 'acc_card' })

    // Services invoices
    if (i % 3 === 2 || i === 0) {
      const cl = clients[(13 - i) % 3]
      const pr = projects.find((p) => p.clientId === cl.id)!
      const inv = invoice(ctx, {
        clientId: cl.id,
        projectId: pr.id,
        issueDate: day(ms, 8),
        dueDate: addDays(day(ms, 8), 30),
        lines: [line(`${pr.name} — fixed fee`, 1, between(rnd, 18, 35) * 10000, 'l1'), line('Implementation hours', between(rnd, 10, 30), 3500, 'l2')],
        discount: { type: 'percent', value: 0 },
        taxRate: 18,
        taxLabel: 'GST',
        terms: workspace.defaultTerms,
      }, 'TL-')
      if (inv && i >= 3) {
        tx(ctx, { type: 'income', amount: invoiceAmounts(inv).total, date: addDays(inv.issueDate, between(rnd, 25, 38)), description: `Payment — ${inv.number}`, categoryId: 'cat_services', accountId: 'acc_axis', clientId: inv.clientId, projectId: inv.projectId, invoiceId: inv.id })
      } else if (inv && i === 2) {
        tx(ctx, { type: 'income', amount: Math.round(invoiceAmounts(inv).total * 0.4), date: addDays(inv.issueDate, 33), description: `Part payment — ${inv.number}`, categoryId: 'cat_services', accountId: 'acc_axis', clientId: inv.clientId, projectId: inv.projectId, invoiceId: inv.id })
      }
    }
    if (i === 7) tx(ctx, { type: 'income', amount: M(1000000), date: day(ms, 19), description: 'Startup India Seed Fund — tranche 1', categoryId: 'cat_other_inc', accountId: 'acc_axis', notes: 'Grant — non-dilutive' })
    if (i === 3) {
      tx(ctx, { type: 'income', amount: M(36000), date: day(ms, 11), description: 'Annual plan refund — churned customer', categoryId: 'cat_subscriptions', accountId: 'acc_rzp', refund: true })
    }
  }

  const budgets: Budget[] = [
    { id: 'bud_all', categoryId: null, amount: M(1450000), period: 'monthly', alertAt: 85 },
    { id: 'bud_mkt', categoryId: 'cat_marketing', amount: M(150000), period: 'monthly', alertAt: 80 },
    { id: 'bud_infra', categoryId: 'cat_infra', amount: M(95000), period: 'monthly', alertAt: 85 },
    { id: 'bud_ppl', categoryId: 'cat_people', amount: M(950000), period: 'monthly', alertAt: 90 },
    { id: 'bud_soft', categoryId: 'cat_software', amount: M(45000), period: 'monthly', alertAt: 85 },
  ]
  workspace.onboarding.done = { sample: true }
  return { workspace, data: { categories: defaultCategories('startup'), accounts, clients, projects, transactions: ctx.txs, invoices: ctx.invoices, budgets } }
}

/** Number invoices in issue-date order, as a real ledger would, and keep payment descriptions in sync. */
function renumber(data: WorkspaceData) {
  const sorted = [...data.invoices].sort((a, b) => (a.issueDate < b.issueDate ? -1 : a.issueDate > b.issueDate ? 1 : a.id.localeCompare(b.id)))
  const map = new Map<string, string>()
  sorted.forEach((inv, i) => {
    const prefix = inv.number.replace(/\d{4}-\d+$/, '')
    const next = `${prefix}${inv.issueDate.slice(0, 4)}-${String(i + 1).padStart(3, '0')}`
    map.set(inv.number, next)
    inv.number = next
  })
  for (const t of data.transactions) {
    if (!t.invoiceId) continue
    const m = t.description.match(/— (.+)$/)
    if (m && map.has(m[1])) t.description = t.description.replace(m[1], map.get(m[1])!)
  }
}

export function sampleWorkspace(type: WorkspaceType, today = todayISO()) {
  const r = type === 'startup' ? startup(today) : freelancer(today)
  renumber(r.data)
  r.data.transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return r
}
