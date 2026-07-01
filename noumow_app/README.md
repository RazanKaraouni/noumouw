# Noumouw (parent app)

Flutter **parent** mobile/web app for Noumouw — children, milestones, therapist resources, and account flows.

This is **not** the web staff console (admin/therapist); that project lives in `website/` (`admin-website` and `therapist-website`, shared `backend`).

**Dart package name:** `noumouw_parent` (see `pubspec.yaml`).

## Getting started

```bash
cd noumouw_app
flutter pub get

# Terminal 1 — API (required for booking, chat, tips, sockets)
cd ../website/backend
npm install
npm run dev

# Terminal 2 — parent app (physical phone: use your PC LAN IP, not 127.0.0.1)
cd ../../noumouw_app
flutter run --dart-define=THERAPISTS_API_BASE=http://YOUR_PC_LAN_IP:5000
```

Set `THERAPISTS_API_BASE` in `assets/app.env` or `dart_defines.json` so you do not need the flag every run. On Android emulator use `http://10.0.2.2:5000` instead of your LAN IP.
