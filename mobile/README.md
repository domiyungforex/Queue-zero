# TuRnMaRk mobile

Native Expo staff application for the existing TuRnMaRk platform.

## Scope of the first shippable release
- Clerk email OTP sign-in
- RLS-scoped queue list
- Live staff queue console
- Atomic Call Next through the existing Postgres RPC
- Complete, Recall and No-show operations
- Realtime ticket invalidation plus authoritative refetch
- Pull-to-refresh and explicit failure states

Customer QR joining stays on the web and requires no app install.

## Run
Copy `.env.example` to `.env`, use the same public Clerk/Supabase values as the web project, then:

```
npm install
npx expo start
```

For installable builds, configure the Expo/EAS project and run an internal preview build before store submission. Never put Supabase service-role credentials in this app.
