import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LipaPoint - #1 POS System for Kenyan Businesses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #09090b 0%, #18181b 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "rgba(212, 175, 55, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
            }}
          >
            🏪
          </div>
          <span
            style={{
              fontSize: "48px",
              fontWeight: "bold",
              color: "#fafafa",
            }}
          >
            LipaPoint
          </span>
        </div>
        <h1
          style={{
            fontSize: "56px",
            fontWeight: "bold",
            color: "#d4af37",
            textAlign: "center",
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          #1 POS System for
          <br />
          Kenyan Businesses
        </h1>
        <p
          style={{
            fontSize: "24px",
            color: "#a1a1aa",
            textAlign: "center",
            marginTop: "24px",
            maxWidth: "800px",
          }}
        >
          M-Pesa Payments | Inventory | Analytics | Multi-Location
        </p>
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "40px",
          }}
        >
          <div
            style={{
              background: "#d4af37",
              color: "#09090b",
              padding: "12px 32px",
              borderRadius: "8px",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            Free 14-Day Trial
          </div>
          <div
            style={{
              border: "1px solid #27272a",
              color: "#fafafa",
              padding: "12px 32px",
              borderRadius: "8px",
              fontSize: "20px",
            }}
          >
            From KSh 2,999/mo
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
