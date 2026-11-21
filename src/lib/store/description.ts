/**
 * Split a plain-text product description into paragraphs and bullet lists.
 *
 * Descriptions are stored as plain text and written by editors. The solar
 * packages in particular carry a contents list ("Includes: E-SUN 3KVA inverter;
 * 2x LI MAX battery; ..."), which as one dense paragraph buries the most
 * decision-relevant part of the package. Recognising a bullet run gives that
 * list real structure without adding a rich-text field.
 *
 * Two shapes are recognised and nothing else:
 *   - a blank-line-separated paragraph;
 *   - a consecutive run of lines starting with `-`, `*` or `•`, which becomes one
 *     list. A run directly after a paragraph stays a separate block, so a
 *     "Includes:" line introduces the list that follows it.
 *
 * No HTML or markdown is interpreted, so a `<script>` written into a description
 * stays visible characters and cannot execute.
 */

export type DescriptionBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

const BULLET = /^[-*•]\s+(.*)$/;

export function descriptionBlocks(description: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];

  for (const chunk of description.split(/\n{2,}/)) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    let paragraph: string[] = [];
    let list: string[] = [];

    const flushParagraph = () => {
      if (paragraph.length > 0) {
        blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
        paragraph = [];
      }
    };
    const flushList = () => {
      if (list.length > 0) {
        blocks.push({ kind: "list", items: list });
        list = [];
      }
    };

    for (const line of lines) {
      const bullet = BULLET.exec(line);
      if (bullet) {
        flushParagraph();
        list.push((bullet[1] ?? "").trim());
      } else {
        flushList();
        paragraph.push(line);
      }
    }

    flushParagraph();
    flushList();
  }

  return blocks;
}
