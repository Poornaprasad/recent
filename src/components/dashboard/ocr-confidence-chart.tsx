'use client';

import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getOcrConfidenceDataAction } from '@/lib/actions/index';
import type { StateFilterValue } from '@/hooks/use-state-filter';

const COLORS = {
  high: '#22C55E', // green-500
  medium: '#F59E0B', // amber-500
  low: '#EF4444', // red-500
  failed: '#6B7280', // gray-500
};

interface OcrConfidenceChartProps {
  stateFilter?: StateFilterValue;
}

export const OcrConfidenceChart = ({ stateFilter = 'all' }: OcrConfidenceChartProps) => {
  const [data, setData] = useState([
    { name: 'High (>90%)', value: 0, color: COLORS.high },
    { name: 'Medium (70-90%)', value: 0, color: COLORS.medium },
    { name: 'Low (<70%)', value: 0, color: COLORS.low },
    { name: 'Failed', value: 0, color: COLORS.failed },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionRequired, setActionRequired] = useState(0);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getOcrConfidenceDataAction(stateFilter);
      if (result.data) {
        const chartData = [
          { name: 'High (>90%)', value: result.data.high, color: COLORS.high },
          { name: 'Medium (70-90%)', value: result.data.medium, color: COLORS.medium },
          { name: 'Low (<70%)', value: result.data.low, color: COLORS.low },
          { name: 'Failed', value: result.data.failed, color: COLORS.failed },
        ];
        setData(chartData);
        setActionRequired(result.data.actionRequired);
      }
    } catch (error) {
      console.error('Error loading OCR confidence data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [stateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  const highConfidenceValue = data.find(d => d.name.startsWith('High'))?.value || 0;
  const highConfidencePercentage = total > 0 ? Math.round((highConfidenceValue / total) * 100) : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>OCR Confidence Levels</CardTitle>
          <CardDescription>Document processing accuracy</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>OCR Confidence Levels</CardTitle>
        <CardDescription>Document processing accuracy</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="relative w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  innerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                  paddingAngle={5}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{highConfidencePercentage}%</span>
                <span className="text-sm text-muted-foreground">High Confidence</span>
            </div>
          </div>
          <div className="space-y-4">
            {data.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value}</span>
                </div>
              </div>
            ))}
            <div className="pt-4">
                <p className="text-sm font-semibold">Action Required</p>
                <p className="text-xs text-muted-foreground">{actionRequired} document{actionRequired !== 1 ? 's' : ''} need manual review</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
