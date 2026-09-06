import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    <div style={{ display: "flex", background: "#ff00ff", color: "#00ffee", fontSize: 64, padding: 40 }}>
      Social card artwork
    </div>,
    { width: 1200, height: 630 }
  );
}
