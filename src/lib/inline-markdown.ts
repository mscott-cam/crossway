import { safeHref } from './safe-href';

const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

function renderInline(source: string): string {
  let out = '';
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    out += escape(source.slice(last, match.index));
    last = match.index + match[0].length;
    const [, linkText, href, bold, emphasis] = match;
    if (linkText !== undefined) {
      const safe = safeHref(href);
      out += safe
        ? `<a href="${escape(safe)}">${renderInline(linkText)}</a>`
        : renderInline(linkText);
    } else if (bold !== undefined) {
      out += `<strong>${renderInline(bold)}</strong>`;
    } else {
      out += `<em>${renderInline(emphasis!)}</em>`;
    }
  }
  return out + escape(source.slice(last));
}

export function renderInlineMarkdown(source: string): string {
  return source
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${renderInline(paragraph.trim())}</p>`)
    .join('');
}
