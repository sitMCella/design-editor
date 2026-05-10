import postgres from 'postgres';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/design_editor';

export const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => undefined,
});
