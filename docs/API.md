# Building API

Base path: /api. All responses are JSON except authenticated file downloads and successful deletes (204).

Authentication uses an HttpOnly cookie. Register/login/me return { user, csrfToken }. Send X-CSRF-Token on every authenticated POST, PUT, PATCH and DELETE. Keep the CSRF token in memory; fetch /auth/me after reload. Browser Origin must equal APP_ORIGIN. There is no Bearer demo token.

## Authentication

| Method | Path | Body |
|---|---|---|
| POST | /auth/register | { name, username, password, email?: string } |
| POST | /auth/login | { identifier, password } — username or email |
| GET | /auth/me | Returns current user and CSRF token |
| POST | /auth/logout | No body; expires cookie and deletes session |
| PATCH | /auth/profile | { name } |
| POST | /auth/password | { currentPassword, password }; revokes all sessions and returns a new one |

username: 3–40 ASCII letters, digits or underscores; normalized to lowercase.
password: 10–128 characters; never returned. name: 1–100 characters.
Email is optional; omitted or empty email is stored as null. The original signup form sends name (first and last name combined), username and password. Returned user.email can be null. Database migration 2 keeps existing users, sessions and project ownership while allowing username-only accounts.

The session is valid for seven days. Auth writes are limited to 30 requests per IP per 15 minutes; all API calls to 300 per IP per minute.

Network errors and 5xx responses from `/auth/me` do not establish that the session is invalid. Keep the protected URL and draft and offer retry; only 401 requires login.

## Safe creation retries and concurrent edits

`POST /projects`, `POST /works` and `POST /works/:id/reports` accept an optional `Idempotency-Key` (16–128 ASCII letters, digits, underscores or hyphens). The frontend uses a UUID persisted for the lifetime of each draft, including retries, payload edits and full reloads. Clear it only after acknowledged success, explicit discard or starting a fresh draft. Validation failures do not consume the key. Legacy callers that omit it retain ordinary POST semantics.

Keys are scoped to the authenticated user and recorded transactionally in schema migration 3. A retry of the same method, route and payload returns the same resource with status 201, including after a server restart. JSON key ordering and multipart boundaries do not matter; uploaded filenames, content types, sizes and actual bytes do. Reusing a key with a different payload returns 409. A recorded resource that was subsequently deleted returns 410. Current authorization is always checked; a stored key cannot restore revoked access. A replay returns the current resource representation and does not undo subsequent edits.

Works and reports include an opaque `version` string. Send the version that the user actually began editing as a quoted `If-Match` header, e.g. `If-Match: "<version>"`, on `PATCH /works/:id`, `PATCH /works/:id/status`, `PUT /works/:id/assignees` and `PATCH /works/:id/reports/:reportId`. Missing headers return 428; mismatches return 412 without applying the change. Read, compare and write happen in the same transaction. Work versions include metadata, status, assignees and file records; report versions are independent. Persist the baseline version with an edit draft rather than replacing it when background queries refresh. On conflict, preserve the user's input and explicitly review/reload the latest information before retrying. These preconditions do not apply to deletes, project renames or member invitations.

## Projects

| Method | Path | Body / response |
|---|---|---|
| GET | /projects | Flat array of accessible projects |
| GET | /projects/roots | Accessible root projects |
| GET | /projects/tree | Nested array with children |
| GET | /projects/:id | A project |
| POST | /projects | { name, parentId?: string or null } |
| PATCH | /projects/:id | { name }; owner only |
| DELETE | /projects/:id | Owner only; 409 when it contains children or works |
| GET | /projects/:id/members | { ownerId, rootId, canManage, members } |
| POST | /projects/:id/members | { identifier }; exact registered username/email, owner only |
| DELETE | /projects/:id/members/:userId | Owner only; removes assignments within the root subtree |

A project contains id, name, label, parentId, rootId, ownerId, canManage, pathNames, displayPath and createdAt.
Membership belongs to the root and is inherited by all children. Parent links cannot be edited; maximum nesting depth is 12.

## Works

| Method | Path | Body / response |
|---|---|---|
| GET | /works | { items, total, page, limit } |
| GET | /works/:id | One work |
| POST | /works | JSON or multipart/form-data |
| PATCH | /works/:id | JSON or multipart/form-data; full editable fields |
| PATCH | /works/:id/status | { status: "in_progress" or "done" } |
| PUT | /works/:id/assignees | { userIds: string[] }; project members only |
| DELETE | /works/:id | Removes work, reports, assignments and files |

Create fields: title, projectId, floorNum (integer 1–7), summary and prerequisite (optional).
Update fields: title, floorNum, summary and prerequisite; projectId must remain the same if sent.
Optional multipart files: cover, attachment. Each max 10 MiB. Covers must have PNG/JPEG/WebP signatures; attachments always download with application/octet-stream.
On update send removeCover="true" and/or removeAttachment="true" to remove an existing file. An incoming replacement takes precedence over removal.
Maximum total files per root project: 500 MiB. Uploads stop if fewer than 100 MiB would remain free on the server.

List filters: projectId (includes descendants), mine=true (creator or assignee), status, floorNum, q (literal title substring), page (default 1), limit (default 50, max 100).
URL-encode all path ids. IDs are immutable; the floor currently assigned to a work is floorNum, not an id segment.

A work includes creator, assignees, cover/attachment { id, name, size, url }, canEdit and canChangeStatus in addition to its details. Filesystem paths and password hashes are never exposed.

## Reports and files

| Method | Path | Body / response |
|---|---|---|
| GET | /works/:id/reports | Report array, oldest first |
| POST | /works/:id/reports | { text }; maximum 10,000 characters |
| PATCH | /works/:id/reports/:reportId | { text }; author or project owner |
| DELETE | /works/:id/reports/:reportId | Author or project owner |
| GET | /files/:id | Private inline cover or attachment download |
| GET | /health | { ok: true }; database availability |

Report writes never change work status.

## Errors

{ error: "user-facing message", requestId: "correlation id" }. Rate-limit responses contain error and standard RateLimit headers.

- 400: invalid body, fields or files.
- 401: missing or expired session.
- 403: CSRF/origin violation or operation forbidden to a project member.
- 404: missing resource or resource outside the user's projects.
- 409: duplicate account, non-empty project deletion or changed payload for a previously committed request key.
- 410: the resource recorded for a creation retry has since been deleted.
- 412: the supplied edit version is stale; no change was applied.
- 413: request/body or project file quota exceeded.
- 428: an edit is missing its required If-Match version.
- 429: request limit reached.
- 500: internal error; detailed cause is logged with requestId.
- 507: insufficient server disk space.
