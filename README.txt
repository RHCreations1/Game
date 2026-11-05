EVENT GAMING SYSTEM — FIREBASE SPARK + WHEEL CENTRE LOGO UPDATE

Included:
- Existing Firebase prototype UI and pages.
- Admin email/password sign-in using Firebase Authentication.
- Admin sign-out button.
- Admin upload/remove for the Spin the Wheel centre logo.
- Logo saved to Firestore event settings and displayed in the wheel hub.
- Firestore rules restricted to Admin@gmail.com.

IMPORTANT FIREBASE SPARK LIMITATIONS / DEPLOYMENT STATUS:
1. This is not yet a live-event-safe complete customer system.
2. The current prototype stores players, prizes, gifts and settings together in
   eventData/main. Admin-only Firestore rules protect those records, but also
   prevent anonymous customer pages from loading the event state, registering,
   spinning or using the release page. Those flows are intentionally blocked by
   the secure rules until the data model is migrated.
3. Do NOT replace the rules with allow read, write: if true. That exposes names,
   phone numbers, prize records, stock and event settings to anyone.
4. To enable QR customer registration safely on Spark, the app must be migrated
   to separate Firestore collections with tightly constrained create-only
   customer registration rules and admin-only reads/writes. Client-side prize
   selection and stock deduction remain tamperable without trusted server code.
5. For stronger prize integrity / atomic stock updates, use a trusted backend
   (Cloud Functions generally requires Blaze) or a different server-side service.
6. Firebase web config is public by design. Security comes from Authentication
   and Firestore Security Rules, not hiding the config.
7. Create the Firebase Authentication user Admin@gmail.com in Firebase Console
   > Authentication > Users. Set a new strong password privately there.
   Never put the password in HTML/JS or send it in chat.
8. Confirm Firebase project settings in firebase-config.js before deployment.

Quick setup:
- Firebase Console > Authentication > Sign-in method > enable Email/Password.
- Authentication > Users > Add user: Admin@gmail.com + a strong private password.
- Firestore Database > Rules: publish the included firestore.rules.
- Host all files on HTTPS (e.g. Firebase Hosting).
- Open admin.html and sign in normally.
- Admin > Photos & terms > Spin the Wheel · Centre Logo > upload PNG/JPG/WebP.
- Use a square transparent PNG/WebP, ideally under 100 KB.

Test locally:
- Run START_SERVER.bat and open http://localhost:8000/admin.html.
- Firebase Authentication/Firestore require the correct project configuration.


ADMIN ACCOUNT CREATION (UPDATED)
- Admin account is created in Firebase Authentication, NOT stored as a plaintext password in Firestore.
- Open admin.html, select Create Admin Account, enter Admin@gmail.com and a strong password, then verify the email link.
- After verification, return and sign in normally. Only Admin@gmail.com is accepted by the page and Firestore rules.
- Never store passwords in Firestore or HTML/JS. Firebase Authentication securely manages password credentials.

API KEY ERROR FIX
- The error auth/api-key-not-valid means the Firebase Web API key in firebase-config.js is invalid, deleted, restricted incorrectly, or copied from a different project.
- Firebase Console > event-gaming-system > Project settings (gear) > General > Your apps > select Event Gaming Web App > SDK setup and configuration > Config.
- Copy the full config and replace the values in firebase-config.js. Keep projectId exactly event-gaming-system.
- In Google Cloud Console API key restrictions, ensure the key allows the Firebase APIs needed by Authentication and Firestore; for local testing, temporarily remove HTTP referrer restrictions or add localhost and your deployed domain.
- Firebase Console > Authentication > Sign-in method > enable Email/Password.
- Do not create/store the admin password in a Firestore collection.


FIREBASE CONFIG UPDATED FROM USER-PROVIDED CONSOLE CONFIG
- firebase-config.js now contains the exact apiKey/appId/projectId values supplied by the project owner.
- If auth/api-key-not-valid persists, check Google Cloud Console > APIs & Services > Credentials:
  * Ensure this API key belongs to project event-gaming-system and is enabled.
  * If Application restrictions are HTTP referrers, add http://localhost:8000/* and the exact deployed HTTPS domain.
  * If API restrictions are enabled, allow the Firebase Authentication API (Identity Toolkit API) and required Firebase APIs.
- Also verify Firebase Console > Authentication > Sign-in method > Email/Password is enabled.
- Open via START_SERVER.bat / http://localhost:8000/admin.html, not by double-clicking the HTML file.
- The Firebase config API key is public web configuration, not an admin password. Never put passwords or service-account private keys in this file.


ADMIN LOGIN UPDATE — EMAIL VERIFICATION DISABLED
- Firebase Authentication remains enabled (Email/Password provider).
- The application no longer calls sendEmailVerification() or checks emailVerified.
- Only Admin@gmail.com is accepted by the client-side admin gate.
- Existing unverified Admin@gmail.com accounts can sign in with their existing password.
- If no account exists, use Create Admin Account once to create it. Afterward use Sign in.
- Firestore rules must remain enabled; do not use public read/write rules.
- This is not the same as disabling Firebase Authentication. Authentication is what protects Firestore access under Spark.
- Use a strong password; do not use 2027. Never store passwords in Firestore or source files.


FIRESTORE PUBLIC GAME SETTINGS PATCH
- Admin saves private event data to eventData/main (admin-only).
- Admin also publishes a limited public configuration to publicGame/settings.
- Public wheel/game pages subscribe to publicGame/settings and receive enabled gift updates.
- publicGame/settings contains gift display/allocation counters, wheel settings, slots/weights and terms only; it does not contain player names, phone numbers or prize history.
- Firestore rules: public read only for publicGame/settings; only admin can write. eventData/main remains admin-only.
- IMPORTANT LIMITATION: the existing customer registration and prize-award functions still write to eventData/main from the browser. Those flows are NOT made production-safe by this patch and may still fail for unauthenticated customers. A trusted backend (e.g. Cloud Functions) is required to safely support public registration and prize awarding with private customer data. Do not use broad public write rules.
- Serve via localhost/HTTPS, not file://, and ensure the admin account is authenticated before saving.

FIREBASE STORAGE — ALL EVENT PHOTOS

This update moves all uploaded event images to Firebase Storage:
- Gift inventory photos
- OPPS/no-prize photo
- Game 01 registration background
- Game 02 wheel background
- Spin the Wheel centre logo

Firestore stores only each image's download URL and Storage object path. Public game pages read the published image URLs. Only the authenticated Admin@gmail.com account can upload, replace or delete files.

ONE-TIME FIREBASE CONSOLE SETUP:
1. Open Firebase Console > Build > Storage for project event-gaming-system.
2. Click Get started / Create bucket. Select a nearby region compatible with your project and complete setup.
3. Open Storage > Rules.
4. Copy the full contents of the included storage.rules file into the Rules editor and click Publish.
5. Keep the existing Firestore rules in firestore.rules; Storage rules are a separate rules page.
6. Confirm the admin is signed in as Admin@gmail.com before uploading photos.
7. Host the site on HTTPS (or test using the included localhost server). Do not open the pages by double-clicking file:// URLs.

UPLOAD / DELETE BEHAVIOUR:
- Uploading a new image stores it under event-images/ in Firebase Storage and saves its URL/path in Firestore.
- Replacing an image uploads the new file, updates Firestore, then attempts to delete the old Storage object.
- Clicking Remove deletes the Firestore reference and attempts to delete the corresponding Storage object.
- Existing browser-local images are migrated to Storage after the admin signs in and the private event document loads. Keep the old browser data until migration is confirmed.
- If Storage deletion is denied by rules, the UI reports the failure; check that Storage rules are published and the admin session is valid.

SECURITY NOTE:
Storage read is public because the customer wheel and registration pages must display the images without a customer login. Upload/update/delete are restricted to the authenticated admin email. Do not add public write access. Public image URLs can be viewed by anyone who can access the game pages; do not upload private or confidential images.

BILLING / PLAN NOTE:
Firebase Storage bucket availability and billing requirements depend on the Firebase project and current Google Cloud setup. If the console asks to upgrade the project to enable or continue Storage, review the displayed plan and costs before confirming. This ZIP does not change your billing plan.
