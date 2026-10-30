# MT-OMS Firebase Setup

## 1. Authentication

Firebase project: `mt-oms-291df`

Enable:

**Authentication > Sign-in method > Email/Password**

The user interface remains username-only. Email is only an internal Firebase identity.

### System Administrator

Locate UID:

`Zy63U0hXZSddx7g8x2hahFtO1d63`

Set its Authentication email to:

`mtadmin@mt-oms.local`

Set a strong password. Do not store the password in GitHub.

Login shown to the administrator:

- Username: `mtadmin`
- Password: the password configured in Firebase Authentication

On the first successful login, MT-OMS creates the administrator profile under:

`/users/Zy63U0hXZSddx7g8x2hahFtO1d63`

## 2. Realtime Database

Create a Firebase **Realtime Database** on the free Spark plan.

For Malaysia, Singapore / `asia-southeast1` is normally the appropriate nearby location when available.

Copy the exact Database URL shown by Firebase Console.

The website currently defaults to:

`https://mt-oms-291df-default-rtdb.asia-southeast1.firebasedatabase.app`

If the URL shown in your Firebase Console is different, edit `databaseURL` in:

`js/firebase-config.js`

## 3. Publish database rules

Open:

**Firebase Console > Realtime Database > Rules**

Replace the existing rules with the contents of:

`database.rules.json`

Then click **Publish**.

Do not use open development rules such as:

`".read": true`

or:

`".write": true`

The MT-OMS rules use the authenticated UID and the user's stored role/site profile to control access.

## 4. User account creation

Only the System Administrator UI exposes user creation.

The administrator provides:

- Full name
- Username
- Temporary password
- Primary site
- Department
- Role

The system creates a hidden Firebase identity such as:

`kpcs01@mt-oms.local`

The staff member only uses:

`kpcs01`

plus their password.

## 5. Current access model

### PH Housekeeping
- Own PH inventory
- Create PH requests
- Transit
- Verify arrival at PH
- Porter / movement visibility
- Reports relevant to available data

### KP Customer Service
- Own KP inventory
- Create KP requests
- Transit
- Verify arrival at KP
- Add porters
- Porter information
- KP porter bill verification
- Reports

### KK Operations Admin
- All inventory visibility
- Replenishment
- Requests
- Transit
- Porter management
- Reports

### Accounts
- All inventory/report visibility
- Transit and porter visibility
- Monthly porter billing
- Accounts verification
- Mark payment as paid

### Management
- Full operational access

### System Administrator
- Full operational access
- User creation and enable/disable controls

## 6. Future modules

Reserved but not enabled in this build:

- POS
- Google Drive + Apps Script file/media storage
