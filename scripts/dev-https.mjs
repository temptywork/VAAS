import {createServer} from 'vite';

process.env.VITE_DEV_HTTPS = 'true';

const server = await createServer({
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});

await server.listen();
server.printUrls();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
