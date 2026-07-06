import { ImageResponse } from "next/og";
import { loadAudit } from "@/lib/audit";
import { normalizeHandle, isValidHandle } from "@/lib/validation";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Findable — TikTok search visibility score";

const INK = "#10131F";
const VIOLET = "#5B45E0";
const LIME = "#D9F245";

const RADIUS = 150;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface OgImageProps {
  params: Promise<{ locale: string; handle: string }>;
}

export default async function OgImage({ params }: OgImageProps) {
  const { handle: rawHandle } = await params;
  const handle = normalizeHandle(decodeURIComponent(rawHandle));
  const audit = isValidHandle(handle) ? await loadAudit(handle) : null;
  const score = audit?.result.score;
  const grade = audit?.result.grade;
  const dashOffset =
    score === undefined ? CIRCUMFERENCE : CIRCUMFERENCE * (1 - score / 100);

  // satori renders SVG reliably via <img src="data:...">, not inline markup.
  const dialSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">` +
    `<circle cx="180" cy="180" r="${RADIUS}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="26"/>` +
    `<circle cx="180" cy="180" r="${RADIUS}" fill="none" stroke="${VIOLET}" stroke-width="26" stroke-linecap="round" stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 180 180)"/>` +
    `</svg>`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: INK,
        color: "white",
        padding: "72px 88px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: VIOLET,
              color: LIME,
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            F
          </div>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700 }}>
            Findable
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 56,
            fontSize: 44,
            color: "rgba(255,255,255,0.75)",
          }}
        >
          {`@${handle}`}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 12,
            fontSize: 58,
            fontWeight: 700,
            lineHeight: 1.15,
            maxWidth: 640,
          }}
        >
          {audit
            ? "TikTok search visibility score"
            : "Is this profile findable on TikTok?"}
        </div>
        <div
          style={{
            marginTop: 32,
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            color: LIME,
          }}
        >
          findable · free audit
        </div>
      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          width: 360,
          height: 360,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {}
        <img
          width={360}
          height={360}
          alt=""
          src={`data:image/svg+xml,${encodeURIComponent(dialSvg)}`}
        />
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 104,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {`${score ?? "?"}`}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            /100
          </div>
          {grade && (
            <div
              style={{
                marginTop: 14,
                display: "flex",
                padding: "6px 22px",
                borderRadius: 999,
                backgroundColor: LIME,
                color: INK,
                fontSize: 34,
                fontWeight: 700,
              }}
            >
              {`${grade}`}
            </div>
          )}
        </div>
      </div>
    </div>,
    size,
  );
}
