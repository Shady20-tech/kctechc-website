import { describe, expect, it } from "vitest";
import { buildMetadata, buildPrivateMetadata } from "@/lib/seo/metadata";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  websiteJsonLd,
} from "@/lib/seo/structured-data";

describe("buildMetadata", () => {
  const base = {
    locale: "fr" as const,
    pathWithoutLocale: "/real-estate",
    title: "Immobilier",
  };

  it("emits a locale-qualified absolute canonical URL", () => {
    const metadata = buildMetadata(base);
    expect(metadata.alternates?.canonical).toContain("/fr/real-estate");
    expect(metadata.alternates?.canonical).toMatch(/^https?:\/\//);
  });

  it("declares reciprocal hreflang alternates including x-default", () => {
    const metadata = buildMetadata(base);
    const languages = metadata.alternates?.languages ?? {};
    expect(Object.keys(languages).sort()).toEqual(["en", "fr", "x-default"]);
  });

  it("allows indexing by default", () => {
    const metadata = buildMetadata(base);
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it("omits locale alternates when noindex is requested", () => {
    const metadata = buildMetadata({ ...base, noindex: true });
    expect(metadata.alternates?.languages).toBeUndefined();
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });
});

describe("buildPrivateMetadata", () => {
  it("always blocks indexing and advertises no alternates", () => {
    const metadata = buildPrivateMetadata("Admin");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
  });
});

describe("organizationJsonLd", () => {
  it("describes the organization using only supplied facts", () => {
    const data = organizationJsonLd("en");
    expect(data["@type"]).toBe("Organization");
    expect(data.name).toBe("KC Technology Corporation");
    expect(data.address).toMatchObject({
      addressLocality: "Limbe",
      addressRegion: "Southwest Region",
      addressCountry: "CM",
    });
  });

  it("does not invent ratings or price information", () => {
    const data = organizationJsonLd("en");
    expect(data.aggregateRating).toBeUndefined();
    expect(data.priceRange).toBeUndefined();
    expect(data.award).toBeUndefined();
  });
});

describe("websiteJsonLd", () => {
  it("links the website to the organization by @id", () => {
    const website = websiteJsonLd("en");
    const organization = organizationJsonLd("en");
    expect((website.publisher as { "@id": string })["@id"]).toBe(
      organization["@id"],
    );
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers items from one in order", () => {
    const data = breadcrumbJsonLd([
      { name: "Home", path: "/en" },
      { name: "Real Estate", path: "/en/real-estate" },
    ]);
    const items = data.itemListElement as { position: number; name: string }[];
    expect(items.map((item) => item.position)).toEqual([1, 2]);
    expect(items[1]?.name).toBe("Real Estate");
  });
});

describe("serializeJsonLd", () => {
  it("escapes angle brackets so content cannot break out of the script tag", () => {
    const serialized = serializeJsonLd({
      name: "</script><img src=x onerror=alert(1)>",
    });
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c");
  });

  it("produces valid JSON that round-trips", () => {
    const payload = { "@type": "Organization", name: "KC Technology" };
    expect(JSON.parse(serializeJsonLd(payload))).toEqual(payload);
  });
});
