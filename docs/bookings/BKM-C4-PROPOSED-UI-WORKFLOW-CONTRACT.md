# BKM-C4 — Proposed unified booking UI and workflow contract

**Status:** Proposed for exact owner acceptance. The three approved Walk-in, Phone/Future, and Home Service mockups are visual references; their unsupported draft, discount, and payment affordances do not become requirements.

## Entry and mode

The modal header identifies booking mode and branch, provides Close, and preserves the initiating CRM context. Three mode controls switch the adapted workflow without creating payment intent. Walk-in uses branch-time defaults and remains unpaid. Phone/Future exposes a compact `Phone` versus `Future` source choice only when the entry point has not fixed that source. Home Service adds destination verification and travel fee. Switching modes preserves compatible customer and guest data, clears incompatible services or stale quotes with an explanation, rechecks availability, and never implies collection.

## Guest editing

Customer Information contains the intelligent customer-name input, phone, and optional notes. Guests & Services contains expanded cards in vertical order; Add Guest appends below, preserves existing guest state, and scrolls only that section to reveal the addition. Each card has service search, category filters, fixed-width horizontal cards with arrows, a selected-service indicator, and the complete eligible catalogue. Under the cards, row one is **Duration | Therapist | Shared Date & Time**; row two is **Room | Price** where a room applies. Each selected service line retains its own server-quoted duration, quote version, price, and expected completion. The shared start control is synchronized across cards and labeled as shared.

The therapist control is one native or equivalently accessible dropdown per guest. Once services and time permit a check, it displays a provisional qualified, available suggestion or a clear unavailable/loading state. Opening it lists the suggestion, other qualified choices with accurate availability/conflict labels, and Automatic. A CSR choice belongs only to that guest and is exact in a marked request. An automatic suggestion is not serialized as `selectedStaffId`. Customer-requested provenance is explicitly selectable for a manually chosen guest. If exact group persistence is unavailable, the UI must block Save and explain the gate rather than silently save an automatic assignment. The server's result overrides preview labels; guest-specific errors remain visible at the affected card.

In-spa single booking room selection remains; group rooms show authoritative automatic allocation for CSR review. Home Service has no room. Its Customer Information shows one Places-backed **Service Location** search/paste field, a compact verified-address confirmation and Review Map action. Coordinates and fee are not shown there. A changed location invalidates its old fee. Booking Summary alone shows `Updating travel fee…`, an error, or the current provisional transportation fee until the server establishes the final charge.

## Summary, payment, and accessibility

The right summary stays accessible with customer, guest/service list, quote-based amounts, travel fee, payment state, and Save/Cancel. A compact paginated guest summary may prevent summary overflow without changing guest editing. Default payment state is unpaid; explicit collection uses only the existing authorized workflow. At desktop viewport targets 1920×1080, 1440×900, and 1366×768, header, customer information, summary, payment and actions remain reachable while Guests & Services is the intended vertical scroll region. At smaller sizes or high zoom, ordinary page/modal scrolling is an accessible fallback. Keyboard focus, labels, announcements, and error association remain required.

Production Add Guest and Save stop at the current four-attendee CRM contract. Optional 5/10/20-card previews are visibly non-submitting. The higher capacity, browser overflow measurements, and any responsive claims require separate verification; this proposed specification does not certify the current prototype.
