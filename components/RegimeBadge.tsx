interface Props {
  regime: number;  
  color: string;
  confidence: number;
}

export default function RegimeBadge({ regime, color }: Props) {
  const colorMap: Record<string, string> = {
    green:  "bg-green-400 text-green-400",
    red:    "bg-red-400 text-red-400",
    yellow: "bg-amber-400 text-amber-400",
    purple: "bg-purple-400 text-purple-400",
  };
  const styles = colorMap[color] || "bg-gray-400 text-gray-400";
  const [dotColor, textColor] = styles.split(" ");
  return (
    <div className="regime-badge p-6 flex items-center gap-4">
      <div className={`w-4 h-4 rounded-full ${dotColor}`} />
      <div>
      <p className={`text-xs ${textColor} uppercase tracking-wider`}>
          Current regime - {regime}
        </p>
      </div>
    </div>
  );
}