# Controls / WebGPU verification — 2026-10-10

Local build v0.5, http://127.0.0.1:8768/?review=7. Desktop QA viewport 1440×900. PDF is the locally generated tests/fixture-320.pdf, not the user’s novel.

- Native backend observed through #scene[data-renderer]: WebGPU. Forced renderer=webgl initialized WebGL 2. Pages, book thickness, lantern and desk rendered in both.
- node --test tests/*.test.mjs: 18 passed, 0 failed. Covers camera fit/perspective, camera-space trackball, eight-corner floor clearance, release settling, cache bounds, document state and page release.
- Xoay 3D drag (720,500) → (980,355) produced quaternion (-.166,.309,.277,.895). All three axes changed and adaptive framing retained the book. Evidence: webgpu-rotated-pdf.jpg.
- Cầm sách drag (620,480) → (740,385) produced position (.445,.309,.170), then (.445,.309,0) after release. Horizontal placement remained. Evidence: webgpu-moved-pdf.jpg.
- Giở trang after moving the book committed printed spread 210–211 → 212–213. Actual PDF textures visibly updated. Evidence: webgpu-page-after-move.jpg.
- Trở về góc đọc resets object pose, camera and zoom while preserving reading position. Default camera angle reduced from 1.10 to .55 radians; far edge stays narrower than near edge. Tests cover both views and rotated bounds.
- Brightness range End selected 150%; five ArrowLeft presses selected 125%. #scene[data-lamp-brightness] matched 1.5 and 1.25. Escape closed the panel with focus in the range input. Restored 125%.
- Day → night regression found a Three r186 lightShadowMatrix error when castShadow was toggled off for explicitly retained TSL point-shadow nodes. Fixed by retaining castShadow for GPU nodes and freezing inactive shadow maps via autoUpdate/needsUpdate. Repeated day → night after reload: no new warn/error entries; old pre-fix entries remain in browser log history.
- After the fix, three successive lantern crops had three distinct SHA-256 hashes while motion was enabled. Reduced motion yielded identical crops: 714791a08d3c0344aa2e2e462a04ef50eb37aca8fbe8ad5949e3c5c03613e3ed. Restored animation enabled. Final native WebGPU reading screenshot: webgpu-reading-pdf.jpg, printed 200–201, brightness 125%.
- webgpu-day-pdf.jpg is daytime PDF evidence. No user screenshot was inserted into the book texture.

No 60 FPS / 4K benchmark. Object settling is a constrained animation with floor clearance, not rigid-body physics or collision with the lantern. Pixel hash differences establish frame changes, not a perceptual quality score.

Cleanup: removed empty qa/codex-tmp-controls-20261010; downloaded three.tsl.js was removed because the renderer bundle exports TSL directly. No project copy, dependency install, venv or build directory was created.
