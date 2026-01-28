const { Client } = require('pg');
const { spawn } = require('child_process');

const DATABASE_URL = process.env.DATABASE_URL;
const MAX_RETRIES = Number(process.env.DB_WAIT_RETRIES || 20);
const RETRY_DELAY_MS = Number(process.env.DB_WAIT_DELAY_MS || 2000);

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const waitForDb = async () => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const client = new Client({ connectionString: DATABASE_URL });
    try {
      await client.connect();
      await client.end();
      console.log('Database is ready.');
      return;
    } catch (error) {
      await client.end().catch(() => {});
      console.log(
        `Waiting for database... (${attempt}/${MAX_RETRIES}) ${error.message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  console.error('Database did not become ready in time.');
  process.exit(1);
};

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });

(async () => {
  await waitForDb();
  await runCommand('pnpm', ['run', 'db:migrate']);
  await runCommand('pnpm', ['run', 'db:seed']);
  await runCommand('pnpm', ['run', 'start:dev']);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
