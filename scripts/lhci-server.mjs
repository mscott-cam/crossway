import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { spawn } from 'node:child_process';
import { brotliCompressSync, constants } from 'node:zlib';

const port = Number(process.env.PORT ?? 4410);
const upstreamPort = port + 1;
const host = process.env.HOST ?? '127.0.0.1';
const textual =
  /^(text\/|application\/(javascript|json|xml|manifest\+json)|image\/svg)/;
const cache = new Map();

const upstream = spawn('node', ['dist/server/entry.mjs'], {
  env: { ...process.env, PORT: String(upstreamPort), HOST: host },
  stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    upstream.kill();
    process.exit(0);
  });
}
upstream.on('exit', (code) => process.exit(code ?? 1));

const proxy = createServer((req, res) => {
  const forward = request(
    {
      host,
      port: upstreamPort,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, 'accept-encoding': 'identity' },
    },
    (up) => {
      const type = String(up.headers['content-type'] ?? '');
      const accepts = /\bbr\b/.test(String(req.headers['accept-encoding']));
      if (!accepts || !textual.test(type) || req.method !== 'GET') {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
        return;
      }
      const chunks = [];
      up.on('data', (chunk) => chunks.push(chunk));
      up.on('end', () => {
        const body = Buffer.concat(chunks);
        const key = `${req.url}:${body.length}`;
        let packed = cache.get(key);
        if (!packed) {
          packed = brotliCompressSync(body, {
            params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
          });
          cache.set(key, packed);
        }
        const headers = { ...up.headers };
        delete headers['content-length'];
        headers['content-encoding'] = 'br';
        headers['content-length'] = packed.length;
        headers.vary = 'Accept-Encoding';
        res.writeHead(up.statusCode ?? 200, headers);
        res.end(packed);
      });
    },
  );
  forward.on('error', () => {
    res.writeHead(502);
    res.end();
  });
  req.pipe(forward);
});

const shutdown = (code) => {
  upstream.kill();
  process.exit(code);
};

proxy.on('error', (error) => {
  console.error(`lhci-proxy failed: ${error.message}`);
  shutdown(1);
});

function whenUpstreamAccepts(attempts = 100) {
  return new Promise((resolve, reject) => {
    const probe = () => {
      const socket = connect(upstreamPort, host);
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (attempts-- <= 0) reject(new Error('upstream never came up'));
        else setTimeout(probe, 100);
      });
    };
    probe();
  });
}

whenUpstreamAccepts()
  .then(
    () =>
      new Promise((resolve) => {
        proxy.listen(port, host, resolve);
      }),
  )
  .then(() => {
    console.log(`lhci-proxy ready on http://${host}:${port}`);
  })
  .catch((error) => {
    console.error(`lhci-proxy failed: ${error.message}`);
    shutdown(1);
  });
