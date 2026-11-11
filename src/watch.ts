const origin = 'https://www.youtube.com';

export function watchId(url: URL): string | null {
  const id = url.searchParams.get('v');
  return url.origin === origin && url.pathname === '/watch' &&
    url.searchParams.getAll('v').length === 1 && id && /^[\w-]{11}$/.test(id) ? id : null;
}

export function timeLink(id: string, seconds: number): string {
  if (!/^[\w-]{11}$/.test(id) || !Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError('Invalid video or timestamp');
  }
  const link = new URL('/watch', origin);
  link.searchParams.set('v', id);
  link.searchParams.set('t', String(Math.floor(seconds)) + 's');
  return link.href;
}
