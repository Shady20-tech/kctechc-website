import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DepartmentsMenu } from "@/components/layout/DepartmentsMenu";

const items = [
  { href: "/en/digital-marketing", label: "Digital Marketing" },
  { href: "/en/electrical-services", label: "Electrical Services" },
  { href: "/en/real-estate", label: "Real Estate" },
];

function setup() {
  return render(
    <DepartmentsMenu
      label="Departments"
      ariaLabel="Departments menu"
      items={items}
    />,
  );
}

const trigger = () => screen.getByRole("button", { name: /departments/i });

describe("DepartmentsMenu", () => {
  it("keeps the department links in the DOM while closed", () => {
    setup();

    // Crawlability depends on the panel being hidden with CSS rather than
    // unmounted, so the anchors must exist before the menu is ever opened.
    for (const item of items) {
      expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
    }
  });

  it("starts collapsed", () => {
    setup();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("points the trigger at the panel it controls", () => {
    setup();
    const controls = trigger().getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls!)).toBeInTheDocument();
  });

  it("toggles aria-expanded on click", () => {
    setup();

    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape", () => {
    setup();

    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when clicking outside the menu", () => {
    setup();

    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseDown(document.body);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("labels the panel for assistive technology", () => {
    setup();
    expect(screen.getByLabelText("Departments menu")).toBeInTheDocument();
  });
});
