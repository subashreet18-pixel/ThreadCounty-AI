"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import * as tmImage from "@teachablemachine/image";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string;
  imageName: string;
  imageUrl: string;
  prediction: string;
  confidence: string;
  confidenceNum: number;
  time: string;
  date: string;
  severity: "Low" | "Medium" | "High" | "Critical" | "None";
  recommendation: string;
}

interface Notification {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

interface Stats {
  totalScanned: number;
  normalCount: number;
  defectCount: number;
  avgConfidence: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  "⚙️  Loading Model...",
  "🖼️  Preparing Image...",
  "🤖  Running AI Analysis...",
  "📊  Finalizing Prediction...",
];

const COLORS = {
  bg: "#060d1a",
  surface: "rgba(15,25,50,0.85)",
  card: "rgba(20,35,65,0.7)",
  border: "rgba(56,189,248,0.15)",
  borderHover: "rgba(56,189,248,0.4)",
  primary: "#38bdf8",
  primaryDark: "#0ea5e9",
  success: "#22c55e",
  danger: "#ef4444",
  warning: "#f59e0b",
  muted: "#94a3b8",
  text: "#e2e8f0",
  glow: "rgba(56,189,248,0.25)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSeverity(confidenceNum: number, isDefect: boolean): "Low" | "Medium" | "High" | "Critical" | "None" {
  if (!isDefect) return "None";
  if (confidenceNum >= 90) return "Critical";
  if (confidenceNum >= 75) return "High";
  if (confidenceNum >= 55) return "Medium";
  return "Low";
}

function getRecommendation(prediction: string, severity: string): string {
  const isNormal = prediction.toLowerCase().includes("normal");
  if (isNormal) return "✅ Continue Production — Fabric quality meets standards.";
  switch (severity) {
    case "Critical": return "🚨 Stop Production Immediately — Critical defect detected. Inspect machine for needle damage.";
    case "High": return "⛔ Halt Line — High severity defect. Quality inspection required. Check yarn tension.";
    case "Medium": return "⚠️ Pause & Inspect — Possible weaving error or yarn breakage. Manual review needed.";
    default: return "🔍 Flag for Review — Low confidence defect. Manual inspection recommended.";
  }
}

function getAIInsight(history: HistoryEntry[]): string {
  if (history.length === 0) return "No scans yet. Upload a fabric image to begin analysis.";
  const defects = history.filter(h => !h.prediction.toLowerCase().includes("normal"));
  const defectRate = (defects.length / history.length) * 100;
  const avgConf = history.reduce((s, h) => s + h.confidenceNum, 0) / history.length;
  const recentDefects = history.slice(0, 3).filter(h => !h.prediction.toLowerCase().includes("normal")).length;

  if (defectRate === 0) return "🏆 Excellent fabric quality! All scans passed. Production is running at peak efficiency.";
  if (recentDefects >= 3) return "🚨 Critical Alert: 3 consecutive defects detected. Recommend immediate machine inspection.";
  if (defectRate > 60) return "📉 Production quality decreasing. Repeated defects detected — maintenance required.";
  if (defectRate > 30) return "⚠️ Moderate defect rate observed. Monitor closely and schedule preventive maintenance.";
  if (avgConf < 65) return "🔍 Low confidence predictions detected. Ensure proper lighting and image quality.";
  return `✅ Stable production. ${(100 - defectRate).toFixed(0)}% pass rate in last ${history.length} scans.`;
}

function getProductionHealth(stats: Stats): { label: string; color: string; score: number } {
  if (stats.totalScanned === 0) return { label: "No Data", color: COLORS.muted, score: 0 };
  const passRate = (stats.normalCount / stats.totalScanned) * 100;
  if (passRate >= 90) return { label: "Excellent", color: COLORS.success, score: passRate };
  if (passRate >= 75) return { label: "Good", color: "#84cc16", score: passRate };
  if (passRate >= 50) return { label: "Average", color: COLORS.warning, score: passRate };
  return { label: "Critical", color: COLORS.danger, score: passRate };
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlowCard({ children, style = {}, hover = true }: { children: React.ReactNode; style?: React.CSSProperties; hover?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: COLORS.card,
        border: `1px solid ${hovered ? COLORS.borderHover : COLORS.border}`,
        borderRadius: 16,
        padding: 24,
        backdropFilter: "blur(12px)",
        transition: "all 0.3s ease",
        boxShadow: hovered ? `0 0 32px ${COLORS.glow}` : "0 4px 24px rgba(0,0,0,0.4)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 12px",
      borderRadius: 20,
      background: color + "22",
      border: `1px solid ${color}55`,
      color,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.05em",
    }}>
      {label}
    </span>
  );
}

function StatCard({ icon, label, value, color, sub }: { icon: string; label: string; value: string | number; color: string; sub?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);
  return (
    <GlowCard style={{ textAlign: "center", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)", transition: "all 0.5s ease" }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: color + "99", marginTop: 4 }}>{sub}</div>}
    </GlowCard>
  );
}

function NotificationToast({ notifications }: { notifications: Notification[] }) {
  return (
    <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {notifications.map(n => {
        const colors: Record<string, string> = { info: COLORS.primary, success: COLORS.success, warning: COLORS.warning, error: COLORS.danger };
        return (
          <div key={n.id} style={{
            background: "rgba(10,20,40,0.95)",
            border: `1px solid ${colors[n.type]}55`,
            borderLeft: `4px solid ${colors[n.type]}`,
            borderRadius: 10,
            padding: "12px 18px",
            color: COLORS.text,
            fontSize: 14,
            fontWeight: 500,
            backdropFilter: "blur(16px)",
            boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
            minWidth: 280,
            animation: "slideIn 0.3s ease",
          }}>
            {n.message}
          </div>
        );
      })}
    </div>
  );
}

// ─── SVG Charts ───────────────────────────────────────────────────────────────

function PieChart({ normal, defect }: { normal: number; defect: number }) {
  const total = normal + defect;
  if (total === 0) {
    return (
      <svg viewBox="0 0 200 200" width={160} height={160}>
        <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="28" />
        <text x="100" y="107" textAnchor="middle" fill={COLORS.muted} fontSize="14">No Data</text>
      </svg>
    );
  }
  const normalPct = (normal / total) * 100;
  const defectPct = (defect / total) * 100;
  const r = 70, cx = 100, cy = 100;
  const normalAngle = (normalPct / 100) * 2 * Math.PI;
  const x1 = cx + r * Math.sin(0), y1 = cy - r * Math.cos(0);
  const x2 = cx + r * Math.sin(normalAngle), y2 = cy - r * Math.cos(normalAngle);
  const largeArc = normalAngle > Math.PI ? 1 : 0;
  return (
    <svg viewBox="0 0 200 200" width={160} height={160}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.danger + "55"} strokeWidth="28" />
      {normal > 0 && (
        <path
          d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
          fill={COLORS.success}
          opacity="0.85"
        />
      )}
      <circle cx={cx} cy={cy} r={44} fill={COLORS.bg} />
      <text x={cx} y={cy - 6} textAnchor="middle" fill={COLORS.text} fontSize="18" fontWeight="700">
        {normalPct.toFixed(0)}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={COLORS.muted} fontSize="10">
        Pass Rate
      </text>
    </svg>
  );
}

function BarChart({ history }: { history: HistoryEntry[] }) {
  const last7 = history.slice(0, 7).reverse();
  const maxVal = 1;
  const barW = 28, gap = 12, svgW = (barW + gap) * 7 + gap, svgH = 120;
  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height={svgH} style={{ overflow: "visible" }}>
      {last7.map((entry, i) => {
        const isNormal = entry.prediction.toLowerCase().includes("normal");
        const barH = Math.max(8, (entry.confidenceNum / 100) * (svgH - 30));
        const x = gap + i * (barW + gap);
        const y = svgH - 20 - barH;
        return (
          <g key={entry.id}>
            <rect x={x} y={svgH - 20 - (svgH - 30)} width={barW} height={svgH - 30} rx={6} fill="rgba(255,255,255,0.04)" />
            <rect x={x} y={y} width={barW} height={barH} rx={6} fill={isNormal ? COLORS.success : COLORS.danger} opacity={0.8} />
            <text x={x + barW / 2} y={svgH - 4} textAnchor="middle" fill={COLORS.muted} fontSize="9">
              {entry.time.split(":").slice(0, 2).join(":")}
            </text>
          </g>
        );
      })}
      {last7.length === 0 && (
        <text x={svgW / 2} y={svgH / 2} textAnchor="middle" fill={COLORS.muted} fontSize="13">No scan data yet</text>
      )}
    </svg>
  );
}

function LineChart({ history }: { history: HistoryEntry[] }) {
  const data = history.slice(0, 10).reverse();
  if (data.length < 2) {
    return <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: 20 }}>Need at least 2 scans for trend</div>;
  }
  const svgW = 300, svgH = 100, padX = 20, padY = 10;
  const iW = svgW - padX * 2, iH = svgH - padY * 2;
  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * iW;
    const y = padY + iH - (d.confidenceNum / 100) * iH;
    return `${x},${y}`;
  });
  const polyline = points.join(" ");
  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height={svgH}>
      <polyline points={polyline} fill="none" stroke={COLORS.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        const [px, py] = points[i].split(",").map(Number);
        const isNormal = d.prediction.toLowerCase().includes("normal");
        return (
          <circle key={d.id} cx={px} cy={py} r={4} fill={isNormal ? COLORS.success : COLORS.danger} stroke={COLORS.bg} strokeWidth="2" />
        );
      })}
      <text x={padX} y={svgH - 2} fill={COLORS.muted} fontSize="9">{data[0]?.time}</text>
      <text x={svgW - padX} y={svgH - 2} textAnchor="end" fill={COLORS.muted} fontSize="9">{data[data.length - 1]?.time}</text>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [prediction, setPrediction] = useState("");
  const [confidence, setConfidence] = useState("");
  const [confidenceNum, setConfidenceNum] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [activeSection, setActiveSection] = useState("upload");
  const [severity, setSeverity] = useState<HistoryEntry["severity"]>("None");
  const [recommendation, setRecommendation] = useState("");
  const [animatePred, setAnimatePred] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Notification helper ───────────────────────────────────────────────────

  const notify = useCallback((message: string, type: Notification["type"] = "info") => {
    const id = uid();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 3500);
  }, []);

  // ─── Stats ────────────────────────────────────────────────────────────────

  const stats: Stats = {
    totalScanned: history.length,
    normalCount: history.filter(h => h.prediction.toLowerCase().includes("normal")).length,
    defectCount: history.filter(h => !h.prediction.toLowerCase().includes("normal")).length,
    avgConfidence: history.length > 0
      ? Math.round(history.reduce((s, h) => s + h.confidenceNum, 0) / history.length)
      : 0,
  };
  const health = getProductionHealth(stats);

  // ─── File handling ────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      notify("❌ Please upload a valid image file.", "error");
      return;
    }
    setSelectedImage(file);
    setPreview(URL.createObjectURL(file));
    setPrediction("");
    setConfidence("");
    setConfidenceNum(0);
    setSeverity("None");
    setRecommendation("");
    setAnimatePred(false);
    notify("🖼️ Image uploaded successfully!", "success");
  }, [notify]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ─── AI Analysis ──────────────────────────────────────────────────────────

  const analyzeImage = async () => {
    if (!selectedImage) {
      notify("⚠️ Please upload a fabric image first.", "warning");
      return;
    }
    setLoading(true);
    setAnimatePred(false);
    setPrediction("");
    setLoadingProgress(0);
    notify("🤖 AI Analysis started...", "info");

    let msgIdx = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    loadingTimerRef.current = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, LOADING_MESSAGES.length - 1);
      setLoadingMsg(LOADING_MESSAGES[msgIdx]);
      setLoadingProgress(prev => Math.min(prev + 25, 95));
    }, 700);

    try {
      const model = await tmImage.load("/model/model.json", "/model/metadata.json");
      const img = document.createElement("img");
      img.src = URL.createObjectURL(selectedImage);
      img.onload = async () => {
        const results = await model.predict(img);
        const best = results.reduce((a, b) => a.probability > b.probability ? a : b);
        const conf = parseFloat((best.probability * 100).toFixed(2));
        const confStr = conf.toFixed(2) + "%";
        const isDefect = !best.className.toLowerCase().includes("normal");
        const sev = getSeverity(conf, isDefect);
        const rec = getRecommendation(best.className, sev);

        clearInterval(loadingTimerRef.current!);
        setLoadingProgress(100);

        setTimeout(() => {
          setPrediction(best.className);
          setConfidence(confStr);
          setConfidenceNum(conf);
          setSeverity(sev);
          setRecommendation(rec);
          setLoading(false);
          setAnimatePred(true);

          setHistory(prev => [{
            id: uid(),
            imageName: selectedImage.name,
            imageUrl: preview,
            prediction: best.className,
            confidence: confStr,
            confidenceNum: conf,
            time: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString(),
            severity: sev,
            recommendation: rec,
          }, ...prev]);

          notify(
            isDefect ? "🔴 Defect detected in fabric!" : "🟢 Fabric looks normal!",
            isDefect ? "error" : "success"
          );
        }, 400);
      };
    } catch {
      clearInterval(loadingTimerRef.current!);
      setLoading(false);
      notify("❌ Model load failed. Check /model/ files.", "error");
    }
  };

  // ─── Export Report ────────────────────────────────────────────────────────

  const exportReport = () => {
    if (history.length === 0) {
      notify("⚠️ No analysis data to export.", "warning");
      return;
    }
    const latest = history[0];
    const lines = [
      "THREADCOUNTY AI — FABRIC INSPECTION REPORT",
      "=".repeat(50),
      `Date: ${latest.date} ${latest.time}`,
      `Image: ${latest.imageName}`,
      `Prediction: ${latest.prediction}`,
      `Confidence: ${latest.confidence}`,
      `Severity: ${latest.severity}`,
      `Recommendation: ${latest.recommendation}`,
      "=".repeat(50),
      "PRODUCTION SUMMARY",
      `Total Scanned: ${stats.totalScanned}`,
      `Normal: ${stats.normalCount}`,
      `Defective: ${stats.defectCount}`,
      `Avg Confidence: ${stats.avgConfidence}%`,
      `Production Health: ${health.label}`,
      "=".repeat(50),
      "Generated by ThreadCounty AI — AI-Powered Textile Intelligence",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `threadcounty-report-${Date.now()}.txt`; a.click();
    notify("📄 Report downloaded!", "success");
  };

  // ─── Styles ───────────────────────────────────────────────────────────────

  const sectionBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 22px",
    borderRadius: 30,
    border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
    background: active ? COLORS.primary + "22" : "transparent",
    color: active ? COLORS.primary : COLORS.muted,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    transition: "all 0.2s ease",
    letterSpacing: "0.03em",
  });

  const isNormal = prediction.toLowerCase().includes("normal");
  const predColor = isNormal ? COLORS.success : COLORS.danger;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${COLORS.bg}; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
        ::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.3); border-radius: 3px; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(56,189,248,0.3); } 50% { box-shadow: 0 0 40px rgba(56,189,248,0.6); } }
        @keyframes dash { to { stroke-dashoffset: 0; } }
      `}</style>

      <NotificationToast notifications={notifications} />

      <main style={{
        minHeight: "100vh",
        background: `radial-gradient(ellipse at top, #0c1a3a 0%, ${COLORS.bg} 60%)`,
        color: COLORS.text,
        fontFamily: "'Inter', sans-serif",
      }}>

        {/* ── NAV ── */}
        <nav style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(6,13,26,0.85)",
          backdropFilter: "blur(20px)",
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "0 40px",
        }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", height: 64 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>🧵</span>
              <span style={{ fontWeight: 800, fontSize: 18, background: `linear-gradient(90deg, ${COLORS.primary}, #818cf8)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                ThreadCounty AI
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["upload", "dashboard", "analytics", "history"].map(s => (
                <button key={s} onClick={() => setActiveSection(s)} style={sectionBtnStyle(activeSection === s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {stats.totalScanned > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: health.color + "22", border: `1px solid ${health.color}44`, borderRadius: 20, padding: "4px 12px" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: health.color, animation: "pulse 2s infinite" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: health.color }}>{health.label}</span>
                </div>
              )}
              <button onClick={exportReport} style={{ padding: "8px 18px", borderRadius: 8, background: COLORS.primary + "22", border: `1px solid ${COLORS.primary}44`, color: COLORS.primary, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                📄 Export
              </button>
            </div>
          </div>
        </nav>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>

          {/* ── HERO ── */}
          {activeSection === "upload" && (
            <div style={{ textAlign: "center", marginBottom: 56, animation: "fadeUp 0.6s ease" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.primary + "18", border: `1px solid ${COLORS.primary}33`, borderRadius: 20, padding: "6px 18px", marginBottom: 24, fontSize: 13, color: COLORS.primary, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.primary, display: "inline-block", animation: "pulse 1.5s infinite" }} />
                AI-Powered Textile Intelligence
              </div>
              <h1 style={{ fontSize: "clamp(36px,6vw,72px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", background: `linear-gradient(135deg, #ffffff 0%, ${COLORS.primary} 60%, #818cf8 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 20 }}>
                Detect Fabric Defects<br />Before They Cost You
              </h1>
              <p style={{ fontSize: "clamp(16px,2.5vw,20px)", color: COLORS.muted, maxWidth: 600, margin: "0 auto 36px", lineHeight: 1.7 }}>
                Upload a fabric image and get instant AI-powered defect detection, severity scoring, and production recommendations.
              </p>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => fileInputRef.current?.click()} style={{ padding: "14px 32px", borderRadius: 12, background: `linear-gradient(135deg, ${COLORS.primaryDark}, #818cf8)`, color: "white", border: "none", cursor: "pointer", fontSize: 16, fontWeight: 700, boxShadow: `0 0 32px ${COLORS.glow}` }}>
                  🚀 Start Analysis
                </button>
                <button onClick={() => setActiveSection("dashboard")} style={{ padding: "14px 32px", borderRadius: 12, background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.primary}55`, cursor: "pointer", fontSize: 16, fontWeight: 600 }}>
                  📊 View Dashboard
                </button>
              </div>
            </div>
          )}

          {/* ── FEATURES ── */}
          {activeSection === "upload" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 48 }}>
              {[
                { icon: "🧠", title: "AI Detection", desc: "Teachable Machine powered defect analysis" },
                { icon: "⚡", title: "Instant Results", desc: "Predictions in under 3 seconds" },
                { icon: "📊", title: "Analytics", desc: "Real-time production dashboards" },
                { icon: "🌿", title: "Sustainability", desc: "Reduce waste with smart inspection" },
              ].map(f => (
                <GlowCard key={f.title} style={{ padding: 20 }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>{f.desc}</div>
                </GlowCard>
              ))}
            </div>
          )}

          {/* ── UPLOAD + PREDICTION ── */}
          {activeSection === "upload" && (
            <div style={{ display: "grid", gridTemplateColumns: preview ? "1fr 1fr" : "1fr", gap: 24, marginBottom: 32 }}>

              {/* Upload zone */}
              <GlowCard hover={false} style={{ padding: 0 }}>
                <div style={{ padding: 24, borderBottom: `1px solid ${COLORS.border}` }}>
                  <h2 style={{ fontWeight: 800, fontSize: 20 }}>🤖 AI Fabric Analysis</h2>
                  <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>Drag & drop or click to upload a fabric image</p>
                </div>
                <div style={{ padding: 24 }}>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    style={{
                      border: `2px dashed ${isDragging ? COLORS.primary : COLORS.border}`,
                      borderRadius: 12,
                      padding: "40px 24px",
                      textAlign: "center",
                      cursor: "pointer",
                      background: isDragging ? COLORS.primary + "0a" : "transparent",
                      transition: "all 0.2s ease",
                      minHeight: preview ? 120 : 200,
                    }}
                  >
                    {preview ? (
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <img src={preview} alt="Preview" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 10, border: `2px solid ${COLORS.primary}55`, objectFit: "cover" }} />
                        <button onClick={e => { e.stopPropagation(); setSelectedImage(null); setPreview(""); setPrediction(""); }} style={{ position: "absolute", top: -10, right: -10, background: COLORS.danger, border: "none", borderRadius: "50%", width: 26, height: 26, color: "white", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>×</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
                        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Drop fabric image here</div>
                        <div style={{ color: COLORS.muted, fontSize: 13 }}>or click to browse — PNG, JPG, WEBP</div>
                      </>
                    )}
                  </div>

                  {preview && (
                    <div style={{ marginTop: 12, fontSize: 13, color: COLORS.muted }}>
                      📎 {selectedImage?.name} ({selectedImage ? (selectedImage.size / 1024).toFixed(0) : 0} KB)
                    </div>
                  )}

                  {/* Loading progress */}
                  {loading && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                        <div style={{ width: 20, height: 20, border: `2px solid ${COLORS.primary}33`, borderTop: `2px solid ${COLORS.primary}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
                        <span style={{ fontSize: 14, color: COLORS.primary, fontWeight: 600, animation: "pulse 1s infinite" }}>{loadingMsg}</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: `linear-gradient(90deg,${COLORS.primaryDark},#818cf8)`, width: `${loadingProgress}%`, borderRadius: 3, transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={analyzeImage}
                    disabled={loading || !selectedImage}
                    style={{
                      marginTop: 20, width: "100%", padding: "14px", borderRadius: 10,
                      background: loading || !selectedImage ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg,${COLORS.primaryDark},#818cf8)`,
                      color: loading || !selectedImage ? COLORS.muted : "white",
                      border: "none", cursor: loading || !selectedImage ? "not-allowed" : "pointer",
                      fontSize: 16, fontWeight: 700, transition: "all 0.2s ease",
                      boxShadow: !loading && selectedImage ? `0 0 24px ${COLORS.glow}` : "none",
                    }}
                  >
                    {loading ? "⏳ Analyzing..." : "🔍 Analyze Fabric"}
                  </button>
                </div>
              </GlowCard>

              {/* Prediction card */}
              {prediction && (
                <GlowCard hover={false} style={{ opacity: animatePred ? 1 : 0, transform: animatePred ? "scale(1)" : "scale(0.95)", transition: "all 0.4s ease", animation: animatePred ? "glow 3s infinite" : "none", border: `1px solid ${predColor}44` }}>
                  <div style={{ textAlign: "center", padding: "8px 0" }}>

                    <div style={{ fontSize: 64, marginBottom: 8 }}>{isNormal ? "✅" : "🚨"}</div>

                    <div style={{ fontSize: 32, fontWeight: 900, color: predColor, marginBottom: 4, letterSpacing: "-0.02em" }}>
                      {isNormal ? "FABRIC NORMAL" : "DEFECT DETECTED"}
                    </div>

                    <div style={{ fontSize: 14, color: COLORS.muted, marginBottom: 20 }}>{prediction}</div>

                    {/* Confidence meter */}
                    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 600 }}>Confidence</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: predColor }}>{confidence}</span>
                      </div>
                      <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${confidenceNum}%`, background: `linear-gradient(90deg,${predColor}88,${predColor})`, borderRadius: 4, transition: "width 1s ease" }} />
                      </div>
                    </div>

                    {/* Severity */}
                    {!isNormal && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>DEFECT SEVERITY</div>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          {(["Low", "Medium", "High", "Critical"] as const).map(s => {
                            const colors: Record<string, string> = { Low: "#84cc16", Medium: COLORS.warning, High: "#f97316", Critical: COLORS.danger };
                            const active = s === severity;
                            return (
                              <div key={s} style={{ padding: "4px 10px", borderRadius: 6, background: active ? colors[s] + "33" : "rgba(255,255,255,0.05)", border: `1px solid ${active ? colors[s] + "88" : "transparent"}`, fontSize: 11, fontWeight: 700, color: active ? colors[s] : COLORS.muted }}>
                                {s}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Recommendation */}
                    <div style={{ background: predColor + "12", border: `1px solid ${predColor}33`, borderRadius: 10, padding: 14, fontSize: 13, lineHeight: 1.6, color: COLORS.text, textAlign: "left" }}>
                      {recommendation}
                    </div>

                    {/* AI Score */}
                    <div style={{ marginTop: 16, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: COLORS.muted }}>Production Health</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: health.color }}>{health.label}</span>
                    </div>
                  </div>
                </GlowCard>
              )}

              {!prediction && !loading && (
                <GlowCard hover={false} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 300 }}>
                  <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>🔬</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.muted }}>Awaiting Analysis</div>
                  <div style={{ fontSize: 13, color: COLORS.muted + "99", marginTop: 8 }}>Upload a fabric image and click Analyze</div>
                </GlowCard>
              )}
            </div>
          )}

          {/* ── AI INSIGHTS ── */}
          {activeSection === "upload" && (
            <GlowCard style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.primary, letterSpacing: "0.1em", marginBottom: 6 }}>AI INSIGHTS</div>
                  <div style={{ fontSize: 15, lineHeight: 1.6 }}>{getAIInsight(history)}</div>
                </div>
                {stats.totalScanned > 0 && (
                  <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.success }}>{stats.normalCount}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>Passed</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.danger }}>{stats.defectCount}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>Defects</div>
                    </div>
                  </div>
                )}
              </div>
            </GlowCard>
          )}

          {/* ── DASHBOARD ── */}
          {activeSection === "dashboard" && (
            <div style={{ animation: "fadeUp 0.5s ease" }}>
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>📊 Production Dashboard</h2>
                <p style={{ color: COLORS.muted }}>Live statistics from your fabric inspection sessions</p>
              </div>

              {/* Stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 32 }}>
                <StatCard icon="🔬" label="Total Scanned" value={stats.totalScanned} color={COLORS.primary} />
                <StatCard icon="✅" label="Normal Fabrics" value={stats.normalCount} color={COLORS.success} sub={stats.totalScanned ? `${((stats.normalCount / stats.totalScanned) * 100).toFixed(0)}% pass rate` : undefined} />
                <StatCard icon="🚨" label="Defects Found" value={stats.defectCount} color={COLORS.danger} sub={stats.totalScanned ? `${((stats.defectCount / stats.totalScanned) * 100).toFixed(0)}% defect rate` : undefined} />
                <StatCard icon="🎯" label="Avg Confidence" value={`${stats.avgConfidence}%`} color="#818cf8" />
                <StatCard icon="🏭" label="Production Health" value={health.label} color={health.color} sub={stats.totalScanned ? `${health.score.toFixed(0)}% score` : undefined} />
              </div>

              {/* Charts */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20, marginBottom: 24 }}>
                <GlowCard>
                  <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>🥧 Quality Distribution</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    <PieChart normal={stats.normalCount} defect={stats.defectCount} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS.success }} />
                        <span style={{ fontSize: 13 }}>Normal ({stats.normalCount})</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS.danger }} />
                        <span style={{ fontSize: 13 }}>Defect ({stats.defectCount})</span>
                      </div>
                    </div>
                  </div>
                </GlowCard>

                <GlowCard>
                  <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>📈 Confidence History</div>
                  <LineChart history={history} />
                </GlowCard>

                <GlowCard>
                  <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>📊 Recent Scans (Confidence)</div>
                  <BarChart history={history} />
                </GlowCard>
              </div>

              {/* Recent Activity Timeline */}
              {history.length > 0 && (
                <GlowCard>
                  <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>🕐 Recent Activity</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 300, overflowY: "auto" }}>
                    {history.slice(0, 8).map(h => {
                      const isN = h.prediction.toLowerCase().includes("normal");
                      return (
                        <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: (isN ? COLORS.success : COLORS.danger) + "22", border: `2px solid ${(isN ? COLORS.success : COLORS.danger) + "55"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                            {isN ? "✅" : "🔴"}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{h.imageName}</div>
                            <div style={{ fontSize: 12, color: COLORS.muted }}>{isN ? "Fabric passed" : "Defect found"} · {h.confidence}</div>
                          </div>
                          <div style={{ fontSize: 11, color: COLORS.muted }}>{h.time}</div>
                          <Badge label={isN ? "Normal" : h.severity} color={isN ? COLORS.success : COLORS.danger} />
                        </div>
                      );
                    })}
                  </div>
                </GlowCard>
              )}

              {history.length === 0 && (
                <GlowCard style={{ textAlign: "center", padding: 48 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                  <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>No Data Yet</div>
                  <div style={{ color: COLORS.muted }}>Run your first fabric analysis to populate the dashboard.</div>
                  <button onClick={() => setActiveSection("upload")} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 8, background: COLORS.primary + "22", border: `1px solid ${COLORS.primary}55`, color: COLORS.primary, cursor: "pointer", fontWeight: 600 }}>
                    Start Analyzing →
                  </button>
                </GlowCard>
              )}
            </div>
          )}

          {/* ── ANALYTICS ── */}
          {activeSection === "analytics" && (
            <div style={{ animation: "fadeUp 0.5s ease" }}>
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>📉 Production Analytics</h2>
                <p style={{ color: COLORS.muted }}>Deep insights into your fabric quality trends</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
                <GlowCard>
                  <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 15 }}>Defect Rate</div>
                  <div style={{ fontSize: 48, fontWeight: 900, color: stats.defectCount / Math.max(stats.totalScanned, 1) > 0.3 ? COLORS.danger : COLORS.success }}>
                    {stats.totalScanned ? ((stats.defectCount / stats.totalScanned) * 100).toFixed(1) : 0}%
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.muted }}>of {stats.totalScanned} total scans</div>
                </GlowCard>

                <GlowCard>
                  <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Severity Breakdown</div>
                  {(["Critical", "High", "Medium", "Low"] as const).map(s => {
                    const count = history.filter(h => h.severity === s).length;
                    const pct = history.length ? (count / history.length) * 100 : 0;
                    const c: Record<string, string> = { Critical: COLORS.danger, High: "#f97316", Medium: COLORS.warning, Low: "#84cc16" };
                    return (
                      <div key={s} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: c[s], fontWeight: 600 }}>{s}</span>
                          <span style={{ color: COLORS.muted }}>{count}</span>
                        </div>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: c[s], borderRadius: 3, transition: "width 0.8s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </GlowCard>

                <GlowCard>
                  <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Line Trend</div>
                  <LineChart history={history} />
                  <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 12 }}>Confidence score over last 10 scans</div>
                </GlowCard>
              </div>

              <GlowCard style={{ marginTop: 20 }}>
                <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>📊 Confidence per Scan</div>
                <BarChart history={history} />
              </GlowCard>
            </div>
          )}

          {/* ── HISTORY ── */}
          {activeSection === "history" && (
            <div style={{ animation: "fadeUp 0.5s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>🗂️ Analysis History</h2>
                  <p style={{ color: COLORS.muted }}>{history.length} scans total · newest first</p>
                </div>
                {history.length > 0 && (
                  <button onClick={exportReport} style={{ padding: "10px 20px", borderRadius: 8, background: COLORS.primary + "22", border: `1px solid ${COLORS.primary}55`, color: COLORS.primary, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                    📄 Download Report
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <GlowCard style={{ textAlign: "center", padding: 60 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                  <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>No Scans Yet</div>
                  <div style={{ color: COLORS.muted }}>Your analysis history will appear here after your first scan.</div>
                  <button onClick={() => setActiveSection("upload")} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 8, background: COLORS.primary + "22", border: `1px solid ${COLORS.primary}55`, color: COLORS.primary, cursor: "pointer", fontWeight: 600 }}>
                    Start Scanning →
                  </button>
                </GlowCard>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {history.map((h, idx) => {
                    const isN = h.prediction.toLowerCase().includes("normal");
                    const pColor = isN ? COLORS.success : COLORS.danger;
                    return (
                      <GlowCard key={h.id} style={{ animation: `fadeUp 0.4s ease ${idx * 0.05}s both` }}>
                        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                          <img src={h.imageUrl} alt={h.imageName} style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: `2px solid ${pColor}55`, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 160 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{h.imageName}</div>
                            <div style={{ fontSize: 13, color: COLORS.muted }}>{h.date} · {h.time}</div>
                            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4, lineHeight: 1.5 }}>{h.recommendation}</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <Badge label={isN ? "Normal" : "Defect"} color={pColor} />
                            <div style={{ fontSize: 18, fontWeight: 800, color: pColor, marginTop: 6 }}>{h.confidence}</div>
                            {!isN && <Badge label={h.severity} color={COLORS.warning} />}
                          </div>
                        </div>
                      </GlowCard>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 80, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 20 }}>🧵</span>
              <span style={{ fontWeight: 800, background: `linear-gradient(90deg,${COLORS.primary},#818cf8)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ThreadCounty AI</span>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 28, marginBottom: 20, flexWrap: "wrap" }}>
              {["GitHub", "LinkedIn", "About", "Contact"].map(l => (
                <a key={l} href="#" style={{ color: COLORS.muted, textDecoration: "none", fontSize: 14, transition: "color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = COLORS.primary)}
                  onMouseLeave={e => (e.currentTarget.style.color = COLORS.muted)}>
                  {l}
                </a>
              ))}
            </div>
            <div style={{ fontSize: 13, color: COLORS.muted + "88" }}>
              Built with ❤️ using Next.js · TensorFlow.js · Teachable Machine · Hackathon 2026
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
