"use client";

const pulse = {
  animation: "sk-pulse 1.6s ease-in-out infinite",
} as React.CSSProperties;

if (typeof document !== "undefined") {
  const id = "__sk_pulse";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes sk-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.35; }
      }
    `;
    document.head.appendChild(s);
  }
}

const BG = "rgba(100,116,139,0.15)";

export function Skeleton({
  height = "1em",
  width = "100%",
  radius = "4px",
  style = {},
}: {
  height?: string;
  width?: string;
  radius?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: 0,
        background: BG,
        ...pulse,
        ...style,
      }}
    />
  );
}

export function SkeletonCard({
  height = "120px",
  style = {},
}: {
  height?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        height,
        borderRadius: "0px",
        background: BG,
        ...pulse,
        ...style,
      }}
    />
  );
}

function Row({ w = "100%", h = "12px", mb = "8px" }: { w?: string; h?: string; mb?: string }) {
  return <Skeleton height={h} width={w} style={{ marginBottom: mb, borderRadius: "0px" }} />;
}

function Block({ h = "40px", radius = "6px", style = {} }: { h?: string; radius?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ height: h, borderRadius: 0, background: BG, ...pulse, ...style }} />
  );
}

function Grid({ cols, gap = "12px", children }: { cols: string; gap?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, gap }}>{children}</div>
  );
}

function Section({ children, mt = "24px" }: { children: React.ReactNode; mt?: string }) {
  return <div style={{ marginTop: mt }}>{children}</div>;
}

export function DashboardSkeleton() {
  return (
    <div>
      <Grid cols="1fr 1fr" gap="16px">
        <div style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.15)", padding: "16px" }}>
          <Row w="40%" h="10px" mb="10px" />
          <Row w="60%" h="22px" mb="8px" />
          <Row w="50%" h="10px" mb="0" />
        </div>
        <div style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.15)", padding: "16px" }}>
          <Row w="35%" h="10px" mb="10px" />
          <Row w="70%" h="16px" mb="6px" />
          <Row w="80%" h="12px" mb="0" />
        </div>
      </Grid>

      <Section mt="24px">
        <div style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.15)", padding: "20px" }}>
          <Row w="30%" h="14px" mb="16px" />
          <Block h="280px" radius="6px" />

          <Section mt="20px">
            <Grid cols="repeat(4, 1fr)" gap="10px">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.12)", padding: "12px" }}>
                  <Row w="60%" h="9px" mb="8px" />
                  <Row w="40%" h="16px" mb="0" />
                </div>
              ))}
            </Grid>
          </Section>

          <Section mt="24px">
            <Row w="25%" h="12px" mb="12px" />
            <div style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.12)", padding: "16px" }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: BG, ...pulse }} />
                  <Skeleton height="8px" width="60px" style={{ borderRadius: "0px" }} />
                  <Skeleton height="6px" style={{ flex: 1, borderRadius: "0px" }} />
                  <Skeleton height="8px" width="36px" style={{ borderRadius: "0px" }} />
                </div>
              ))}
              <Section mt="16px">
                <Row w="100%" h="10px" mb="6px" />
                <Row w="85%" h="10px" mb="0" />
              </Section>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.1)", padding: "10px 12px", marginTop: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <Skeleton height="9px" width="38%" style={{ borderRadius: "0px" }} />
                  <Skeleton height="9px" width="15%" style={{ borderRadius: "0px" }} />
                  <div style={{ flex: 1 }} />
                  <Skeleton height="20px" width="48px" radius="4px" />
                </div>
              ))}
            </div>
          </Section>

          <Section mt="24px">
            <Row w="30%" h="12px" mb="12px" />
            <Grid cols="1fr 1fr" gap="12px">
              <Block h="180px" />
              <Block h="180px" />
            </Grid>
            <Section mt="12px">
              <Block h="160px" />
            </Section>
          </Section>

          <Section mt="24px">
            <Row w="20%" h="12px" mb="12px" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                <Skeleton height="9px" width="70px" style={{ borderRadius: "0px" }} />
                <Skeleton height="9px" width="40px" style={{ borderRadius: "0px" }} />
                <Skeleton height="9px" style={{ flex: 1, borderRadius: "0px" }} />
                <Skeleton height="9px" width="50px" style={{ borderRadius: "0px" }} />
              </div>
            ))}
          </Section>
        </div>
      </Section>
      <div style={{ marginTop: "2em" }}>

      <Row w="60%" h="9px" mb="16px" />

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px 16px", marginBottom: "8px" }}>
        <Row w="90%" h="9px" mb="6px" />
        <Row w="70%" h="9px" mb="0" />
      </div>

      <Grid cols="repeat(4, 1fr)" gap="8px">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px" }}>
            <Row w="70%" h="9px" mb="8px" />
            <Row w="45%" h="18px" mb="6px" />
            <Row w="60%" h="8px" mb="0" />
          </div>
        ))}
      </Grid>

      <Grid cols="1fr 1fr" gap="8px" >
        <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "14px", marginTop: "8px" }}>
          <Row w="50%" h="9px" mb="16px" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <Skeleton height="9px" width="25%" style={{ borderRadius: "0px" }} />
                <Skeleton height="9px" width="15%" style={{ borderRadius: "0px" }} />
              </div>
              <Skeleton
                height="3px"
                width={`${[85, 55, 40, 30][i]}%`}
                style={{ borderRadius: "0px" }}
              />
            </div>
          ))}
        </div>

        <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "14px", marginTop: "8px" }}>
          <Row w="55%" h="9px" mb="16px" />
          <Grid cols="1fr 1fr" gap="8px">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} style={{ border: "1px solid rgba(100,116,139,0.1)", padding: "10px" }}>
                <Row w="70%" h="8px" mb="8px" />
                <Row w="40%" h="14px" mb="0" />
              </div>
            ))}
          </Grid>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px", background: "rgba(100,116,139,0.07)", marginTop: "8px" }}>
              <Skeleton height="9px" width="55%" style={{ borderRadius: "0px" }} />
              <Skeleton height="9px" width="15%" style={{ borderRadius: "0px" }} />
            </div>
          ))}
          <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "10px", marginTop: "8px" }}>
            <Row w="95%" h="8px" mb="4px" />
            <Row w="80%" h="8px" mb="0" />
          </div>
        </div>
      </Grid>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", marginTop: "8px", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "8px", padding: "10px 12px", borderBottom: "1px solid rgba(100,116,139,0.12)" }}>
          {["18%", "12%", "12%", "14%", "14%", "14%", "10%"].map((w, i) => (
            <Skeleton key={i} height="8px" width={w} style={{ borderRadius: "0px" }} />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderBottom: i < 3 ? "1px solid rgba(100,116,139,0.08)" : "none" }}>
            <Skeleton height="9px" width="18%" style={{ borderRadius: "0px" }} />
            {["12%", "12%", "14%", "14%", "14%", "10%"].map((w, j) => (
              <Skeleton key={j} height="9px" width={w} style={{ borderRadius: "0px" }} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px 16px", marginTop: "8px" }}>
        <Row w="20%" h="8px" mb="8px" />
        <Row w="100%" h="9px" mb="6px" />
        <Row w="85%" h="9px" mb="0" />
      </div>

      <Row w="100%" h="8px" mb="0" style={{ marginTop: "12px" }} />
    </div>

    <div style={{ marginTop: "2em" }}>
      <Row w="55%" h="9px" mb="16px" />
      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px 16px", marginBottom: "8px" }}>
        <Row w="100%" h="9px" mb="6px" />
        <Row w="70%" h="9px" mb="0" />
      </div>

      <Row w="30%" h="9px" mb="8px" style={{ marginTop: "1em" }} />
      <Grid cols="repeat(4, 1fr)" gap="8px">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px" }}>
            <Row w="70%" h="8px" mb="8px" />
            <Row w="50%" h="16px" mb="0" />
          </div>
        ))}
      </Grid>

      <Grid cols="1fr 1fr" gap="8px" >
        {Array.from({ length: 2 }).map((_, col) => (
          <div key={col} style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "14px", marginTop: "8px" }}>
            <Row w="50%" h="9px" mb="14px" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <Skeleton height="9px" width="45%" style={{ borderRadius: "0px" }} />
                <Skeleton height="4px" width="30%" style={{ borderRadius: "0px" }} />
              </div>
            ))}
          </div>
        ))}
      </Grid>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", marginTop: "8px", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "8px", padding: "10px 12px", borderBottom: "1px solid rgba(100,116,139,0.12)" }}>
          {["25%", "15%", "15%", "15%", "15%"].map((w, i) => (
            <Skeleton key={i} height="8px" width={w} style={{ borderRadius: "0px" }} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", padding: "10px 12px", borderBottom: i < 5 ? "1px solid rgba(100,116,139,0.08)" : "none" }}>
            {["25%", "15%", "15%", "15%", "15%"].map((w, j) => (
              <Skeleton key={j} height="9px" width={w} style={{ borderRadius: "0px" }} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px 16px", marginTop: "8px" }}>
        <Row w="20%" h="8px" mb="8px" />
        <Row w="100%" h="9px" mb="6px" />
        <Row w="80%" h="9px" mb="0" />
      </div>
      <Row w="100%" h="8px" mb="0" style={{ marginTop: "12px" }} />
    </div>

    <div style={{ marginTop: "2em" }}>

      <Row w="65%" h="9px" mb="16px" />

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px 16px", marginBottom: "8px" }}>
        <Row w="100%" h="9px" mb="6px" />
        <Row w="80%" h="9px" mb="6px" />
        <Row w="60%" h="9px" mb="0" />
      </div>

      <Grid cols="repeat(4, 1fr)" gap="8px">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px" }}>
            <Row w="70%" h="9px" mb="8px" />
            <Row w="45%" h="18px" mb="6px" />
            <Row w="60%" h="8px" mb="0" />
          </div>
        ))}
      </Grid>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "14px", marginTop: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
          <Skeleton height="9px" width="35%" style={{ borderRadius: "0px" }} />
          <Skeleton height="9px" width="25%" style={{ borderRadius: "0px" }} />
        </div>
        <Block h="140px" />
      </div>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", marginTop: "8px", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "8px", padding: "10px 12px", borderBottom: "1px solid rgba(100,116,139,0.12)" }}>
          {["14%", "14%", "10%", "22%", "10%", "10%", "10%"].map((w, i) => (
            <Skeleton key={i} height="8px" width={w} style={{ borderRadius: "0px" }} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderBottom: i < 5 ? "1px solid rgba(100,116,139,0.08)" : "none" }}>
            {["14%", "14%", "10%", "22%", "10%", "10%", "10%"].map((w, j) => (
              <Skeleton key={j} height="9px" width={w} style={{ borderRadius: "0px" }} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px 16px", marginTop: "8px" }}>
        <Row w="20%" h="8px" mb="8px" />
        <Row w="100%" h="9px" mb="6px" />
        <Row w="75%" h="9px" mb="0" />
      </div>

      <Row w="100%" h="8px" mb="0" style={{ marginTop: "12px" }} />
    </div>
    </div>
  );
}

export function BacktestSkeleton() {
  return (
    <div style={{ padding: "24px" }}>
      <Grid cols="repeat(4, 1fr)" gap="12px">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.12)", padding: "14px" }}>
            <Row w="70%" h="9px" mb="10px" />
            <Row w="50%" h="20px" mb="0" />
          </div>
        ))}
      </Grid>

      <Section mt="20px">
        <Block h="260px" />
      </Section>

      <Section mt="20px">
        <div style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.12)", padding: "16px" }}>
          <Row w="40%" h="10px" mb="12px" />
          <Row w="100%" h="6px" mb="8px" style={{ borderRadius: "0px" }} />
          <Grid cols="1fr 1fr 1fr" gap="10px">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ borderRadius: "0px", padding: "10px", border: "1px solid rgba(100,116,139,0.1)" }}>
                <Row w="60%" h="9px" mb="8px" />
                <Row w="45%" h="16px" mb="0" />
              </div>
            ))}
          </Grid>
        </div>
      </Section>

      <Section mt="20px">
        <div style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.12)", padding: "16px" }}>
          <Row w="35%" h="10px" mb="14px" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <Skeleton height="9px" width="45%" style={{ borderRadius: "0px" }} />
              <div style={{ flex: 1 }} />
              <Skeleton height="22px" width="60px" radius="4px" />
              <Skeleton height="22px" width="80px" radius="4px" />
            </div>
          ))}
        </div>
      </Section>

      <Section mt="20px">
        <Grid cols="1fr 1fr" gap="12px">
          <Block h="160px" />
          <Block h="160px" />
        </Grid>
      </Section>

      <Section mt="20px">
        <Block h="120px" />
      </Section>

      <Section mt="28px">
        <Row w="40%" h="14px" mb="16px" />
        <Grid cols="repeat(4, 1fr)" gap="10px">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.1)", padding: "12px" }}>
              <Row w="70%" h="9px" mb="8px" />
              <Row w="45%" h="18px" mb="0" />
            </div>
          ))}
        </Grid>
        <Section mt="14px">
          <Block h="180px" />
        </Section>
      </Section>
    </div>
  );
}

export function PaperSkeleton() {
  return (
    <div style={{ padding: "24px" }}>
      <Grid cols="1fr 1fr" gap="16px">
        <div style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.12)", padding: "16px" }}>
          <Row w="50%" h="11px" mb="12px" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <Skeleton height="9px" width="45%" style={{ borderRadius: "0px" }} />
              <Skeleton height="9px" width="30%" style={{ borderRadius: "0px" }} />
            </div>
          ))}
        </div>
        <div style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.12)", padding: "16px" }}>
          <Row w="50%" h="11px" mb="12px" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <Skeleton height="9px" width="45%" style={{ borderRadius: "0px" }} />
              <Skeleton height="9px" width="30%" style={{ borderRadius: "0px" }} />
            </div>
          ))}
        </div>
      </Grid>

      <Section mt="24px">
        <Row w="30%" h="11px" mb="14px" />
        <div style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.12)", overflow: "hidden" }}>
          <div style={{ display: "flex", gap: "0", borderBottom: "1px solid rgba(100,116,139,0.12)", padding: "10px 16px" }}>
            {["25%", "18%", "18%", "18%", "21%"].map((w, i) => (
              <Skeleton key={i} height="9px" width={w} style={{ borderRadius: "0px", marginRight: "8px" }} />
            ))}
          </div>
          {["crash", "bearish", "transitional", "bullish"].map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: i < 3 ? "1px solid rgba(100,116,139,0.08)" : "none" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "0%", background: BG, ...pulse, marginRight: "8px", flexShrink: 0 }} />
              {["20%", "15%", "15%", "15%", "20%"].map((w, j) => (
                <Skeleton key={j} height="9px" width={w} style={{ borderRadius: "0px", marginRight: "8px" }} />
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section mt="24px">
        <Block h="140px" />
      </Section>
    </div>
  );
}

export function CompareSkeleton() {
  return (
    <div>
      <div style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.12)", padding: "14px 16px", marginBottom: "20px" }}>
        <Row w="55%" h="10px" mb="8px" />
        <Row w="80%" h="10px" mb="0" />
      </div>

      <Grid cols="1fr 1fr" gap="16px">
        <div>
          <Row w="30%" h="11px" mb="10px" />
          <Block h="200px" />
        </div>
        <div>
          <Row w="30%" h="11px" mb="10px" />
          <Block h="200px" />
        </div>
      </Grid>

      <Section mt="24px">
        <Row w="25%" h="11px" mb="14px" />
        <div style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.12)", overflow: "hidden" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderBottom: i < 7 ? "1px solid rgba(100,116,139,0.08)" : "none", gap: "12px" }}>
              <Skeleton height="9px" width="30%" style={{ borderRadius: "0px" }} />
              <div style={{ flex: 1 }} />
              <Skeleton height="9px" width="22%" style={{ borderRadius: "0px" }} />
              <Skeleton height="9px" width="22%" style={{ borderRadius: "0px" }} />
            </div>
          ))}
        </div>
      </Section>

      <Section mt="24px">
        <Row w="30%" h="11px" mb="14px" />
        <Block h="160px" />
      </Section>
    </div>
  );
}

export function IntradaySkeleton() {
  return (
    <div style={{ padding: "24px" }}>
      <Grid cols="repeat(3, 1fr)" gap="12px">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.12)", padding: "14px" }}>
            <Row w="65%" h="9px" mb="10px" />
            <Row w="40%" h="22px" mb="6px" />
            <Row w="55%" h="9px" mb="0" />
          </div>
        ))}
      </Grid>

      <Section mt="14px">
        <Skeleton height="34px" width="200px" radius="6px" />
      </Section>

      <Section mt="20px">
        <Block h="240px" />
      </Section>

      <Section mt="20px">
        <Row w="30%" h="11px" mb="14px" />
        <Grid cols="repeat(4, 1fr)" gap="10px">
          {["crash", "bearish", "transitional", "bullish"].map((label, i) => (
            <div key={i} style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.12)", padding: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "0%", background: BG, ...pulse }} />
                <Skeleton height="9px" width="60%" style={{ borderRadius: "0px" }} />
              </div>
              <Row w="45%" h="18px" mb="6px" />
              <Row w="70%" h="9px" mb="0" />
            </div>
          ))}
        </Grid>
      </Section>

      <Section mt="20px">
        <Block h="180px" />
      </Section>
    </div>
  );
}

export function StatsSkeleton() {
  const Section4 = ({ title }: { title?: boolean }) => (
    <div style={{ borderRadius: "0px", border: "1px solid rgba(100,116,139,0.12)", padding: "16px", marginBottom: "16px" }}>
      {title && <Row w="40%" h="10px" mb="14px" />}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < 3 ? "12px" : "0" }}>
          <Skeleton height="9px" width="50%" style={{ borderRadius: "0px" }} />
          <div style={{ flex: 1 }} />
          <Skeleton height="22px" width="55px" radius="4px" />
          <Skeleton height="22px" width="70px" radius="4px" />
          <Skeleton height="22px" width="55px" radius="4px" />
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: "24px" }}>
      <Section4 title />
      <Section4 title />
      <Section4 title />
      <Section4 title />
    </div>
  );
}

export function VolForecastSkeleton() {
  return (
    <div style={{ marginTop: "2em" }}>

      <Row w="60%" h="9px" mb="16px" />

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px 16px", marginBottom: "8px" }}>
        <Row w="90%" h="9px" mb="6px" />
        <Row w="70%" h="9px" mb="0" />
      </div>

      <Grid cols="repeat(4, 1fr)" gap="8px">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px" }}>
            <Row w="70%" h="9px" mb="8px" />
            <Row w="45%" h="18px" mb="6px" />
            <Row w="60%" h="8px" mb="0" />
          </div>
        ))}
      </Grid>

      <Grid cols="1fr 1fr" gap="8px" >
        <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "14px", marginTop: "8px" }}>
          <Row w="50%" h="9px" mb="16px" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <Skeleton height="9px" width="25%" style={{ borderRadius: "0px" }} />
                <Skeleton height="9px" width="15%" style={{ borderRadius: "0px" }} />
              </div>
              <Skeleton
                height="3px"
                width={`${[85, 55, 40, 30][i]}%`}
                style={{ borderRadius: "0px" }}
              />
            </div>
          ))}
        </div>

        <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "14px", marginTop: "8px" }}>
          <Row w="55%" h="9px" mb="16px" />
          <Grid cols="1fr 1fr" gap="8px">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} style={{ border: "1px solid rgba(100,116,139,0.1)", padding: "10px" }}>
                <Row w="70%" h="8px" mb="8px" />
                <Row w="40%" h="14px" mb="0" />
              </div>
            ))}
          </Grid>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px", background: "rgba(100,116,139,0.07)", marginTop: "8px" }}>
              <Skeleton height="9px" width="55%" style={{ borderRadius: "0px" }} />
              <Skeleton height="9px" width="15%" style={{ borderRadius: "0px" }} />
            </div>
          ))}
          <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "10px", marginTop: "8px" }}>
            <Row w="95%" h="8px" mb="4px" />
            <Row w="80%" h="8px" mb="0" />
          </div>
        </div>
      </Grid>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", marginTop: "8px", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "8px", padding: "10px 12px", borderBottom: "1px solid rgba(100,116,139,0.12)" }}>
          {["18%", "12%", "12%", "14%", "14%", "14%", "10%"].map((w, i) => (
            <Skeleton key={i} height="8px" width={w} style={{ borderRadius: "0px" }} />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderBottom: i < 3 ? "1px solid rgba(100,116,139,0.08)" : "none" }}>
            <Skeleton height="9px" width="18%" style={{ borderRadius: "0px" }} />
            {["12%", "12%", "14%", "14%", "14%", "10%"].map((w, j) => (
              <Skeleton key={j} height="9px" width={w} style={{ borderRadius: "0px" }} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px 16px", marginTop: "8px" }}>
        <Row w="20%" h="8px" mb="8px" />
        <Row w="100%" h="9px" mb="6px" />
        <Row w="85%" h="9px" mb="0" />
      </div>

      <Row w="100%" h="8px" mb="0" style={{ marginTop: "12px" }} />
    </div>
  );
}

export function ChangepointSkeleton() {
  return (
    <div style={{ marginTop: "2em" }}>

      <Row w="65%" h="9px" mb="16px" />

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px 16px", marginBottom: "8px" }}>
        <Row w="100%" h="9px" mb="6px" />
        <Row w="80%" h="9px" mb="6px" />
        <Row w="60%" h="9px" mb="0" />
      </div>

      <Grid cols="repeat(4, 1fr)" gap="8px">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px" }}>
            <Row w="70%" h="9px" mb="8px" />
            <Row w="45%" h="18px" mb="6px" />
            <Row w="60%" h="8px" mb="0" />
          </div>
        ))}
      </Grid>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "14px", marginTop: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
          <Skeleton height="9px" width="35%" style={{ borderRadius: "0px" }} />
          <Skeleton height="9px" width="25%" style={{ borderRadius: "0px" }} />
        </div>
        <Block h="140px" />
      </div>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", marginTop: "8px", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "8px", padding: "10px 12px", borderBottom: "1px solid rgba(100,116,139,0.12)" }}>
          {["14%", "14%", "10%", "22%", "10%", "10%", "10%"].map((w, i) => (
            <Skeleton key={i} height="8px" width={w} style={{ borderRadius: "0px" }} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderBottom: i < 5 ? "1px solid rgba(100,116,139,0.08)" : "none" }}>
            {["14%", "14%", "10%", "22%", "10%", "10%", "10%"].map((w, j) => (
              <Skeleton key={j} height="9px" width={w} style={{ borderRadius: "0px" }} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px 16px", marginTop: "8px" }}>
        <Row w="20%" h="8px" mb="8px" />
        <Row w="100%" h="9px" mb="6px" />
        <Row w="75%" h="9px" mb="0" />
      </div>

      <Row w="100%" h="8px" mb="0" style={{ marginTop: "12px" }} />
    </div>
  );
}

export function MacroAttributionSkeleton() {
  return (
    <div style={{ marginTop: "2em" }}>
      <Row w="55%" h="9px" mb="16px" />
      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px 16px", marginBottom: "8px" }}>
        <Row w="100%" h="9px" mb="6px" />
        <Row w="70%" h="9px" mb="0" />
      </div>

      <Row w="30%" h="9px" mb="8px" style={{ marginTop: "1em" }} />
      <Grid cols="repeat(4, 1fr)" gap="8px">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px" }}>
            <Row w="70%" h="8px" mb="8px" />
            <Row w="50%" h="16px" mb="0" />
          </div>
        ))}
      </Grid>

      <Grid cols="1fr 1fr" gap="8px" >
        {Array.from({ length: 2 }).map((_, col) => (
          <div key={col} style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "14px", marginTop: "8px" }}>
            <Row w="50%" h="9px" mb="14px" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <Skeleton height="9px" width="45%" style={{ borderRadius: "0px" }} />
                <Skeleton height="4px" width="30%" style={{ borderRadius: "0px" }} />
              </div>
            ))}
          </div>
        ))}
      </Grid>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", marginTop: "8px", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "8px", padding: "10px 12px", borderBottom: "1px solid rgba(100,116,139,0.12)" }}>
          {["25%", "15%", "15%", "15%", "15%"].map((w, i) => (
            <Skeleton key={i} height="8px" width={w} style={{ borderRadius: "0px" }} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", padding: "10px 12px", borderBottom: i < 5 ? "1px solid rgba(100,116,139,0.08)" : "none" }}>
            {["25%", "15%", "15%", "15%", "15%"].map((w, j) => (
              <Skeleton key={j} height="9px" width={w} style={{ borderRadius: "0px" }} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid rgba(100,116,139,0.12)", padding: "12px 16px", marginTop: "8px" }}>
        <Row w="20%" h="8px" mb="8px" />
        <Row w="100%" h="9px" mb="6px" />
        <Row w="80%" h="9px" mb="0" />
      </div>
      <Row w="100%" h="8px" mb="0" style={{ marginTop: "12px" }} />
    </div>
  );
}