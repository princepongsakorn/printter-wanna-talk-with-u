# Chat 1-1

A private 1-on-1 chat web app for close conversations, using Gmail login and Firestore real-time updates.

## Stack

- **React 18 + Vite + TypeScript** (mobile-first, responsive)
- **Tailwind CSS** - modern chat-style UI
- **Firebase** — Auth (Google), Firestore (real-time), Hosting
- **react-router-dom** v6

## Structure

```
src/
  contexts/AuthContext.tsx   # auth state + Google sign-in + user doc upsert
  components/                # Avatar, Spinner, ProtectedRoute
  lib/
    firebase.ts              # Firebase init
    types.ts                 # UserProfile, FriendRequest, Friendship, Message
    friends.ts               # add/accept/cancel requests + subscribe friendships
    chat.ts                  # send messages + subscribe + mark read
    time.ts                  # Thai date/time formatter
  pages/
    Login.tsx                # login page
    Friends.tsx              # tabs: chats / requests / add friend
    Chat.tsx                 # real-time chat room
firestore.rules              # Security Rules
firestore.indexes.json       # Composite indexes
firebase.json, .firebaserc
```

## Data Model (Firestore)

```
users/{uid}
  uid, email, emailLower, displayName, photoURL, createdAt, lastActiveAt

friendRequests/{autoId}
  fromUid, fromEmail, fromDisplayName, fromPhotoURL
  toEmailLower, toUid (null until the other side logs in for the first time)
  status: "pending" | "accepted" | "rejected" | "cancelled"
  createdAt, updatedAt

friendships/{pairId}    # pairId = sorted([uidA, uidB]).join("_")
  users: [uidA, uidB]
  userInfo: { [uid]: { displayName, photoURL, email } }
  lastMessage?: { text, senderUid, createdAt, messageId }
  createdAt

chats/{pairId}/messages/{messageId}
  senderUid, text, createdAt
  readBy: { [uid]: Timestamp }
```

## Setup

### 0. Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore + Realtime Database enabled

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/) -> Add project
2. Open the Build menu:
   - **Authentication** -> Get started -> Sign-in method -> enable **Google**
   - **Firestore Database** -> Create database -> Production mode
   - **Realtime Database** -> Create database
3. Project Settings -> General -> Your apps -> Web (`</>`) -> register app -> copy config

### 3. Configure env

```bash
cp .env.example .env
# Fill values from Firebase Console (including DATABASE_URL)
```

Required `.env` keys:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL= # DATABASE_URL from Realtime Database
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Update `.firebaserc` with your project ID.

### 4. Run local development server

```bash
npm run dev
```

### 5. Deploy Security Rules + Indexes

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

### 6. Deploy Web App

```bash
npm run deploy
```

## Authorized domains

Add your deployment domain in Firebase Console -> Authentication -> Settings -> Authorized domains.
(`localhost` and `*.web.app` / `*.firebaseapp.com` are added automatically.)

## Friend-Adding Flow

1. User A enters User B's email -> create a friendRequest (`toUid` may still be null if B has never logged in).
2. User B logs in for the first time -> `backfillIncomingRequests` fills `toUid` automatically.
3. User B sees the request in the "Requests" tab -> clicks "Accept" -> batch write creates friendship + updates status to accepted.
4. Both users immediately see the chat room in the "Chats" tab (real-time).

## Security Rules Summary

- `users/{uid}`: readable by authenticated users (for email search), writable only by owner
- `friendRequests`: readable only by sender/recipient
- `friendships`: accessible only by the 2 users in `users[]`, and doc id must be the correct `pairId`
- `chats/{pairId}/messages`: accessible only when the friendship document exists and the user is in `users[]`

## Next Steps (Not Implemented Yet)

- Typing indicator + online presence (use Realtime Database + `onDisconnect`)
- Push notification (FCM) - important because the core goal is message alerts
- PWA (installable, offline cache, notification)
- Block/unfriend
- Image sending (Firebase Storage)

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | type-check + build production |
| `npm run preview` | preview build |
| `npm run deploy` | build + deploy hosting |
| `npm run deploy:rules` | deploy firestore rules only |
| `npm run emulators` | run Firebase emulators (Auth + Firestore + Hosting) |
