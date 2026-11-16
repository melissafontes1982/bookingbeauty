// Gera um par de chaves VAPID para as notificações push.
// Uso:  npm run vapid
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });
const b64 = (s) => s; // as chaves JWK já vêm em base64url
const rawPublic = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]);

console.log("\nCopie estes dois valores para as variáveis de ambiente do Vercel:\n");
console.log("VITE_VAPID_PUBLIC_KEY=" + rawPublic.toString("base64url"));
console.log("VAPID_PRIVATE_KEY=" + b64(priv.d));
console.log("\nGuarde a VAPID_PRIVATE_KEY em segredo. Nunca a coloque no GitHub.\n");
