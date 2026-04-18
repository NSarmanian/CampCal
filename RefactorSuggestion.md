Phase 4 Refactor Map (Proposed, No Code Changes Yet)

Goal
Move repeated inline page scripts into reusable modules under src, while preserving existing behavior and minimizing risk.

Target Architecture

src/appSession.js
src/dateUtils.js
src/eventStore.js
src/profileStore.js
src/uiHomeCalendar.js
src/uiProfileCalendar.js
Keep existing gamification.js as-is (already shared)
1) appSession Module
File: src/appSession.js (new)

Responsibilities:

Read current user name from localStorage.
Apply navbar user link behavior (Welcome + profile link vs Log In + auth link).
Shared helper for “require logged-in user” checks.
Functions:

getCurrentUserName()
applyNavbarUserLink(selector = '.user a')
isLoggedIn()
Used by:

home.html
auth.html
signup.html
eventCreation.html
profileSettings.html
profilePreferences.html
leaderboard.html
2) dateUtils Module
File: src/dateUtils.js (new)

Responsibilities:

Shared date formatting and time formatting.
Shared date+time sort logic.
Shared phone formatter.
Functions:

formatDateLocal(dateObj)
formatReadableDate(dateStr, includeWeekday = false)
formatTime(timeStr)
sortEventsByDateTime(events)
formatPhoneNumber(value)
Used by:

home.html
profileSettings.html
signup.html
profilePreferences.html
3) eventStore Module
File: src/eventStore.js (new)

Responsibilities:

Load merged events from seed + local-created.
Save newly created event.
Provide common selectors for day/upcoming filtering.
Functions:

loadAllEvents()
getEventsForDate(allEvents, dateStr)
getUpcomingEvents(allEvents, todayDate = new Date(), limit = 8)
createAndStoreEvent(payload)
: adds event ID, persists to campCalCreatedEvents, returns created object.
Used by:

home.html
profileSettings.html
eventCreation.html
4) profileStore Module
File: src/profileStore.js (new)

Responsibilities:

Single source for profile localStorage keys.
Read/write profile payload.
Compose display full name.
Functions:

getProfile()
saveProfile(profileData)
getFullNameFromProfile(profileData)
Used by:

signup.html
profileSettings.html
profilePreferences.html
5) uiHomeCalendar Module
File: src/uiHomeCalendar.js (new)

Responsibilities:

Own home-page calendar rendering and handlers.
Use eventStore, dateUtils, and gamification APIs.
Keep home.html mostly orchestration-only.
Functions:

initHomeCalendar({ selectors })
Internal: renderUpcomingEvents, renderSelectedDay, renderCalendar, RSVP binding.
Used by:

home.html
6) uiProfileCalendar Module
File: src/uiProfileCalendar.js (new)

Responsibilities:

Own profile mini-calendar and selected-day rendering.
Reuse eventStore + dateUtils.
Keep points/leaderboard/history rendering in profileSettings script or split later.
Functions:

initProfileCalendar({ selectors })
Used by:

profileSettings.html
HTML Script Strategy
To avoid bundlers and keep static compatibility:

Use <script type="module"> in each page.
Import needed module(s) directly from src.
Keep gamification.js as classic script for now, or optionally convert to ESM in a later pass.
Transition gradually page-by-page, not all at once.
Recommended Implementation Order (Low Risk)

Extract appSession.js and wire nav greeting across pages.
Extract dateUtils.js; replace duplicated formatters.
Extract eventStore.js; update home/profile settings/event creation to use it.
Extract profileStore.js; update signup/settings/preferences.
Extract uiHomeCalendar.js; slim home.html.
Extract uiProfileCalendar.js; slim profileSettings.html.
Final pass: remove dead inline helpers and verify behavior parity.
Behavior Parity Checklist

Navbar user link still updates correctly on every page.
Event creation still awards points and persists createdBy.
RSVP duplicate prevention still works.
Leaderboard page still reads same current semester standings.
Profile settings still shows points HUD + archive.
Phone formatting still works on signup/settings/preferences.
Calendar month navigation and selected-day behavior unchanged.
What Will Not Change in Phase 4

No data model changes.
No points or leaderboard math changes.
No UI redesign requirement.
No backend introduction.
If you approve this map, I’ll implement it in small commits-in-place style (module by module), validating after each step so regressions are easy to catch.