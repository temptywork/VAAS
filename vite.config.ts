import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'node:fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { onvifBridge } from './server/onvifBridge.ts';

export default defineConfig(({command, mode}) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_DEV_');
  const certFile = env.VITE_DEV_TLS_CERT?.trim();
  const keyFile = env.VITE_DEV_TLS_KEY?.trim();
  if (command === 'serve' && Boolean(certFile) !== Boolean(keyFile)) {
    throw new Error('Set both VITE_DEV_TLS_CERT and VITE_DEV_TLS_KEY to enable a custom local HTTPS certificate.');
  }

  const httpsEnabled = command === 'serve' && (env.VITE_DEV_HTTPS === 'true' || Boolean(certFile && keyFile));
  const customTls = httpsEnabled && Boolean(certFile && keyFile);

  return {
    plugins: [
      react(),
      tailwindcss(),
      onvifBridge(),
      ...(httpsEnabled && !customTls ? [basicSsl()] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      ...(httpsEnabled
        ? {
            https: customTls
              ? {
                  cert: readFileSync(path.resolve(process.cwd(), certFile!)),
                  key: readFileSync(path.resolve(process.cwd(), keyFile!)),
                }
              : {},
          }
        : {}),
    },
  };
});
