import { loadFont } from "@remotion/fonts";
import { Audio } from "@remotion/media";
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

const titleFont = "Playfair Display";
loadFont({
  family: titleFont,
  url: staticFile("fonts/playfair-600.woff2"),
  weight: "600",
});

const FPS = 30;
const SECONDS = 45;

// Source image size and key points in it (pixels).
const IMG_W = 1536;
const IMG_H = 1024;
const SUN = { x: 1037, y: 297 };

type Props = {
  text: string;
};

export const MiSuenoComposition = () => {
  return (
    <Composition
      id="MiSueno"
      component={MiSueno}
      durationInFrames={SECONDS * FPS}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ text: "Mi sueño... mi transformación" }}
    />
  );
};

// ------------------------------------------------------------------ camera

type Key = { t: number; x: number; y: number; z: number; r: number };

// Virtual drone path over the image (t in seconds, x/y source px,
// z zoom relative to a full-frame cover fit, r roll in degrees).
const PATH: Key[] = [
  // 0-10 s: take-off from the coffee leaves, rising toward the misty hills.
  { t: 0, x: 1180, y: 830, z: 2.1, r: 0 },
  { t: 5, x: 1120, y: 640, z: 1.9, r: -0.6 },
  { t: 10, x: 1060, y: 450, z: 1.7, r: 0 },
  // 10-20 s: fly over the plantation rows and the picker.
  { t: 14, x: 1290, y: 580, z: 1.85, r: 1.2 },
  { t: 20, x: 760, y: 560, z: 1.65, r: -1 },
  // 20-30 s: panoramic sweep of the whole farm.
  { t: 25, x: 720, y: 500, z: 1.18, r: 0 },
  { t: 30, x: 880, y: 470, z: 1.14, r: 0.4 },
  // 30-35 s: rise and turn to reveal the scale of the landscape.
  { t: 35, x: 960, y: 400, z: 1.4, r: 4 },
  // 35-45 s: slow epic pull-back to the full view.
  { t: 45, x: 768, y: 512, z: 1.0, r: 0 },
];

// Cubic Hermite spline through keyframes (non-uniform Catmull-Rom),
// so the camera never stops dead between segments.
const sample = (t: number, key: "x" | "y" | "z" | "r") => {
  const k = PATH;
  if (t <= k[0].t) return k[0][key];
  if (t >= k[k.length - 1].t) return k[k.length - 1][key];
  let i = 0;
  while (t > k[i + 1].t) i++;
  const p0 = k[i];
  const p1 = k[i + 1];
  const h = p1.t - p0.t;
  const slope = (j: number) => {
    if (j === 0 || j === k.length - 1) return 0;
    return (k[j + 1][key] - k[j - 1][key]) / (k[j + 1].t - k[j - 1].t);
  };
  const m0 = slope(i) * h;
  const m1 = slope(i + 1) * h;
  const s = (t - p0.t) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * p0[key] +
    (s3 - 2 * s2 + s) * m0 +
    (-2 * s3 + 3 * s2) * p1[key] +
    (s3 - s2) * m1
  );
};

const useCamera = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const cover = Math.max(width / IMG_W, height / IMG_H);
  // Gentle drone drift on top of the planned path.
  const drift = (seed: number, amp: number) =>
    amp *
    (Math.sin(t * 0.7 + seed) * 0.6 + Math.sin(t * 1.9 + seed * 3) * 0.4);

  const rDeg = sample(t, "r") + drift(1, 0.25);
  const rad = (Math.abs(rDeg) * Math.PI) / 180;
  const viewW = width / cover;
  const viewH = height / cover;
  // Zoom needed so a rolled viewport never shows the image edges.
  const zMin = Math.max(
    (viewW * Math.cos(rad) + viewH * Math.sin(rad)) / IMG_W,
    (viewW * Math.sin(rad) + viewH * Math.cos(rad)) / IMG_H,
  );
  const z = Math.max(sample(t, "z"), zMin);
  const halfW = (viewW * Math.cos(rad) + viewH * Math.sin(rad)) / (2 * z);
  const halfH = (viewW * Math.sin(rad) + viewH * Math.cos(rad)) / (2 * z);
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(Math.max(v, lo), hi);
  const x = clamp(sample(t, "x") + drift(2, 4), halfW, IMG_W - halfW);
  const y = clamp(sample(t, "y") + drift(3, 3), halfH, IMG_H - halfH);

  return {
    transform: `translate(${width / 2}px, ${height / 2}px) rotate(${rDeg}deg) scale(${cover * z}) translate(${-x}px, ${-y}px)`,
  };
};

// ------------------------------------------------------------------ layers

// Drifting golden mist in the valleys (image space, so it stays in place).
const Mist: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const bands = [
    { y: [300, 380], count: 9, alpha: 0.42, h: [40, 80] }, // distant ridges
    { y: [380, 500], count: 9, alpha: 0.32, h: [50, 100] }, // valleys
    { y: [520, 720], count: 6, alpha: 0.16, h: [80, 140] }, // over the fields
  ];
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", width: IMG_W, height: IMG_H }}>
      {bands.flatMap((b, bi) =>
        new Array(b.count).fill(0).map((_, i) => {
          const id = `${bi}-${i}`;
          const w = 260 + random(`w${id}`) * 420;
          const h = b.h[0] + random(`h${id}`) * (b.h[1] - b.h[0]);
          const speed = (4 + random(`s${id}`) * 9) * (bi === 2 ? 1.4 : 1);
          const span = IMG_W + w + 200;
          const x = ((random(`x${id}`) * span + t * speed) % span) - w - 100;
          const y = b.y[0] + random(`y${id}`) * (b.y[1] - b.y[0]);
          const breathe = 0.7 + 0.3 * Math.sin(t * 0.4 + random(`p${id}`) * 6);
          // Warmer and brighter the closer the mist is to the sun.
          const warm = Math.max(0, 1 - Math.abs(x + w / 2 - SUN.x) / 900);
          return (
            <div
              key={id}
              style={{
                position: "absolute",
                left: x,
                top: y - h / 2,
                width: w,
                height: h,
                borderRadius: "50%",
                background: `radial-gradient(ellipse at center, rgba(255, ${200 + 30 * warm}, ${150 + 40 * warm}, ${b.alpha * breathe}) 0%, rgba(255, 200, 150, 0) 70%)`,
                filter: "blur(14px)",
              }}
            />
          );
        }),
      )}
    </AbsoluteFill>
  );
};

const SunLight: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const glow = 0.55 + 0.12 * Math.sin(t * 0.9);
  const rot = interpolate(t, [0, SECONDS], [-8, 8]);
  const at = `${SUN.x}px ${SUN.y}px`;
  const mask = `radial-gradient(circle at ${at}, black 0%, transparent 55%)`;
  return (
    <>
      <AbsoluteFill
        style={{
          width: IMG_W,
          height: IMG_H,
          mixBlendMode: "screen",
          opacity: 0.16,
          filter: "blur(4px)",
          background: `repeating-conic-gradient(from ${rot}deg at ${at}, rgba(255,195,100,0.4) 0deg 2.5deg, rgba(255,195,100,0) 2.5deg 9deg)`,
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      />
      <AbsoluteFill
        style={{
          width: IMG_W,
          height: IMG_H,
          mixBlendMode: "screen",
          opacity: glow,
          background: `radial-gradient(circle at ${at}, rgba(255,215,130,0.85) 0%, rgba(255,150,50,0.3) 10%, rgba(255,120,30,0) 30%)`,
        }}
      />
    </>
  );
};

// Floating pollen / dust catching the sunlight (screen space).
const Dust: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen" }}>
      {new Array(45).fill(0).map((_, i) => {
        const size = 2 + random(`r${i}`) * 5;
        const speed = 0.25 + random(`s${i}`) * 0.5;
        const x =
          random(`x${i}`) * width + Math.sin((frame + i * 20) / 45) * 35;
        const y =
          (((random(`y${i}`) * height - frame * speed) % height) + height) %
          height;
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin((frame + i * 13) / 28));
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
              background: "rgba(255, 205, 130, 0.9)",
              boxShadow: "0 0 8px rgba(255, 180, 90, 0.9)",
              opacity: twinkle * 0.5,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ title

const TEXT_START = 37 * FPS;
const TEXT_END = SECONDS * FPS;

// Golden particles spiralling into the centre as the title forms.
const VortexParticles: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const local = frame - TEXT_START + 15;
  if (local < 0 || local > 110) return null;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen" }}>
      {new Array(70).fill(0).map((_, i) => {
        const delay = random(`d${i}`) * 30;
        const p = interpolate(local - delay, [0, 60], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.in(Easing.quad),
        });
        if (p <= 0 || p >= 1) return null;
        const r0 = 500 + random(`r${i}`) * 500;
        const a0 = random(`a${i}`) * Math.PI * 2;
        const r = r0 * (1 - p);
        const a = a0 + p * Math.PI * 3;
        const size = 2 + random(`z${i}`) * 4;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: width / 2 + Math.cos(a) * r * 1.6,
              top: height / 2 + Math.sin(a) * r * 0.55,
              width: size,
              height: size,
              borderRadius: "50%",
              background: "rgba(255, 215, 150, 1)",
              boxShadow: "0 0 10px rgba(255, 180, 80, 1)",
              opacity: Math.sin(p * Math.PI),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const VortexTitle: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const local = frame - TEXT_START;
  if (local < -20) return null;

  const fadeOut = interpolate(frame, [TEXT_END - 45, TEXT_END - 5], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const backdrop = interpolate(local, [-20, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chars = Array.from(text);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <AbsoluteFill
        style={{
          opacity: backdrop * fadeOut,
          background:
            "radial-gradient(ellipse 55% 30% at center, rgba(20,10,0,0.45) 0%, rgba(20,10,0,0) 100%)",
        }}
      />
      <div
        style={{
          fontFamily: titleFont,
          fontWeight: 600,
          fontSize: 112,
          color: "#fff4e2",
          whiteSpace: "nowrap",
          opacity: fadeOut,
          textShadow:
            "0 0 18px rgba(255,190,90,0.6), 0 0 44px rgba(255,160,60,0.35), 0 4px 22px rgba(0,0,0,0.55)",
        }}
      >
        {chars.map((c, i) => {
          const p = interpolate(local - i * 1.4, [0, 42], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          const angle = (1 - p) * Math.PI * 2.2 + i * 0.35;
          const radius = (1 - p) * 700;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                whiteSpace: "pre",
                opacity: p,
                filter: `blur(${(1 - p) * 12}px)`,
                transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius * 0.5}px) rotate(${(1 - p) * 540}deg) scale(${0.2 + 0.8 * p})`,
              }}
            >
              {c}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ main

export const MiSueno: React.FC<Props> = ({ text }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const camera = useCamera();

  const fade = interpolate(
    frame,
    [0, 45, durationInFrames - 20, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ opacity: fade }}>
        <div
          style={{
            position: "absolute",
            width: IMG_W,
            height: IMG_H,
            transformOrigin: "0 0",
            ...camera,
          }}
        >
          <Img
            src={staticFile("cafetal.webp")}
            style={{
              width: IMG_W,
              height: IMG_H,
              filter: "saturate(1.08) contrast(1.04)",
            }}
          />
          <SunLight />
          <Mist />
        </div>

        <Dust />

        {/* Warm haze, cinematic vignette */}
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,170,80,0.10) 0%, rgba(255,170,80,0) 45%), radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)",
          }}
        />

        <VortexParticles />
        <VortexTitle text={text} />
      </AbsoluteFill>

      <Audio src={staticFile("mi-sueno-audio.mp3")} />
    </AbsoluteFill>
  );
};
