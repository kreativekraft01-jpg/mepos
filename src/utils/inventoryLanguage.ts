/** Conservative shorthand expansion; never fuzzy-correct model numbers or SKUs. */
export function normalizeInventoryQuery(text: string): string {
  const words: Record<string, string> = { pls: 'please', plz: 'please', u: 'you', ur: 'your', qty: 'quantity', qnty: 'quantity', prce: 'price', pric: 'price', stok: 'stock', stck: 'stock', iphons: 'iphones', iphne: 'iphone', iphon: 'iphone', lapop: 'laptop', latop: 'laptop', laptps: 'laptops', avail: 'available', cheper: 'cheaper' }
  return text.replace(/\biphon[e]?(\d+)/gi, 'iphone $1').replace(/[’]/g, "'").replace(/(?<![\w-])[a-z]+(?![\w-])/gi, w => words[w.toLowerCase()] ?? w)
    .replace(/\bhow (?:mny|manny)\b/gi, 'how many').replace(/\b(?:hw much|how mch)\b/gi, 'how much')
    .replace(/\boos\b/gi, 'out of stock').replace(/\bgr\s+([a-f])\b/gi, 'grade $1')
    .replace(/\b([a-f])\s*[- ]\s*grade\b/gi, 'grade $1')
    .replace(/\bgrade\s*[-:]\s*([a-f])\b/gi, 'grade $1')
    .replace(/\bcheaper\b/gi, 'cheapest').trim()
}

export function previousInventoryQuestion(messages: { role: string; content: string; resolvedQuery?: string }[]): string | undefined {
  const prior = [...messages].reverse().find(m => m.role === 'user' && !/^(thanks?(?: you)?|thank you|cheers|ok(?:ay)?|great|nice|hello|hi|hey)[!. ]*$/i.test(m.content.trim()))
  return prior?.resolvedQuery ?? prior?.content
}
