import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchSeedFromUrl,
  loadWebSearchModule,
  type WebSearchModule,
} from '../../src/cli/fetch-seed-url.js';

test('loadWebSearchModule resolves AgentOS web-search subpath exports', async () => {
  const mod = await loadWebSearchModule();
  assert.equal(typeof mod.WebSearchService, 'function');
  assert.equal(typeof mod.FirecrawlProvider, 'function');
  const service = new mod.WebSearchService({});
  assert.equal(typeof service.search, 'function');
});

test('fetchSeedFromUrl uses AgentOS search body content when a provider is configured', async () => {
  class FakeProvider {
    constructor(_key: string) {}
  }
  class FakeService {
    constructor(_opts: unknown) {}
    registerProvider(_provider: unknown) {}
    hasProviders() { return true; }
    async search(query: string) {
      return [{
        url: query,
        title: 'Fetched title',
        snippet: 'Snippet fallback.',
        content: `# ${query}\n\nExtracted body.`,
      }];
    }
  }
  const fakeModule: WebSearchModule = {
    WebSearchService: FakeService,
    FirecrawlProvider: FakeProvider,
    TavilyProvider: FakeProvider,
    SerperProvider: FakeProvider,
    BraveProvider: FakeProvider,
  };

  const fetched = await fetchSeedFromUrl('https://example.com/source', {
    env: { FIRECRAWL_API_KEY: 'fc-test' },
    importWebSearch: async () => fakeModule,
  });

  assert.equal(fetched.text, '# https://example.com/source\n\nExtracted body.');
  assert.equal(fetched.title, 'Fetched title');
  assert.equal(fetched.sourceUrl, 'https://example.com/source');
});

test('fetchSeedFromUrl falls back to direct HTML fetch when no search providers exist', async () => {
  class EmptyService {
    constructor(_opts: unknown) {}
    registerProvider(_provider: unknown) {}
    hasProviders() { return false; }
    async search() { return []; }
  }
  class FakeProvider {
    constructor(_key: string) {}
  }
  const fakeModule: WebSearchModule = {
    WebSearchService: EmptyService,
    FirecrawlProvider: FakeProvider,
    TavilyProvider: FakeProvider,
    SerperProvider: FakeProvider,
    BraveProvider: FakeProvider,
  };

  const fetched = await fetchSeedFromUrl('https://example.com/page', {
    env: {},
    importWebSearch: async () => fakeModule,
    fetchImpl: async () => new Response(
      '<html><head><title>Page Title</title><script>bad()</script></head><body><h1>Hello</h1><p>Main &amp; useful text.</p></body></html>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    ),
  });

  assert.equal(fetched.title, 'Page Title');
  assert.equal(fetched.text, 'Hello Main & useful text.');
  assert.equal(fetched.sourceUrl, 'https://example.com/page');
});
