/**
 * Allow the dashboard to send the local-agent bearer token only to its supported
 * endpoint origins. A tunnel is public; the user must never paste a token into an
 * arbitrary host or URL path.
 */
export function allowedAgentOrigin(raw) {
  try {
    const url = new URL(raw);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname && url.pathname !== '/')
    ) return '';

    const cloudflareQuickTunnel =
      url.protocol === 'https:' &&
      url.hostname !== 'trycloudflare.com' &&
      url.hostname.endsWith('.trycloudflare.com') &&
      !url.port;

    const localDevelopment =
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname);

    return cloudflareQuickTunnel || localDevelopment ? url.origin : '';
  } catch {
    return '';
  }
}
