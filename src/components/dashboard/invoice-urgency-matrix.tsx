'use client';

import { useState, useEffect } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { getInvoiceUrgencyDataAction } from '@/lib/actions';

const COLORS = {
  Overdue: 'hsl(var(--destructive))',
  'Due Soon': '#F59E0B', // orange-400
  'Due Today': '#FBBF24', // amber-400
  'This Week': 'hsl(var(--chart-2))',
  '>7 Days': 'hsl(var(--chart-2))',
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border border-border p-2 rounded-md shadow-lg text-sm">
        <p className="font-bold">{`$${data.amount.toLocaleString()}`}</p>
        <p className="text-muted-foreground">{`${Math.abs(data.days)} days ${data.days < 0 ? 'overdue' : 'until due'}`}</p>
      </div>
    );
  }

  return null;
};

export const InvoiceUrgencyMatrix = () => {
  const [data, setData] = useState<Array<{ days: number; amount: number; urgency: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [urgencyCounts, setUrgencyCounts] = useState({
    overdue: 0,
    dueSoon: 0,
    dueToday: 0,
    thisWeek: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const result = await getInvoiceUrgencyDataAction();
      if (result.data) {
        setData(result.data);
        
        // Calculate counts
        const counts = {
          overdue: result.data.filter(d => d.urgency === 'Overdue').length,
          dueSoon: result.data.filter(d => d.urgency === 'Due Soon').length,
          dueToday: result.data.filter(d => d.urgency === 'Due Today').length,
          thisWeek: result.data.filter(d => d.urgency === 'This Week').length,
        };
        setUrgencyCounts(counts);
      }
    } catch (error) {
      console.error('Error loading invoice urgency data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate domain for chart
  const maxAmount = data.length > 0 ? Math.max(...data.map(d => d.amount)) : 60000;
  const minDays = data.length > 0 ? Math.min(...data.map(d => d.days)) : -15;
  const maxDays = data.length > 0 ? Math.max(...data.map(d => d.days)) : 45;

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Invoice Urgency Matrix</CardTitle>
          <CardDescription>Amount vs. days until due</CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-120px)]">
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Invoice Urgency Matrix</CardTitle>
        <CardDescription>Amount vs. days until due</CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
            {urgencyCounts.overdue > 0 && (
              <Badge variant="destructive">{urgencyCounts.overdue} Overdue</Badge>
            )}
            {urgencyCounts.dueSoon > 0 && (
              <Badge className="bg-orange-500/80 border-transparent text-white">{urgencyCounts.dueSoon} Due Soon</Badge>
            )}
            {urgencyCounts.dueToday > 0 && (
              <Badge className="bg-yellow-500/80 border-transparent text-white">{urgencyCounts.dueToday} Due Today</Badge>
            )}
            {urgencyCounts.thisWeek > 0 && (
              <Badge className="bg-green-500/80 border-transparent text-white">{urgencyCounts.thisWeek} This Week</Badge>
            )}
            {data.length === 0 && (
              <Badge variant="outline">No pending invoices</Badge>
            )}
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-120px)]">
        {data.length > 0 ? (
          <div className="w-full h-[400px] min-h-[400px] max-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{
                  top: 20,
                  right: 20,
                  bottom: 40,
                  left: 20,
                }}
              >
              <XAxis
                type="number"
                dataKey="days"
                name="Days Until Due"
                domain={[Math.min(minDays, -15), Math.max(maxDays, 45)]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                stroke="hsl(var(--border))"
                label={{ value: 'Days Until Due', position: 'insideBottom', offset: -15, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                type="number"
                dataKey="amount"
                name="Invoice Amount"
                tickFormatter={(tick) => `$${tick / 1000}K`}
                domain={[0, Math.max(maxAmount * 1.1, 60000)]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                stroke="hsl(var(--border))"
                label={{ value: 'Invoice Amount', angle: -90, position: 'insideLeft', offset: -5, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Invoices" data={data} fill="#8884d8">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.urgency as keyof typeof COLORS]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No pending invoices to display</p>
          </div>
        )}
         <p className="text-xs text-muted-foreground text-center mt-2 px-4">
             Note: Larger bubbles represent higher invoice amounts. Color indicates urgency: Red (overdue), Orange (due soon), Yellow (this week), Green ({'>'}7 days).
         </p>
      </CardContent>
    </Card>
  );
};
