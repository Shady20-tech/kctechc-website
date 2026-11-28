import { act, fireEvent, render, screen } from "@testing-library/react";
import { useActionState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FormStateKeeper } from "./FormStateKeeper";

function Form({ alert }: { alert?: string }) {
  return (
    <form method="post">
      <input type="hidden" name="$ACTION_KEY" value="action-1" />
      <label>
        Title
        <input name="title" defaultValue="Original title" />
      </label>
      <label>
        Notes
        <textarea name="notes" />
      </label>
      <label>
        Newsletter
        <input type="checkbox" name="newsletter" defaultChecked />
      </label>
      <input type="password" name="password" />
      {alert ? <div role="alert">{alert}</div> : null}
    </form>
  );
}

async function frames() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

function ActionForm() {
  const [state, action] = useActionState(
    async () => ({ error: "Title is too short" }),
    { error: "" },
  );
  return (
    <section>
      {state.error ? <div role="alert">{state.error}</div> : null}
      <form action={action}>
        <label>
          Title
          <input name="title" defaultValue="" />
        </label>
      </form>
    </section>
  );
}

describe("FormStateKeeper", () => {
  it("restores values after the form is unmounted and mounted again", async () => {
    const first = render(
      <>
        <FormStateKeeper />
        <Form />
      </>,
    );
    fireEvent.input(screen.getByLabelText("Title"), {
      target: { value: "A draft title" },
    });
    fireEvent.input(screen.getByLabelText("Notes"), {
      target: { value: "A long description" },
    });
    first.unmount();

    render(
      <>
        <FormStateKeeper />
        <Form />
      </>,
    );
    await frames();

    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "A draft title",
    );
    expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).value).toBe(
      "A long description",
    );
  });

  it("restores a form that mounts after a client navigation", async () => {
    function Shell({ showForm }: { showForm: boolean }) {
      return (
        <>
          <FormStateKeeper />
          {showForm ? <Form /> : null}
        </>
      );
    }

    const { rerender } = render(<Shell showForm />);
    fireEvent.input(screen.getByLabelText("Title"), {
      target: { value: "Survives a route change" },
    });

    rerender(<Shell showForm={false} />);
    rerender(<Shell showForm />);
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Survives a route change",
    );
  });

  it("finds the draft after the server-rendered action key is dropped", async () => {
    function HydratingShell({
      hydrated,
      showForm,
    }: {
      hydrated: boolean;
      showForm: boolean;
    }) {
      return (
        <>
          <FormStateKeeper />
          {showForm ? (
            <form>
              {hydrated ? null : (
                <input
                  type="hidden"
                  name="$ACTION_KEY"
                  value="server-action-key"
                />
              )}
              <label>
                Title
                <input name="title" defaultValue="" />
              </label>
            </form>
          ) : null}
        </>
      );
    }

    const { rerender } = render(<HydratingShell hydrated={false} showForm />);
    fireEvent.input(screen.getByLabelText("Title"), {
      target: { value: "Hydrated away" },
    });

    rerender(<HydratingShell hydrated showForm={false} />);
    rerender(<HydratingShell hydrated showForm />);
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Hydrated away",
    );
  });

  it("restores a cleared field and an unchecked default", async () => {
    const first = render(
      <>
        <FormStateKeeper />
        <Form />
      </>,
    );
    fireEvent.input(screen.getByLabelText("Title"), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Newsletter"));
    first.unmount();

    render(
      <>
        <FormStateKeeper />
        <Form />
      </>,
    );
    await frames();

    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("");
    expect(
      (screen.getByLabelText("Newsletter") as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("never persists a password", async () => {
    render(
      <>
        <FormStateKeeper />
        <Form />
      </>,
    );
    fireEvent.input(screen.getByLabelText("Title"), {
      target: { value: "Title" },
    });
    const password = document.querySelector(
      'input[name="password"]',
    ) as HTMLInputElement;
    fireEvent.input(password, { target: { value: "secret-pass" } });

    expect(Object.values(sessionStorage)).not.toContain("secret-pass");
  });

  it("survives the reset React performs after a failing action", async () => {
    render(
      <>
        <FormStateKeeper />
        <ActionForm />
      </>,
    );
    const title = screen.getByLabelText("Title") as HTMLInputElement;
    fireEvent.input(title, { target: { value: "Keep me after error" } });

    await act(async () => {
      document.querySelector("form")!.requestSubmit();
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(title.value).toBe("Keep me after error");
  });

  it("keeps the values when a validation alert appears", async () => {
    const { rerender } = render(
      <>
        <FormStateKeeper />
        <Form />
      </>,
    );
    const title = screen.getByLabelText("Title") as HTMLInputElement;
    fireEvent.input(title, { target: { value: "Keep me" } });
    fireEvent.submit(document.querySelector("form")!);

    rerender(
      <>
        <FormStateKeeper />
        <Form alert="Title is too short" />
      </>,
    );
    await frames();

    expect(title.value).toBe("Keep me");
  });
});
