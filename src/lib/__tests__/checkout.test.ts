import { describe, it, expect } from "vitest";
import {
  buildOrderParams,
  changeForValue,
  checkoutBlock,
  checkoutTotals,
  classifyFailure,
  initialChoices,
  type CheckoutChoices,
  type CheckoutLine,
  type StoreCheckout,
} from "@/lib/checkout";

// MJ-024. Two checkout surfaces disagreed about what a customer may supply, so
// what these pin is agreement: one basket, one set of choices, one answer —
// whichever page asked. The arithmetic itself is order-math's and is pinned to
// the RPC there; what is pinned here is the SEQUENCE (coupon → points → fee),
// the two minimums, and the parameters that actually go on the wire.

const store = (over: Partial<StoreCheckout> = {}): StoreCheckout => ({
  storeId: "11111111-1111-1111-1111-111111111111",
  storeName: "دكانة",
  acceptsDelivery: true,
  acceptsPickup: true,
  minOrder: null,
  zones: [],
  checkoutFields: [],
  branches: [],
  paymentNote: null,
  prepTime: null,
  whatsapp: null,
  loyaltyPoints: 0,
  loyaltyPointsPerUnit: 0,
  ...over,
});

const choices = (
  s: StoreCheckout,
  over: Partial<CheckoutChoices> = {},
): CheckoutChoices => ({ ...initialChoices(s), ...over });

const lines = (...ls: [number, number][]): CheckoutLine[] =>
  ls.map(([unitPrice, quantity], i) => ({
    id: `p${i}`,
    name: `product ${i}`,
    quantity,
    unitPrice,
  }));

describe("checkoutTotals — the same basket adds up the same way", () => {
  it("is just the subtotal when the store offers nothing else", () => {
    const s = store();
    const t = checkoutTotals(s, choices(s), lines([10, 3]));
    expect(t.subtotal).toBe(30);
    expect(t.grandTotal).toBe(30);
    expect(t.deliveryFee).toBe(0);
    expect(t.blocked).toBe(false);
  });

  it("applies the coupon before the points, and caps the points at the rest", () => {
    // 100 points at 10/unit is $10, but only $4 is still owed after the coupon.
    const s = store({ loyaltyPoints: 100, loyaltyPointsPerUnit: 10 });
    const t = checkoutTotals(
      s,
      choices(s, { couponDiscount: 26, redeemLoyalty: true }),
      lines([10, 3]),
    );
    expect(t.couponDiscount).toBe(26);
    expect(t.pointsDiscount).toBe(4);
    expect(t.pointsUsed).toBe(40); // only the points that $4 is worth
    expect(t.grandTotal).toBe(0);
  });

  it("resolves the delivery fee against the POST-discount net, as the RPC does", () => {
    // free_over 25: the $30 basket clears it, the same basket with a $10 coupon
    // does not — because resolve_delivery_fee is handed v_net, not the subtotal.
    const s = store({
      zones: [{ id: "z1", name: "الحمرا", fee: 3, freeOver: 25 }],
    });
    const full = checkoutTotals(s, choices(s, { zoneId: "z1" }), lines([10, 3]));
    expect(full.deliveryFee).toBe(0);
    expect(full.grandTotal).toBe(30);

    const couponed = checkoutTotals(
      s,
      choices(s, { zoneId: "z1", couponDiscount: 10 }),
      lines([10, 3]),
    );
    expect(couponed.deliveryFee).toBe(3);
    expect(couponed.grandTotal).toBe(23);
  });

  it("charges no delivery fee on a pickup order whatever the zone says", () => {
    const s = store({ zones: [{ id: "z1", name: "الحمرا", fee: 3 }] });
    const t = checkoutTotals(
      s,
      choices(s, { zoneId: "z1", fulfillment: "pickup" }),
      lines([10, 1]),
    );
    expect(t.deliveryFee).toBe(0);
  });

  it("compares the STORE minimum against the subtotal, not the net (0229)", () => {
    // $30 of goods with a $25 coupon still meets a $20 minimum: a merchant's
    // minimum is the value of the goods, not what was left to pay.
    const s = store({ minOrder: 20 });
    const t = checkoutTotals(s, choices(s, { couponDiscount: 25 }), lines([10, 3]));
    expect(t.belowStoreMinimum).toBe(false);

    const under = checkoutTotals(s, choices(s), lines([10, 1]));
    expect(under.belowStoreMinimum).toBe(true);
    expect(under.blocked).toBe(true);
  });

  it("compares the ZONE minimum against the net, which is what it is handed", () => {
    const s = store({
      zones: [{ id: "z1", name: "الحمرا", fee: 2, minOrder: 25 }],
    });
    const ok = checkoutTotals(s, choices(s, { zoneId: "z1" }), lines([10, 3]));
    expect(ok.belowZoneMinimum).toBe(false);

    const under = checkoutTotals(
      s,
      choices(s, { zoneId: "z1", couponDiscount: 10 }),
      lines([10, 3]),
    );
    expect(under.belowZoneMinimum).toBe(true);
  });

  it("never lets discounts drive the total below zero", () => {
    const s = store();
    const t = checkoutTotals(s, choices(s, { couponDiscount: 999 }), lines([10, 1]));
    expect(t.grandTotal).toBe(0);
    expect(t.net).toBe(0);
  });

  it("rounds to cents the way numeric(12,2) does", () => {
    const s = store();
    const t = checkoutTotals(s, choices(s), lines([2.99, 3]));
    expect(t.subtotal).toBe(8.97); // not 8.969999999999999
  });
});

describe("checkoutBlock — what the client refuses before asking the server", () => {
  it("blocks a delivery order that names no zone in a store that has them", () => {
    const s = store({ zones: [{ id: "z1", name: "الحمرا", fee: 2 }] });
    const c = choices(s, { zoneId: "" });
    const t = checkoutTotals(s, c, lines([10, 1]));
    expect(checkoutBlock(s, c, lines([10, 1]), t, (f) => f.label)).toEqual({
      kind: "zoneRequired",
    });
  });

  it("does not block the same order for pickup", () => {
    const s = store({ zones: [{ id: "z1", name: "الحمرا", fee: 2 }] });
    const c = choices(s, { zoneId: "", fulfillment: "pickup" });
    const t = checkoutTotals(s, c, lines([10, 1]));
    expect(checkoutBlock(s, c, lines([10, 1]), t, (f) => f.label)).toBeNull();
  });

  it("names the merchant's own required field when it is blank", () => {
    const s = store({
      checkoutFields: [
        {
          id: "f1",
          label: "رقم الطابق",
          labelEn: "Floor",
          fieldType: "text",
          options: [],
          required: true,
        },
      ],
    });
    const c = choices(s);
    const t = checkoutTotals(s, c, lines([10, 1]));
    expect(checkoutBlock(s, c, lines([10, 1]), t, (f) => f.label)).toEqual({
      kind: "missingField",
      label: "رقم الطابق",
    });
  });
});

describe("buildOrderParams — the wire call, once", () => {
  const contact = {
    name: "سامي",
    phone: "+96170000000",
    address: "الحمرا، بيروت",
    note: "",
    deliveryInstructions: "الجرس الثاني",
  };
  const base = {
    contact,
    changeFor: 50,
    idempotencyKey: "key-1",
    customFields: { "رقم الطابق": "3" },
  };

  it("sends the coupon, the zone and the custom fields on the signed-in path", () => {
    // The buy box used to hard-code p_coupon: null and pass no zone at all.
    const s = store({
      zones: [{ id: "z1", name: "الحمرا", fee: 2 }],
      loyaltyPoints: 500,
      loyaltyPointsPerUnit: 100,
    });
    const c = choices(s, {
      zoneId: "z1",
      couponCode: "EID10",
      redeemLoyalty: true,
    });
    const { rpc, params } = buildOrderParams({
      ...base,
      store: s,
      choices: c,
      items: [{ product_id: "p1", quantity: 2, variant_id: "v1" }],
      guest: false,
    });
    expect(rpc).toBe("place_customer_order");
    expect(params.p_coupon).toBe("EID10");
    expect(params.p_zone_id).toBe("z1");
    expect(params.p_redeem_points).toBe(500);
    expect(params.p_change_for).toBe(50);
    expect(params.p_delivery_instructions).toBe("الجرس الثاني");
    expect(params.p_custom_fields).toEqual({ "رقم الطابق": "3" });
    expect(params.p_items).toEqual([
      { product_id: "p1", quantity: 2, variant_id: "v1" },
    ]);
  });

  it("routes a guest to the guest RPC with a name and no points", () => {
    const s = store({ loyaltyPoints: 500, loyaltyPointsPerUnit: 100 });
    const { rpc, params } = buildOrderParams({
      ...base,
      store: s,
      choices: choices(s, { redeemLoyalty: true }),
      items: [{ product_id: "p1", quantity: 1 }],
      guest: true,
    });
    expect(rpc).toBe("place_guest_order");
    expect(params.p_customer_name).toBe("سامي");
    // place_guest_order has no p_redeem_points — the ledger is keyed to an
    // account. Sending one would be an unknown parameter, not a no-op.
    expect(params).not.toHaveProperty("p_redeem_points");
  });

  it("sends no address, instructions or change on a pickup order", () => {
    const s = store();
    const c = choices(s, { fulfillment: "pickup" });
    const { params } = buildOrderParams({
      ...base,
      store: s,
      choices: c,
      items: [{ product_id: "p1", quantity: 1 }],
      guest: false,
    });
    expect(params.p_address).toBe("");
    expect(params.p_delivery_instructions).toBe("");
    expect(params.p_change_for).toBeNull();
  });

  it("names a branch only when the store has more than one", () => {
    const one = store({
      branches: [{ id: "b1", name: "الفرع", area: null, address: null }],
    });
    expect(
      buildOrderParams({
        ...base,
        store: one,
        choices: choices(one),
        items: [{ product_id: "p1", quantity: 1 }],
        guest: false,
      }).params.p_location_id,
    ).toBeNull();

    const two = store({
      branches: [
        { id: "b1", name: "الحمرا", area: null, address: null },
        { id: "b2", name: "الأشرفية", area: null, address: null },
      ],
    });
    expect(
      buildOrderParams({
        ...base,
        store: two,
        choices: choices(two, { branchId: "b2" }),
        items: [{ product_id: "p1", quantity: 1 }],
        guest: false,
      }).params.p_location_id,
    ).toBe("b2");
  });

  it("folds surface-specific extras into p_custom_fields", () => {
    const s = store();
    const { params } = buildOrderParams({
      ...base,
      store: s,
      choices: choices(s),
      items: [{ product_id: "p1", quantity: 1 }],
      guest: false,
      extraCustomFields: { scheduled_for: "2026-08-21T18:00:00.000Z" },
    });
    expect(params.p_custom_fields).toEqual({
      "رقم الطابق": "3",
      scheduled_for: "2026-08-21T18:00:00.000Z",
    });
  });
});

describe("changeForValue", () => {
  const s = store();
  it("is null unless the customer asked for change on a delivery", () => {
    expect(changeForValue(choices(s), "none", "")).toBeNull();
    expect(
      changeForValue(choices(s, { fulfillment: "pickup" }), "50", ""),
    ).toBeNull();
  });
  it("reads a preset and a custom amount", () => {
    expect(changeForValue(choices(s), "50", "")).toBe(50);
    expect(changeForValue(choices(s), "custom", "75")).toBe(75);
  });
  it("ignores a custom amount that is not a positive number", () => {
    expect(changeForValue(choices(s), "custom", "")).toBeNull();
    expect(changeForValue(choices(s), "custom", "0")).toBeNull();
  });
});

describe("classifyFailure — one reading of what the server refused", () => {
  it("pulls the short product's name out of the stock trigger", () => {
    expect(classifyFailure('insufficient_stock:كلل - احمر"')).toEqual({
      kind: "outOfStock",
      productName: "كلل - احمر",
    });
  });
  it("still reports a bare stock error", () => {
    expect(classifyFailure("insufficient_stock")).toEqual({
      kind: "outOfStock",
      productName: null,
    });
  });
  it.each([
    ["zone_required", "zoneRequired"],
    ["below_zone_minimum", "belowZoneMinimum"],
    ["below_store_minimum", "belowStoreMinimum"],
    ["coupon_already_used", "couponAlreadyUsed"],
    ["modifier_required", "modifierRequired"],
    ["rate_limited", "rateLimited"],
  ])("classifies %s", (message, kind) => {
    expect(classifyFailure(message).kind).toBe(kind);
  });
  it("treats a NULL order id with no error as a failure, not a success", () => {
    // The RPC's idempotency branch re-selects the existing row and returns
    // whatever it finds, so a lost race returns NULL with no error at all.
    expect(classifyFailure(null).kind).toBe("generic");
  });
});
