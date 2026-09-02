export default {
  async fetch() {
    return new Response(JSON.stringify({
      ok: false,
      message: "ONI HUB v2 worker foundation placeholder. Production worker remains in src/."
    }), {
      status: 501,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
};
