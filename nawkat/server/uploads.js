import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from './config.js';
import { bad } from './util.js';

fs.mkdirSync(config.uploadDir, { recursive: true });

const TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${TYPES[file.mimetype]}`),
});

export const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!TYPES[file.mimetype]) return cb(bad('Format accepté : JPG, PNG ou WEBP.'));
    cb(null, true);
  },
});

/** Vérifie la signature binaire pour éviter les faux types MIME */
export function checkImage(file) {
  if (!file) return null;
  const buf = Buffer.alloc(12);
  const fd = fs.openSync(file.path, 'r');
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf.subarray(0, 4).toString('hex') === '89504e47';
  const isWebp = buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
  if (!isJpg && !isPng && !isWebp) {
    fs.rmSync(file.path, { force: true });
    throw bad('Fichier image invalide.');
  }
  return `/uploads/${path.basename(file.path)}`;
}

export function removeUpload(url) {
  if (!url || !url.startsWith('/uploads/') || url.startsWith('/uploads/demo/')) return;
  fs.rmSync(path.join(config.uploadDir, path.basename(url)), { force: true });
}
