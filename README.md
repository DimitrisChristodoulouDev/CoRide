# CoRide

A Cyprus carpooling app for Android and iOS using Expo / React Native, with a separate administrator login and dashboard.

## Try it in Codespaces

```sh
git pull
npm ci
npx expo start --tunnel ngrok --clear
```

Scan the new QR code in Expo Go on your phone. Keep the Codespace and server running. Use the Expo Go release compatible with SDK 58. No local PC installation is needed.

The app now connects by default to the **CoRide Supabase project** (`qybreyxpaktuiipsnfxg`). Its schema, storage buckets and the search/notification functions are deployed. Client configuration in `src/project.ts` contains only the public project URL and publishable key. Sign up on your phone to use live data.

Set `EXPO_PUBLIC_DEMO_MODE=true` in `.env` and restart Expo to use **demo mode**, which provides sample rides, reviews, city/driver search, sorting, map pin selection, current-location pickup, date/time scheduling, demo booking/cancellation, and review submission after simulating a completed trip. All demo data resets on reload. Demo acceptance and trip completion are explicitly labelled simulations.

## What is implemented

| Feature              | Behavior                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Maps          | Pickup/drop-off pins, current location, exact coordinates and Google Maps navigation links                                                      |
| Full-address search  | Google Places API (New), through an authenticated server function; Google billing/key required                                                  |
| Scheduling           | Native date/time pickers, future departure validation, date filter; ride cards display Cyprus time                                              |
| Driver discovery     | Name search; departure, duration, rating, cost/seat, driving quality, chatty/quiet sorting                                                      |
| Reviews & avatars    | Stars, profile photos, driving quality and chattiness; one review per completed passenger booking                                               |
| Accounts             | Email sign-in/up, confirmation, forgot password, password change, profile edits and photo uploads                                               |
| Driver registration  | Driver option at signup; licence image/number/expiry and vehicle submission after email confirmation; admin approval required before publishing |
| Bookings             | Pending requests, driver accept/reject, database-locked seat counts, cancellations and trip start/completion                                    |
| Chat                 | Group chat for driver and accepted passengers, with persistent messages and periodic refresh                                                    |
| Notifications        | Persistent in-app alerts; optional remote push via Expo and a Supabase function                                                                 |
| Driver tracking      | Driver opts into foreground GPS sharing on an active ride; accepted passengers see updates, timestamps and stale status                         |
| Reporting & blocking | Reports to the admin dashboard; blocked drivers hidden and new bookings prevented                                                               |
| Admin                | Separate Admin page/login, role-based dashboard, statistics, private licence review, driver editing/suspension and report resolution            |

Journey durations are driver-entered estimates, not Google traffic predictions. Supported matching areas are within 40 km of Nicosia, Limassol, Larnaca, Paphos and Ayia Napa; exact pickup/drop-off coordinates are retained. Choosing a point outside these areas does not silently assign a city.

## Connect Supabase (required for live accounts and shared data)

The current CoRide project is already connected. The following steps are for a **new or replacement project**; do not rerun the initial schema on CoRide.

1. Create a Supabase project.
2. In its SQL editor, run **supabase/schema.sql** once on a new project. It creates tables, row-level policies, private licence storage, public avatar storage, booking transactions and realtime publication entries.
3. Copy `.env.example` to `.env`. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project settings. The public anon key also works. **Never put a service-role key in EXPO_PUBLIC variables or commit `.env`.**
4. Configure Authentication → URL Configuration redirects. For an installed build, allow `coride://auth/callback`. For Expo Go development, also allow the exact URL printed by `npx expo` with `/--/auth/callback` appended (an `exp://` tunnel URL); update it if the tunnel changes. Confirmation/reset links should be opened on the same phone used to request them. PKCE stores the verifier on that device.
5. Enable email/password authentication and email confirmation. Configure a production SMTP provider before a public release.
6. Restart Expo after changing `.env`.

The driver signup checkbox records a request to become a driver, not an approval. After confirming email, drivers sign in and submit their vehicle, licence number, future expiry and image under **Profile**. They cannot publish until an administrator reviews the document and approves it. Review is manual: this app does not claim to authenticate government documents automatically.

## Google services

For CoRide, the `search-address` function is already deployed. Open [Google Cloud credentials](https://console.cloud.google.com/apis/credentials), select/create your project, enable billing and **Places API (New)**, and create a server API key restricted to Places API (New). Add it as `GOOGLE_PLACES_API_KEY` in [CoRide Edge Function secrets](https://supabase.com/dashboard/project/qybreyxpaktuiipsnfxg/functions/secrets). Never add the server key to GitHub. No function redeployment is needed after setting the secret.

For other projects, enable billing and **Places API (New)** in Google Cloud. Store the Places key as the Supabase secret `GOOGLE_PLACES_API_KEY`, then deploy the authenticated function:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set GOOGLE_PLACES_API_KEY=YOUR_SERVER_KEY
npx supabase functions deploy search-address
```

Enter the real key privately in your terminal or set it through the Supabase dashboard. The server limits address searches to 30 per user per minute. Restrict the key to Places API (New).

For an **Expo Go demo only**, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` enables direct Places search without Supabase. This value is visible in the app bundle; use a separate restricted development key and remove it for deployed builds. Connected accounts always use the server function.

Expo Go supplies its own native map configuration; on iOS Expo Go, the map falls back to Apple Maps while Google address search and navigation links still work. Own iOS builds use Google Maps. For your own development/store builds, enable Maps SDK for Android and Maps SDK for iOS and provide separate appropriately restricted native keys in `GOOGLE_MAPS_ANDROID_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY`. The app configuration uses package/bundle ID `com.coride.app`; restrict Android keys using the build's signing SHA-1 too.

## Create the administrator

The Admin page is separate from the member profile, and admin sign-in redirects to its dashboard. The requested email is `admin@coride.com`. The password is stored in Supabase Auth, never hardcoded in this repository.

In a **private Codespaces terminal**, set the following variables. The `read -s` commands hide secret input (paste each value when prompted):

```bash
export SUPABASE_URL='https://YOUR_PROJECT.supabase.co'
read -rsp 'Supabase service-role key: ' SUPABASE_SERVICE_ROLE_KEY
export SUPABASE_SERVICE_ROLE_KEY
read -rsp 'Initial admin password: ' CORIDE_ADMIN_PASSWORD
export CORIDE_ADMIN_PASSWORD
npm run admin:setup
unset SUPABASE_SERVICE_ROLE_KEY CORIDE_ADMIN_PASSWORD
```

Enter your requested initial admin password at the password prompt. This script creates a confirmed account and sets its database admin role using the service-role key. Run it once. If the email already exists, use the Supabase Auth dashboard to reset its password and explicitly assign `profiles.role='admin'` in the SQL editor to that intended account only. Signup metadata and the mobile client cannot assign admin privileges.

Use **Admin** in the app to sign in, review private licence images (signed URLs expire after 2 minutes), approve/reject applications, edit names/vehicles, suspend publishing access, review reports and view counts for users, drivers, rides, active rides, bookings, completed bookings, reviews and pending approvals.

## Notifications and native builds

In-app alerts work with Supabase in Expo Go. Remote push notifications require a physical device and an **Expo development or production build**; Expo Go does not provide remote push support.

```sh
npx supabase functions deploy deliver-notifications
npx eas-cli login
npx eas-cli init
```

Set `EXPO_PUBLIC_EAS_PROJECT_ID` in `.env` to the EAS project ID. Configure the platform push credentials through EAS and install the development client:

```sh
npx expo install expo-dev-client
npx eas-cli build --profile development --platform android
npx expo start --dev-client --tunnel ngrok
```

On the phone, open Alerts → Enable phone push notifications. Booking/chat changes create durable in-app notifications and invoke the push function. It retries undelivered notifications when their actor next performs a live action; there is no background worker or scheduled reminder system in this version.

## Live trip tracking

Start a trip under **My rides**, open its trip details and press **Share live driver location**. Location permission is requested only when needed. Only the driver and accepted participants of that active trip can read its coordinates. Updates are sent roughly every 5 seconds / 10 metres and refreshed on passenger screens every 10 seconds. The server stamps update times; positions older than 30 seconds are labelled last known.

Sharing stops on leaving the trip screen, backgrounding the app, pressing Stop or completing the trip. Completion removes the location row. If the app is killed offline, the last row can remain until completion; its timestamp makes it stale. **Background/locked-screen tracking is not implemented.** It requires a foreground service/background-location build and a separate consent/lifecycle design.

## Checks

```sh
npm run typecheck
npm test
npm run test:db
```

Database checks require Docker and test real PostgreSQL permissions, driver approval, booking concurrency, verified-trip reviews, chat membership, location access, and cancellation. They use an isolated temporary container. To export native bundles:

```sh
npx expo export --platform android
npx expo export --platform ios
```

## Current limits

The CoRide database, storage buckets and server functions are deployed. Google billing/keys, admin provisioning, auth redirect/SMTP settings and push credentials still need configuration before their corresponding features work. End-to-end testing against those services and physical Android/iOS devices is still required. No real payments, refunds, automated licence authenticity checks, background tracking or app-store release are included. Cancellation currently carries no fee and is allowed while a ride is scheduled. Configure privacy/retention processes and operating requirements before onboarding real users or collecting licence documents.
