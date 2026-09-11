import { loadEnv, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

/** Local development convenience only. Never included in the static site's browser bundle. */
export function developmentAI(): Plugin {
	let root = process.cwd();
	let mode = 'development';
	function json(res: ServerResponse, status: number, data: unknown) {
		res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
		res.end(JSON.stringify(data));
	}
	async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
		if (!req.url?.startsWith('/.pattern/ai/')) return next();
		const host = req.headers.host ?? '';
		const remote = req.socket.remoteAddress ?? '';
		if (
			!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) ||
			!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) ||
			req.headers['x-pattern-client'] !== '1' ||
			(req.headers.origin &&
				req.headers.origin !== `http://${host}` &&
				req.headers.origin !== `https://${host}`)
		)
			return json(res, 403, {
				error: { message: 'This connection is available only to this local app.' }
			});
		const env = loadEnv(mode, root, 'OPENAI_');
		const key = env.OPENAI_API_KEY?.trim();
		if (req.url === '/.pattern/ai/status' && req.method === 'GET')
			return json(res, 200, { available: !!key, model: env.OPENAI_MODEL || 'gpt-4.1-mini' });
		const endpoint = req.url.slice('/.pattern/ai/'.length);
		if (req.method !== 'POST' || !['responses', 'embeddings'].includes(endpoint))
			return json(res, 404, { error: { message: 'Unknown operation.' } });
		if (!key)
			return json(res, 503, {
				error: { message: 'Add OPENAI_API_KEY to .env, or connect your own key.' }
			});
		if (!req.headers['content-type']?.startsWith('application/json'))
			return json(res, 415, { error: { message: 'Expected JSON.' } });
		let body = '';
		for await (const chunk of req) {
			body += chunk.toString();
			if (body.length > 25_000_000)
				return json(res, 413, { error: { message: 'Images are too large. Use smaller files.' } });
		}
		let payload: Record<string, unknown>;
		try {
			payload = JSON.parse(body);
		} catch {
			return json(res, 400, { error: { message: 'Invalid JSON.' } });
		}
		if (!payload || Array.isArray(payload) || typeof payload.model !== 'string' || !payload.input)
			return json(res, 400, { error: { message: 'A model and input are required.' } });
		if (endpoint === 'responses') {
			payload.store = false;
			payload.max_output_tokens = Math.min(
				4096,
				Math.max(16, Number(payload.max_output_tokens) || 1024)
			);
			if (
				Array.isArray(payload.tools) &&
				payload.tools.some((tool) => !tool || typeof tool !== 'object' || tool.type !== 'function')
			)
				return json(res, 400, {
					error: { message: 'This lab supports its own local functions only.' }
				});
		} else if (Array.isArray(payload.input) && payload.input.length > 64) {
			return json(res, 400, { error: { message: 'Embed up to 64 passages at a time.' } });
		}
		const abort = new AbortController();
		res.on('close', () => {
			if (!res.writableEnded) abort.abort();
		});
		try {
			const upstream = await fetch(`https://api.openai.com/v1/${endpoint}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
				body: JSON.stringify(payload),
				signal: AbortSignal.any([abort.signal, AbortSignal.timeout(90_000)])
			});
			res.writeHead(upstream.status, {
				'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
				'Cache-Control': 'no-store',
				'X-Content-Type-Options': 'nosniff'
			});
			if (upstream.body)
				Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0])
					.on('error', () => res.end())
					.pipe(res);
			else res.end();
		} catch {
			if (abort.signal.aborted) return;
			if (!res.headersSent)
				json(res, 502, { error: { message: 'OpenAI could not be reached. Please try again.' } });
			else res.end();
		}
	}
	return {
		name: 'pattern-local-ai',
		configResolved(config) {
			root = config.root;
			mode = config.mode;
		},
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				void handle(req, res, next).catch(() =>
					json(res, 500, { error: { message: 'Local connection failed.' } })
				);
			});
		},
		configurePreviewServer(server) {
			server.middlewares.use((req, res, next) => {
				void handle(req, res, next).catch(() =>
					json(res, 500, { error: { message: 'Local connection failed.' } })
				);
			});
		}
	};
}
