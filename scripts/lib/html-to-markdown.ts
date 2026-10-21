import { parse, HTMLElement, TextNode, type Node } from 'node-html-parser';

const DROP_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'svg',
  'iframe',
  'nav',
  'footer',
  'form',
  'button',
  'select',
  'input',
  'textarea',
  'template',
  'video',
  'audio',
  'canvas',
  'img',
  'picture',
  'head',
]);

const DROP_CLASS =
  /(^|\s)(w-nav|navbar|mobile_nav|sticky-div|back-to-top|w-form|modal-wrapper|w-embed|w-condition-invisible|w-dyn-bind-empty|footer)(\s|$)/;
const DROP_COOKIE = /cookie/i;

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'body',
  'div',
  'dl',
  'dt',
  'dd',
  'figure',
  'figcaption',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'html',
  'li',
  'main',
  'ol',
  'p',
  'section',
  'table',
  'tr',
  'ul',
]);

const PSEUDO_HEADING = /(subheading|copy-heads|tab-heading)/;

const isElement = (node: Node): node is HTMLElement =>
  node instanceof HTMLElement;

const tagOf = (el: HTMLElement) => (el.rawTagName ?? '').toLowerCase();

function shouldDrop(el: HTMLElement): boolean {
  if (DROP_TAGS.has(tagOf(el))) return true;
  const cls = el.getAttribute('class') ?? '';
  if (DROP_CLASS.test(cls)) return true;
  return DROP_COOKIE.test(cls) || DROP_COOKIE.test(el.getAttribute('id') ?? '');
}

function hasBlockDescendant(el: HTMLElement): boolean {
  return el.childNodes.some(
    (child) =>
      isElement(child) &&
      !shouldDrop(child) &&
      (BLOCK_TAGS.has(tagOf(child)) || hasBlockDescendant(child)),
  );
}

const isBlock = (el: HTMLElement) =>
  BLOCK_TAGS.has(tagOf(el)) || hasBlockDescendant(el);

function cleanText(text: string): string {
  return text
    .replace(/[​-‍﻿]/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ');
}

function escapeText(text: string): string {
  return text.replace(/[\\*_`[\]<]/g, '\\$&');
}

function cleanHref(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let href = raw.trim();
  const wrapped = href.lastIndexOf('#http');
  if (wrapped >= 0) href = href.slice(wrapped + 1);
  if (!href || href.startsWith('#') || /^javascript:/i.test(href)) {
    return undefined;
  }
  const internal = href.match(
    /^https?:\/\/(?:www\.)?crosswaysa\.org(\/[^\s]*)?$/i,
  );
  if (internal) return internal[1] || '/';
  return href;
}

function inline(node: Node): string {
  if (node instanceof TextNode) return escapeText(cleanText(node.text));
  if (!isElement(node) || shouldDrop(node)) return '';
  const tag = tagOf(node);
  if (tag === 'br') return '\n';
  const inner = node.childNodes.map(inline).join('');
  if (!inner.trim()) return inner;
  if (tag === 'strong' || tag === 'b') return wrap(inner, '**');
  if (tag === 'em' || tag === 'i') return wrap(inner, '*');
  if (tag === 'a') {
    const href = cleanHref(node.getAttribute('href'));
    return href ? `[${inner.trim()}](${href})` : inner;
  }
  return inner;
}

function wrap(inner: string, mark: string): string {
  const lead = inner.match(/^\s*/)![0];
  const trail = inner.match(/\s*$/)![0];
  const core = inner.trim();
  return core ? `${lead}${mark}${core}${mark}${trail}` : inner;
}

function paragraphs(text: string): string[] {
  return text
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .split(/\n{2,}/)
    .map((part) => part.replace(/\n/g, ' ').replace(/ {2,}/g, ' ').trim())
    .filter(Boolean);
}

type Block = { kind: 'h'; level: number; text: string } | { text: string };

function collect(node: HTMLElement, out: Block[], listDepth = 0): void {
  let buffer = '';
  const flush = () => {
    for (const text of paragraphs(buffer)) out.push({ text });
    buffer = '';
  };

  for (const child of node.childNodes) {
    if (child instanceof TextNode) {
      buffer += inline(child);
      continue;
    }
    if (!isElement(child) || shouldDrop(child)) continue;
    const tag = tagOf(child);

    if (/^h[1-6]$/.test(tag)) {
      flush();
      const text = paragraphs(inline(child) + '').join(' ');
      if (text) out.push({ kind: 'h', level: Number(tag[1]), text });
    } else if (tag === 'ul' || tag === 'ol') {
      flush();
      const items = child.childNodes.filter(
        (c): c is HTMLElement => isElement(c) && tagOf(c) === 'li',
      );
      const lines = items.flatMap((li, i) => {
        const text = paragraphs(
          li.childNodes
            .filter((c) => !(isElement(c) && /^(ul|ol)$/.test(tagOf(c))))
            .map(inline)
            .join(''),
        ).join(' ');
        if (!text) return [];
        const marker = tag === 'ol' ? `${i + 1}.` : '-';
        return [`${'  '.repeat(listDepth)}${marker} ${text}`];
      });
      if (lines.length) out.push({ text: lines.join('\n') });
    } else if (tag === 'blockquote') {
      flush();
      const inner: Block[] = [];
      collect(child, inner, listDepth);
      const quoted = inner
        .filter((b) => !('kind' in b))
        .map((b) => `> ${b.text}`)
        .join('\n>\n');
      if (quoted) out.push({ text: quoted });
    } else if (tag === 'hr') {
      flush();
    } else if (
      PSEUDO_HEADING.test(child.getAttribute('class') ?? '') &&
      !hasBlockDescendant(child)
    ) {
      flush();
      const text = paragraphs(inline(child)).join(' ');
      if (text) out.push({ kind: 'h', level: 3, text });
    } else if (isBlock(child)) {
      flush();
      collect(child, out, listDepth);
    } else {
      buffer += inline(child);
    }
  }
  flush();
}

export function htmlToMarkdownDraft(html: string): string {
  const root = parse(html);
  const body = root.querySelector('body') ?? root;
  const blocks: Block[] = [];
  collect(body, blocks);

  let titleDropped = false;
  const kept = blocks.filter((block) => {
    if ('kind' in block && block.level === 1 && !titleDropped) {
      titleDropped = true;
      return false;
    }
    return true;
  });

  const levels = kept.flatMap((b) => ('kind' in b ? [b.level] : []));
  const shift = levels.length ? 2 - Math.min(...levels) : 0;

  const lines = kept.map((block) =>
    'kind' in block
      ? `${'#'.repeat(Math.min(6, Math.max(2, block.level + shift)))} ${block.text}`
      : block.text,
  );
  const text = lines.join('\n\n').trim();
  return text ? `${text}\n` : '';
}
