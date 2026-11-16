"use server";

import { revalidatePath } from "next/cache";

import { getAuthState } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { profileResidencySchema } from "@/lib/validation/membership";

/**
 * The customer's own residency details.
 *
 * Writes with the session client, so `profiles_update_own` is the control: a user
 * may edit their own row and nothing else, and the `forbid_self_role_change`
 * trigger keeps `role` pinned even though this action touches the same table. The
 * action deliberately does not send `role` at all — sending it, even unchanged,
 * would be a write this module has no business making.
 *
 * `profile_completed_at` is not written here either. It is derived by the
 * `sync_profile_completion` trigger from the columns this action sets, so the
 * completeness flag can never disagree with the data it describes.
 */

export type ProfileResidencyState =
  | { ok: true }
  | { ok: false; error: string; fields?: Record<string, string> };

export async function updateProfileResidencyAction(
  _previous: ProfileResidencyState | null,
  formData: FormData,
): Promise<ProfileResidencyState> {
  const auth = await getAuthState();
  if (auth.status === "unconfigured")
    return { ok: false, error: "unconfigured" };
  if (auth.status !== "authenticated" || !auth.profile) {
    return { ok: false, error: "unauthenticated" };
  }

  const parsed = profileResidencySchema.safeParse({
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    countryOfResidence: String(formData.get("countryOfResidence") ?? ""),
    countryIsoCode: String(formData.get("countryIsoCode") ?? ""),
    city: String(formData.get("city") ?? ""),
    regionId: String(formData.get("regionId") ?? ""),
    permanentResidency: formData.get("permanentResidency") === "on",
  });

  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return { ok: false, error: "invalid", fields };
  }

  const input = parsed.data;
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "unconfigured" };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName,
      phone: input.phone || null,
      country_of_residence: input.countryOfResidence,
      country_iso_code: input.countryIsoCode || null,
      city: input.city || null,
      // A region is only meaningful for a Cameroon resident. The form hides the
      // field for any other country; clearing it here as well means a stale value
      // from a previous country cannot survive a change of residence — and the
      // `profiles_region_requires_cameroon` constraint would refuse it anyway.
      region_id: input.countryIsoCode === "CM" ? input.regionId || null : null,
      permanent_residency: input.permanentResidency,
    })
    .eq("id", auth.profile.id);

  if (error) {
    // The country/region relationship is a database constraint; surfacing it as a
    // field error is more useful than a generic failure, and it is the one
    // constraint this form can plausibly trip.
    if ((error.message ?? "").includes("profiles_region_requires_cameroon")) {
      return {
        ok: false,
        error: "invalid",
        fields: { regionId: "invalid" },
      };
    }
    return { ok: false, error: "write_failed" };
  }

  revalidatePath("/en/account");
  revalidatePath("/fr/account");
  revalidatePath("/admin/profile");

  return { ok: true };
}
