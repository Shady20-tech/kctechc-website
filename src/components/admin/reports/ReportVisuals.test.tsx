import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ReportBarChart,
  ReportHighlights,
  ReportInsights,
  ReportKpi,
  ReportTrendChart,
} from "./ReportVisuals";

describe("ReportKpi", () => {
  it("renders the figure and its hint", () => {
    render(
      <ReportKpi
        metric={{
          label: "Confirmed revenue",
          value: "350 000 FCFA",
          hint: "3 paid orders",
          tone: "positive",
        }}
      />,
    );
    expect(screen.getByText("Confirmed revenue")).toBeInTheDocument();
    expect(screen.getByText("350 000 FCFA")).toBeInTheDocument();
    expect(screen.getByText("3 paid orders")).toBeInTheDocument();
  });
});

describe("ReportBarChart", () => {
  it("shows every label and formatted value", () => {
    render(
      <ReportBarChart
        title="Enquiries by department"
        bars={[
          { label: "Digital Marketing", value: 4, meta: "50% replied" },
          { label: "Real Estate", value: 2 },
        ]}
        formatValue={(value) => `${value} enquiries`}
        emptyMessage="Nothing recorded"
      />,
    );
    expect(screen.getByText("Digital Marketing")).toBeInTheDocument();
    expect(screen.getByText("4 enquiries")).toBeInTheDocument();
    expect(screen.getByText("50% replied")).toBeInTheDocument();
    expect(screen.queryByText("Nothing recorded")).not.toBeInTheDocument();
  });

  it("says so when there is no data instead of drawing an empty scale", () => {
    render(
      <ReportBarChart
        title="Enquiries by department"
        bars={[]}
        emptyMessage="Nothing recorded"
      />,
    );
    expect(screen.getByText("Nothing recorded")).toBeInTheDocument();
  });
});

describe("ReportTrendChart", () => {
  it("keeps the figures available to a screen reader", () => {
    render(
      <ReportTrendChart
        title="Daily revenue"
        points={[
          { label: "Nov 24", accessibleLabel: "24 Nov 2026", value: 100 },
          { label: "Nov 25", accessibleLabel: "25 Nov 2026", value: 250 },
        ]}
        formatValue={(value) => `${value} FCFA`}
        emptyMessage="Nothing recorded"
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /24 Nov 2026 100 FCFA.*25 Nov 2026 250 FCFA/,
    );
    expect(screen.getByText("24 Nov 2026: 100 FCFA")).toBeInTheDocument();
  });
});

describe("ReportInsights", () => {
  it("renders observations only when there are any", () => {
    const { rerender } = render(
      <ReportInsights
        heading="What the numbers say"
        intro="Observations"
        items={[
          {
            title: "Orders need confirmation",
            body: "2 orders await payment.",
            tone: "warning",
          },
        ]}
        emptyMessage="Not enough data"
      />,
    );
    expect(screen.getByText("2 orders await payment.")).toBeInTheDocument();

    rerender(
      <ReportInsights
        heading="What the numbers say"
        intro="Observations"
        items={[]}
        emptyMessage="Not enough data"
      />,
    );
    expect(screen.getByText("Not enough data")).toBeInTheDocument();
  });
});

describe("ReportHighlights", () => {
  it("links a dashboard block to the full report", () => {
    render(
      <ReportHighlights
        heading="Department pulse"
        intro="Catalogue health"
        metrics={[{ label: "Published share", value: "80%" }]}
        href="/admin/reports"
        linkLabel="View reports"
      />,
    );
    expect(screen.getByText("Published share")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View reports/ })).toHaveAttribute(
      "href",
      "/admin/reports",
    );
  });
});
