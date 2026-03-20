export default function handler(req, res) {
  if (req.method === 'POST') {
    res.status(200).json({ success: true, userId: "u_123", message: "Registered successfully" });
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
