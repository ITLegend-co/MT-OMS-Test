# MT Operations Management System (MT-OMS)

Internal Mountain Torq operations system for KK, KP and PH.

## Implemented modules

- Username + password login
- System Administrator user management
- Site / department / role access
- Inventory by site
- PH / KP item requests and replenishment status
- Replenishment route: via KK to KP or directly to KP
- Item transit by KK staff or porter
- External / Supplier to KP transit support
- Porter directory and RM/kg rates
- Custom charge for bulk / hard-to-carry items
- Bill number and itemized transit details
- Arrival verification and inventory transfer
- Monthly porter billing
- KP bill verification
- Separate carrier porter and payment-recipient porter
- Accounts transaction verification
- Paid status and payment reference
- Dashboard and CSV reports

## Firebase

Project: `mt-oms-291df`

Authentication uses Firebase Email/Password internally, but staff only enter a username. A username such as `kp01` maps internally to `kp01@mt-oms.local`.

Operational data uses **Firebase Realtime Database**.

Rules are stored in:

`database.rules.json`

The default database URL configured in `js/firebase-config.js` is:

`https://mt-oms-291df-default-rtdb.asia-southeast1.firebasedatabase.app`

If Firebase Console shows a different Realtime Database URL, replace that single value.

## System Administrator

- Username: `mtadmin`
- Required UID: `Zy63U0hXZSddx7g8x2hahFtO1d63`
- Internal auth identity: `mtadmin@mt-oms.local`

The password is never stored in this repository.

## Not included yet

- POS module — reserved for future implementation.
- Google Drive / Apps Script media storage — reserved for later implementation after the main system is tested.
- Automatic administrator password reset for other users — with the current free client-only Firebase design, forgotten staff passwords should be handled from Firebase Authentication Console.

## Run

Serve the repository using a local web server or GitHub Pages. ES modules should not be opened directly using a `file://` URL.
