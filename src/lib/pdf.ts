import type { Client, Invoice, Workspace } from '@/data/types'
import { invoiceAmounts, lineTotal } from './finance'
import { formatDate } from './dates'
import { formatMoney } from './money'

/**
 * Generates a text-based A4 PDF with jsPDF (loaded on demand).
 * Core PDF fonts lack the ₹ glyph, so INR amounts are prefixed "Rs." in the PDF.
 */
export async function downloadInvoicePDF(invoice: Invoice, ws: Workspace, client: Client | undefined, fromName: string, fromEmail: string | undefined, paid: number) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const money = (v: number) => {
    const s = formatMoney(v, ws.currency, ws.locale, { decimals: true })
    return ws.currency === 'INR' ? s.replace('₹', 'Rs. ').replace('−Rs. ', '-Rs. ') : s.replace('−', '-')
  }
  const a = invoiceAmounts(invoice)
  const ink: [number, number, number] = [22, 22, 21]
  const muted: [number, number, number] = [119, 117, 111]

  // brand mark
  doc.setFillColor(...ink)
  doc.roundedRect(M, M, 30, 30, 8, 8, 'F')
  doc.setDrawColor(245, 203, 60)
  doc.setLineWidth(2.2)
  doc.circle(M + 12, M + 15, 5.5)
  doc.setDrawColor(255, 255, 255)
  doc.circle(M + 18.5, M + 15, 5.5)

  doc.setTextColor(...ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(ws.name, M + 42, M + 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...muted)
  if (fromEmail) doc.text(fromEmail, M + 42, M + 26)

  doc.setTextColor(...ink)
  doc.setFontSize(26)
  doc.text('Invoice', W - M, M + 18, { align: 'right' })
  doc.setFontSize(10)
  doc.setTextColor(...muted)
  doc.text(invoice.number, W - M, M + 34, { align: 'right' })
  if (invoice.state === 'draft') doc.text('DRAFT', W - M, M + 48, { align: 'right' })
  if (invoice.state === 'void') doc.text('VOID', W - M, M + 48, { align: 'right' })

  let y = M + 90
  const block = (x: number, title: string, lines: string[], width: number) => {
    doc.setFontSize(8)
    doc.setTextColor(...muted)
    doc.text(title.toUpperCase(), x, y)
    doc.setFontSize(10)
    let yy = y + 15
    lines.filter(Boolean).forEach((l, i) => {
      doc.setTextColor(...(i === 0 ? ink : muted))
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal')
      const wrapped = doc.splitTextToSize(l, width) as string[]
      doc.text(wrapped, x, yy)
      yy += wrapped.length * 13
    })
    return yy
  }
  const colW = (W - M * 2) / 3
  const y1 = block(M, 'Billed to', [client?.name ?? '', client?.address ?? '', client?.email ?? '', client?.taxId ? `Tax ID: ${client.taxId}` : ''], colW - 12)
  const y2 = block(M + colW, 'From', [fromName, ws.businessAddress ?? '', ws.businessTaxId ? `Tax ID: ${ws.businessTaxId}` : ''], colW - 12)
  doc.setFont('helvetica', 'normal')
  const meta: [string, string][] = [
    ['Issued', formatDate(invoice.issueDate, 'medium')],
    ['Due', formatDate(invoice.dueDate, 'medium')],
    ['Currency', ws.currency],
  ]
  meta.forEach(([k, v], i) => {
    doc.setFontSize(9.5)
    doc.setTextColor(...muted)
    doc.text(k, W - M - 110, y + 15 + i * 14)
    doc.setTextColor(...ink)
    doc.text(v, W - M, y + 15 + i * 14, { align: 'right' })
  })
  y = Math.max(y1, y2, y + 60) + 24

  // table header
  const cQty = W - M - 200
  const cRate = W - M - 110
  const cAmt = W - M
  doc.setDrawColor(...ink)
  doc.setLineWidth(0.8)
  doc.setFontSize(8)
  doc.setTextColor(...muted)
  doc.text('DESCRIPTION', M, y)
  doc.text('QTY', cQty, y, { align: 'right' })
  doc.text('RATE', cRate, y, { align: 'right' })
  doc.text('AMOUNT', cAmt, y, { align: 'right' })
  y += 7
  doc.line(M, y, W - M, y)
  y += 16
  doc.setFontSize(10)
  doc.setDrawColor(230, 229, 225)
  doc.setLineWidth(0.5)
  for (const l of invoice.lines) {
    const desc = doc.splitTextToSize(l.description, cQty - M - 40) as string[]
    if (y + desc.length * 13 > H - 160) {
      doc.addPage()
      y = M
    }
    doc.setTextColor(...ink)
    doc.text(desc, M, y)
    doc.text(String(l.quantity), cQty, y, { align: 'right' })
    doc.text(money(l.rate), cRate, y, { align: 'right' })
    doc.text(money(lineTotal(l.quantity, l.rate)), cAmt, y, { align: 'right' })
    y += desc.length * 13 + 6
    doc.line(M, y - 4, W - M, y - 4)
    y += 10
  }

  // totals
  y += 6
  const row = (k: string, v: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 11.5 : 10)
    doc.setTextColor(...(bold ? ink : muted))
    doc.text(k, W - M - 200, y)
    doc.setTextColor(...ink)
    doc.text(v, W - M, y, { align: 'right' })
    y += bold ? 20 : 16
  }
  row('Subtotal', money(a.subtotal))
  if (a.discount > 0) row(`Discount${invoice.discount.type === 'percent' ? ` (${invoice.discount.value}%)` : ''}`, '-' + money(a.discount))
  if (invoice.taxRate > 0 || invoice.taxLabel) row(`${invoice.taxLabel || 'Tax'} (${invoice.taxRate}%)`, money(a.tax))
  doc.setDrawColor(...ink)
  doc.line(W - M - 200, y - 8, W - M, y - 8)
  y += 6
  row('Total', money(a.total), true)
  if (paid > 0) {
    row('Paid', '-' + money(paid))
    row('Balance due', money(Math.max(0, a.total - paid)), true)
  }

  // notes / terms
  y += 20
  doc.setFont('helvetica', 'normal')
  for (const [title, body] of [
    ['Notes', invoice.notes],
    ['Payment terms', invoice.terms],
  ] as const) {
    if (!body) continue
    if (y > H - 100) {
      doc.addPage()
      y = M
    }
    doc.setFontSize(8)
    doc.setTextColor(...muted)
    doc.text(title.toUpperCase(), M, y)
    doc.setFontSize(10)
    doc.setTextColor(...ink)
    const w = doc.splitTextToSize(body, W - M * 2) as string[]
    doc.text(w, M, y + 14)
    y += 14 + w.length * 13 + 14
  }

  doc.setFontSize(8)
  doc.setTextColor(...muted)
  doc.text(`${ws.name} · ${invoice.number}`, M, H - 30)
  doc.save(`${invoice.number}.pdf`)
}
