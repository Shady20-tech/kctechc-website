import { describe, expect, it } from "vitest";
import { descriptionBlocks } from "./description";

describe("descriptionBlocks", () => {
  it("returns one paragraph for a single line", () => {
    expect(descriptionBlocks("A 14-inch business laptop.")).toEqual([
      { kind: "paragraph", text: "A 14-inch business laptop." },
    ]);
  });

  it("splits paragraphs on blank lines", () => {
    expect(descriptionBlocks("First para.\n\nSecond para.")).toEqual([
      { kind: "paragraph", text: "First para." },
      { kind: "paragraph", text: "Second para." },
    ]);
  });

  it("joins wrapped lines within one paragraph", () => {
    expect(descriptionBlocks("A long line\nwrapped over two.")).toEqual([
      { kind: "paragraph", text: "A long line wrapped over two." },
    ]);
  });

  it("collects a bullet run into a single list", () => {
    const input = "Includes:\n- Inverter\n- Two batteries\n- Panels";
    expect(descriptionBlocks(input)).toEqual([
      { kind: "paragraph", text: "Includes:" },
      { kind: "list", items: ["Inverter", "Two batteries", "Panels"] },
    ]);
  });

  it("recognises *, - and bullet characters", () => {
    expect(descriptionBlocks("- a\n* b\n• c")).toEqual([
      { kind: "list", items: ["a", "b", "c"] },
    ]);
  });

  it("keeps a list that follows a paragraph as its own block", () => {
    const input = "Intro line.\n- one\n- two";
    expect(descriptionBlocks(input)).toEqual([
      { kind: "paragraph", text: "Intro line." },
      { kind: "list", items: ["one", "two"] },
    ]);
  });

  it("does not interpret HTML", () => {
    const blocks = descriptionBlocks("<script>alert(1)</script>");
    expect(blocks).toEqual([
      { kind: "paragraph", text: "<script>alert(1)</script>" },
    ]);
  });

  it("ignores blank input", () => {
    expect(descriptionBlocks("   \n\n  ")).toEqual([]);
  });

  it("parses the seeded solar package description shape", () => {
    const input =
      "For lighting, a TV, a fridge, fans, routers and laptops.\n\n" +
      "Includes: E-SUN 3KVA/24V off-grid inverter; 2x LI MAX battery.";
    expect(descriptionBlocks(input)).toEqual([
      {
        kind: "paragraph",
        text: "For lighting, a TV, a fridge, fans, routers and laptops.",
      },
      {
        kind: "paragraph",
        text: "Includes: E-SUN 3KVA/24V off-grid inverter; 2x LI MAX battery.",
      },
    ]);
  });
});
