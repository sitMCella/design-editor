# CONVENTIONS.md

> This file defines the coding standards, patterns, and rules for this project.
> Paste this into every AI coding session before writing or reviewing code.

---

## Stack

- **React 19** with concurrent features and the new compiler
- **Vite** — dev server and build tool
- **TypeScript** — strict mode enabled
- **pnpm** — package manager
- **Tailwind CSS v4** — styling
- **React Router v7** — routing (file-based or config-based, see Routing section)
- **Vitest** + **React Testing Library** — unit and integration tests
- **Playwright** — end-to-end tests
- **ESLint** + **Prettier** — linting and formatting

---

## TypeScript

- Strict mode is **always on** (`"strict": true` in `tsconfig.json`)
- **Never use `any`** — use `unknown` and narrow, or define a proper type
- **Never use non-null assertion** (`!`) — use optional chaining or explicit guards
- Prefer `type` over `interface` for object shapes; use `interface` only when extension/declaration merging is needed
- All function parameters and return types must be explicitly typed
- Use `satisfies` operator to validate types without widening
- Discriminated unions over optional fields where possible

```ts
// ✅ Good
type Result<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

// ❌ Bad
type Result = {
  status: string;
  data?: any;
  message?: string;
};
```

---

## File & Folder Structure

```
src/
  assets/         # Static files (images, fonts, svgs)
  components/     # Shared, reusable UI components
    ui/           # Primitives (Button, Input, Badge, etc.)
    [Feature]/    # Feature-scoped shared components
  hooks/          # Custom React hooks
  layouts/        # Route layout components
  pages/          # Route-level page components
  routes/         # React Router route definitions
  lib/            # Pure utility functions and helpers
  services/       # API clients and external service wrappers
  stores/         # Global state (if applicable)
  types/          # Shared TypeScript types and interfaces
  test/           # Global test utilities, mocks, and setup
```

- **File naming:** `kebab-case` for all files and folders
- **Component naming:** `PascalCase` for React components, matching the filename
  - `user-profile-card.tsx` exports `UserProfileCard`
- **Hook naming:** prefix with `use`, e.g. `use-auth.ts` exports `useAuth`
- **Test files:** co-located with source — `user-profile-card.test.tsx` alongside `user-profile-card.tsx`
- **E2E tests:** live in `/e2e` at the project root

---

## Components

- One component per file — no exceptions
- **No logic in JSX** — extract to a custom hook or helper function
- **No inline functions in JSX** that do meaningful work — extract and name them
- Prefer small, focused components; if a component exceeds ~150 lines, split it
- Use **named exports** for all components — no default exports
- Destructure props at the function signature level

```tsx
// ✅ Good
type UserCardProps = {
  name: string;
  avatarUrl: string;
  isOnline?: boolean;
};

export function UserCard({ name, avatarUrl, isOnline = false }: UserCardProps) {
  const formattedName = useFormattedName(name);
  return (
    <div className="flex items-center gap-3">
      <Avatar src={avatarUrl} />
      <span>{formattedName}</span>
      {isOnline && <StatusDot />}
    </div>
  );
}

// ❌ Bad — logic in JSX, default export, no type annotation
export default function Card(props) {
  return (
    <div>
      {props.name.split(' ').map(n => n[0]).join('')}
    </div>
  );
}
```

---

## React 19 Specifics

- Use the **React Compiler** output — do not manually wrap in `useMemo` or `useCallback` unless profiling proves it's necessary
- Use `use()` for reading promises and context inside render where appropriate
- Use **Actions** and `useActionState` for form submissions and mutations — not manual `useState` loading flags
- Use `useOptimistic` for optimistic UI updates
- Use `useFormStatus` inside form child components to read pending state
- Avoid `useEffect` for data fetching — use React Router loaders or `use()` with Suspense
- `useEffect` is allowed **only** for synchronizing with external systems (DOM APIs, subscriptions, timers)

```tsx
// ✅ Good — React 19 form action pattern
function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? 'Saving...' : 'Save'}</button>;
}

// ❌ Bad — manual loading state
const [loading, setLoading] = useState(false);
const handleSubmit = async () => {
  setLoading(true);
  await save();
  setLoading(false);
};
```

---

## Styling (Tailwind CSS v4)

- **All styling via Tailwind utility classes** — no inline `style` props except for truly dynamic values (e.g. CSS custom properties set at runtime)
- **No separate CSS files** for component styles — Tailwind only
- **No `@apply`** in CSS files — compose utilities in JSX
- Use **CSS variables** (via Tailwind's `theme()` system) for design tokens; define them in `app.css`
- Class ordering: follow the official Tailwind class order (enforced by `prettier-plugin-tailwindcss`)
- For conditional classes use the `clsx` or `cn` utility — never string interpolation

```tsx
// ✅ Good
import { cn } from '@/lib/utils';

<button className={cn(
  'rounded-md px-4 py-2 text-sm font-medium transition-colors',
  isActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
  className
)}>
  {children}
</button>

// ❌ Bad
<button style={{ backgroundColor: isActive ? 'blue' : 'gray' }}>
<button className={`btn ${isActive ? 'active' : ''}`}>
```

---

## Routing (React Router v7)

- Use **file-based routing** conventions unless the project explicitly uses config-based routing
- Route-level data loading happens in **loader functions** — not in components
- Mutations happen in **action functions** — not in event handlers calling fetch
- Use `defer()` for non-critical data that can stream in
- Always handle `errorElement` at the route level for error boundaries
- Use typed `useLoaderData<typeof loader>()` — never cast loader return types

```tsx
// ✅ Good
export async function loader({ params }: LoaderFunctionArgs) {
  const user = await fetchUser(params.id);
  if (!user) throw new Response('Not Found', { status: 404 });
  return { user };
}

export function UserPage() {
  const { user } = useLoaderData<typeof loader>();
  return <UserProfile user={user} />;
}
```

---

## State Management

- **Local UI state:** `useState` — for state that belongs to one component
- **Derived state:** compute during render — never store derived values in state
- **Server/async state:** React Router loaders + actions are the primary mechanism; if additional client-side caching is needed, evaluate on a case-by-case basis
- **Global client state:** use React Context for low-frequency updates (theme, auth); document the decision if a third-party store is added
- **Never** duplicate server data into local state

---

## Data Fetching

- All fetching happens in **React Router loaders** — components do not call `fetch` directly
- For mutations, use **React Router actions** with `useFetcher` or form submissions
- If a standalone fetch hook is genuinely needed (e.g. polling), wrap it in a custom hook in `/hooks`
- Always handle loading, error, and empty states explicitly

---

## Custom Hooks

- Every hook lives in `src/hooks/` (shared) or co-located with the component if single-use
- A hook must **do one thing** — split if it grows beyond one concern
- Hooks must never be called conditionally
- Every hook must have a corresponding test in Vitest

```ts
// ✅ Good — single concern, typed
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });
  // ...
  return [value, setValue] as const;
}
```

---

## Error Handling

- **Never `throw` in business logic** — return a typed `Result<T, E>` instead
- Use React Router's `errorElement` and `useRouteError` for route-level errors
- Use React's `<ErrorBoundary>` for unexpected render errors in subtrees
- Always log errors with enough context to debug (`console.error` in dev; a real logger in prod)
- User-facing error messages must never expose internal details

```ts
// ✅ Good
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const data = await api.get(`/users/${id}`);
    return { ok: true, value: data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error('Unknown error') };
  }
}
```

---

## Testing (Vitest + React Testing Library)

- **Test behaviour, not implementation** — query by role, label, and text; never by class name or test ID unless unavoidable
- Every component with logic gets a test
- Every custom hook gets a unit test (use `renderHook`)
- Do not test internal state or implementation details
- Mock at the boundary (API calls, external modules) — not inside components
- Use `userEvent` from `@testing-library/user-event` for interactions — not `fireEvent`
- Aim for tests that read like a user story

```tsx
// ✅ Good
it('shows an error message when the email field is empty on submit', async () => {
  const user = userEvent.setup();
  render(<LoginForm />);

  await user.click(screen.getByRole('button', { name: /sign in/i }));

  expect(screen.getByRole('alert')).toHaveTextContent(/email is required/i);
});

// ❌ Bad
it('sets error state to true', () => {
  const { result } = renderHook(() => useState(false));
  expect(result.current[0]).toBe(false);
});
```

---

## End-to-End Tests (Playwright)

- E2E tests live in `/e2e` at the project root
- Each major user flow gets at least one E2E test
- Tests must be independent — no shared state between tests
- Use `page.getByRole()` and `page.getByLabel()` — not CSS selectors
- Always test the happy path and at least one error/edge case per flow
- Use Playwright's `expect` for assertions — not external assertion libraries

```ts
// ✅ Good
test('user can log in with valid credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('correctpassword');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
});
```

---

## ESLint & Prettier

- **Never disable ESLint rules inline** without a comment explaining why
- **Never commit with `// eslint-disable`** lines unless approved in code review
- Prettier runs on save and on pre-commit (via lint-staged) — do not fight the formatter
- Import order is enforced by ESLint: built-ins → external → internal (`@/`) → relative
- No unused imports, variables, or parameters — ever

---

## Imports & Path Aliases

- Use the `@/` alias for all `src/` imports — no deep relative paths (`../../..`)
- Group imports: external libraries first, then internal `@/` imports, then relative
- Never import from a component's internal file — only from its public export

```ts
// ✅ Good
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { UserCard } from './user-card';

// ❌ Bad
import { UserCard } from '../../../components/user/user-card/user-card';
```

---

## Git & PR Conventions

- **Commit messages:** `type(scope): short description` (Conventional Commits)
  - Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`
  - Example: `feat(auth): add magic link sign-in flow`
- One logical change per commit
- PRs must include: what changed, why, and how to test it
- All tests must pass before merging — no exceptions
- No `console.log` statements in committed code (use a logger utility)

---

## What AI Should Never Do

- Do not add dependencies without flagging it explicitly
- Do not change the build config (`vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`) without being asked
- Do not introduce a new state management pattern without discussion
- Do not write `any` — ask for the correct type if uncertain
- Do not skip tests for new logic
- Do not restructure existing files unless that is the explicit task
