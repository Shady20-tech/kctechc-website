import type { ReactNode } from "react";

export type DataTableColumn<Row> = {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  /** Align numeric/currency columns; defaults to start. */
  align?: "start" | "end";
};

/**
 * Data table.
 *
 * A real `<table>` with `<caption>`, `<th scope="col">` and row headers, so the
 * relationship between cells and headers survives for a screen reader. It is
 * horizontally scrollable on narrow screens rather than collapsed into cards,
 * because these tables carry operational data where column comparison matters.
 *
 * The scroll container is focusable and labelled so a keyboard user can reach
 * and scroll it.
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  emptyMessage,
  rowHeaderKey,
  scrollLabel,
}: {
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row) => string;
  emptyMessage: string;
  /** Column whose cell should be a `<th scope="row">`. */
  rowHeaderKey?: string;
  scrollLabel: string;
}) {
  return (
    <div
      className="overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label={scrollLabel}
    >
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border-strong">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-3 py-2 font-semibold text-ink-900 ${
                  column.align === "end" ? "text-right" : "text-left"
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center text-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="border-b border-border transition-soft hover:bg-surface-alt"
              >
                {columns.map((column) => {
                  const isRowHeader = column.key === rowHeaderKey;
                  const content = column.render(row);
                  const alignClass =
                    column.align === "end" ? "text-right" : "text-left";
                  return isRowHeader ? (
                    <th
                      key={column.key}
                      scope="row"
                      className={`px-3 py-2 font-medium text-ink-900 ${alignClass}`}
                    >
                      {content}
                    </th>
                  ) : (
                    <td key={column.key} className={`px-3 py-2 ${alignClass}`}>
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
