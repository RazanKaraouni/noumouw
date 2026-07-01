# Frontend MVC layout

| Layer | Folder | Responsibility |
|-------|--------|----------------|
| **Model** | `src/models/` | API calls and data shaping only (`therapistModel`, `adminModel`, `authModel`, `chatModel`, `activityModel`) |
| **Controller** | `src/controllers/` | State, orchestration, hooks (`useTherapistDashboard`, `useTherapistAssignments`, …) |
| **View** | `src/pages/`, `src/components/` | JSX presentation; no direct `fetch` / `axios` in views when a model exists |

Legacy paths re-export models for compatibility:

- `lib/therapistApi.js` → `models/therapistModel.js`
- `features/chat/chatApi.ts` → `models/chatModel.js`
- `hooks/useOverviewStats.js` → admin overview controller

Backend follows the same split: `routes/` → `controllers/` → Supabase/services.
