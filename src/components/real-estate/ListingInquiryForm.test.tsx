import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ListingInquiryForm,
  type ListingInquiryLabels,
} from "@/components/real-estate/ListingInquiryForm";
import { createTranslator } from "@/lib/i18n/translator";

/**
 * The property-enquiry "purpose of acquisition" control.
 *
 * The field exists so the responsible agent knows *why* a visitor wants the
 * property without reading the free-text message. What matters is that the
 * control is present, offers the closed set the database accepts, is optional,
 * and is localized — a purpose only one locale can answer is not a field.
 */

function labelsFor(locale: "en" | "fr"): ListingInquiryLabels {
  const t = createTranslator(locale).t;
  return {
    heading: t("realEstate.inquiry.heading"),
    intro: t("realEstate.listing.inquiryIntro"),
    nameLabel: t("realEstate.inquiry.nameLabel"),
    namePlaceholder: t("realEstate.inquiry.nameLabel"),
    emailLabel: t("realEstate.inquiry.emailLabel"),
    emailPlaceholder: t("realEstate.inquiry.emailLabel"),
    phoneLabel: t("realEstate.inquiry.phoneLabel"),
    phonePlaceholder: t("realEstate.inquiry.phoneLabel"),
    phoneHint: t("realEstate.inquiry.phoneLabel"),
    purposeLabel: t("realEstate.inquiry.purposeLabel"),
    purposeHint: t("realEstate.inquiry.purposeHint"),
    purposeNotStated: t("realEstate.inquiry.purposeNotStated"),
    purposeResidence: t("realEstate.acquisitionPurpose.residence"),
    purposeInvestment: t("realEstate.acquisitionPurpose.investment"),
    purposeBusiness: t("realEstate.acquisitionPurpose.business"),
    purposeOther: t("realEstate.acquisitionPurpose.other"),
    messageLabel: t("realEstate.inquiry.messageLabel"),
    messagePlaceholder: t("realEstate.inquiry.messageHint"),
    messageHint: t("realEstate.inquiry.messageHint"),
    viewingLabel: t("realEstate.listing.viewingCta"),
    viewingHint: t("realEstate.listing.inquiryIntro"),
    consentLabel: t("contact.consentLabel"),
    submit: t("realEstate.inquiry.submit"),
    submitting: t("realEstate.inquiry.sending"),
    successTitle: t("realEstate.inquiry.sentHeading"),
    successBody: t("realEstate.inquiry.sentBody"),
    referenceLabel: t("realEstate.listing.referenceLabel"),
    errorTitle: t("realEstate.inquiry.errorHeading"),
    errorBody: t("realEstate.inquiry.errors.invalid"),
    errorSummaryHeading: t("a11y.errorSummary"),
    rateLimitedTitle: t("realEstate.inquiry.errorHeading"),
    rateLimitedBody: t("realEstate.inquiry.errors.rate_limited"),
    unavailableTitle: t("realEstate.inquiry.errorHeading"),
    unavailableBody: t("realEstate.inquiry.errors.unconfigured"),
  };
}

function setup(locale: "en" | "fr" = "en") {
  return render(
    <ListingInquiryForm
      listingId="0f8fad5b-d9cb-469f-a165-70867728950e"
      locale={locale}
      labels={labelsFor(locale)}
      validationMessages={{
        required: "required",
        tooLong: "tooLong",
        tooShort: "tooShort",
        invalidPhone: "invalidPhone",
        consentRequired: "consentRequired",
      }}
    />,
  );
}

describe("ListingInquiryForm acquisition purpose", () => {
  it("renders a labelled purpose select named acquisitionPurpose", () => {
    setup();
    const select = screen.getByLabelText("Purpose of acquisition");
    expect(select).toHaveAttribute("name", "acquisitionPurpose");
    expect(select.tagName).toBe("SELECT");
  });

  it("offers the closed set the database accepts, plus a not-stated option", () => {
    setup();
    const select = screen.getByLabelText("Purpose of acquisition");
    const values = Array.from(select.querySelectorAll("option")).map((option) =>
      option.getAttribute("value"),
    );
    // The empty value is the "prefer not to say" option; the rest are the enum.
    expect(values).toEqual([
      "",
      "residence",
      "investment",
      "business",
      "other",
    ]);
  });

  it("does not require an answer, so an enquiry is never blocked on it", () => {
    setup();
    expect(screen.getByLabelText("Purpose of acquisition")).not.toBeRequired();
  });

  it("localizes the label and every option in French", () => {
    setup("fr");
    const select = screen.getByLabelText("Objet de l'acquisition");
    const text = Array.from(select.querySelectorAll("option")).map(
      (option) => option.textContent,
    );
    expect(text).toEqual([
      "Je préfère ne pas le dire",
      "Une résidence pour y vivre",
      "Un investissement",
      "Des locaux professionnels",
      "Autre chose",
    ]);
  });
});
