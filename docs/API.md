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
- 409: duplicate account or non-empty project deletion.
- 413: request/body or project file quota exceeded.
- 429: request limit reached.
- 500: internal error; detailed cause is logged with requestId.
- 507: insufficient server disk space.
