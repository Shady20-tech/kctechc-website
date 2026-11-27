import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthShell } from "./AuthShell";

describe("AuthShell section switcher", () => {
  it("shows Register Here above the sign-in heading and marks sign-in active", () => {
    render(
      <AuthShell
        locale="en"
        mode="signin"
        eyebrow="Welcome back"
        heading="Sign in"
        intro="Sign in to continue."
      >
        <p>form</p>
      </AuthShell>,
    );

    expect(screen.getByRole("link", { name: "Register Here" })).toHaveAttribute(
      "href",
      "/en/sign-up",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows Sign in above the register heading and marks register active", () => {
    render(
      <AuthShell
        locale="fr"
        mode="signup"
        eyebrow="Commencez ici"
        heading="Créer votre compte"
        intro="Créez un compte."
      >
        <p>form</p>
      </AuthShell>,
    );

    expect(screen.getByRole("link", { name: "Connexion" })).toHaveAttribute(
      "href",
      "/fr/login",
    );
    expect(
      screen.getByRole("link", { name: "Inscrivez-vous ici" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("replaces the two-way switcher with a sign-in return link on recovery pages", () => {
    render(
      <AuthShell
        locale="en"
        mode="recovery"
        eyebrow="Account recovery"
        heading="Reset your password"
        intro="Enter your email."
      >
        <p>form</p>
      </AuthShell>,
    );

    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/en/login");
    expect(screen.queryByRole("link", { name: "Register Here" })).toBeNull();
  });
});
