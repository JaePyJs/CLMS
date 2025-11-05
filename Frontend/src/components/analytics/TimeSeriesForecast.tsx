import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Download,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';

interface TimeSeriesData {
  timestamp: Date;
  value: number;
  predicted?: number;
  upperBound?: number;
  lowerBound?: number;
}

interface TimeSeriesForecastProps {
  data: TimeSeriesData[];
  title?: string;
  description?: string;
  metric?: 'student_visits' | 'equipment_usage' | 'book_circulation';
  timeframe?: 'day' | 'week' | 'month';
  onMetricChange?: (
    metric: 'student_visits' | 'equipment_usage' | 'book_circulation'
  ) => void;
  onTimeframeChange?: (timeframe: 'day' | 'week' | 'month') => void;
  showConfidence?: boolean;
  showPredictions?: boolean;
}

const METRIC_CONFIG = {
  student_visits: {
    label: 'Student Visits',
    color: '#3b82f6',
    icon: Activity,
    unit: 'visits',
  },
  equipment_usage: {
    label: 'Equipment Usage',
    color: '#10b981',
    icon: Activity,
    unit: 'sessions',
  },
  book_circulation: {
    label: 'Book Circulation',
    color: '#f59e0b',
    icon: Activity,
    unit: 'transactions',
  },
};

export function TimeSeriesForecast({
  data,
  title,
  description,
  metric = 'student_visits',
  timeframe = 'week',
  onMetricChange,
  onTimeframeChange,
  showConfidence = true,
  showPredictions = true,
}: TimeSeriesForecastProps) {
  const [showHistorical, setShowHistorical] = useState(true);
  const [showBounds, setShowBounds] = useState(true);

  const config = METRIC_CONFIG[metric];

  // Process data for chart
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      date: new Date(d.timestamp).toLocaleDateString(),
      timestamp: d.timestamp.getTime(),
      hasPrediction: d.predicted !== undefined,
    }));
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    const historicalData = data.filter((d) => d.predicted === undefined);
    const predictedData = data.filter((d) => d.predicted !== undefined);

    const historicalValues = historicalData.map((d) => d.value);
    const predictedValues = predictedData.map((d) => d.predicted || 0);

    const lastHistorical = historicalValues[historicalValues.length - 1] || 0;
    const avgHistorical =
      historicalValues.reduce((sum, val) => sum + val, 0) /
        historicalValues.length || 0;
    const avgPredicted =
      predictedValues.reduce((sum, val) => sum + val, 0) /
        predictedValues.length || 0;

    const trend =
      avgPredicted > avgHistorical
        ? 'increasing'
        : avgPredicted < avgHistorical
          ? 'decreasing'
          : 'stable';
    const trendPercent =
      avgHistorical > 0
        ? Math.round(((avgPredicted - avgHistorical) / avgHistorical) * 100)
        : 0;

    return {
      lastHistorical,
      avgHistorical: Math.round(avgHistorical),
      avgPredicted: Math.round(avgPredicted),
      trend,
      trendPercent,
      totalHistorical: historicalData.length,
      totalPredicted: predictedData.length,
      maxValue: Math.max(
        ...data.map((d) =>
          Math.max(d.value, d.predicted || d.value, d.upperBound || d.value)
        )
      ),
      minValue: Math.min(
        ...data.map((d) =>
          Math.min(d.value, d.predicted || d.value, d.lowerBound || d.value)
        )
      ),
    };
  }, [data]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value} {config.unit}
            </p>
          ))}
          {data.hasPrediction && (
            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
              <p>
                Confidence Range: {data.lowerBound} - {data.upperBound}
              </p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <config.icon className="h-5 w-5" />
              <span>{title || `${config.label} Forecast`}</span>
            </CardTitle>
            <CardDescription>
              {description ||
                `Time series analysis and prediction for ${config.label.toLowerCase()}`}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {onMetricChange && (
              <Select value={metric} onValueChange={onMetricChange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METRIC_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {onTimeframeChange && (
              <Select value={timeframe} onValueChange={onTimeframeChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistorical(!showHistorical)}
            >
              {showHistorical ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBounds(!showBounds)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Statistics Summary */}
          <div className="grid gap-4 md:grid-cols-5">
            <div className="p-3 bg-muted/30 rounded">
              <div className="text-2xl font-bold">{stats.avgHistorical}</div>
              <div className="text-xs text-muted-foreground">
                Current Average
              </div>
            </div>

            <div className="p-3 bg-muted/30 rounded">
              <div className="text-2xl font-bold">{stats.avgPredicted}</div>
              <div className="text-xs text-muted-foreground">
                Predicted Average
              </div>
            </div>

            <div className="p-3 bg-muted/30 rounded">
              <div className="flex items-center space-x-2">
                {stats.trend === 'increasing' ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : stats.trend === 'decreasing' ? (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                ) : (
                  <Activity className="h-4 w-4 text-blue-600" />
                )}
                <div className="text-2xl font-bold">
                  {stats.trendPercent > 0 ? '+' : ''}
                  {stats.trendPercent}%
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {stats.trend === 'increasing'
                  ? 'Increasing'
                  : stats.trend === 'decreasing'
                    ? 'Decreasing'
                    : 'Stable'}
              </div>
            </div>

            <div className="p-3 bg-muted/30 rounded">
              <div className="text-2xl font-bold">{stats.totalHistorical}</div>
              <div className="text-xs text-muted-foreground">
                Historical Points
              </div>
            </div>

            <div className="p-3 bg-muted/30 rounded">
              <div className="text-2xl font-bold">{stats.totalPredicted}</div>
              <div className="text-xs text-muted-foreground">
                Predicted Points
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    });
                  }}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  domain={[stats.minValue * 0.9, stats.maxValue * 1.1]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                {/* Confidence bounds */}
                {showPredictions && showBounds && showConfidence && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="upperBound"
                      stackId="bounds"
                      stroke="none"
                      fill={config.color}
                      fillOpacity={0.1}
                      name="Upper Bound"
                    />
                    <Area
                      type="monotone"
                      dataKey="lowerBound"
                      stackId="bounds"
                      stroke="none"
                      fill="white"
                      fillOpacity={0.8}
                      name="Lower Bound"
                    />
                  </>
                )}

                {/* Historical data */}
                {showHistorical && (
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={config.color}
                    strokeWidth={2}
                    dot={{ fill: config.color, r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Historical"
                    connectNulls={false}
                  />
                )}

                {/* Predicted data */}
                {showPredictions && (
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke={config.color}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: config.color, r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Predicted"
                    connectNulls={false}
                  />
                )}

                {/* Reference line between historical and predicted */}
                {showHistorical && showPredictions && (
                  <ReferenceLine
                    x={chartData.find((d) => d.hasPrediction)?.date || ''}
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Forecast Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Time Period:</span>
                  <span className="font-medium">{timeframe}ly</span>
                </div>
                <div className="flex justify-between">
                  <span>Prediction Method:</span>
                  <span className="font-medium">Exponential Smoothing</span>
                </div>
                <div className="flex justify-between">
                  <span>Confidence Level:</span>
                  <span className="font-medium">95%</span>
                </div>
                <div className="flex justify-between">
                  <span>Data Points:</span>
                  <span className="font-medium">{chartData.length}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Trend Analysis</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Current Trend:</span>
                  <Badge
                    variant={
                      stats.trend === 'increasing'
                        ? 'default'
                        : stats.trend === 'decreasing'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {stats.trend}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Change Rate:</span>
                  <span className="font-medium">{stats.trendPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Peak Value:</span>
                  <span className="font-medium">
                    {Math.round(stats.maxValue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Min Value:</span>
                  <span className="font-medium">
                    {Math.round(stats.minValue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Forecast generated using historical data and statistical analysis
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Report
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TimeSeriesForecast;
