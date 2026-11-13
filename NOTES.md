# DueDay notes

## Run it

1. In the project folder, run `node helper/server.js`.
2. In a second terminal, run `.\\node_modules\\.bin\\expo.cmd start --lan` (this computer does not expose `npx`; the local Expo CLI is the SDK-matched equivalent).
3. Scan the Expo Go QR code while the phone and computer use the same Wi-Fi.

The helper listens on port 3001 and reads the OpenAI key only from `.env`. The app never contains the key. Expo LAN mode is required so the phone can reach the computer helper. If Expo is running through a tunnel, use LAN mode instead.

## Done

- Expo SDK 58 is kept because Expo Go on the phone supports SDK 58. The project uses `expo ~58.0.25`.
- MVP 1: paste assignment text and let AI find a clear due date.
- MVP 2: save a local phone reminder before the due date. Lock-screen wording is general: “You have schoolwork due soon.”
- MVP 3: save assignments on the phone and show them sorted by due date.
- MVP 4: ask a question answered only from the saved assignments.
- The AI helper sends the instructions from `BRIEF.md` with every OpenAI request and uses the `gpt-5.6-luna` model named here.
- The app shows the date source, asks the student to confirm uncertain dates, and includes an incorrect-date report button.
- `expo-notifications` local notifications work in Expo Go; remote push notifications are not part of this version.
- The live helper path is wired, but the current OpenAI request returned HTTP 401; replace the local key in `.env` if the AI buttons show an error.
- After each save point, push it to GitHub.

## Check the MVP features in 2 steps each

1. AI date extraction: Paste `Science project is due Friday, November 20` and tap `Find due date with AI`.
2. Confirm the date appears, then tap `Save assignment & reminder`.

1. Phone reminder: Allow notifications when the phone asks and save an assignment due tomorrow after the day-before time.
2. Wait about one minute for the demo reminder, or use a far-future date to test the normal day-before schedule.

1. Sorted list: Save two assignments with different due dates.
2. Check that the earlier date appears first under `Your due dates`.

1. Safe AI question: Save at least two assignments and ask `What is due first?`.
2. Check that the answer uses only the assignments saved on this phone.

## Maybe Later

- The user can see where each date came from, like entered by you.
- The user can report an incorrect date the AI found.
- The user can choose general lock-screen reminders that hide assignment names.
- The user can mark an assignment done so its reminders stop.
- The user can choose how early reminders come, like one day before.
- The user can break a big project into smaller tasks with their own dates.
- The user can mute reminders for a chosen time.
- The user can see a weekly view of what is due.
