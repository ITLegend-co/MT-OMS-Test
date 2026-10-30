# One-time System Administrator setup

The application is configured to use:

- Username: `mtadmin`
- Internal Firebase Authentication identity: `mtadmin@mt-oms.local`
- Required Firebase UID: `Zy63U0hXZSddx7g8x2hahFtO1d63`
- Role: System Administrator
- Site access: KK, KP and PH

## Important

The Firebase Authentication user with UID:

`Zy63U0hXZSddx7g8x2hahFtO1d63`

must have its Authentication email set to:

`mtadmin@mt-oms.local`

and it must have a password.

The password is deliberately **not stored in GitHub, JavaScript, Firestore, or this document**.

## Firebase Console steps

1. Open Firebase Console.
2. Select project `mt-oms-291df`.
3. Go to **Authentication > Users**.
4. Find the user whose UID is `Zy63U0hXZSddx7g8x2hahFtO1d63`.
5. Set its email to `mtadmin@mt-oms.local`.
6. Set/change the password to a strong administrator password known only to the authorized administrator.
7. Ensure **Email/Password** sign-in is enabled under Authentication > Sign-in method.
8. Create/enable Firestore Database if it has not yet been created.
9. Publish the repository's `firestore.rules`.

After the first successful login with username `mtadmin`, the app automatically creates the System Administrator profile in:

`users/Zy63U0hXZSddx7g8x2hahFtO1d63`

No staff-facing email is required.

## Free-tier design

This foundation uses Firebase Authentication and Cloud Firestore only. It does not require Cloud Functions or Firebase Storage.

Media/file storage is intentionally deferred for later Google Drive + Apps Script integration.

POS is intentionally not included in the current build; it is reserved as a future MT-OMS module.
