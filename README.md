# MT Operations Management System (MT-OMS)

Initial foundation for Mountain Torq's internal operations platform.

## Current scope
- Username + password login
- Firebase Authentication
- Firestore user profiles and permissions
- System Administrator / Management / Accounts / Operations Admin / KP Customer Service / PH Housekeeping foundations
- Inventory, item request/replenishment, transit, porter, billing/verification and reporting foundations

## Deferred
- POS module (future)
- Google Drive / Apps Script media storage (future)

## Firebase
Project: `mt-oms-291df`

The UI accepts a username only. Internally, usernames are normalized and mapped to a generated Firebase Authentication identity; staff do not need a work email.

System Administrator UID:
`Zy63U0hXZSddx7g8x2hahFtO1d63`
