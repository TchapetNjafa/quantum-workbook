// Génère la paire de clés VAPID des notifications push. À lancer une seule fois, sur votre machine :
//   node outils/generer_cles_push.mjs
// Puis, dans Vercel > Settings > Environment Variables (Production + Preview), créer :
//   VAPID_PUBLIC_KEY  = la clé publique affichée   (peut figurer dans le code : elle est publique)
//   VAPID_PRIVATE_KEY = la clé privée affichée      (SECRET : ne la collez ni dans GitHub ni dans une conversation)
// et redéployer. Changer les clés plus tard invalide tous les abonnements : les étudiants devront réactiver les notifications.
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const prv = privateKey.export({ format: 'jwk' }), pub = publicKey.export({ format: 'jwk' });
const publique = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]).toString('base64url');
console.log(`VAPID_PUBLIC_KEY=${publique}\nVAPID_PRIVATE_KEY=${prv.d}`);
