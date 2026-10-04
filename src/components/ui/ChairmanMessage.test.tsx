import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChairmanMessage } from "@/components/ui/ChairmanMessage";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * Founder's message.
 *
 * The letter is one message key with blank-line-separated paragraphs. Two things
 * are easy to get wrong and are asserted here: the body must be split into real
 * `<p>` elements (not one blob or a `<br>` chain), and the summary variant must
 * keep the first paragraph and the sign-off while dropping the pillars — that is
 * the difference between the homepage placement and the full letter on `/about`.
 */

function setup(
  locale: "en" | "fr",
  props: Partial<React.ComponentProps<typeof ChairmanMessage>> = {},
) {
  const t = createTranslator(locale).t;
  return render(
    <ChairmanMessage
      locale={locale}
      eyebrow={t("about.leadershipHeading")}
      heading={t("about.chairmanHeading")}
      {...props}
    />,
  );
}

describe("ChairmanMessage", () => {
  it("attributes the letter to the founder in both locales", () => {
    for (const locale of ["en", "fr"] as const) {
      const t = createTranslator(locale).t;
      const { unmount } = setup(locale);
      // The name appears twice on purpose: under the portrait and again at the
      // sign-off, so the letter still ends with the writer's name.
      expect(
        screen.getAllByText(t("about.leaderName")).length,
      ).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText(t("about.leaderRole")).length).toBeGreaterThan(
        0,
      );
      expect(
        screen.getByAltText(t("about.chairmanPortraitAlt")),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("splits the message body into separate paragraphs", () => {
    const t = createTranslator("en").t;
    const { container } = setup("en");
    const paragraphs = container.querySelectorAll("p");
    // The body alone is five paragraphs; the page also renders the eyebrow,
    // heading, role and sign-off, so the count is comfortably above five.
    expect(paragraphs.length).toBeGreaterThan(5);
    // The full text is present, not truncated to one blob.
    expect(
      container.textContent?.includes(
        t("about.leaderBody")
          .split(/\n{2,}/)[0]
          ?.slice(0, 40) ?? "",
      ),
    ).toBe(true);
  });

  it("renders the three pillars and the core values in the full variant", () => {
    const t = createTranslator("en").t;
    setup("en");
    for (const key of [
      "about.chairmanPillar1Title",
      "about.chairmanPillar2Title",
      "about.chairmanPillar3Title",
    ] as const) {
      expect(screen.getByText(t(key))).toBeInTheDocument();
    }
    expect(screen.getByText(t("about.chairmanValues"))).toBeInTheDocument();
  });

  it("keeps the summary short and funnels to the full letter", () => {
    const t = createTranslator("en").t;
    setup("en", {
      variant: "summary",
      ctaHref: "/en/about",
      ctaLabel: t("home.messageCta"),
    });
    // The pillars belong to the full letter only.
    expect(
      screen.queryByText(t("about.chairmanPillar1Title")),
    ).not.toBeInTheDocument();
    // The sign-off stays, so the summary still reads as a letter.
    expect(
      screen.getAllByText(t("about.leaderName")).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole("link", { name: t("home.messageCta") }),
    ).toHaveAttribute("href", "/en/about");
  });

  it("omits the portrait when a second-language rendering asks it to", () => {
    const t = createTranslator("fr").t;
    setup("fr", { showPortrait: false, id: "gateway-chairman-fr" });
    expect(
      screen.queryByAltText(t("about.chairmanPortraitAlt")),
    ).not.toBeInTheDocument();
  });

  it("uses the id it is given for the section heading", () => {
    setup("en", { id: "gateway-chairman-en" });
    expect(
      screen.getByRole("heading", {
        name: createTranslator("en").t("about.chairmanHeading"),
      }),
    ).toHaveAttribute("id", "gateway-chairman-en-heading");
  });
});
