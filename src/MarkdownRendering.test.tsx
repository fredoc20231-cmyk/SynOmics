import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MarkdownBlock,
  normalizeDisplayMarkdown,
  safeMarkdownHref,
  splitAcademicFigureSegments,
} from "@ui/components/MarkdownBlock";

describe("professional Markdown rendering", () => {
  it("renders prose, emphasis, lists, code, quotes, tables, links, and notation", () => {
    const markup = renderToStaticMarkup(
      <MarkdownBlock
        text={`# Heading

Paragraph with **bold**, *italic*, \`inline code\`, and $p < 0.05$.

1. First
2. Second

- One
- Two

> A restrained quotation.

| Gene | Role |
| --- | --- |
| BRCA1 | Repair |

\`\`\`python
print("hello")
\`\`\`

[PubMed](https://pubmed.ncbi.nlm.nih.gov/)`}
      />,
    );

    expect(markup).toContain("<h1");
    expect(markup).toContain("<strong>bold</strong>");
    expect(markup).toContain("<em>italic</em>");
    expect(markup).toContain("<ol");
    expect(markup).toContain("<ul");
    expect(markup).toContain("<blockquote");
    expect(markup).toContain("<table");
    expect(markup).toContain("<pre");
    expect(markup).toContain('href="https://pubmed.ncbi.nlm.nih.gov/"');
    expect(markup).not.toContain("**bold**");
  });

  it("renders FIGURE lines as explicitly non-empirical conceptual schematics", () => {
    const text = [
      "## Mechanism",
      "Evidence-backed prose remains ordinary Markdown.",
      "FIGURE: DNA damage → end resection → RAD51 loading → strand invasion → repair synthesis",
      "The schematic is explanatory, not a measurement.",
    ].join("\n\n");
    const segments = splitAcademicFigureSegments(text);
    const markup = renderToStaticMarkup(<MarkdownBlock text={text} />);

    expect(segments.some((segment) => segment.kind === "conceptual_figure")).toBe(true);
    expect(markup).toContain('data-testid="academic-conceptual-figure"');
    expect(markup).toContain("DNA damage");
    expect(markup).toContain("repair synthesis");
    expect(markup).toContain("AI-generated conceptual illustration; not empirical data.");
    expect(markup).not.toContain("FIGURE:");
  });

  it("never converts FIGURE syntax inside fenced code into a visual", () => {
    const text = [
      "```text",
      "FIGURE: A -> B -> C",
      "```",
    ].join("\n");
    const segments = splitAcademicFigureSegments(text);
    const markup = renderToStaticMarkup(<MarkdownBlock text={text} />);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe("markdown");
    expect(markup).not.toContain('data-testid="academic-conceptual-figure"');
    expect(markup).toContain("FIGURE: A -&gt; B -&gt; C");
  });

  it("repairs the malformed m6A structural escapes without touching fenced code", () => {
    const malformed = [
      "\\### Step 1: Data acquisition and QC",
      "",
      "\\1. **Raw data**",
      "   \\- Obtain paired-end FASTQ files.",
      "\\2. **Quality control**",
      "   \\- Run FastQC.",
      "   \\- Aggregate reports with MultiQC.",
      "",
      "\\### Step 2: Alignment",
      "",
      "\\```bash",
      "STAR --runThreadN 8",
      "echo \\#### keep-this-literal",
      "```",
    ].join("\n");
    const normalized = normalizeDisplayMarkdown(malformed);
    const markup = renderToStaticMarkup(<MarkdownBlock text={malformed} />);

    expect(normalized).toContain("### Step 1: Data acquisition and QC");
    expect(normalized).toContain("echo \\#### keep-this-literal");
    expect(markup).toContain("<h3");
    expect(markup).toContain("<ol");
    expect(markup).toContain("<ul");
    expect(markup).toContain("<pre");
    expect(markup).toContain("STAR --runThreadN 8");
    expect(markup).not.toContain("\\### Step 1");
    expect(markup).not.toContain("\\- Obtain");
    expect(markup).not.toContain("\\```bash");
    expect(markup).not.toContain(">1. ");
  });

  it("never executes or links javascript:, data:text/html, or raw HTML injection", () => {
    expect(safeMarkdownHref("javascript:alert(1)")).toBeNull();
    expect(safeMarkdownHref("data:text/html,<script>alert(1)</script>")).toBeNull();
    const markup = renderToStaticMarkup(
      <MarkdownBlock
        text={`[ok](https://example.org)

[bad](javascript:alert(1))

<img src=x onerror=alert(1)>

<script>alert(1)</script>`}
      />,
    );
    expect(markup).toContain('href="https://example.org"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).not.toContain("javascript:");
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("onerror");
    expect(markup).not.toContain("<img");
  });
});
