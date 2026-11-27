export const neocromOrigin = 'https://ocrom.net';

export async function neocromRequest(path, { method = 'GET', body, token, fetch: request = globalThis.fetch } = {}) {
  const response = await request(neocromOrigin + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(20_000),
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'Ocrom ID is unavailable.'), { status: response.status });
  return result;
}

export function createNeocromIdClient() {
  return {
    connect: () => neocromRequest('/api/neocrom-id/device', { method: 'POST', body: { client: 'sdk' } }),
    poll: deviceCode => neocromRequest('/api/neocrom-id/token', { method: 'POST', body: { deviceCode } }),
    profile: token => neocromRequest('/api/neocrom-id/profile', { token }),
    pulseProject: token => neocromRequest('/api/neocrom-id/pulse', { token }),
    disconnect: token => neocromRequest('/api/neocrom-id/session', { method: 'DELETE', token }),
  };
}
