# Tasks — Now & Later (v0.1.4 preview)

A separate, mobile-first proof of the new Tasks app. **It is not a modification of the existing `mojocolony/tasks` project.** It has no connection to the old app or its Dropbox file, and it never reads or migrates old app data.

## v0.1.4 adjustment

- Kept Lucide Sparkles but returned the clear-completed action to a deliberate **downward pull near the top of the task page**. The app now claims this touch gesture earlier and sets CSS overscroll containment to suppress browser pull-to-refresh where supported. The clear threshold is 120px; the Undo and Recently Cleared controls remain.
- Pull to clear is available only when completed tasks exist on the current page and the gesture begins in a blank part of the upper page (not on a task, input, or button).
- The native browser gesture can vary by Safari/iOS version; test on the actual device. Settings still offers the clear-completed fallback.

## v0.1.3 changes

- Replaced all ⚡ controls with the exact Lucide Sparkles SVG. Existing starred data stays unchanged.
- A Sparkles-only filter may display empty lists until a task is marked important; the empty state now explains this and the filter banner offers Show all.
- The subsequent v0.1.4 change restores **pull down** from blank space at the top to clear completed tasks. Undo and Recently Cleared are preserved.

## v0.1.2 correction

New tasks are unstarred regardless of filter state. The ⚡ symbol appears on a row only when explicitly starred. Expand a task to mark it important or remove its star.

## Implemented in this preview

- Canonical Now and Later lists on the first page; swipe or tap to access a second page of user-created lists.
- Collapse or expand any list; collapse all from the hamburger menu.
- Add and edit tasks; custom lists may be created, renamed, and deleted. Deleting a list moves its tasks to Later.
- Tap checkbox to complete/uncomplete; completed tasks remain crossed out and dimmed.
- Tap task title to expand a note editor. Text is saved automatically. HTTP/HTTPS URLs are shown as clickable links underneath.
- Swipe a task left to reveal Delete. Deleted tasks have an Undo action.
- Pull down deliberately from blank space at the top of the page to clear completed tasks on that page (120px gesture threshold); Undo and a Recently Cleared restore action are provided.
- Drag tasks within or between lists, including collapsed/empty lists; drag to the screen edge to flip pages. There is a dedicated drag handle as a fallback.
- Floating pill: outlined in blue with a white (or dark-theme) interior and blue icons; add above, Sparkles-only filter below.
- IBM Plex Mono; font scale options; selected light palette; provisional dark mode.
- Offline app shell via a uniquely scoped service worker, and local data persistence using IndexedDB with a localStorage backup.
- JSON export/import restricted to this app's own format (does not accept backups from the older app).

## Deliberately not connected yet

- **No account sign-in/sign-out or Supabase sync yet.** Sign out is visibly disabled in this preview. Data is local to the device/browser; export backups before clearing browser data.
- No production repository or GitHub Pages deployment has been created. A new repository (suggested: `mojocolony/tasks-now-later`) must be created before deployment.
- Dark colours are placeholders until the final palette is supplied.
- iPhone/iPad Safari gesture behavior has not yet been verified on physical devices; test before using the app for important data.

## Run the preview on a Mac

Open a terminal in the extracted folder and run:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173/` in a browser.

To see example tasks without adding your own, open `http://localhost:4173/?demo=1` in a new browser profile, or before any tasks have been saved in this preview.

This static site can be deployed to **a new** GitHub Pages repository without a build step. Do not upload it into `mojocolony/tasks`.

## Automated tests

```bash
node tests/test-core.mjs
```

These tests cover isolation of the backup format, add/complete/clear/restore, reordering and moving between lists, deletion/undo, and custom-list deletion. Browser smoke tests checked task completion, note editing/link recognition, creating custom lists, drag between Now and Later, Undo after clearing, and horizontal page swipe in headless Chromium. Device-native Safari gesture and installed-PWA tests remain outstanding.

## Storage isolation

- IndexedDB database: `tasks-now-later-v1`
- IndexedDB record: `documents/workspace`
- Local fallback key: `tasks-now-later-v1-backup`
- Service-worker cache prefix: `tasks-now-later-`
- Backup file format identifier: `tasks-now-later`

The existing Tasks app's `tasks-v13`, `tasks-v2`, Dropbox tokens, and `/tasks.json` are never accessed.
