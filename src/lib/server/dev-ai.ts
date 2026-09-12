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
		const listing = endpoint === 'models' && req.method === 'GET';
		if (
			!listing &&
			(req.method !== 'POST' ||
				![
					'responses',
					'embeddings',
					'chat/completions',
					'audio/speech',
					'images/generations'
				].includes(endpoint))
		)
			return json(res, 404, { error: { message: 'Unknown operation.' } });
		if (!key)
			return json(res, 503, {
				error: { message: 'Add OPENAI_API_KEY to .env, or connect your own key.' }
			});
		if (!listing && !req.headers['content-type']?.startsWith('application/json'))
			return json(res, 415, { error: { message: 'Expected JSON.' } });
		let body = '';
		for await (const chunk of req) {
			body += chunk.toString();
			if (body.length > 25_000_000)
				return json(res, 413, { error: { message: 'Images are too large. Use smaller files.' } });
		}
		let payload: Record<string, unknown>;
		try {
			payload = listing ? {} : JSON.parse(body);
		} catch {
			return json(res, 400, { error: { message: 'Invalid JSON.' } });
		}
		if (
			!listing &&
			(!payload ||
				Array.isArray(payload) ||
				typeof payload.model !== 'string' ||
				!(endpoint === 'chat/completions'
					? payload.messages
					: endpoint === 'images/generations'
						? payload.prompt
						: payload.input))
		)
			return json(res, 400, { error: { message: 'A model and input are required.' } });
		if (endpoint === 'images/generations') {
			if (
				!/^gpt-image-(?:2\.5-(?:sunburst|flare)|2|1\.5|1-mini)(?:-\d{4}-\d{2}-\d{2})?$/.test(
					String(payload.model)
				) ||
				typeof payload.prompt !== 'string' ||
				payload.prompt.length > 4000 ||
				!['1024x1024', '1536x1024', '1024x1536'].includes(String(payload.size)) ||
				!['low', 'medium', 'high'].includes(String(payload.quality))
			)
				return json(res, 400, {
					error: {
						message:
							'Choose a supported image model, size, quality, and a prompt up to 4,000 characters.'
					}
				});
			payload = {
				model: payload.model,
				prompt: payload.prompt,
				size: payload.size,
				quality: payload.quality,
				n: 1,
				output_format: 'png',
				background: 'opaque'
			};
		} else if (endpoint === 'responses') {
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
		} else if (endpoint === 'chat/completions') {
			payload.store = false;
			payload.max_completion_tokens = Math.min(
				2048,
				Math.max(256, Number(payload.max_completion_tokens) || 2048)
			);
			if (
				!/^gpt-audio/.test(String(payload.model)) ||
				JSON.stringify(payload.messages).length > 4000 ||
				payload.tools
			)
				return json(res, 400, {
					error: { message: 'Use a short speech prompt and an audio model.' }
				});
		} else if (
			endpoint === 'audio/speech' &&
			(typeof payload.input !== 'string' || payload.input.length > 1200)
		) {
			return json(res, 400, { error: { message: 'Use up to 1,200 characters for speech.' } });
		} else if (Array.isArray(payload.input) && payload.input.length > 64) {
			return json(res, 400, { error: { message: 'Embed up to 64 passages at a time.' } });
		}
		const abort = new AbortController();
		res.on('close', () => {
			if (!res.writableEnded) abort.abort();
		});
		try {
			const upstream = await fetch(`https://api.openai.com/v1/${endpoint}`, {
				method: listing ? 'GET' : 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
				body: listing ? undefined : JSON.stringify(payload),
				signal: AbortSignal.any([
					abort.signal,
					AbortSignal.timeout(endpoint === 'images/generations' ? 240_000 : 90_000)
				])
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
