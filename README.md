# VAAS Development

Install JavaScript dependencies with `npm install`, then start the development server with `npm run dev` at `http://localhost:3000`.

## Local HTTPS

Run `npm run dev:https` to start Vite at `https://localhost:3000`. It generates and caches a self-signed development certificate. Your browser will show a certificate warning the first time; proceed only for this local development server. This is suitable for testing on the same computer, but the generated certificate is not trusted by other devices.

For a trusted local certificate, create one with [mkcert](https://github.com/FiloSottile/mkcert) and configure its paths in `.env.local`:

```sh
mkdir -p .certs
mkcert -install
mkcert -cert-file .certs/localhost.pem -key-file .certs/localhost-key.pem localhost 127.0.0.1 ::1
```

```dotenv
VITE_DEV_TLS_CERT=.certs/localhost.pem
VITE_DEV_TLS_KEY=.certs/localhost-key.pem
```

Then run `npm run dev`. Supplying both certificate paths enables HTTPS automatically. To open VAAS on a phone or another computer, include the development machine's LAN IP or hostname in the certificate and install/trust mkcert's local CA on that device. Keep the private key in `.certs/`; that directory is ignored by Git.

