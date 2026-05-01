interface Props {
  action: string;
  detail: string;
  color: string;
  regime: number;
}

export default function RecommendationCard({ action, detail, color, regime }: Props) {
  const styleMap: Record<string, string> = {
    green:  "bg-green-950 border-green-800 text-green-300",
    red:    "bg-red-950 border-red-800 text-red-300",
    yellow: "bg-yellow-950 border-yellow-800 text-yellow-300",
    purple: "bg-purple-950 border-purple-800 text-purple-300",
  };
  const styles = styleMap[color] || "bg-gray-900 border-gray-700 text-gray-300";

  

  return (
    <div className={`recommendation p-6 border ${styles.split(" ").slice(0, 2).join(" ")}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Recommended strategy</p>
      <p className={`text-lg font-semibold mb-2 ${styles.split(" ")[2]}`}>{action}</p>
      <p className="text-sm text-gray-400">{detail}</p>
    </div>
  );
}