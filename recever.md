# RouteGuard Receiver UI Rewrite Plan

## Purpose
This document defines a production-ready rewrite plan for the Receiver experience so it:
- matches the new Sender and Login UI language
- stays simple for receiver-only workflows
- supports search + monitor without overloading the dashboard

## Product Scope (Receiver Only)
Receiver sees and uses only what is operationally needed:
- Where is my order now?
- When will it arrive?
- Is it delayed?
- What changed?
- Can I confirm receipt safely?

Receiver must NOT include sender/manager complexity:
- no quote negotiation
- no reroute approvals
- no ML deep panels in primary UX
- no fleet/driver management views

## Navigation And Information Architecture
Primary receiver routes should be:
1. /receiver -> Main Dashboard
2. /receiver/shipments/:id -> Order Detail
3. /receiver/shipments/:id/confirm -> Delivery Confirmation
4. /receiver/track -> Search and Monitor
5. /receiver/alerts -> Alerts Center

## UI Alignment With Sender/Login
Use the same design language already visible in sender/login.

### Shared Design Rules
- Typography: same families, sizes, and hierarchy as sender pages.
- Spacing: use same spacing scale for cards, sections, and page gutters.
- Surfaces: same card elevation, border style, and radius tokens.
- Controls: same button variants, input styles, chips, toggles, and badges.
- Feedback: same success/warning/error semantics and motion timing.

### Receiver Visual Priorities
- Keep status readability first (Incoming, Delayed, Delivered).
- Keep actions secondary (View, Add to Monitor, Confirm).
- Avoid decorative complexity that reduces operational scan speed.

## Page 1: Receiver Dashboard
Goal: quick operational view in less than 10 seconds.

### Sections
1. Header
- receiver name + location
- optional live sync indicator

2. KPI Row
- Incoming count
- Delivered count
- Delayed count

3. Incoming Orders List
- order id / tracking number
- route summary (from -> to)
- ETA and status chip
- row action: View

4. Delayed Orders Block
- only delayed subset
- reason + new ETA
- row action: View

5. Recently Delivered Block
- recent delivered subset
- delivered at timestamp
- condition summary
- row action: View Details

6. Alert Strip (Optional)
- top 1-3 latest alerts with deep links

### Dashboard Behavior
- every order row click opens Order Detail
- status chips use shared token colors
- empty states follow same pattern as sender empty cards

## Page 2: Order Detail
Goal: single source of truth for one order.

### Layout
Left column:
- status timeline (primary)
- map snapshot/live path

Right column:
- order metadata
- parties (sender, receiver, manager, vessel/driver if available)
- order-level alerts
- delivery confirmation CTA (when eligible)

### Timeline Rules
- canonical sequence: created -> picked up -> in transit -> at port -> customs -> delivered
- if delayed, insert delay event with reason + timestamp
- current step is visually highlighted

### Confirmation Entry Rule
Show Confirm Delivery CTA only when shipment reached eligible delivery stage.

## Page 3: Search And Monitor
Goal: allow receiver to track orders not already visible on dashboard.

### Search Inputs
- tracking number (required)
- optional QR scan trigger (if scanner is enabled later)

### Search Result Card
- tracking number
- cargo summary
- route summary
- ETA + status
- actions:
  - View Details
  - Add to Monitor

### Monitored Orders List
Each monitored item shows:
- tracking number
- compact route
- ETA/status
- monitor added date
- actions: View, Alert toggle, Remove

### Guardrails
- prevent duplicate monitor entries
- show clear toast on add/remove success/failure

## Page 4: Alerts Center
Goal: all receiver-relevant alerts in one queue.

### Features
- filters: All, Delays, Route changes, Unread
- actions: View Order, Mark Read, Mark All Read
- timestamps in relative + absolute format

### Alert Item Contract
- type
- order reference
- concise message
- action buttons

## Feature: Notification Preferences
Recommended as a compact settings panel.

### Toggles
- Delay alerts
- Route changes
- Departure updates
- Customs updates
- Delivery confirmation prompts

### Channels
- Email on/off
- SMS on/off

## Technical Mapping To Existing Frontend
Existing receiver files already support most flows:
- rontend/src/pages/receiver/ReceiverDashboard.jsx
- rontend/src/pages/receiver/ReceiverOrderDetail.jsx
- rontend/src/pages/receiver/TrackShipment.jsx
- rontend/src/pages/receiver/ConfirmDelivery.jsx

### Rewrite Strategy
1. Keep routes stable; upgrade visuals and IA.
2. Refactor dashboard into clear sections (Incoming, Delayed, Delivered).
3. Keep Order Detail as core page, polish timeline and alerts block.
4. Convert TrackShipment into Search + Monitor page contract.
5. Keep ConfirmDelivery as final lifecycle step and align styling.

## API And Data Requirements
Current endpoints already cover core flow:
- ENDPOINTS.MY_SHIPMENTS
- ENDPOINTS.SHIPMENT_DETAIL(id)
- ENDPOINTS.ACTIVE_ALERTS
- ENDPOINTS.MARK_ALERT_READ(id)
- ENDPOINTS.CONFIRM_DELIVERY(id)

### Additional Backend Support Needed For Full Monitor UX
- add monitored orders list endpoint per receiver
- add create/remove monitor endpoint
- optional: search-by-tracking endpoint with receiver authorization check

## Acceptance Criteria
UI rewrite is complete when:
1. Receiver dashboard visually matches sender/login system.
2. Receiver can scan Incoming/Delayed/Delivered without confusion.
3. Clicking any order opens detail with timeline + map + alerts.
4. Search and add-to-monitor works with clear state feedback.
5. Alerts center supports filter and read-state workflows.
6. Delivery confirmation works and closes lifecycle.

## Delivery Plan
Phase 1: Visual alignment + dashboard section cleanup
Phase 2: Order detail polish (timeline, CTA, alert grouping)
Phase 3: Search + monitor workflow
Phase 4: Alerts center + notification preferences
Phase 5: QA, accessibility pass, and role-based regression

## Final Verdict
Yes, this receiver rewrite is fully achievable and should blend cleanly with the new sender and login UI.
The scope is correct, practical, and implementation-ready with the plan above.