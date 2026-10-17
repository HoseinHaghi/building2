# Verification — 2026-10-13

On 2026-10-17, the eight usability repairs passed lint, the production build, all 23 API tests and all 10 Chromium tests. Four new browser scenarios verify project/work/edit drafts after reload, preservation and actual upload of both selected files across project-picker confirmation and cancellation, optional prerequisites, report editing/deletion with cancellation, reopening completed work, project renaming, rejection of non-empty project deletion, empty-project deletion, confirmed dashboard work deletion, and logout in both sidebar states. Member tests also verify that another author's reports cannot be edited/deleted through either the interface or direct API calls. The four scenarios passed again after the final dialog styling adjustment. Form, report-editor, project-rename and deletion-confirmation screenshots were visually reviewed. Browser tests use a temporary database; the existing local account and uploads are not modified. Those initial repairs retained unsubmitted files in tab memory; the later update described below adds persistence across full reloads.

The subsequent requested fixes (items 1, 2, 3, 4, 6, 9 and 10) passed lint, the production build, all 23 API tests and a full 16-test Chromium run. All seven focused browser scenarios then passed, including the additional storage-unavailable case (17 distinct browser scenarios in total). Tests verify URL-backed project/task/floor selection and Back/Forward, explicit fetch errors and retry, per-user/work/report drafts after reload and navigation, IndexedDB file restoration with byte-identical uploads, early signature/size validation without replacing valid selections, deletion of file drafts on successful submission/logout, graceful storage failure with immediate uploads, separate assignment removal and confirmed subtree/file access revocation, Enter submission and persistent login/signup errors. Existing report history remains after revocation. The focused navigation test also checks that reselecting the current project does not append duplicate history entries. Error/retry and revoke-access screenshots were visually reviewed. Tests use isolated temporary server data and browser contexts.

Verified locally on Windows with Node 24.21.0.

| Check | Result |
|---|---|
| npm run lint | Passed, no errors or warnings |
| npm test | 23 tests passed |
| npm run build | Passed; output in dist |
| npm run test:e2e | 6 Chromium tests passed against the restored original frontend and real API |
| npm audit | 0 known vulnerabilities reported at the dependency verification step |
| npm --prefix server audit | 0 known vulnerabilities reported at the dependency verification step |
| Compose and GitHub Actions YAML parsing | Passed |
| Real legacy data import into temporary database | 27 projects, 6 works, 3 files; 2 missing legacy files reported |
| Original preview data in the requested local account | 68 new projects, 99 works (84 in progress / 15 done), 198 reports, 3 files |

The browser suite checks the original login/signup tabs and rounded inputs, username-only signup, protected routes, project/subproject creation, retained work drafts across project selection, work creation/editing, Persian attachment downloads, persistent reports, membership and assignees through the original dialog, completion, original task cards, missing work and password/session behavior. It checks for browser page errors during the main workflow.

On 2026-10-16, lint, the production build and all four Chromium tests passed after adding the project creation button to the sidebar. The main browser flow creates a project through the collapsed sidebar button and a subproject through its expanded version. Both sidebar screenshots were visually reviewed for matching colors, rounded shapes, spacing and placement above the profile footer.

Later on 2026-10-16, all five Chromium tests passed with the dashboard work-creation action. Root projects, direct children and a third-level project were used to create real works; the API's saved projectId was checked. Tests also cover preselection after reload, replacing an unrelated draft when starting a new work, cancellation back to the selected project and displaying the saved work on that project's board. Both sidebar action states were visually reviewed. The selected project is also included as a valid display-select option to avoid MUI out-of-range warnings.

The work-details close icon was subsequently verified with lint, a production build and the targeted Chromium workflow. Closing a root-project work and a directly reloaded nested-project work returns to the corresponding dashboard. The API check confirms that closing leaves the work in progress. The close icon's placement and styling were visually reviewed.

Cancellation was subsequently checked with lint, a production build and all six Chromium tests. The new regression test first reproduced the project picker selection reappearing after cancel and browser Back. Both creation forms now discard their saved drafts and consumed route state; title, parent-project toggle/selection, work floor, descriptions and both upload labels remain empty after cancel, Back and reload. The API confirms cancellation creates no project or work. Starting a fresh work from the dashboard still preselects the current project, and the existing creation and editing flows also pass.

At the user's request, 79 distinct task-cover images were generated with the built-in image_gen tool and installed on the existing h_haghi account. Prompts use each task's title, description, prerequisite and project hierarchy. Full-resolution WebP covers total 12,327,202 bytes. Verification fetched and decoded all 79 private image files, checked the actual cover on 11 representative work pages, and compared task titles, descriptions, prerequisites, project IDs, floors and statuses with the original inventory. All checks passed, including unique-image hashes, anonymous file-access denial and absence of browser page errors. Both contact sheets were visually reviewed. The temporary verification session was removed. The private cover/prompt manifest and verification report are in server/storage/generated-work-covers; application layouts and styles were not edited for this data update.

The API suite checks private project authorization, CSRF/origins, sessions, concurrent writes, uploads and quotas, backup/restore, username-only registration and migration from schema 1 to 2 without losing existing users, sessions or project ownership.

The preview importer was tested for private ownership, preserving existing data, original card ordering, repeated-import protection and rollback including copied files. The live local account's existing users/projects/works were compared against the pre-import backup. A temporary session was used to check the real API and original board, task cards, assignees and reports in Chromium; it was removed afterwards. No browser page errors were reported. The original two missing legacy files remain unavailable. Sample actor passwords are random and undisclosed; preview data is never seeded automatically or in production.

The six original UI component files were recovered from the untouched BuildingFront-Back.zip. Their styles/layouts were preserved while API wiring and original broken actions were repaired. Added navigation and the new settings page were removed. No Figma screenshot or design context was accessible: the connector reports missing Editor access to file VsWHrkfClTuupFsH457Set. Exact parity with the Final section is still pending access and cannot be claimed.

Original server/data.json and server/uploads were retained. New runtime data is separate in server/storage.

Docker is not installed in the local environment. The Docker image and live Caddy/HTTPS deployment were not executed locally. CI includes an image build and container health smoke test; run the documented Docker commands on the Linux server before opening the application to users.

This package targets one application instance on one server. Password recovery is available to the server operator through the maintenance CLI; email-based recovery is not configured. The original interface does not include a newly designed settings page; profile/password APIs remain available.
