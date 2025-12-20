'use client';

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, MapPin } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { InvoiceUrgencyMatrix } from "@/components/dashboard/invoice-urgency-matrix";
import { OcrConfidenceChart } from "@/components/dashboard/ocr-confidence-chart";
import { Button } from "@/components/ui/button";
import { getDashboardStatsAction, getDashboardTimeComparisonAction, getDuplicateAlertsAction } from '@/lib/actions/index';
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  getEnabledStatCards,
  buildStatCardProps,
  type DashboardStatsData,
  type DashboardTimeComparisonData
} from "@/lib/config/dashboard.config";
import { 
  useStateFilter, 
  STATE_OPTIONS, 
  type StateFilterValue,
  getEffectiveStateFilter,
  shouldShowStateFilter,
  getStateOptionsForUser,
  getStateDisplayName
} from "@/hooks/use-state-filter";
import { useAuthStore } from "@/hooks/use-auth-store";

interface DuplicateAlert {
  invoiceId: string;
  invoiceNumber: string;
  vendorName: string;
  amount: number;
  date: string;
  confidence: number;
  duplicateReason?: string;
}

export default function DashboardPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { selectedState, setSelectedState } = useStateFilter();
  const effectiveStateFilter = getEffectiveStateFilter(user, selectedState);
  const showStateFilter = shouldShowStateFilter(user);
  const stateOptions = getStateOptionsForUser(user);
  const [statCards, setStatCards] = useState<ReturnType<typeof buildStatCardProps>[]>([]);
  const [duplicateAlerts, setDuplicateAlerts] = useState<DuplicateAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = useCallback(async (stateFilter: StateFilterValue) => {
    setIsLoading(true);
    try {
      const [statsResult, comparisonResult, alertsResult] = await Promise.all([
        getDashboardStatsAction(stateFilter),
        getDashboardTimeComparisonAction(stateFilter),
        getDuplicateAlertsAction(5, stateFilter),
      ]);

      if (statsResult.error || comparisonResult.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: statsResult.error || comparisonResult.error || 'Failed to load dashboard data.',
        });
        return;
      }

      const dashboardStats = statsResult.data!;
      const comparison = comparisonResult.data!;

      // Build stat cards from configuration
      const enabledCards = getEnabledStatCards();
      const builtCards = enabledCards.map(config =>
        buildStatCardProps(config, dashboardStats, comparison)
      );

      setStatCards(builtCards);

      if (alertsResult.data) {
        setDuplicateAlerts(alertsResult.data);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load dashboard data.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboardData(effectiveStateFilter);
  }, [effectiveStateFilter, loadDashboardData]);

  const handleStateChange = (value: string) => {
    setSelectedState(value as StateFilterValue);
  };

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Accounts Payable Dashboard</h2>
            <p className="text-muted-foreground">Real-time overview of invoice processing and payment status</p>
          </div>
          {!showStateFilter && effectiveStateFilter !== 'all' && (
            <Badge variant="outline" className="text-sm">
              {getStateDisplayName(effectiveStateFilter)}
            </Badge>
          )}
        </div>
        {showStateFilter && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedState} onValueChange={handleStateChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent>
                  {stateOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => loadDashboardData(effectiveStateFilter)}>
              Refresh
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 space-y-4">
            <OcrConfidenceChart stateFilter={selectedState} />
            {duplicateAlerts.length > 0 && (
              <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                        <CardTitle>Duplicate Invoice Alert</CardTitle>
                    </div>
                  <CardDescription>
                    {duplicateAlerts.length} potential duplicate invoice{duplicateAlerts.length > 1 ? 's' : ''} detected
                  </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                      {duplicateAlerts.map((alert, index) => (
                        <div key={alert.invoiceId} className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                          <div className="flex items-center gap-2 font-bold text-destructive mb-2">
                            <AlertTriangle className="w-5 h-5" />
                            <span>Potential Duplicate #{index + 1}</span>
                          </div>
                          {alert.duplicateReason && (
                            <p className="text-sm text-destructive/80 mb-3">{alert.duplicateReason}</p>
                          )}
                          <div className="bg-background/50 p-3 rounded-md">
                            <div className="flex justify-between items-center mb-2">
                              <div>
                                <p className="font-semibold">{alert.vendorName}</p>
                                <p className="text-sm text-muted-foreground">Invoice #{alert.invoiceNumber}</p>
                              </div>
                              <Badge variant="secondary" className="text-base">
                                ${alert.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Date: {alert.date} | OCR Confidence: {Math.round(alert.confidence * 100)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button asChild className="w-full">
                        <Link href="/duplicates">Review All Duplicates</Link>
                    </Button>
                </CardFooter>
              </Card>
            )}
        </div>
        <div className="col-span-4 lg:col-span-3">
            <InvoiceUrgencyMatrix stateFilter={selectedState} />
        </div>
      </div>
    </div>
  );
}
