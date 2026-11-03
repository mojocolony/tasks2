# Tasks — Now, Later & Someday (v0.1.11 preview)

A separate, mobile-first proof of the new Tasks app. **It is not a modification of the existing `mojocolony/tasks` project.** It has no connection to the old app or its Dropbox file, and it never reads or migrates old app data.

## v0.1.11 icon asset refresh

- Applied the blue `#1BADF8`, 2px-stroke Lucide Square Check to header, favicon, and new raster PWA icons (192px and 512px).
- Versioned all icon URLs to refresh the previously cached iPhone Home Screen artwork.
- No local task data or storage keys changed.

## v0.1.10 Square Check icon

- Uses the exact supplied Lucide Square Check SVG in blue `#1badf8` with stroke width 2 as the brand mark and SVG browser favicon.
- New 192px and 512px Home Screen PNG icons use the same symbol on white for good contrast.
- Icon and CSS/JS/manifest URLs are versioned to make iPhone updates more reliable. No task data or sync behaviour is changed.

## v0.1.9 Someday list

- Added **Someday** as the third permanent, foldable list on the Tasks page, immediately below Later.
- A saved pre-v0.1.9 local workspace automatically gains Someday without modifying any existing tasks, custom lists, order, or notes.
- Someday supports new tasks, completion, moving/dragging, collapse, Sparkles filter, and page-wide completed-task clearing and restoration.
- Someday cannot be renamed or deleted. User-created lists remain on the Lists page.

## v0.1.8 mobile settings drawer

- On phones, Settings uses a right-side drawer sized with dynamic viewport height (`100dvh`) so Safari's toolbar no longer obscures its bottom.
- The drawer scrolls independently with native vertical touch scrolling, extra bottom safe-area padding, and a sticky Settings/Close header.
- Desktop remains a smaller popover, now with a dynamic viewport height limit.
- This change affects layout and versioning only; it does not modify saved tasks, backup keys, or the separate original Tasks app.

## v0.1.7 delete colour

- Swipe-to-delete uses the requested coral `#FCA886`, with dark text/icons for legibility in light and provisional dark themes.
- This colour applies only to the swipe-to-delete surface, leaving other danger controls and task data untouched.

## v0.1.6 expanded-task layout fix

- Delete swipe surface is now confined to the task title row; it cannot bleed into an expanded note area or appear from an ordinary tap.
- The Delete button is hidden and non-interactive unless a swipe has opened it.
- Compact notes editor and simpler Mark important control, without the redundant instruction text.
- Local task data is unchanged.

## v0.1.5 offline update fix

- Replaced the service worker's cache-first behaviour with a network-first strategy and offline fallback. It now uses a new isolated cache namespace version and includes the versioned core module.
- A normal refresh after the new service worker activates will load the latest published assets. Existing browser data and the separate original Tasks app are untouched.

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

- Canonical Now, Later and Someday lists on the first page; swipe or tap to access a second page of user-created lists.
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
