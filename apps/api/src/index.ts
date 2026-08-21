import { serve } from '@hono/node-server';

import { createApp } from './app.ts';

const runtime = await createApp();
const server = serve(
  {
    fetch: runtime.app.fetch,
    port: runtime.config.port,
  },
  () => {
    console.log(
      `gym-api on :${runtime.config.port} (rpID=${runtime.config.rpId}, origin=${runtime.config.origin})`,
    );
  },
);

let shuttingDown = false;
const shutdown = (signal: NodeJS.Signals): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  runtime.dispose();
  server.close((error) => {
    if (error) {
      console.error(`gym-api ${signal} shutdown failed`, error);
      process.exitCode = 1;
    }
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
