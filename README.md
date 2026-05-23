# indra-v0

Personal FastAPI site for `www.indra.network`.

## Services

- `indra.service`: runs the FastAPI app from `/root/indra`.
- `indra-opencode-proxy.service`: runs the local OpenCode proxy on `127.0.0.1:8787`.

The OpenCode proxy must stay private to the VPS. Public traffic should go through the FastAPI app only.

## Environment

`indra.service` needs:

```ini
Environment=INDRA_ADMIN_PASSWORD=...
Environment=INDRA_AI_PROXY_URL=http://127.0.0.1:8787
```

`indra-opencode-proxy.service` needs `opencode` on PATH. On the VPS it is installed at:

```txt
/root/.opencode/bin/opencode
```

Use a PATH like:

```ini
Environment=PATH=/root/.opencode/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

## AI Endpoints

- `GET /chat`: simple personal chat page.
- `POST /api/ask`: one-shot chat request. Requires `password` in the JSON body.
- `POST /api/translate`: translation endpoint for the Whale extension. No password.

The browser chat does not store cookies, sessions, or message history.

## Models

- Translation: `openai/gpt-5.4-mini` with `low` variant.
- Chat: `openai/gpt-5.5` with no explicit variant.

## Whale Extension

Local extension path:

```txt
/Users/taehwi/justdoit/openai-bilingual-translator
```

The extension proxy URL should be:

```txt
https://www.indra.network/api/translate
```

Its `manifest.json` must include:

```json
"https://www.indra.network/*"
```

## Smoke Tests

```sh
curl http://127.0.0.1:8787/health
```

```sh
curl -X POST https://www.indra.network/api/translate \
  -H 'Content-Type: application/json' \
  --data '{"items":[{"id":"one","text":"Hello world."}],"targetLanguage":"Korean"}'
```

```sh
curl -X POST https://www.indra.network/api/ask \
  -H 'Content-Type: application/json' \
  --data '{"password":"...","prompt":"Say only OK"}'
```
