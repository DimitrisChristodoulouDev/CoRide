# CoRide

An Expo / React Native prototype for sharing rides in Cyprus, built for Android and iOS.

## Included

- Search example routes by departure and destination city; swap route direction.
- Inspect ride details and reserve or cancel a demo seat.
- View your demo bookings.
- Publish a demo ride with city, time and EUR price validation.

All data is in memory and resets on restart. Sample departures have no calendar date. No real bookings, authentication, messaging, location tracking or payments are connected.

## Run

Use Node.js 22 LTS or newer.

```sh
npm ci
npm start
```

Install the matching Expo Go version on your Android phone and scan the QR code. A local development machine normally needs to be on the same network. For a remote/cloud workspace, try:

```sh
npx expo start --tunnel ngrok
```

The ngrok tunnel dependency is included in the project. Keep the process running. Tunnels depend on the cloud network and are temporary, not hosting. Never share credentials or personal data through a development preview. If the store version of Expo Go does not yet support this project's Expo SDK, use a compatible Expo Go from expo.dev/go on Android, or create an Expo development build.

```sh
npm run typecheck
```

## Next steps

Connect a backend for accounts, persistent rides, bookings and seat concurrency. Add real dates, pickup locations, messaging, notifications and driver verification. Review Cyprus transport requirements and privacy obligations before taking real bookings or payments.
