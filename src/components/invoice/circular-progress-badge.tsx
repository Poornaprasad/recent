
import { cn } from "@/lib/utils";

interface CircularProgressBadgeProps {
  score: number;
  className?: string;
}

export function CircularProgressBadge({ score, className }: CircularProgressBadgeProps) {
  const percentage = Math.round(score * 100);
  const circumference = 2 * Math.PI * 18; // 2 * pi * r (radius is 18)
  const strokeDashoffset = circumference - (score * circumference);

  const getColor = () => {
    if (score >= 0.9) return "text-green-500";
    if (score >= 0.7) return "text-yellow-500";
    return "text-red-500";
  };

  const getBgColor = () => {
    if (score >= 0.9) return "text-green-500/20";
    if (score >= 0.7) return "text-yellow-500/20";
    return "text-red-500/20";
  }

  return (
    <div className={cn("relative h-12 w-12", className)}>
      <svg className="w-full h-full" viewBox="0 0 40 40">
        <circle
          className={cn("stroke-current", getBgColor())}
          strokeWidth="4"
          fill="transparent"
          r="18"
          cx="20"
          cy="20"
        />
        <circle
          className={cn("stroke-current transform -rotate-90 origin-center", getColor())}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          r="18"
          cx="20"
          cy="20"
        />
      </svg>
      <span className={cn("absolute inset-0 flex items-center justify-center text-sm font-semibold", getColor())}>
        {percentage}%
      </span>
    </div>
  );
}
