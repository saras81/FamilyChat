# FamilyChat

FamilyChat is a family-focused messaging prototype built with Expo React Native. It separates parent and child experiences, gates child setup behind a parent-generated invite code or QR payload, and gives parents a protected dashboard for family controls.

## Current App Shape

### Role-Based Entry

The first screen is a Parent/Child landing flow:

- **Parent**
  - Sign in with email and password.
  - Create a parent account if needed.
  - Complete family setup by naming the family unit.
  - After setup success, the app forces a return to login so parent permissions initialize through the normal auth path.

- **Child**
  - Must start with **Link to Family**.
  - Can enter a 6-character invite code or scan a QR payload like `familychat:ABC123`.
  - Cannot reach child profile creation until the invite code validates.
  - After validation, creates a child profile with username/avatar and signs in as a child.

### Parent Dashboard

Parents land on a protected dashboard with these modules:

- **Family Manager**: list of linked child accounts.
- **Invite Center**: generate child invite slots with alpha-numeric codes and QR payload strings.
- **Activity Monitor**: read-only feed of child message activity.
- **The Safelist**: approve or block contact handles.
- **Privacy Tools**: danger-styled **Purge Data** action that confirms before deleting local chat history/media.

### Child Experience

Children see a brighter child palette and have access to:

- Safe List contacts only.
- Chat from approved contacts.
- Child settings/profile controls.

## Architecture

```
FamilyChat/
├── App.js                              # Auth-protected navigation root
├── index.js                            # Expo root registration
├── src/
│   ├── components/
│   │   ├── LoginScreen.js              # Parent/Child landing, login, code entry, QR scan
│   │   ├── ParentOnboardingScreen.js   # Parent registration, family setup, success/logout
│   │   ├── ChildOnboardingScreen.js    # Validated child profile creation
│   │   ├── ParentManagementScreen.js   # Parent dashboard modules
│   │   ├── SafeListScreen.js           # Approved contacts list
│   │   ├── ChatScreen.js               # Messaging UI
│   │   └── ChildSettingsScreen.js      # Child profile/settings
│   ├── context/
│   │   └── AuthContext.js              # Global isLoggedIn/userRole state
│   ├── database/
│   │   ├── DatabaseService.js          # Platform selector
│   │   ├── DatabaseService.mobile.js   # SQLite-backed service
│   │   └── DatabaseService.web.js      # localStorage-backed service
│   └── services/
│       └── MatrixService.js            # Matrix login/register/sync helpers
└── FamilyChatWatch/                    # Watch companion prototype
```

## Data Model

The mobile app uses SQLite through `expo-sqlite`; web uses matching `localStorage` collections for development.

Main entities:

- `contacts`: parents, children, contact handles, Safe List approval state.
- `messages`: local chat history with optional Matrix metadata.
- `family`: current family unit name and invite metadata.
- `devices`: current logged-in session details and role.
- `child_invites`: parent-generated child invite codes.
- `parent_accounts`: local parent account fallback for prototype use.

## Auth And Security Notes

- Global auth state lives in `AuthContext`.
- Logged-in routes are protected by `isLoggedIn` and `userRole`.
- Parent dashboard routes only appear for users with `userRole === 'parent'`.
- Child profile creation validates the invite again before creating the account.
- Parent account setup attempts Matrix registration, but does not block the flow if Matrix is unavailable; it stores a local parent account fallback.
- Matrix support is present, but this is still a prototype and should not be treated as production-grade authentication/storage.

## Development

### Prerequisites

- Node.js
- npm
- Expo CLI / Expo tooling
- Xcode for iOS simulator/device work

### Install

```bash
npm install
```

### Run

```bash
npm start
npm run ios
npm run android
npm run web
```

### Verification Commands

```bash
node --check App.js
node --check src/components/LoginScreen.js
node --check src/components/ParentOnboardingScreen.js
node --check src/components/ChildOnboardingScreen.js
node --check src/components/ParentManagementScreen.js
node --check src/database/DatabaseService.mobile.js
node --check src/database/DatabaseService.web.js
node --check src/services/MatrixService.js
git diff --check
```

Note: running Expo web in the current local environment previously hit a Node 25/freeport `ERR_SOCKET_BAD_PORT` issue before serving. If that appears, try an LTS Node version.

## Key Dependencies

- `expo`
- `expo-camera`
- `expo-sqlite`
- `matrix-js-sdk`
- `@react-navigation/native`
- `@react-navigation/stack`
- `@react-navigation/bottom-tabs`
- `react-native-safe-area-context`
- `react-native-screens`
- `react-native-web`

## Roadmap

- Render actual QR images for invite codes instead of only QR payload strings.
- Replace prototype local parent password storage with secure credential handling.
- Strengthen Matrix homeserver/account setup.
- Add push notifications.
- Add media sharing and richer message states.
- Build full watch-to-phone sync through Watch Connectivity.

## Status

This is a proof-of-concept implementation. Production use would require security review, secure credential storage, Matrix homeserver hardening, privacy review, and platform release configuration.
