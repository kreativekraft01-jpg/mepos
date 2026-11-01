/**
 * Turn an uploaded text file into knowledge-base documents the assistant can
 * retrieve. Files are read in the browser only — nothing is uploaded.
 */

export interface KnowledgeFileDoc {
  title: string
  content: string
}

const MAX_CHARS = 400_000

export function titleFromFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() || name).trim()
  const withoutExt = base.replace(/\.[^.]+$/, '')
  const pretty = withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return pretty || 'Imported document'
}

function clean(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim().slice(0, MAX_CHARS)
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
}

function asDoc(value: unknown): KnowledgeFileDoc | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const title = typeof row.title === 'string' ? row.title.trim() : ''
  const content = typeof row.content === 'string' ? row.content : typeof row.text === 'string' ? row.text : ''
  if (!content.trim()) return null
  return { title: title || 'Imported document', content: content.trim() }
}

function docsFromJson(value: unknown, fallbackTitle: string): KnowledgeFileDoc[] | null {
  if (Array.isArray(value)) {
    const docs = value.map(asDoc).filter((d): d is KnowledgeFileDoc => !!d)
    return docs.length ? docs : null
  }
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>

  // Backup files keep docs under data.knowledge.
  const data = obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : null
  for (const list of [data?.knowledge, obj.knowledge, obj.documents, obj.docs]) {
    if (Array.isArray(list)) {
      const docs = list.map(asDoc).filter((d): d is KnowledgeFileDoc => !!d)
      if (docs.length) return docs
    }
  }

  const single = asDoc(obj)
  if (single) return [single]

  // A backup that contains other store data but no knowledge docs — importing
  // its raw JSON would pollute the assistant's answers.
  if (data || obj.app || obj.products || obj.customers) return []
  return null
}

/** Split markdown/text into documents by `#`, `##` or `###` headings. */
function splitMarkdown(text: string, fallbackTitle: string): KnowledgeFileDoc[] {
  const docs: KnowledgeFileDoc[] = []
  const preamble: string[] = []
  let heading: string | null = null
  let buffer: string[] = []

  const flush = () => {
    if (heading === null) return
    const content = clean(buffer.join('\n'))
    if (content) docs.push({ title: heading, content })
    buffer = []
  }

  for (const line of text.split('\n')) {
    const match = /^\s{0,3}#{1,3}\s+(.+?)\s*#*\s*$/.exec(line)
    if (match) {
      flush()
      if (heading === null) {
        const intro = clean(preamble.join('\n'))
        if (intro) docs.push({ title: fallbackTitle, content: intro })
      }
      heading = match[1].trim() || fallbackTitle
    } else if (heading === null) {
      preamble.push(line)
    } else {
      buffer.push(line)
    }
  }
  flush()

  if (heading === null) {
    const content = clean(text)
    return content ? [{ title: fallbackTitle, content }] : []
  }
  return docs
}

/**
 * Parse a file into one or more knowledge documents.
 * Supported: .md/.markdown, .txt/.log, .csv, .html/.htm and .json
 * (array of `{title, content}` or a POS backup's `data.knowledge`).
 */
export function parseKnowledgeFile(name: string, raw: string): KnowledgeFileDoc[] {
  const fallbackTitle = titleFromFileName(name)
  const ext = (name.split('.').pop() || '').toLowerCase()
  const text = clean(raw)

  if (ext === 'json') {
    try {
      const parsed: unknown = JSON.parse(text)
      const docs = docsFromJson(parsed, fallbackTitle)
      if (docs) return docs
    } catch {
      /* not JSON — fall through and keep it as text */
    }
    return text ? [{ title: fallbackTitle, content: text }] : []
  }

  if (ext === 'html' || ext === 'htm') {
    const content = clean(htmlToText(text))
    return content ? [{ title: fallbackTitle, content }] : []
  }

  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') {
    return splitMarkdown(text, fallbackTitle)
  }

  return text ? [{ title: fallbackTitle, content: text }] : []
}
