import { createApiServer } from './index.js';

const port = Number(process.env.PORT ?? 3000);
createApiServer({ seedDemo: true }).listen(port);
console.log(`Hybrid Context AI API listening on http://localhost:${port}`);
