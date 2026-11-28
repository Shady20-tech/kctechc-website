import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GeographyFields } from "./GeographyFields";

const geography = [
  {
    id: "region-sw",
    name: "Southwest",
    code: "SW",
    divisions: [
      {
        id: "division-meme",
        name: "Meme",
        code: "CM006",
        subdivisions: [
          { id: "subdivision-buea", name: "Buea", code: "CM006001" },
          { id: "subdivision-tiko", name: "Tiko", code: "CM006002" },
        ],
      },
      {
        id: "division-fako",
        name: "Fako",
        code: "CM007",
        subdivisions: [
          { id: "subdivision-limbe", name: "Limbe", code: "CM007001" },
        ],
      },
    ],
  },
  {
    id: "region-littoral",
    name: "Littoral",
    code: "LT",
    divisions: [
      {
        id: "division-wouri",
        name: "Wouri",
        code: "CM005",
        subdivisions: [
          { id: "subdivision-douala", name: "Douala", code: "CM005001" },
        ],
      },
    ],
  },
] as const;

describe("GeographyFields", () => {
  it("shows only the divisions of the selected region", () => {
    render(<GeographyFields geography={geography} locale="en" />);

    fireEvent.change(screen.getByLabelText(/^Region/i), {
      target: { value: "region-sw" },
    });

    expect(screen.getByRole("option", { name: "Meme" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Fako" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Wouri" })).toBeNull();
  });

  it("shows only the subdivisions of the selected division", () => {
    render(<GeographyFields geography={geography} locale="en" />);

    fireEvent.change(screen.getByLabelText(/^Region/i), {
      target: { value: "region-sw" },
    });
    fireEvent.change(screen.getByLabelText(/^Division/i), {
      target: { value: "division-meme" },
    });

    expect(screen.getByRole("option", { name: "Buea" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Tiko" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Limbe" })).toBeNull();
  });

  it("clears the children when the region changes", () => {
    render(
      <GeographyFields
        geography={geography}
        locale="en"
        initialRegionId="region-sw"
        initialDivisionId="division-meme"
        initialSubdivisionId="subdivision-buea"
        initialLocality="Buea"
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Region/i), {
      target: { value: "region-littoral" },
    });

    expect(
      (screen.getByLabelText(/^Division/i) as HTMLSelectElement).value,
    ).toBe("");
    expect(
      (screen.getByLabelText(/^Subdivision/i) as HTMLSelectElement).value,
    ).toBe("");
    expect(screen.queryByRole("option", { name: "Buea" })).toBeNull();
  });

  it("derives the posted locality from the selected level", () => {
    render(<GeographyFields geography={geography} locale="en" />);

    fireEvent.change(screen.getByLabelText(/^Region/i), {
      target: { value: "region-sw" },
    });
    fireEvent.change(screen.getByLabelText(/^Division/i), {
      target: { value: "division-meme" },
    });
    fireEvent.change(screen.getByLabelText(/^Subdivision/i), {
      target: { value: "subdivision-tiko" },
    });

    expect(
      (document.querySelector('input[name="locality"]') as HTMLInputElement)
        .value,
    ).toBe("Tiko");
  });
});
