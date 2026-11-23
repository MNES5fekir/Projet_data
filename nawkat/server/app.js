import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { config } from './config.js';
import { loadUser } from './auth.js';
import { HttpError } from './util.js';
import authRoutes from './routes/auth.js';
import tailorRoutes from './routes/tailors.js';
import shopRoutes from './routes/shop.js';
import orderRoutes from './routes/orders.js';
import messageRoutes from './routes/messages.js';
import paymentRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // En-têtes de sécurité
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(self), geolocation=()',
      'Content-Security-Policy': [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "script-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "form-action 'self' https://paytech.sn",
      ].join('; '),
    });
    if (config.isProd) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  app.use(express.json({ limit: '200kb' }));
  app.use(loadUser);

  app.get('/api/health', (_req, res) => res.json({ ok: true, provider: config.payment.provider }));
  app.use('/api/auth', authRoutes);
  app.use('/api/tailors', tailorRoutes);
  app.use('/api/shop', shopRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/conversations', messageRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Route API inconnue.')));

  app.use('/uploads', express.static(config.uploadDir, { maxAge: '30d', immutable: true, fallthrough: false }));
  app.use(express.static(path.join(config.root, 'public'), {
    setHeaders: (res, file) => {
      if (file.endsWith('sw.js') || file.endsWith('.html')) res.set('Cache-Control', 'no-cache');
    },
  }));

  // Gestion centralisée des erreurs
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `Image trop lourde (max ${config.maxUploadMb} Mo).` : 'Envoi de fichier invalide.';
      return res.status(400).json({ error: msg });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requête invalide.' });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 && config.isProd ? 'Erreur interne. Réessayez plus tard.' : err.message });
  });

  return app;
}
