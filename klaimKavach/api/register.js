import "./_env.js";

export default function handler(req, res) {
  if (req.method === "POST") {
    const body = req.body || {};
    const name = body.name;

    if (name) {
      res.setHeader(
        "Set-Cookie",
        `klaimName=${encodeURIComponent(name)}; Path=/; Max-Age=86400`,
      );
    }

    res
      .status(200)
      .json({
        success: true,
        userId: "u_123",
        message: "Registered successfully",
      });
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
