
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Example API endpoint
    if (url.pathname === "/api/health") {
      return Response.json({
        status: "ok"
      });
    }

    // Add your real API endpoints here.
    if (url.pathname.startsWith("/api/")) {
      return Response.json(
        { error: "API endpoint not implemented" },
        { status: 404 }
      );
    }

    // Serve your HTML, CSS, JS, and images.
    return env.ASSETS.fetch(request);
  }
};
