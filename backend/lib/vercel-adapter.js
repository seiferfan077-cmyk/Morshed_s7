function requestHeaders(nodeRequest) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeRequest.headers ?? {})) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  return headers;
}

function requestBody(nodeRequest) {
  if (nodeRequest.body === undefined || nodeRequest.body === null) return undefined;
  return typeof nodeRequest.body === 'string' ? nodeRequest.body : JSON.stringify(nodeRequest.body);
}

export function toFetchRequest(nodeRequest) {
  const method = (nodeRequest.method ?? 'GET').toUpperCase();
  const host = nodeRequest.headers?.host ?? 'localhost';
  const url = new URL(nodeRequest.url ?? '/', `https://${host}`);
  const body = requestBody(nodeRequest);
  return new Request(url, {
    method,
    headers: requestHeaders(nodeRequest),
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  });
}

export async function writeFetchResponse(nodeResponse, response) {
  nodeResponse.statusCode = response.status;
  response.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });
  nodeResponse.end(await response.text());
}

export function createVercelHandler(fetchHandler) {
  const handler = async (request, response) => {
    await writeFetchResponse(response, await fetchHandler(toFetchRequest(request)));
  };
  handler.fetch = fetchHandler;
  return handler;
}
