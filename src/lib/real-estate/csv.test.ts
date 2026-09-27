import { describe, expect, it } from "vitest";

import { CsvParseError, parseCsv, parseListCell } from "./csv";

describe("parseCsv", () => {
  it("parses a simple document with a header", () => {
    const { header, rows } = parseCsv("a,b,c\n1,2,3\n4,5,6\n");
    expect(header).toEqual(["a", "b", "c"]);
    expect(rows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("strips a byte-order mark so the first column name is usable", () => {
    // Without this the first header becomes "\uFEFFregionCode" and every lookup
    // of that column silently fails.
    const { header } = parseCsv("\uFEFFregionCode,title\nSW,House\n");
    expect(header.at(0)).toBe("regionCode");
  });

  it("keeps a comma inside a quoted field", () => {
    const { rows } = parseCsv('title,description\n"Villa, Limbe","A villa, with a view"\n');
    expect(rows.at(0)).toEqual(["Villa, Limbe", "A villa, with a view"]);
  });

  it("keeps a newline inside a quoted field", () => {
    const { rows } = parseCsv('title,description\nVilla,"line one\nline two"\n');
    expect(rows.at(0)?.at(1)).toBe("line one\nline two");
    expect(rows).toHaveLength(1);
  });

  it("unescapes a doubled quote", () => {
    const { rows } = parseCsv('title,description\nVilla,"He said ""hello"""\n');
    expect(rows.at(0)?.at(1)).toBe('He said "hello"');
  });

  it("handles CRLF endings", () => {
    const { header, rows } = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(header).toEqual(["a", "b"]);
    expect(rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles a file with no trailing newline", () => {
    const { rows } = parseCsv("a,b\n1,2");
    expect(rows).toEqual([["1", "2"]]);
  });

  it("trims header whitespace but preserves cell content", () => {
    const { header, rows } = parseCsv(" a , b \n  x  , y \n");
    expect(header).toEqual(["a", "b"]);
    // Data cells are not trimmed by the parser; the importer trims per column so
    // a description keeps its intentional leading space if any.
    expect(rows.at(0)?.at(0)).toBe("  x  ");
  });

  it("reports a row with the wrong number of cells instead of throwing", () => {
    const { rows, ragged } = parseCsv("a,b,c\n1,2,3\n4,5\n6,7,8\n");
    expect(rows).toEqual([
      ["1", "2", "3"],
      ["6", "7", "8"],
    ]);
    expect(ragged).toEqual([{ line: 3, cells: 2 }]);
  });

  it("rejects a duplicate column name", () => {
    expect(() => parseCsv("a,b,a\n1,2,3\n")).toThrow(CsvParseError);
    expect(() => parseCsv("a,b,a\n1,2,3\n")).toThrow(/Duplicate column/);
  });

  it("rejects an empty document", () => {
    expect(() => parseCsv("")).toThrow(/empty/i);
    expect(() => parseCsv("   \n  ")).toThrow(/empty/i);
  });

  it("rejects an unterminated quoted field", () => {
    expect(() => parseCsv('a,b\n"unclosed,2\n')).toThrow(/Unterminated/);
  });

  it("treats a quote mid-field as a literal, matching spreadsheet exports", () => {
    const { rows } = parseCsv('a,b\n12" pipe,2\n');
    expect(rows.at(0)?.at(0)).toBe('12" pipe');
  });

  it("reports the correct source line for a ragged row after a multi-line field", () => {
    // The record on line 2 spans lines 2 and 3, so the bad row is on line 4.
    const { ragged } = parseCsv('a,b,c\n"x\ny",2,3\n1,2\n');
    expect(ragged).toEqual([{ line: 4, cells: 2 }]);
  });

  it("ignores a blank trailing line", () => {
    const { rows, ragged } = parseCsv("a,b\n1,2\n\n");
    expect(rows).toEqual([["1", "2"]]);
    expect(ragged).toEqual([]);
  });
});

describe("parseListCell", () => {
  it("splits on a pipe and trims", () => {
    expect(parseListCell("sea view | fenced | solar")).toEqual([
      "sea view",
      "fenced",
      "solar",
    ]);
  });

  it("drops empty entries from a trailing separator", () => {
    expect(parseListCell("a||b|")).toEqual(["a", "b"]);
  });

  it("returns an empty list for an empty cell", () => {
    expect(parseListCell("")).toEqual([]);
  });

  it("preserves a comma, which is the CSV delimiter and not the list separator", () => {
    expect(parseListCell("sea view, west facing|fenced")).toEqual([
      "sea view, west facing",
      "fenced",
    ]);
  });
});
