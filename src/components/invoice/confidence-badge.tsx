import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ConfidenceBadgeProps {
  score: number;
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const percentage = Math.round(score * 100);
  const getBadgeClass = () => {
    if (score > 0.9) return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800";
    if (score > 0.7) return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800";
    return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800";
  };

  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-mono", getBadgeClass())}
    >
      {percentage}% confidence
    </Badge>
  );
}
