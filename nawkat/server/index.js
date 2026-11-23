import { config } from './config.js';
import { createApp } from './app.js';

const app = createApp();
app.listen(config.port, () => {
  console.log(`Ñawkat démarré sur ${config.publicUrl} (paiement : ${config.payment.provider})`);
});
