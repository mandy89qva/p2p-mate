
const QVAPAY_API = "https://api.qvapay.com/p2p/averages";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/qvapay/averages") {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      if (request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: corsHeaders
        });
      }

      try {
        const response = await fetch(QVAPAY_API, {
          method: "GET",
          headers: { Accept: "application/json" }
        });

        const body = await response.text();

        return new Response(body, {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type":
              response.headers.get("Content-Type") ||
              "application/json; charset=utf-8"
          }
        });
      } catch {
        return new Response(
          JSON.stringify({
            error: "No se pudo consultar la API pública de QvaPay."
          }),
          {
            status: 502,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
  
