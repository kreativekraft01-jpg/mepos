import type { Category, Product, Sale } from '../types'
import { inventoryProducts, stripFollowUpAnnotation } from './ai'

/** Read-only inventory questions; quantities are units, never catalog row counts. */
export function inventoryAnswer(question: string, products: Product[], categories: Category[], sales: Sale[], currency: string): string | undefined {
  const raw = stripFollowUpAnnotation(question)
  const annotation = question.match(/\(of:\s*([^)]*)\)\s*$/i)?.[1]
  const skuMatch = products.find(p => raw.toLowerCase().split(/\s+/).some(word => word.replace(/^[?!,.]+|[?!,.]+$/g, '') === p.sku.toLowerCase()))
  const filters = !!annotation && /grade|under|below|price|cheapest/i.test(raw)
  const count = /how many|\bquantity\b|\bunits?\b|\bcopies\b/i.test(raw)
  const requested = raw.match(/\b(?:got|need|have you got|do we have)\s+(\d+)\b/i)?.[1]
  const location = /\bwhere\b|can'?t find|cannot find|missing/i.test(raw)
  const history = /\b(latest|last|recent)\b.*\b(sales?|buys?|sold|bought|transactions?|movements?)\b/i.test(raw)
  const out = /out of stock|sold out|zero stock/i.test(raw)
  const low = /low[ -]stock/i.test(raw)
  if (!count && !requested && !location && !history && !out && !low && !filters && !skuMatch) {
    if (!annotation && /^(?:price|how much|under\s*[£$€]?\d+|grade\s+[a-f]|any cheapest)[?.!]*$/i.test(raw.trim())) return 'Which product or category do you mean? You can give me its name or box SKU.'
    return undefined
  }
  let subject = skuMatch?.sku ?? annotation ?? raw
    .replace(/\b(?:got|need|have you got|do we have)\s+\d+\b/gi, '')
    .replace(/how many|how much|out of stock|sold out|zero stock|low[ -]stock|can'?t find|cannot find/gi, '')
    .replace(/\b(where|is|it|are|they|the|this|that|box|in|on|store|system|latest|last|recent|sales?|buys?|sold|bought|transactions?|movements?|copies|units?|quantity|left|please|only|show|me|missing)\b/gi, ' ')
    .replace(/[?!]/g, '').trim()
  subject = subject.replace(/can'?t find|cannot find|\bmissing\b/gi, '').replace(/\b(?:it|this box|the box)\b/gi, '').trim()
  if (!subject && (out || low)) subject = 'products'
  if (!subject) return 'Which product or box do you mean? Give me its name or SKU so I can check the right stock record.'
  // Current constraints override earlier ones; preserve the product identity.
  const grade = raw.match(/grade\s+([a-f])\b/i)?.[0]
  if (annotation && grade) subject = subject.replace(/grade\s+[a-f]\b/gi, '') + ' ' + grade
  const budget = raw.match(/(?:under|below)\s*[£$€]?\s*\d+(?:\.\d+)?/i)?.[0]
  if (annotation && budget) subject = subject.replace(/(?:under|below)\s*[£$€]?\s*\d+(?:\.\d+)?/gi, '') + ' ' + budget
  let matches = inventoryProducts(subject, products, categories)
  if (!matches.length && filters) return `No stock matches ${subject.trim()}. Try a different grade or budget.`
  if (!matches.length) return `I couldn't find a matching stock record for "${subject}". Check the box SKU, platform or product name.`
  if (out) matches = matches.filter(p => p.stock <= 0)
  if (low) matches = matches.filter(p => p.stock <= p.lowStockThreshold)
  if (out || low) {
    if (!matches.length) return `No ${out ? 'out-of-stock' : 'low-stock'} products match that selection.`
    return `${matches.length} ${out ? 'out-of-stock' : 'low-stock'} product records:\n${matches.slice(0, 10).map(p => `• ${p.name} · Grade ${p.grade} · ${p.stock} units · ${p.sku}`).join('\n')}${matches.length > 10 ? `\n…and ${matches.length - 10} more.` : ''}`
  }
  if ((requested || location || history) && matches.length > 1) {
    return `Which exact box do you mean?\n${matches.slice(0, 6).map(p => `• ${p.name} · Grade ${p.grade} · ${p.sku}`).join('\n')}\nReply with the box SKU so I don't mix stock from different versions.`
  }
  if (filters || (skuMatch && !count && !requested && !location && !history)) {
    matches = matches.filter(p => p.stock > 0)
    if (/cheapest/i.test(raw)) matches = matches.sort((a, b) => a.price - b.price).slice(0, 1)
    return matches.length ? matches.slice(0, 8).map(p => `• ${p.name} · Grade ${p.grade} · ${currency}${p.price.toFixed(2)} · ${p.stock} units · ${p.sku}`).join('\n') + (matches.length > 8 ? `\n…and ${matches.length - 8} more.` : '') : 'No matching products are currently in stock.'
  }
  const units = matches.reduce((sum, p) => sum + Math.max(0, p.stock), 0)
  if (location || history) {
    const p = matches[0]
    const buysOnly = /\b(buys?|bought)\b/i.test(raw) && !/\b(sales?|sold)\b/i.test(raw)
    const salesOnly = /\b(sales?|sold)\b/i.test(raw) && !/\b(buys?|bought)\b/i.test(raw)
    const transactions = sales.filter(s => (!buysOnly || s.kind === 'buy') && (!salesOnly || s.kind === 'sale') && s.items.some(i => i.productId === p.id)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)
    return `${p.name} · ${p.sku}: ${p.stock} units recorded in stock.\n\n` + (transactions.length ? 'Latest recorded transactions:\n' + transactions.map(s => `• ${new Date(s.createdAt).toLocaleString('en-GB')} · ${s.kind} · ${s.items.filter(i => i.productId === p.id).reduce((n, i) => n + i.qty, 0)} units · ${s.receiptNo}${s.tillId ? ` · till ${s.tillId}` : ''}`).join('\n') : 'No recorded transactions were found for this box.') + (location ? '\n\nShelf locations are not recorded, so I cannot confirm where it is. Check the box SKU and the latest receipt before changing stock.' : '')
  }
  if (requested) return `${units >= Number(requested) ? 'Yes' : 'No'} — ${matches[0].name} has ${units} units recorded in stock; you asked for ${requested}.`
  return `${units} units in stock across ${matches.length} matching product ${matches.length === 1 ? 'record' : 'records'}.\n${matches.slice(0, 8).map(p => `• ${p.name} · Grade ${p.grade} · ${p.stock} units`).join('\n')}${matches.length > 8 ? `\n…and ${matches.length - 8} more product records.` : ''}`
}
