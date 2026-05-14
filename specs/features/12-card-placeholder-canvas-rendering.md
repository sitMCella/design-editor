# Feature Spec: Project Card Canvas Thumbnail

## Summary

Replace the grey placeholder in project cards with a live screenshot of the design canvas. After each successful auto-save the frontend captures the `DesignSurface` DOM node, compresses it to a JPEG thumbnail, and uploads it to the backend. The thumbnail is stored on the asset volume, its URL is recorded on the `project` row, and included in the project list response so cards can display it immediately on home page load.

## Scope

**In scope**
- Thumbnail generation on the frontend using `html2canvas`, triggered after each successful auto-save
- New `POST /api/projects/:id/thumbnail` endpoint — accepts a JPEG blob, writes to asset volume, updates `project.thumbnail_url`
- New `GET /api/projects/:id/thumbnail` endpoint — streams the stored thumbnail file
- `thumbnail_url` column on the `project` table (nullable; `NULL` for projects with no thumbnail yet)
- `thumbnailUrl` field added to `ProjectSummary` (included in `GET /api/projects` list response)
- `ProjectCard` renders `<img>` when `thumbnailUrl` is present; grey placeholder as fallback
- Thumbnail is silently regenerated on every successful auto-save (overwrites previous)
- Thumbnail generation failures are silent — no user-visible error, no retry

**Out of scope**
- Thumbnail generation at design creation time (the first thumbnail is produced after the first auto-save mutation)
- Manual "refresh thumbnail" action
- Server-side rendering of thumbnails (e.g., Puppeteer)
- Thumbnail generation in response to undo/redo actions (auto-save already debounces these)
- Animated or video thumbnails
- Thumbnail for designs that have never been auto-saved

---

## Design Decisions

### Client-side vs. server-side rendering

| Approach | Pros | Cons |
|---|---|---|
| Client-side (`html2canvas`) | Reuses the existing React rendering stack; no extra infrastructure; renders exactly what the user sees | Requires a JS library; result may differ slightly from print-quality export |
| Server-side (Puppeteer / Playwright headless) | High fidelity; consistent across clients | Significant infrastructure overhead; slow; adds heavy Node.js dependency to the backend |

**Decision: client-side with `html2canvas`.** The design surface already renders correctly in the browser. Capturing the DOM node reuses all existing element renderers (text, image, arrow, table) with zero duplication. Puppeteer would require a separate service or at minimum a heavy backend dependency for a feature whose primary value is "good enough" visual recognition at 320 × 180 px.

### Stored thumbnail vs. on-the-fly rendering in the card

The `GET /api/projects` list endpoint intentionally omits `canvas` to keep the response lightweight (see spec 07). Rendering a live miniature canvas in every card would require including the full element array in the list response, reversing that decision.

**Decision: generate once (on auto-save) and store.** The thumbnail URL is returned as part of `ProjectSummary`, so cards load instantly with no additional network requests.

### Thumbnail storage: asset table vs. project-scoped file

The existing `asset` table tracks provenance (`original_url`), MIME type, and size for user-uploaded or HTTP-fetched images. Thumbnails are internal, mutable artefacts — they are overwritten on every save and have no external provenance. Inserting and then updating `asset` rows would pollute the table with synthetic entries and require a FK on `project`.

**Decision: write thumbnail files directly to the asset volume using a predictable filename (`thumb_{projectId}.jpg`), bypassing the `asset` table.** A new, dedicated thumbnail endpoint manages the file. This keeps the `asset` table clean and the update path simple (overwrite in place).

---

## Database Schema

```sql
-- 003_add_project_thumbnail.sql
ALTER TABLE project
  ADD COLUMN thumbnail_url TEXT;
```

`thumbnail_url` is `NULL` for projects that have never been auto-saved after this feature ships, or for projects whose thumbnail generation failed. The frontend gracefully falls back to the grey placeholder in either case.

---

## API

### `POST /api/projects/:id/thumbnail`

Upload or replace the thumbnail for a project. The request body is `multipart/form-data` with a single field `file` containing the JPEG blob.

**Server-side behaviour**

1. Look up the project by `id`; return `404` if not found.
2. Validate `Content-Type` of the uploaded part — must be `image/jpeg`. Reject with `400 INVALID_FILE` otherwise.
3. Enforce a maximum upload size of **512 KB**. Reject with `400 TOO_LARGE` if exceeded.
4. Write the file to `{ASSET_DIR}/thumb_{id}.jpg` (overwrite if it already exists).
5. Set `project.thumbnail_url = '/api/projects/{id}/thumbnail'` and `project.updated_at = now()`.
6. Return `204 No Content`.

**Errors**

| Status | Code | Condition |
|---|---|---|
| `400` | `INVALID_FILE` | Uploaded part is not `image/jpeg` |
| `400` | `TOO_LARGE` | File exceeds 512 KB |
| `404` | `NOT_FOUND` | No project with that id |

---

### `GET /api/projects/:id/thumbnail`

Stream the stored thumbnail file.

**Response headers**
```
Content-Type: image/jpeg
Cache-Control: no-cache
```

`no-cache` (not `immutable`) is used because the thumbnail changes on each auto-save. The browser will revalidate, but if the content is unchanged the server will serve a `304 Not Modified`.

**Errors**

| Status | Code | Condition |
|---|---|---|
| `404` | `NOT_FOUND` | No project with that id, or thumbnail file missing from disk |

---

### `GET /api/projects` (extended)

`thumbnailUrl` is added to every item in the list response. Its value is `'/api/projects/{id}/thumbnail'` when a thumbnail file exists, or `null` when it does not.

**Response `200` (extended)**
```json
{
  "ok": true,
  "data": [
    {
      "id": "abc123",
      "name": "My Design",
      "elementCount": 3,
      "thumbnailUrl": "/api/projects/abc123/thumbnail",
      "createdAt": "2026-05-10T10:00:00Z",
      "updatedAt": "2026-05-10T10:07:30Z"
    }
  ]
}
```

The backend checks for the existence of `{ASSET_DIR}/thumb_{id}.jpg` for each row and sets `thumbnailUrl` accordingly. This check is per-row and runs in memory (no additional DB query) using a filesystem stat.

---

## Frontend

### Dependency

```bash
pnpm add html2canvas
```

`html2canvas` captures a DOM node to an `HTMLCanvasElement`. The captured canvas is then exported as a compressed JPEG blob.

### Thumbnail generation

A `useThumbnail` hook is responsible for triggering and uploading the thumbnail. It is mounted inside `EditorPage` alongside the auto-save effect.

```ts
// src/hooks/useThumbnail.ts
export function useThumbnail(designId: string, surfaceRef: RefObject<HTMLDivElement | null>): void
```

**Trigger**: the hook watches `isDirty` from the canvas store. Whenever `isDirty` transitions from `true` to `false` (i.e., a successful auto-save has just completed and `markSaved()` was called), it schedules thumbnail generation.

**Generation steps**:
1. Call `html2canvas(surfaceRef.current, { scale: 0.25, useCORS: true, logging: false })`.
   - `scale: 0.25` produces a 320 × 180 px image from the 1280 × 720 design surface.
   - `useCORS: true` allows image elements with HTTP sources to be included.
2. Call `canvas.toBlob(blob => ..., 'image/jpeg', 0.7)` — quality `0.7` gives a good balance between file size and visual clarity.
3. Build a `FormData` with the blob appended as `file`.
4. Call `POST /api/projects/:id/thumbnail` with the `FormData` body.
5. If the request fails for any reason, swallow the error silently.

The generation is fire-and-forget — it does not block the auto-save flow and does not set `isDirty` or trigger any store mutation.

**Debounce / guard**: a `generating` ref prevents concurrent thumbnail jobs. If a save completes while a previous thumbnail upload is still in flight, the new generation is skipped (the previous one is "close enough").

### `surfaceRef` wiring

`EditorPage` creates a `surfaceRef` (`useRef<HTMLDivElement>(null)`) and passes it to `DesignSurface` as a `ref` prop. `DesignSurface` forwards it to the root `<div>` of the design surface. The same ref is passed to `useThumbnail`.

### `ProjectSummary` type extension (frontend)

```ts
export type ProjectSummary = {
  id: string
  name: string
  elementCount: number
  thumbnailUrl: string | null   // NEW
  createdAt: string
  updatedAt: string
}
```

### `ProjectCard` update

When `project.thumbnailUrl` is non-null, render an `<img>` in place of the grey placeholder `<div>`:

```tsx
<div className="relative h-36 w-full overflow-hidden rounded-t-lg bg-gray-100">
  {project.thumbnailUrl ? (
    <img
      src={project.thumbnailUrl}
      alt={project.name}
      className="h-full w-full object-cover"
    />
  ) : null}
  {isLoading && (
    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  )}
</div>
```

The grey `bg-gray-100` background on the container serves as the fallback — when `thumbnailUrl` is `null` no `<img>` is rendered and the grey placeholder is visible naturally.

`object-cover` is used so the thumbnail fills the card area at any aspect ratio mismatch (future-proofing for canvas dimensions other than 16:9).

---

## File structure additions

```
backend/
  migrations/
    003_add_project_thumbnail.sql   (new)
  src/
    routes/
      projects.ts    (extended — thumbnail upload/serve endpoints; thumbnailUrl in list)

frontend/
  src/
    api/
      projects.ts    (extended — thumbnailUrl in ProjectSummary type)
    hooks/
      useThumbnail.ts              (new)
    components/
      editor/
        DesignSurface.tsx          (extended — forwarded ref on root div)
      ProjectCard.tsx              (extended — img rendering when thumbnailUrl present)
    pages/
      EditorPage.tsx               (extended — surfaceRef + useThumbnail wiring)
```

---

## Types

### `ProjectSummary` (backend, extended)

```ts
export type ProjectSummary = {
  id: string;
  name: string;
  elementCount: number;
  thumbnailUrl: string | null;   // NEW
  createdAt: string;
  updatedAt: string;
};
```

---

## Acceptance Criteria

1. Opening a newly created design and making at least one change triggers an auto-save; within 5 seconds of the auto-save completing, a thumbnail file exists at `{ASSET_DIR}/thumb_{designId}.jpg`.
2. After the thumbnail is generated, navigating to the home page shows the thumbnail image in the project card instead of the grey placeholder.
3. The thumbnail accurately represents the canvas content visible in the editor at the time of the last auto-save.
4. Subsequent auto-saves overwrite the previous thumbnail; the card reflects the latest content after the next home page load.
5. A project that has never been auto-saved (e.g., zero mutations since creation) shows the grey placeholder in its card — no broken image or error state.
6. If thumbnail generation or upload fails (network error, `html2canvas` exception), the editor continues to function normally with no visible error.
7. `GET /api/projects` includes `thumbnailUrl: "/api/projects/{id}/thumbnail"` for projects with a thumbnail and `thumbnailUrl: null` for projects without one.
8. `GET /api/projects/:id/thumbnail` returns the JPEG file with `Content-Type: image/jpeg`.
9. `GET /api/projects/:id/thumbnail` returns `404` for a project that has no thumbnail file.
10. `POST /api/projects/:id/thumbnail` with a non-JPEG file returns `400 INVALID_FILE`.
11. `POST /api/projects/:id/thumbnail` with a file exceeding 512 KB returns `400 TOO_LARGE`.
12. The thumbnail image in the card fills the placeholder area (`object-cover`) without distortion.
13. The loading spinner overlay on the card remains visible and functional when a project is being opened, regardless of whether a thumbnail is displayed.
14. Multiple designs each generate and display their own independent thumbnails.
