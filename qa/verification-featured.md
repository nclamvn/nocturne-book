# Khởi Nguồn integration — 0.7.0

2026-10-10. Bundled the original Khởi Nguồn PDF, Nguyễn Cảnh Lâm, 360 pages, 2,948,055 bytes. SHA-256 d783ee55c1de1e29bfc719d67899b97e1b443c73315d481263b39857dd43aa9a. PDF byte-for-byte unchanged. No embedded attachments; source catalogue had no OpenAction or document-level JavaScript names entry.

- Opens as the default book without file selection. Author name, 360-page total and download link are present.
- Native WebGPU observed. Page 360 displays and Next is disabled; jump to 10 displays printed 10–11. Day/night transition had no warning/error entries.
- Download endpoint returned HTTP 200, application/pdf, matching length and SHA-256. No extra download copy was saved.
- Screenshot: khoi-nguon-featured.jpg, 1440×900; temporary viewport reset after QA.
- npm run check: syntax and module/resource paths for 22 files. npm test: 19 passed, zero failed, including exact bundled PDF fingerprint and attribution.
- Gitleaks 8.30.1: all existing Git history, current directory, and decoded PDF text/metadata scanned; zero findings. All reports use --redact. Pattern scans are not an absolute guarantee of absence of every possible secret.
- Current distribution tree no longer has borrowed reference pages, logo or grain. Licensed OFL font and its original license notices retained; book rights documented separately. Private reference files moved outside the distributable project without copying.

The owner selected preserve history and do not publish. No history rewrite, force-push or public deployment by this task. GitHub reported PUBLIC at final verification; repository visibility was restored to PRIVATE to follow the owner’s explicit choice. Earlier Git history still contains reference page images without a recorded redistribution license; repositoryPublicReady remains false. Runtime is ready for the owner's private demonstration.
