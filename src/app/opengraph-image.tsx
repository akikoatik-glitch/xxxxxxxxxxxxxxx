import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "XWhiz Lite — Free Football Predictions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #070D0A 0%, #0C1410 55%, #12201A 100%)",
          color: "#EDF7F2",
          position: "relative",
          fontFamily: "sans-serif"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -140,
            left: "50%",
            transform: "translateX(-50%)",
            width: 760,
            height: 420,
            borderRadius: 9999,
            background: "radial-gradient(ellipse, rgba(16,185,129,0.22), transparent 70%)"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 560,
            height: 560,
            border: "1px solid rgba(52,211,153,0.18)",
            borderRadius: "50%",
            transform: "translate(-50%, -50%)"
          }}
        />
        <div style={{ display: "flex", fontSize: 88, fontWeight: 900, letterSpacing: 6 }}>
          <span style={{ color: "#F0FDF4" }}>XWHIZ</span>
          <span style={{ color: "#34D399", marginLeft: 18 }}>LITE</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontSize: 34,
            color: "#34D399",
            letterSpacing: 3,
            textTransform: "uppercase",
            fontWeight: 700
          }}
        >
          Free Football Predictions
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 54,
            gap: 14,
            fontSize: 22,
            color: "#A7F3D0",
            border: "1px solid rgba(52,211,153,0.4)",
            borderRadius: 9999,
            padding: "10px 34px"
          }}
        >
          1X2 Probabilities · Predicted Scores · Confidence Ratings
        </div>
      </div>
    ),
    size
  );
}