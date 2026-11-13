# DueDay notes

## Run it

1. In the project folder, run `node helper/server.js`.
2. In a second terminal, run `npx expo start --lan` (on this computer, use `.\\node_modules\\.bin\\expo.cmd start --lan` if `npx` is unavailable).
3. Scan the Expo Go QR code while the phone and computer use the same Wi-Fi.

The helper reads the OpenAI key only from `.env`. The app never contains the key. Expo LAN mode is required so the phone can reach the computer helper.

## Done

- SDK 58 Expo blank app created and checked with Expo Doctor.
- One-screen Version 1: assignment, due date, AI reminder, “entered by you” source, date-safety note, and report button.
- Assignment and due date save locally on the phone.
- Computer-side OpenAI helper uses `gpt-5.6-luna` from this note and sends the AI instructions from `BRIEF.md` with every request.
- `.env` stays ignored by Git.
- After each save point, push it to GitHub.

## Check the main job in 2 steps

1. Enter an assignment and due date.
2. Tap “Get my reminder” and confirm that the one-sentence reminder appears.

## Maybe Later

- Real scheduled notifications with general lock-screen wording.
- School-system or calendar import with clear date sources.
- Student, parent, and teacher accounts with separate permissions.
- Reminder history, date picker, and a way to send an incorrect-date report.
- A short challenge video and the written PDF entry.
