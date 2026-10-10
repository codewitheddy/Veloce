import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import authRouter from '../server/routes/auth';
import { initializeDatabaseSchema, getDbPool } from '../src/lib/mysql-db';

async function run() {
  await initializeDatabaseSchema();

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  const server = app.listen(3098, async () => {
    console.log('Test server running on port 3098');

    try {
      const res = await fetch('http://localhost:3098/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'edwinmuliro64@gmail.com' }),
      });

      const data = await res.json();
      console.log('HTTP Status:', res.status);
      console.log('HTTP Response:', data);

      await new Promise(r => setTimeout(r, 4000));
    } catch (err: any) {
      console.error('Request failed:', err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

run();
