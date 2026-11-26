import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentContacts } from "@/components/real-estate/AgentContacts";
import { REAL_ESTATE_AGENT_PHONES } from "@/lib/config/site";

describe("AgentContacts", () => {
  it("renders every published agent number as a tel link", () => {
    render(<AgentContacts locale="en" />);

    expect(
      screen.getByRole("heading", {
        name: "Talk to a KC Technology agent",
      }),
    ).toBeInTheDocument();

    for (const phone of REAL_ESTATE_AGENT_PHONES) {
      const link = screen.getByRole("link", { name: `Call ${phone.label}` });
      expect(link).toHaveAttribute("href", `tel:${phone.tel}`);
      expect(link).toHaveTextContent(phone.label);
    }
  });

  it("renders the French copy and keeps the dial links", () => {
    render(<AgentContacts locale="fr" />);

    expect(
      screen.getByRole("heading", {
        name: "Parlez à un agent KC Technology",
      }),
    ).toBeInTheDocument();

    for (const phone of REAL_ESTATE_AGENT_PHONES) {
      expect(
        screen.getByRole("link", { name: `Appeler ${phone.label}` }),
      ).toHaveAttribute("href", `tel:${phone.tel}`);
    }
  });
});
