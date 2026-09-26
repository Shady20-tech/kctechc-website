import type { ReactNode } from "react";

/**
 * Minimal, escaping-first renderer for article bodies.
 *
 * The body text is authored by staff, but it is still untrusted input as far as
 * this module is concerned: raw HTML is escaped, never executed, so a `<script>`
 * written into an article is displayed as text rather than run. The output is
 * built from React elements only, so there is no path that produces raw markup
 * and therefore no `dangerouslySetInnerHTML` anywhere in this path.
 *
 * Supported, deliberately small:
 *   - paragraphs (blank-line separated)
 *   - `##` and `###` headings
 *   - `- ` unordered lists
 *   - `1. ` ordered lists
 *   - `> ` block quotes
 *   - `**bold**` and `*italic*` inline
 *   - `[text](url)` links, restricted to http(s) and site-relative targets
 *
 * Anything else is rendered as plain text. A link whose target is not http(s) or
 * a relative path is rendered as text rather than as a link, which is what stops
 * a `javascript:` URL written into an article from becoming clickable.
 */

type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; text: string };

function parseBlocks(body: string): Block[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list && list.items.length > 0) {
      blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
    }
    list = null;
  };
  const flushQuote = () => {
    if (quote.length > 0) {
      blocks.push({ kind: "quote", text: quote.join(" ").trim() });
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().length === 0) {
      flushAll();
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      blocks.push({
        kind: "heading",
        level: heading[1]!.length === 2 ? 2 : 3,
        text: heading[2]!.trim(),
      });
      continue;
    }

    const quoteLine = /^>\s?(.*)$/.exec(line);
    if (quoteLine) {
      flushParagraph();
      flushList();
      quote.push(quoteLine[1]!.trim());
      continue;
    }

    const unordered = /^[-*]\s+(.*)$/.exec(line);
    if (unordered) {
      flushParagraph();
      flushQuote();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(unordered[1]!.trim());
      continue;
    }

    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    if (ordered) {
      flushParagraph();
      flushQuote();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]!.trim());
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }

  flushAll();
  return blocks;
}

/** Only http(s) and site-relative links become anchors. */
function safeHref(target: string): string | null {
  const trimmed = target.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;

/** Split a line into text and inline elements, escaping by construction. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(INLINE).filter((part) => part.length > 0);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold) return <strong key={key}>{bold[1]}</strong>;

    const italic = /^\*([^*]+)\*$/.exec(part);
    if (italic) return <em key={key}>{italic[1]}</em>;

    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]!);
      // An unsafe target keeps the visible text but is not made clickable.
      if (!href) return <span key={key}>{link[1]}</span>;
      const external = /^https?:\/\//i.test(href);
      return (
        <a
          key={key}
          href={href}
          className="text-dept-accent underline underline-offset-4"
          {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
        >
          {link[1]}
        </a>
      );
    }

    return <span key={key}>{part}</span>;
  });
}

/**
 * Render an article body as React elements.
 *
 * Headings start at `h2` because the page already owns the single `h1`; an
 * article must not introduce a second one.
 */
export function RichText({ body }: { body: string }) {
  const blocks = parseBlocks(body);

  return (
    <div className="space-y-4 text-base leading-relaxed text-body">
      {blocks.map((block, index) => {
        const key = `block-${index}`;

        if (block.kind === "heading") {
          return block.level === 2 ? (
            <h2 key={key} className="mt-8 text-xl font-semibold text-ink-900">
              {renderInline(block.text, key)}
            </h2>
          ) : (
            <h3 key={key} className="mt-6 text-lg font-semibold text-ink-900">
              {renderInline(block.text, key)}
            </h3>
          );
        }

        if (block.kind === "list") {
          const items = block.items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}>
              {renderInline(item, `${key}-${itemIndex}`)}
            </li>
          ));
          return block.ordered ? (
            <ol key={key} className="list-decimal space-y-2 pl-6">
              {items}
            </ol>
          ) : (
            <ul key={key} className="list-disc space-y-2 pl-6">
              {items}
            </ul>
          );
        }

        if (block.kind === "quote") {
          return (
            <blockquote
              key={key}
              className="border-l-4 border-dept-accent pl-4 italic text-ink-700"
            >
              {renderInline(block.text, key)}
            </blockquote>
          );
        }

        return <p key={key}>{renderInline(block.text, key)}</p>;
      })}
    </div>
  );
}
