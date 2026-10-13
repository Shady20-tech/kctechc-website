import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "@/components/content/RichText";

describe("RichText", () => {
  it("renders paragraphs and headings without adding a second h1", () => {
    render(<RichText body={"Intro paragraph.\n\n## A section\n\nMore text."} />);

    expect(screen.getByText("Intro paragraph.")).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 2, name: "A section" });
    expect(heading).toBeInTheDocument();
    // The page owns the single h1; article bodies must never introduce one.
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("renders unordered and ordered lists", () => {
    const { container } = render(<RichText body={"- one\n- two\n\n1. first\n2. second"} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(container.querySelectorAll("ul")).toHaveLength(1);
    expect(container.querySelectorAll("ol")).toHaveLength(1);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("renders bold, italic and block quotes", () => {
    render(<RichText body={"> Quoted line\n\n**bold** and *italic*"} />);

    expect(screen.getByText("Quoted line")).toBeInTheDocument();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("italic").tagName).toBe("EM");
  });

  it("escapes raw HTML rather than executing it", () => {
    const { container } = render(
      <RichText body={"<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>"} />,
    );

    // No script or image element may be created from body text.
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("refuses to make a javascript: URL clickable", () => {
    render(<RichText body={"[click me](javascript:alert(1))"} />);

    expect(screen.queryByRole("link")).toBeNull();
    // The visible text survives so the reader sees what was written.
    expect(screen.getByText("click me")).toBeInTheDocument();
  });

  it("refuses a protocol-relative URL", () => {
    render(<RichText body={"[x](//evil.example.com)"} />);

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("makes site-relative links internal anchors", () => {
    render(<RichText body={"[Contact](/en/contact)"} />);

    const link = screen.getByRole("link", { name: "Contact" });
    expect(link).toHaveAttribute("href", "/en/contact");
    expect(link).not.toHaveAttribute("target");
  });

  it("marks external links as safe to open", () => {
    render(<RichText body={"[Site](https://example.com)"} />);

    const link = screen.getByRole("link", { name: "Site" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("returns nothing for an empty body", () => {
    const { container } = render(<RichText body="" />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("renders a standalone image line with its alt text as a caption", () => {
    const { container } = render(
      <RichText
        body={"Intro.\n\n![A rooftop array](/hero/corporate-v3.jpg)\n\nAfter."}
      />,
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("alt", "A rooftop array");
    expect(img).toHaveAttribute("src", "/hero/corporate-v3.jpg");
    // The alt text is also shown as a caption, so the description is visible.
    expect(screen.getByText("A rooftop array")).toBeInTheDocument();
  });

  it("accepts an https image source", () => {
    const { container } = render(
      <RichText body={"![Photo](https://example.com/photo.jpg)"} />,
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("refuses to render an image from an unsafe scheme", () => {
    const { container } = render(
      <RichText body={"![Click](data:text/html;base64,AAAA)"} />,
    );

    // No img element may be created from a non-http(s) target, and the alt text
    // survives so the author's words are still visible.
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Click")).toBeInTheDocument();
  });

  it("refuses a protocol-relative image source", () => {
    const { container } = render(
      <RichText body={"![x](//evil.example.com/pic.jpg)"} />,
    );

    expect(container.querySelector("img")).toBeNull();
  });

  it("does not turn inline image syntax inside a paragraph into a link", () => {
    const { container } = render(
      <RichText body={"See ![this](https://example.com/x.jpg) inline."} />,
    );

    // An image is a block; mid-paragraph image syntax stays literal text rather
    // than becoming a stray "!" plus an anchor.
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.textContent).toContain("![this]");
  });
});
