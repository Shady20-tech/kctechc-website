import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { forgotPasswordAction } = vi.hoisted(() => ({
  forgotPasswordAction: vi.fn(),
}));

vi.mock("@/lib/auth/actions", () => ({ forgotPasswordAction }));

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

beforeEach(() => {
  forgotPasswordAction.mockReset();
});

describe("ForgotPasswordForm", () => {
  it("disables the submit control while loading and sends only one request", async () => {
    let resolveAction: (state: unknown) => void = () => {};
    forgotPasswordAction.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );

    render(<ForgotPasswordForm locale="en" />);

    const form = screen
      .getByRole("button", { name: "Send verification code" })
      .closest("form")!;

    fireEvent.submit(form);
    await waitFor(() => expect(forgotPasswordAction).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();

    fireEvent.submit(form);
    expect(forgotPasswordAction).toHaveBeenCalledTimes(1);

    resolveAction({ status: "error", messageKey: "auth.errorBody" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Send verification code" }),
      ).toBeEnabled(),
    );
  });

  it("renders the error state returned by the action", async () => {
    forgotPasswordAction.mockResolvedValue({
      status: "error",
      messageKey: "auth.invalidEmail",
    });

    render(<ForgotPasswordForm locale="en" />);

    fireEvent.submit(
      screen
        .getByRole("button", { name: "Send verification code" })
        .closest("form")!,
    );

    await waitFor(() =>
      expect(
        screen.getByText("Enter a valid email address."),
      ).toBeInTheDocument(),
    );
  });
});
