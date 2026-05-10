import { buildServer } from './server.js';
import { logger } from './lib/logger.js';

const PORT = Number(process.env['PORT'] ?? 3000);
const HOST = process.env['HOST'] ?? '0.0.0.0';

const app = await buildServer();

try {
  await app.listen({ port: PORT, host: HOST });
  logger.info(`Server listening on http://${HOST}:${PORT}`);
} catch (err) {
  logger.error('Failed to start server', err);
  process.exit(1);
}
