import { describe, expect, it } from 'vitest';
import { CurlParseError, parseCurl, toCurl, tokenize } from './curl';

describe('tokenize', () => {
  it('honours single, double and ANSI-C quoting plus line continuations', () => {
    expect(tokenize(`curl 'a b' "c \\"d\\"" $'e\\nf' g\\ h \\\n  -s`)).toEqual([
      'curl',
      'a b',
      'c "d"',
      'e\nf',
      'g h',
      '-s',
    ]);
  });

  it('reports unterminated quotes', () => {
    expect(() => tokenize(`curl 'oops`)).toThrow(CurlParseError);
    expect(() => tokenize(`curl "oops`)).toThrow(CurlParseError);
  });
});

describe('parseCurl', () => {
  it('reads a plain GET', () => {
    expect(parseCurl('curl https://api.example.com/items?page=2')).toMatchObject({
      method: 'GET',
      url: 'https://api.example.com/items?page=2',
      headers: [],
      bodyType: 'NONE',
      auth: { type: 'NONE' },
    });
  });

  it('turns -d with JSON into a formatted JSON POST', () => {
    const request = parseCurl(
      `curl https://api.example.com/orders -H 'Content-Type: application/json' -d '{"id":3,"qty":2}'`,
    );
    expect(request.method).toBe('POST');
    expect(request.bodyType).toBe('JSON');
    expect(JSON.parse(request.body)).toEqual({ id: 3, qty: 2 });
    expect(request.body).toContain('\n  "id": 3');
  });

  it('understands browser "Copy as cURL (bash)" output', () => {
    const command = `curl 'https://shop.example.com/api/cart' \\
  -X 'PATCH' \\
  -H 'accept: application/json' \\
  -H 'authorization: Bearer eyJhbGciOi.payload.sig' \\
  --data-raw $'{"note":"it\\'s fine"}' \\
  --compressed`;
    const request = parseCurl(command);
    expect(request.method).toBe('PATCH');
    expect(request.auth).toEqual({ type: 'BEARER', token: 'eyJhbGciOi.payload.sig' });
    expect(request.headers).toEqual([{ key: 'accept', value: 'application/json', enabled: true }]);
    expect(JSON.parse(request.body)).toEqual({ note: "it's fine" });
  });

  it('handles combined and attached short flags', () => {
    const request = parseCurl(`curl -sSL -XDELETE -H'X-Trace: 1' https://api.example.com/items/4`);
    expect(request).toMatchObject({ method: 'DELETE', url: 'https://api.example.com/items/4' });
    expect(request.headers).toEqual([{ key: 'X-Trace', value: '1', enabled: true }]);
  });

  it('maps -u and Basic headers to Basic auth', () => {
    expect(parseCurl('curl -u alice:s3cret https://x.dev').auth).toEqual({
      type: 'BASIC',
      username: 'alice',
      password: 's3cret',
    });
    const encoded = btoa('bob:hunter2');
    expect(parseCurl(`curl -H 'Authorization: Basic ${encoded}' https://x.dev`).auth).toEqual({
      type: 'BASIC',
      username: 'bob',
      password: 'hunter2',
    });
  });

  it('supports --json, -G and --data-urlencode', () => {
    const json = parseCurl(`curl --json '{"a":1}' https://x.dev/things`);
    expect(json.method).toBe('POST');
    expect(json.headers.map((header) => header.key)).toEqual(['Content-Type', 'Accept']);

    const get = parseCurl(`curl -G https://x.dev/search --data-urlencode 'q=two words' -d page=2`);
    expect(get).toMatchObject({ method: 'GET', url: 'https://x.dev/search?q=two%20words&page=2', bodyType: 'NONE' });
  });

  it('keeps form-encoded bodies as raw text with the content type curl would send', () => {
    const request = parseCurl('curl https://x.dev/login -d user=a -d pass=b');
    expect(request).toMatchObject({ method: 'POST', bodyType: 'RAW', body: 'user=a&pass=b' });
    expect(request.headers).toContainEqual({
      key: 'Content-Type',
      value: 'application/x-www-form-urlencoded',
      enabled: true,
    });
  });

  it('warns about what it cannot reproduce', () => {
    expect(parseCurl('curl -F file=@a.png https://x.dev/upload').warnings[0]).toMatch(/Multipart/);
  });

  it('rejects input that is not a usable curl command', () => {
    expect(() => parseCurl('wget https://x.dev')).toThrow('starts with "curl"');
    expect(() => parseCurl('curl -s')).toThrow('no URL');
    expect(() => parseCurl('curl -X BREW https://x.dev')).toThrow('BREW');
  });

  it('adds a scheme to bare hosts but keeps {{variables}}', () => {
    expect(parseCurl('curl localhost:4000/api/health').url).toBe('http://localhost:4000/api/health');
    expect(parseCurl('curl {{baseUrl}}/health').url).toBe('{{baseUrl}}/health');
  });
});

describe('toCurl', () => {
  it('produces a command that parses back to the same request', () => {
    const command = toCurl({
      method: 'POST',
      url: 'https://api.example.com/notes?draft=true',
      headers: [
        { key: 'X-Team', value: "o'reilly", enabled: true },
        { key: 'X-Off', value: 'skip', enabled: false },
      ],
      bodyType: 'JSON',
      body: '{"text":"it\'s here"}',
      auth: { type: 'BEARER', token: 'abc' },
    });
    expect(command).toContain(`-H 'X-Team: o'\\''reilly'`);
    expect(command).not.toContain('X-Off');

    const parsed = parseCurl(command);
    expect(parsed).toMatchObject({
      method: 'POST',
      url: 'https://api.example.com/notes?draft=true',
      auth: { type: 'BEARER', token: 'abc' },
    });
    expect(JSON.parse(parsed.body)).toEqual({ text: "it's here" });
    expect(parsed.headers).toContainEqual({ key: 'X-Team', value: "o'reilly", enabled: true });
  });

  it('omits -X for GET and uses -u for Basic auth', () => {
    expect(
      toCurl({
        method: 'GET',
        url: 'https://x.dev',
        headers: [],
        bodyType: 'NONE',
        body: null,
        auth: { type: 'BASIC', username: 'a', password: 'b' },
      }),
    ).toBe(`curl 'https://x.dev' \\\n  -u 'a:b'`);
  });
});
