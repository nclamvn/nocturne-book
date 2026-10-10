# Polish and cleanup verification — v0.6.0

2026-10-10. Local app at http://127.0.0.1:8768/?review=8.

## Product changes

- Increased control hit areas and idle visibility; preserved quiet night/Paper Mono palette.
- G / C / R select page, move and rotation modes. 0 resets to reading pose while preserving the page.
- Added a two-pixel reading progress strip and native labelled progress indicator. Fixture spread 202–203 produced value=203, max=320.
- Lamp and bookmark popovers are mutually exclusive, close on outside pointer input or Escape, and restore focus on explicit close. Opening lamp focuses its range; opening bookmarks focuses its close button.
- Help dialog has an accessible name, maximum viewport height, scrolling and retained access at narrow widths. At 1280×720, its top was 24px and its bounded height was 672px; overflow content remained scrollable.
- Loading controls are disabled until the scene/document is ready. Duplicate simultaneous file loads are ignored. Access to browser storage is guarded.

## Verification

- npm run check: syntax and local module/HTML asset links for 21 .mjs files, plus all reference asset provenance paths.
- npm test: 18 passed, 0 failed after cleanup.
- Native WebGPU renderer initialized after removal of GLSL paths. No warning/error entries in the new QA tab.
- Forced WebGL 2 initialized using the same TSL materials; day → night switched without warnings/errors. Temporary fallback tab closed after verification.
- Native PDF fixture: printed 200–201 loaded. Rotation drag produced quaternion (-.142,.283,.155,.936); move drag produced (.217,.152,.006) during descent. Subsequent page drag committed 202–203; reset returned identity pose without changing the spread. No console warnings/errors.
- Keyboard R selected rotation; C selected move; 0 restored page mode. Escape from lamp range restored focus to its trigger. Opening bookmarks closed lamp. Opening help closed bookmarks.

- Final cleaned scene (including removal of invisible meshes) reloaded on WebGPU with no console warnings/errors; 800×600 help was accessible, bounded to 552px at top 24px, with scrollable content.
- Final screenshot: qa/polish-desktop.jpg, fixture 200–201, 1280×720. Temporary viewport override reset; user tab was not replaced.

## Cleanup and delivery

- One renderer/material path for both backends; removed unused WebGL-only bundle, GLSL shader code, obsolete generated demo and invisible book meshes.
- Source, HTML, CSS and tests formatted using an already installed local formatter.
- 32 obsolete QA images/GIF/timing files removed (22.27 MiB). Six historical reports moved outside the product to ../outputs/nocturne-book-history-20261010 without copying. Current QA evidence retained.
- Repository excludes private PDFs (except the original test fixture), env files, logs, dependencies and caches. No dependency install, build or temporary project copy.
- README documents current runtime and limits; GitHub Actions runs syntax/resource and unit checks without installing dependencies.

Screenshots use the locally generated fixture, not the user's novel. No frame-rate/4K benchmark or rigid-body physics claim.
