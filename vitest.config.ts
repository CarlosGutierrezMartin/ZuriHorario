import { defineConfig } from 'vitest/config';
process.env.TZ='Europe/Madrid';
export default defineConfig({test:{include:['tests/*.test.ts']}});
