import { loadFont } from "@remotion/fonts";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Img,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const serif = "Playfair Display";
const sans = "Montserrat";
loadFont({ family: serif, url: staticFile("fonts/playfair-600.woff2"), weight: "600" });
loadFont({ family: sans, url: staticFile("fonts/montserrat-500.woff2"), weight: "500" });

type Props = {
  title: string;
  subtitle: string;
};

const FPS = 30;
const DURATION = 12 * FPS;

export const MyComposition = () => {
  return (
    <Composition
      id="Cafetal"
      component={Cafetal}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{
        title: "Donde nace el café",
        subtitle: "Tierra · Tradición · Atardecer",
      }}
    />
  );
};

// Sun position in the source image (1536x1024), as fractions.
const SUN_X = 0.675;
const SUN_Y = 0.29;

const Dust: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen" }}>
      {new Array(40).fill(0).map((_, i) => {
        const x0 = random(`x${i}`) * width;
        const y0 = random(`y${i}`) * height;
        const speed = 0.3 + random(`s${i}`) * 0.6;
        const size = 2 + random(`r${i}`) * 5;
        const x = x0 + Math.sin((frame + i * 20) / 40) * 30;
        const y = ((y0 - frame * speed) % height + height) % height;
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin((frame + i * 13) / 25));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: "rgba(255, 200, 120, 0.9)",
              boxShadow: "0 0 8px rgba(255, 180, 90, 0.9)",
              opacity: twinkle * 0.6,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Cafetal: React.FC<Props> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  const progress = frame / durationInFrames;

  // Slow Ken Burns push toward the sun.
  const scale = interpolate(progress, [0, 1], [1.05, 1.28], {
    easing: Easing.inOut(Easing.sin),
  });
  const originX = `${SUN_X * 100 - 10}%`;
  const originY = `${SUN_Y * 100 + 15}%`;

  // Sun glow breathing.
  const glow = 0.55 + 0.15 * Math.sin(frame / 18);
  // Image is cover-fitted (3:2 into 16:9), so map source coords to frame coords.
  const coverScale = Math.max(width / 1536, height / 1024);
  const sunX = (SUN_X * 1536 - (1536 - width / coverScale) / 2) * coverScale;
  const sunY = (SUN_Y * 1024 - (1024 - height / coverScale) / 2) * coverScale;

  // Light rays rotation.
  const rayRotation = interpolate(frame, [0, durationInFrames], [-6, 6]);

  // Global fade in / out.
  const fade = interpolate(
    frame,
    [0, 30, durationInFrames - 30, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Title timing.
  const titleIn = interpolate(frame, [60, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const subIn = interpolate(frame, [95, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const lineW = interpolate(frame, [85, 140], [0, 260], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity: fade }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin: `${originX} ${originY}`,
        }}
      >
        <Img
          src={staticFile("cafetal.webp")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* Light rays from the sun */}
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            opacity: 0.22,
            background: `repeating-conic-gradient(from ${rayRotation}deg at ${sunX}px ${sunY}px, rgba(255,190,90,0.35) 0deg 3deg, rgba(255,190,90,0) 3deg 11deg)`,
            maskImage: `radial-gradient(circle at ${sunX}px ${sunY}px, black 0%, transparent 60%)`,
            WebkitMaskImage: `radial-gradient(circle at ${sunX}px ${sunY}px, black 0%, transparent 60%)`,
          }}
        />

        {/* Sun glow */}
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            opacity: glow,
            background: `radial-gradient(circle at ${sunX}px ${sunY}px, rgba(255,210,120,0.9) 0%, rgba(255,140,40,0.35) 12%, rgba(255,120,30,0) 35%)`,
          }}
        />

      </AbsoluteFill>

      <Dust />

      {/* Vignette + bottom gradient for text legibility */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%), linear-gradient(to top, rgba(10,5,0,0.75) 0%, rgba(10,5,0,0) 40%)",
        }}
      />

      {/* Title */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "flex-end",
          padding: "0 160px 140px 160px",
        }}
      >
        <div style={{ textAlign: "right", color: "#fff" }}>
          <div
            style={{
              fontFamily: serif,
              fontSize: 128,
              fontWeight: 600,
              lineHeight: 1.05,
              opacity: titleIn,
              transform: `translateY(${(1 - titleIn) * 40}px)`,
              textShadow: "0 4px 30px rgba(0,0,0,0.6)",
            }}
          >
            {title}
          </div>
          <div
            style={{
              height: 3,
              width: lineW,
              background: "#f5a623",
              marginLeft: "auto",
              marginTop: 28,
              marginBottom: 28,
            }}
          />
          <div
            style={{
              fontFamily: sans,
              fontSize: 48,
              fontWeight: 500,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#ffd9a0",
              opacity: subIn,
              transform: `translateY(${(1 - subIn) * 20}px)`,
              textShadow: "0 2px 16px rgba(0,0,0,0.7)",
            }}
          >
            {subtitle}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
