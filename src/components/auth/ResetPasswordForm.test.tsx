import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, resetPasswordAction } = vi.hoisted(() => ({
  push: vi.fn(),
  resetPasswordAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/auth/actions", () => ({ resetPasswordAction }));

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

beforeEach(() => {
  push.mockReset();
  resetPasswordAction.mockReset();
});

describe("ResetPasswordForm", () => {
  it("pre-fills the email and submits the code and new password", async () => {
    resetPasswordAction.mockResolvedValue({ status: "updated" });

    render(<ResetPasswordForm locale="en" initialEmail="amina@example.com" />);

    expect(screen.getByLabelText(/Email address/i)).toHaveValue(
      "amina@example.com",
    );

    fireEvent.change(screen.getByLabelText(/6-digit verification code/i), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText(/New password/i), {
      target: { value: "new-passphrase" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), {
      target: { value: "new-passphrase" },
    });

    fireEvent.submit(
      screen.getByRole("button", { name: "Set new password" }).closest("form")!,
    );

    await waitFor(() => expect(resetPasswordAction).toHaveBeenCalledTimes(1));

    const formData = resetPasswordAction.mock.calls[0]?.[1] as FormData;
    expect(formData.get("email")).toBe("amina@example.com");
    expect(formData.get("token")).toBe("123456");
    expect(formData.get("password")).toBe("new-passphrase");
    expect(formData.get("confirmPassword")).toBe("new-passphrase");

    await waitFor(() =>
      expect(screen.getByText("Password updated")).toBeInTheDocument(),
    );
  });

  it("shows the invalid-code error returned by the action", async () => {
    resetPasswordAction.mockResolvedValue({
      status: "error",
      errors: { form: "invalidOtp" },
    });

    render(<ResetPasswordForm locale="en" initialEmail="amina@example.com" />);

    fireEvent.submit(
      screen.getByRole("button", { name: "Set new password" }).closest("form")!,
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          "That code is invalid or has expired. Request a new code and try again.",
        ),
      ).toBeInTheDocument(),
    );
  });
});
