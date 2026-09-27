"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getAuthState } from "@/lib/auth/session";
import { recordAudit } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES, canTransition, type OrderStatus } from "./types";

/**
 * Admin order actions.
 *
 * Authorization is `assertRole(ADMIN_ROLES)` — a non-redirecting check, because a
 * Server Action returning a redirect would be the wrong response shape. It runs
 * before any read or write.
 *
 * **Recording a manual payment is the delicate one.** A bank transfer arrives in
 * the business's account, not through the provider, so nothing can reconcile it
 * automatically and an operator has to confirm it. That confirmation is the only
 * way an order becomes paid without a verified provider result, so it is
 * restricted to admin roles, only accepted for a bank-transfer order, and audited
 * with the acting user's id.
 *
 * The state machine itself lives in the database (the `orders_enforce_transition`
 * trigger, backed by `order_transition_allowed`). These actions set the status and
 * let the trigger reject an illegal move; `canTransition` is checked first only so
 * the admin gets a targeted message instead of a Postgres error.
 */

export type OrderActionState =
  | { status: "idle" }
  | { status: "updated" }
  | { status: "paid_recorded" }
  | { status: "invalid_transition" }
  | { status: "forbidden" }
  | { status: "unconfigured" }
  | { status: "error" };

/**
 * The acting staff member, or a reason they are not permitted.
 *
 * A signed-out and a wrong-role caller get the same response, because telling an
 * anonymous caller they are merely under-privileged leaks that the surface
 * exists.
 */
async function actingAdmin(): Promise<
  { ok: true; actorId: string } | { ok: false; state: OrderActionState }
> {
  try {
    const state = await getAuthState();
    if (state.status === "unconfigured") {
      return { ok: false, state: { status: "unconfigured" } };
    }
    const profile = await assertRole(ADMIN_ROLES);
    return { ok: true, actorId: profile.id };
  } catch {
    return { ok: false, state: { status: "forbidden" } };
  }
}

/** Change an order's status through the state machine. */
export async function changeOrderStatus(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const actor = await actingAdmin();
  if (!actor.ok) return actor.state;

  const orderId = String(formData.get("orderId") ?? "");
  const nextStatus = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);

  if (!orderId || !ORDER_STATUSES.includes(nextStatus as OrderStatus)) {
    return { status: "error" };
  }

  const admin = createAdminClient();
  if (!admin) return { status: "unconfigured" };

  const { data: order } = await admin
    .from("orders")
    .select("id, reference, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { status: "error" };

  const from = order.status as OrderStatus;
  const to = nextStatus as OrderStatus;

  if (!canTransition(from, to)) return { status: "invalid_transition" };

  // Promotion to `paid` must go through `recordManualPayment`, which also writes
  // the payment row. Reaching `paid` here would leave an order marked paid with
  // nothing recorded against it and no money accounted for.
  if (to === "paid") return { status: "invalid_transition" };

  // A cancellation must run `cancel_order`, which also returns the reserved
  // stock. A bare status update would cancel a paid order without releasing its
  // inventory, so the two paths are kept apart rather than merged.
  if (to === "cancelled") {
    const { error } = await admin.rpc("cancel_order", {
      p_order_id: orderId,
      p_actor_id: actor.actorId,
      p_actor_kind: "staff",
      p_note: note || undefined,
    });
    if (error) {
      return error.message.includes("Illegal order transition")
        ? { status: "invalid_transition" }
        : { status: "error" };
    }
    await auditChange(actor.actorId, order.reference, from, to);
    revalidateOrder(orderId, order.reference);
    return { status: "updated" };
  }

  // The transition trigger validates this and stamps the matching timestamp.
  const { error } = await admin
    .from("orders")
    .update({ status: to })
    .eq("id", orderId);

  if (error) {
    if (error.message.includes("Illegal order transition")) {
      return { status: "invalid_transition" };
    }
    return { status: "error" };
  }

  // The timeline is append-only and names the actor, so a status the reports
  // cannot explain has an explanation.
  await admin.from("order_events").insert({
    order_id: orderId,
    event_type: "order_status_changed",
    actor_id: actor.actorId,
    actor_kind: "staff",
    from_status: from,
    to_status: to,
    note: note || undefined,
  });

  await auditChange(actor.actorId, order.reference, from, to);
  revalidateOrder(orderId, order.reference);

  return { status: "updated" };
}

/**
 * Record a bank transfer that has been verified, and mark the order paid.
 *
 * Narrow by design: admin roles only, bank transfer only, from
 * `pending_payment` only, and it writes a `payments` row with
 * `provider = 'manual'` so a report can separate money a provider confirmed from
 * money a human asserted. The amount is read from the order, never the form.
 */
export async function recordManualPayment(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const actor = await actingAdmin();
  if (!actor.ok) return actor.state;

  const orderId = String(formData.get("orderId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);

  if (!orderId) return { status: "error" };

  const admin = createAdminClient();
  if (!admin) return { status: "unconfigured" };

  const { data: order } = await admin
    .from("orders")
    .select("id, reference, status, total_minor, currency, payment_method")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { status: "error" };

  // An order meant to be paid by card must be settled by the provider. Letting it
  // be confirmed by hand would release goods against a card payment that may
  // still fail.
  if (order.payment_method !== "bank_transfer") {
    return { status: "invalid_transition" };
  }
  if (order.status !== "pending_payment") {
    return { status: "invalid_transition" };
  }

  // The unique `provider_tx_ref` makes a double click a no-op rather than a
  // second payment row: the second insert conflicts and is reported as such.
  const { data: payment, error: insertError } = await admin
    .from("payments")
    .insert({
      order_id: order.id,
      status: "succeeded",
      method: "bank_transfer",
      // `manual` (not `flutterwave`) marks this as operator-confirmed.
      provider: "manual",
      amount_minor: order.total_minor,
      currency: order.currency,
      provider_tx_ref: `MANUAL-${order.reference}`,
      idempotency_key: `manual-${order.id}`,
      captured_at: new Date().toISOString(),
      provider_metadata: { recorded_by: actor.actorId, note: note || null },
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    return insertError?.message.includes("duplicate")
      ? { status: "invalid_transition" }
      : { status: "error" };
  }

  // Applied through the same function the provider path uses, so both routes
  // compute the order's paid totals identically.
  const { error: applyError } = await admin.rpc("apply_payment_result", {
    p_payment_id: payment.id,
    p_status: "succeeded",
    p_provider_metadata: { manual: true, recorded_by: actor.actorId },
  });

  if (applyError) return { status: "error" };

  if (note) {
    await admin.from("order_events").insert({
      order_id: order.id,
      event_type: "payment_manual_recorded",
      actor_id: actor.actorId,
      actor_kind: "staff",
      note,
    });
  }

  await recordAudit({
    actorId: actor.actorId,
    action: "payment_state_changed",
    entityType: "order",
    entityId: order.reference,
    metadata: {
      outcome: "manual_payment_recorded",
      amount_minor: order.total_minor,
      currency: order.currency,
    },
  });

  revalidateOrder(order.id, order.reference);
  return { status: "paid_recorded" };
}

async function auditChange(
  actorId: string,
  reference: string,
  from: OrderStatus,
  to: OrderStatus,
): Promise<void> {
  await recordAudit({
    actorId,
    action: "payment_state_changed",
    entityType: "order",
    entityId: reference,
    metadata: { outcome: "status_changed", from, to },
  });
}

function revalidateOrder(orderId: string, reference: string): void {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  for (const locale of ["en", "fr"]) {
    revalidatePath(`/${locale}/digital-marketing/store/orders`);
    revalidatePath(`/${locale}/digital-marketing/store/orders/${reference}`);
  }
}
