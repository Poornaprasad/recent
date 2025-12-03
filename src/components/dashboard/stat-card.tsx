import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils/utils';
import type { LucideIcon } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  change?: number;
  changeText?: string;
  footerText?: string;
}

export function StatCard({ title, value, icon: Icon, change, changeText, footerText }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
             <div className="text-2xl font-bold">{value}</div>
        </div>
        <div className="p-2 bg-primary/10 rounded-md">
             <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {change !== undefined ? (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
             <Badge variant={change > 0 ? 'success' : 'destructive'} className="text-xs">
                {change > 0 ? `+${change}` : change}%
            </Badge>
            <span>{changeText}</span>
          </div>
        ) : (
            <p className="text-xs text-muted-foreground">{footerText}</p>
        )}
      </CardContent>
    </Card>
  );
}
