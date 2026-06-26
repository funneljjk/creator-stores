// runmoa API client. Two surfaces:
//   - Storefront (browser-safe key)  : read site + contents       /api/storefront/v1
//   - Server private (secret key)    : create/update contents      /api/public/v1
// Docs: https://api-docs.runmoa.ai/

export class RunmoaError extends Error {
  constructor(message, { status, body, url } = {}) {
    super(message);
    this.name = 'RunmoaError';
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

export class RunmoaClient {
  constructor({ siteHost, storefrontKey, serverKey } = {}) {
    if (!siteHost) throw new Error('RunmoaClient requires siteHost');
    this.siteHost = siteHost.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    this.storefrontKey = storefrontKey || '';
    this.serverKey = serverKey || '';
    this.storefrontBase = `https://${this.siteHost}/api/storefront/v1`;
    this.serverBase = `https://${this.siteHost}/api/public/v1`;
  }

  async _request(base, pathName, { method = 'GET', query, body, surface = 'storefront' } = {}) {
    const url = new URL(base + pathName);
    if (query) for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    }
    const headers = { Accept: 'application/json' };
    if (surface === 'storefront') {
      if (!this.storefrontKey) throw new Error('Storefront key not configured');
      headers['X-Runmoa-Site-Key'] = this.storefrontKey;
    } else {
      if (!this.serverKey) throw new Error('Server key not configured');
      headers['Authorization'] = `Bearer ${this.serverKey}`;
    }
    const init = { method, headers };
    if (body != null) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(url, init);
    } catch (e) {
      throw new RunmoaError(`Network error calling ${pathName}: ${e.message}`, { url: url.href });
    }
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      throw new RunmoaError(`${method} ${pathName} → ${res.status}`, {
        status: res.status,
        body: data,
        url: url.href,
      });
    }
    return data;
  }

  // ── Storefront (read) ────────────────────────────────────────────────
  getSite() {
    return this._request(this.storefrontBase, '/site', { surface: 'storefront' });
  }
  getHome() {
    return this._request(this.storefrontBase, '/pages/home', { surface: 'storefront' });
  }
  listContents(query = {}) {
    return this._request(this.storefrontBase, '/contents', { surface: 'storefront', query });
  }
  getContentCategoriesStorefront() {
    return this._request(this.storefrontBase, '/content-categories', { surface: 'storefront' });
  }

  // ── Server private (read + write) ────────────────────────────────────
  listServerContents(query = {}) {
    return this._request(this.serverBase, '/contents', { surface: 'server', query });
  }
  createContent(payload) {
    return this._request(this.serverBase, '/contents', {
      surface: 'server',
      method: 'POST',
      body: payload,
    });
  }
  updateContent(contentId, payload) {
    return this._request(this.serverBase, `/contents/${contentId}`, {
      surface: 'server',
      method: 'PUT',
      body: payload,
    });
  }
  getContentCategoriesServer() {
    return this._request(this.serverBase, '/content-categories', { surface: 'server' });
  }
  searchContentCategoryServer(query) {
    return this._request(this.serverBase, '/content-categories/search', {
      surface: 'server',
      query: { query },
    });
  }
  // products (일반상품)
  listServerProducts(query = {}) {
    return this._request(this.serverBase, '/products', { surface: 'server', query });
  }
  createProduct(payload) {
    return this._request(this.serverBase, '/products', {
      surface: 'server',
      method: 'POST',
      body: payload,
    });
  }
  updateProduct(productId, payload) {
    return this._request(this.serverBase, `/products/${productId}`, {
      surface: 'server',
      method: 'PUT',
      body: payload,
    });
  }
  getProductCategoriesServer() {
    return this._request(this.serverBase, '/product-categories', { surface: 'server' });
  }
}

/** Normalize the various category list shapes into [{id, name}]. */
export function normalizeCategories(raw) {
  const arr = Array.isArray(raw)
    ? raw
    : raw?.categories || raw?.data || raw?.items || raw?.result || [];
  return (Array.isArray(arr) ? arr : [])
    .map((c) => ({
      id: c.id ?? c.category_id ?? c.term_id ?? c.ID ?? null,
      name: c.name ?? c.title ?? c.label ?? c.slug ?? '',
    }))
    .filter((c) => c.id != null);
}
