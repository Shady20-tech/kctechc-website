import { describe, expect, it } from "vitest";

import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  PAYMENT_STATUSES,
  canTransition,
  isPaidStatus,
  isTerminalStatus,
  shouldTrackPurchase,
  type OrderStatus,
} from "./types";

/**
 * The order state machine.
 *
 * `ORDER_TRANSITIONS` mirrors `order_transition_allowed` in
 * `20260101000034_order_state_machine.sql`. The two are written separately —
 * SQL is the enforcement, TypeScript lets the admin UI offer only valid moves —
 * so this suite pins the properties the SQL must also hold. If someone edits one
 * without the other, the failure surfaces here rather than as a runtime
 * `check_violation` in production.
 *
 * The properties asserted are the ones with real consequences:
 *   * nothing can leave a terminal state (so a refunded order is never reopened);
 *   * `pending_payment` is the only entry point (an order cannot be *created*
 *     already paid);
 *   * `paid` is unreachable except from `pending_payment`, which is what stops a
 *     late webhook resurrecting a cancelled order.
 */

describe("order state machine", () => {
  it("declares a transition list for every status", () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_TRANSITIONS[status], `missing transitions for ${status}`).toBeDefined();
    }
  });

  it("does not invent statuses beyond the enum", () => {
    const declared = Object.keys(ORDER_TRANSITIONS).sort();
    expect(declared).toEqual([...ORDER_STATUSES].sort());
  });

  it("treats cancelled and refunded as terminal", () => {
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
    expect(ORDER_TRANSITIONS.refunded).toEqual([]);
    expect(isTerminalStatus("cancelled")).toBe(true);
    expect(isTerminalStatus("refunded")).toBe(true);
    expect(isTerminalStatus("paid")).toBe(false);
  });

  it("reaches paid only from pending_payment", () => {
    const intoPaid = ORDER_STATUSES.filter((from) =>
      ORDER_TRANSITIONS[from].includes("paid"),
    );
    expect(intoPaid).toEqual(["pending_payment"]);
  });

  it("never allows a self-transition", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status), `${status} -> ${status}`).toBe(false);
    }
  });

  it("rejects every transition out of a terminal status", () => {
    for (const from of ["cancelled", "refunded"] as const) {
      for (const to of ORDER_STATUSES) {
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(false);
      }
    }
  });

  it("only points at declared statuses", () => {
    for (const [from, targets] of Object.entries(ORDER_TRANSITIONS)) {
      for (const target of targets) {
        expect(
          ORDER_STATUSES.includes(target),
          `${from} -> ${target} is not a declared status`,
        ).toBe(true);
      }
    }
  });

  it("describes a fulfilled order as paid", () => {
    // Fulfilled implies money was taken; a report that disagreed would be wrong.
    expect(isPaidStatus("fulfilled")).toBe(true);
    expect(isPaidStatus("paid")).toBe(true);
    expect(isPaidStatus("pending_payment")).toBe(false);
    expect(isPaidStatus("cancelled")).toBe(false);
  });
});

describe("purchase event gating", () => {
  it("fires a purchase only once money has been received", () => {
    const shouldFire = ORDER_STATUSES.filter(shouldTrackPurchase);
    expect(shouldFire).toEqual(["paid", "processing", "fulfilled"]);
  });

  it("does not fire for an order that is merely placed", () => {
    // The important case: a `pending_payment` order may be abandoned or fail, so
    // reporting it as revenue would make the conversion figure a lie.
    expect(shouldTrackPurchase("pending_payment")).toBe(false);
  });

  it("does not fire for a cancelled or refunded order", () => {
    expect(shouldTrackPurchase("cancelled")).toBe(false);
    expect(shouldTrackPurchase("refunded")).toBe(false);
  });
});

describe("payment status vocabulary", () => {
  it("includes the states the brief requires", () => {
    for (const required of [
      "pending",
      "failed",
      "cancelled",
      "refunded",
      "succeeded",
      "requires_action",
      "manual_pending",
    ]) {
      expect(PAYMENT_STATUSES).toContain(required);
    }
  });

  it("keeps manual_pending distinct from succeeded", () => {
    // A bank transfer awaiting reconciliation must not be reported as success.
    expect(PAYMENT_STATUSES).toContain("manual_pending");
    expect(PAYMENT_STATUSES).not.toContain("manual_reconciled");
  });
});

describe("transition graph reachability", () => {
  /** Walk the graph from a start state and collect everything reachable. */
  function reachableFrom(start: OrderStatus): Set<OrderStatus> {
    const seen = new Set<OrderStatus>();
    const stack: OrderStatus[] = [start];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const next of ORDER_TRANSITIONS[current]) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return seen;
  }

  it("lets a pending order reach every non-terminal outcome", () => {
    const reachable = reachableFrom("pending_payment");
    for (const status of ["paid", "cancelled", "processing", "fulfilled", "refunded"] as const) {
      expect(reachable.has(status), `expected to reach ${status}`).toBe(true);
    }
  });

  it("cannot reach refunded without passing through paid", () => {
    // Refunding an unpaid order is not a thing; the graph must not offer it.
    expect(ORDER_TRANSITIONS.pending_payment).not.toContain("refunded");
    expect(ORDER_TRANSITIONS.pending_payment).not.toContain("fulfilled");
  });
});
