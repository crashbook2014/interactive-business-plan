// PULSE — Master of the Day. Single-origin server: static client + /api.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { securityHeaders, httpsEnforce, rateLimit } from './lib/security.js';
import { attachUser } from './lib/rbac.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(httpsEnforce);
app.use(securityHeaders);
app.use('/api', rateLimit({ windowMs: 60_000, max: 300 }));
app.use('/api', attachUser);
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use('/api', (err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side' });
});

const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('/', (req, res) => res.status(503).send('Client not built yet — run: npm run build'));
}

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`PULSE listening on http://localhost:${PORT}`);
  console.log(`  mode: ${process.env.NODE_ENV || 'development'} · test-login: ${process.env.NODE_ENV === 'production' ? 'off' : (process.env.TEST_LOGIN !== '0' ? 'on' : 'off')}`);
});
