# Feature Spec: Store Design Project

## Summary

Persist the design project (id, name, and full canvas state) to PostgreSQL. The canvas — including text elements, image elements, and shapes — is stored as a JSONB document in a `project` table. Image elements whose `src` is an HTTP URL are downloaded server-side, written to a local Docker volume, and the canvas reference is rewritten to the local asset URL; the original URL is retained for provenance. No user sessions or authentication are required in this iteration.

## Scope

**In scope**
- `project` table: id, name, full canvas JSONB, timestamps
- `asset` table: file metadata with `original_url` provenance for HTTP-fetched images
- SQL migration files run automatically at server startup
- `POST /api/projects` — create a project record
- `GET /api/projects/:id` — load a project
- `PATCH /api/projects/:id` — auto-save canvas state and name
- `POST /api/assets/fetch` — download an HTTP image URL, persist to asset volume, return local asset URL
- `GET /api/assets/:id/content` — serve a stored image file
- Named Docker volume for asset file storage (`asset_data`)
- Frontend: wire design creation to `POST /api/projects`; wire auto-save to `PATCH /api/projects/:id`; call `POST /api/assets/fetch` when an image element is assigned an HTTP `src`

**Out of scope**
- User sessions or authentication
- Listing all projects (no user scope to filter by)
- Deleting projects or assets
- Cloud / object storage (S3, MinIO)
- Image resize or optimisation on ingest
- Google Fonts or font file storage
- Undo / redo integration with persistence
- Real-time collaboration

---

## Design Decisions

### Text element configuration — store in the database?

Text elements carry both layout properties (`x`, `y`, `width`, `height`, `rotation`, `opacity`) and formatting properties (`fontSize`, `fontFamily`, `fontWeight`, `fontStyle`, `color`, `align`, `content`). Two approaches were evaluated:

| Approach | Pros | Cons |
|---|---|---|
| Normalized `text_element` table, one row per element | SQL-level property validation; easy to query by property (e.g. "find bold elements") | Multiple writes per auto-save; schema change required for each new property; misaligned with JSON-document architecture |
| JSONB within the `project.canvas` column | Single atomic write per auto-save; no schema migration per new property; mirrors the in-memory model exactly; portability | Cannot filter designs by text formatting without JSONB operators |

**Decision: store text elements as JSONB within `project.canvas`.**

The architectural decision in `context.md` already defines designs as JSON documents. There is no current requirement to query designs by text formatting properties, and a GIN index on the `canvas` column can support content search later without a schema change. Normalization would add complexity (multiple writes, foreign keys, join queries) with no current benefit.

### Image element storage — where does the image content live?

Image elements reference a `src` string. Three tiers were evaluated:

| Tier | Pros | Cons |
|---|---|---|
| PostgreSQL `bytea` column | No additional infrastructure | Poor streaming performance; bloats the database; not designed for binary large objects |
| Local filesystem + Docker named volume | Simple; fits local-first requirement; files served directly by the backend | Single-host only; not horizontally scalable |
| Object storage (S3 / MinIO) | Production-grade; scalable; CDN-friendly | Infrastructure complexity out of scope for this iteration |

**Decision: local filesystem with a named Docker volume (`asset_data`).**

The backend serves image files through `GET /api/assets/:id/content`. The storage backend (disk path vs S3 URL) is isolated behind the asset routes, so a future switch to object storage requires changing only the storage implementation, not the API contract or the canvas JSON shape.

### HTTP URL images — download strategy

When a user configures an image element with an HTTP/HTTPS `src`, the browser could load the image directly. This approach was rejected because:

- External URLs may become unavailable, breaking the design.
- CORS restrictions can prevent the browser from reading pixel data needed for future export.
- The design would not be self-contained.

**Decision: the backend downloads the image on `POST /api/assets/fetch`, stores it to the asset volume, and returns a local URL.** The frontend replaces the element's `src` with the local URL before the next auto-save. The `original_url` column in the `asset` table records the source for provenance and debugging.

---

## Database Schema

```sql
-- 001_create_project.sql
CREATE TABLE project (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  canvas      JSONB NOT NULL DEFAULT '{"elements":[]}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIN index for future JSONB content queries (no behavioural change now)
CREATE INDEX project_canvas_gin ON project USING gin(canvas);
```

```sql
-- 002_create_asset.sql
CREATE TABLE asset (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  original_url TEXT,           -- NULL for user-uploaded; set for HTTP-fetched images
  storage_path TEXT NOT NULL,  -- relative path within the asset volume, e.g. "abc123.jpg"
  mime_type    TEXT NOT NULL,
  size_bytes   BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Migration files live under `backend/migrations/` and are run in filename order at server startup by a lightweight runner in `backend/src/lib/migrate.ts`.

---

## Canvas JSON shape

The `canvas` column stores the element tree in the same structure as the in-memory `CanvasStore.elements` array. All element types (text, image, shape, group) are stored verbatim.

```json
{
  "elements": [
    {
      "id": "t1",
      "type": "text",
      "x": 560, "y": 320, "width": 160, "height": 40,
      "rotation": 0, "opacity": 1, "locked": false,
      "content": "Hello world",
      "fontSize": 16,
      "fontFamily": "Inter, sans-serif",
      "fontWeight": "bold",
      "fontStyle": "italic",
      "color": "#111827",
      "align": "left"
    },
    {
      "id": "i1",
      "type": "image",
      "x": 480, "y": 240, "width": 320, "height": 240,
      "rotation": 0, "opacity": 1, "locked": false,
      "src": "/api/assets/xyz789/content",
      "objectFit": "cover"
    }
  ]
}
```

Image elements always reference the local asset URL after persistence — never the original HTTP URL. The original URL is available in `asset.original_url` for provenance only.

---

## API

### Projects

#### `POST /api/projects`

Create a new project. The id is generated by the frontend (nanoid) and forwarded to guarantee the canvas store and the database share the same id.

**Request body**
```json
{ "id": "abc123", "name": "My Design" }
```

**Response `201`**
```json
{
  "ok": true,
  "data": {
    "id": "abc123",
    "name": "My Design",
    "canvas": { "elements": [] },
    "createdAt": "2026-05-10T10:00:00Z",
    "updatedAt": "2026-05-10T10:00:00Z"
  }
}
```

**Errors**
| Status | Code | Condition |
|---|---|---|
| `400` | `INVALID_BODY` | Missing or invalid `id` / `name` |
| `409` | `CONFLICT` | A project with that `id` already exists |

---

#### `GET /api/projects/:id`

Load a project including its full canvas.

**Response `200`**
```json
{
  "ok": true,
  "data": {
    "id": "abc123",
    "name": "My Design",
    "canvas": { "elements": [...] },
    "createdAt": "2026-05-10T10:00:00Z",
    "updatedAt": "2026-05-10T10:05:00Z"
  }
}
```

**Errors**
| Status | Code | Condition |
|---|---|---|
| `404` | `NOT_FOUND` | No project with that id |

---

#### `PATCH /api/projects/:id`

Partial update for auto-save. Accepts `name`, `canvas`, or both. Updates `updated_at` unconditionally.

**Request body** (all fields optional)
```json
{ "name": "Renamed Design", "canvas": { "elements": [...] } }
```

**Response `200`**
```json
{
  "ok": true,
  "data": {
    "id": "abc123",
    "name": "Renamed Design",
    "updatedAt": "2026-05-10T10:07:30Z"
  }
}
```

**Errors**
| Status | Code | Condition |
|---|---|---|
| `400` | `INVALID_BODY` | Body present but no valid field |
| `404` | `NOT_FOUND` | No project with that id |

---

### Assets

#### `POST /api/assets/fetch`

Download an image from an HTTP/HTTPS URL and store it locally.

**Request body**
```json
{ "url": "https://example.com/photo.jpg", "name": "photo.jpg" }
```

**Server-side behaviour**
1. Validate `url` — must be a well-formed `http` or `https` URL.
2. `fetch()` the URL server-side.
3. Reject the response if `Content-Type` is not `image/*`.
4. Enforce a **10 MB** maximum download size (abort stream if exceeded).
5. Generate an asset `id` (`nanoid()`), derive the file extension from the MIME type.
6. Stream the response body to `{ASSET_DIR}/{id}{ext}`.
7. Insert a row in `asset` with `original_url` set to the input URL.
8. Return the asset record.

**Response `201`**
```json
{
  "ok": true,
  "data": {
    "id": "xyz789",
    "name": "photo.jpg",
    "originalUrl": "https://example.com/photo.jpg",
    "url": "/api/assets/xyz789/content",
    "mimeType": "image/jpeg",
    "sizeBytes": 204800,
    "createdAt": "2026-05-10T10:06:00Z"
  }
}
```

**Errors**
| Status | Code | Condition |
|---|---|---|
| `400` | `INVALID_URL` | Not a valid http/https URL |
| `400` | `NOT_AN_IMAGE` | Response `Content-Type` is not `image/*` |
| `400` | `TOO_LARGE` | Response body exceeds 10 MB |
| `502` | `FETCH_FAILED` | Network error or non-2xx response from origin |

---

#### `GET /api/assets/:id/content`

Stream the stored image file.

**Response headers**
```
Content-Type: image/jpeg          (from asset.mime_type)
Cache-Control: public, max-age=31536000, immutable
```

Assets are content-addressed by id and never mutate, so aggressive caching is safe.

**Errors**
| Status | Code | Condition |
|---|---|---|
| `404` | `NOT_FOUND` | No asset with that id, or file missing from disk |

---

## Docker changes

Add a named volume `asset_data` and mount it inside the backend container. The `ASSET_DIR` environment variable configures the write path.

```yaml
backend:
  environment:
    ASSET_DIR: /app/assets
  volumes:
    - asset_data:/app/assets

volumes:
  db_data:
  asset_data:
```

---

## Frontend integration

### Design creation

`HomePage` — after the user confirms the new design modal, call `POST /api/projects` with the nanoid-generated `id` and the entered `name` before navigating to the editor. On network failure, display an error notification and remain on the home page.

### Auto-save

Wire the canvas store's debounced `isDirty` watcher (defined in `state-management.md`) to `PATCH /api/projects/:id` via a TanStack Query mutation. On success, call `markSaved()`. On failure, leave `isDirty = true` and retry on the next mutation or on the 10-second fallback timer.

### Image ingestion (HTTP URLs)

When an image element is assigned an HTTP/HTTPS `src` (e.g., via the image URL input in spec `04`):

1. Call `POST /api/assets/fetch` with the URL.
2. On success, call `updateElement(id, { src: data.url })` to replace the element's `src` with the local asset URL.
3. The next auto-save persists the rewritten canvas to the database.

If `POST /api/assets/fetch` fails, show an error notification and leave the element's `src` unchanged (the placeholder remains visible).

---

## File structure

```
backend/
  migrations/
    001_create_project.sql
    002_create_asset.sql
  src/
    lib/
      db.ts           (existing — postgres.js client)
      migrate.ts      (new — runs pending migrations at server startup)
    routes/
      projects.ts     (new — POST / GET / PATCH for project)
      assets.ts       (extended — add /fetch and /:id/content)
```

---

## Types

### `Project` (backend)

```ts
type Project = {
  id: string;
  name: string;
  canvas: { elements: CanvasElement[] };
  createdAt: string;
  updatedAt: string;
};
```

### `Asset` (backend, extended from existing stub)

```ts
type Asset = {
  id: string;
  name: string;
  originalUrl: string | null; // null for user-uploaded; set for HTTP-fetched
  url: string;                // local URL: /api/assets/:id/content
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};
```

---

## Acceptance Criteria

1. Creating a new design calls `POST /api/projects`; the row is present in the `project` table with `canvas = {"elements":[]}`.
2. The canvas state — including all text element properties — is saved to the `canvas` JSONB column on auto-save (`PATCH /api/projects/:id`).
3. Loading a project via `GET /api/projects/:id` returns the full canvas with all element properties intact.
4. Refreshing the editor page and reloading the design from `GET /api/projects/:id` restores the canvas exactly as saved.
5. Adding an image element with an HTTP `src` triggers `POST /api/assets/fetch`; the element's `src` in the canvas is replaced with the local `/api/assets/:id/content` URL before the next auto-save.
6. The original HTTP URL is stored in `asset.original_url` and is not exposed in the canvas JSON.
7. `GET /api/assets/:id/content` streams the image bytes with the correct `Content-Type` header.
8. A fetch request to a URL whose response is not `image/*` is rejected with `400 NOT_AN_IMAGE`.
9. A fetch request to a URL whose response exceeds 10 MB is rejected with `400 TOO_LARGE`.
10. Auto-save fires within 2 seconds of the last canvas mutation and clears `isDirty` on success.
11. Multiple designs can be created and each maintains its own independent canvas state.
12. No user session or authentication is required for any endpoint in this iteration.
