const UPSTREAM_HOST = "sistem-absensi-kantor-qr.myarzlvisualdesign.workers.dev";
const DEFAULT_PUBLIC_HOST = "sistem-absensi-kantor-qr.pages.dev";

function rewriteHeaderValue(value, publicHost) {
  return value
    .replaceAll(UPSTREAM_HOST, publicHost)
    .replaceAll(`https://${UPSTREAM_HOST}`, `https://${publicHost}`)
    .replaceAll(`http://${UPSTREAM_HOST}`, `https://${publicHost}`);
}

function withRewrittenResponseHeaders(response, publicHost) {
  const headers = new Headers(response.headers);
  const location = headers.get("location");

  if (location) {
    headers.set("location", rewriteHeaderValue(location, publicHost));
  }

  if (typeof response.headers.getSetCookie === "function") {
    headers.delete("set-cookie");

    for (const cookie of response.headers.getSetCookie()) {
      headers.append("set-cookie", rewriteHeaderValue(cookie, publicHost));
    }
  } else {
    const setCookie = headers.get("set-cookie");

    if (setCookie) {
      headers.set("set-cookie", rewriteHeaderValue(setCookie, publicHost));
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const worker = {
  async fetch(request) {
    const publicUrl = new URL(request.url);
    const upstreamUrl = new URL(request.url);
    const publicHost = publicUrl.host || DEFAULT_PUBLIC_HOST;

    upstreamUrl.protocol = "https:";
    upstreamUrl.hostname = UPSTREAM_HOST;

    const headers = new Headers(request.headers);
    headers.set("host", UPSTREAM_HOST);
    headers.set("x-forwarded-host", publicHost);
    headers.set("x-forwarded-proto", "https");

    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });

    const response = await fetch(upstreamRequest);

    return withRewrittenResponseHeaders(response, publicHost);
  },
};

export default worker;
