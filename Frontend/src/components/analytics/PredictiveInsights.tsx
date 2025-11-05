import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  TrendingUp,
  Target,
  Activity,
  Clock,
  ChevronRight,
  Info,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface PredictiveInsight {
  type:
    | 'demand_forecast'
    | 'peak_prediction'
    | 'resource_optimization'
    | 'anomaly_detection';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  recommendations: string[];
  data: any;
  validUntil: Date;
}

interface PredictiveInsightsProps {
  insights: PredictiveInsight[];
  timeframe: 'day' | 'week' | 'month';
  onTimeframeChange: (timeframe: 'day' | 'week' | 'month') => void;
  onInsightAction?: (insight: PredictiveInsight, action: string) => void;
}

export function PredictiveInsights({
  insights,
  timeframe,
  onTimeframeChange,
  onInsightAction,
}: PredictiveInsightsProps) {
  const [selectedInsight, setSelectedInsight] =
    useState<PredictiveInsight | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'demand_forecast':
        return <TrendingUp className="h-5 w-5" />;
      case 'peak_prediction':
        return <Clock className="h-5 w-5" />;
      case 'resource_optimization':
        return <Target className="h-5 w-5" />;
      case 'anomaly_detection':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) {
      return 'text-green-600';
    }
    if (confidence >= 0.6) {
      return 'text-yellow-600';
    }
    return 'text-red-600';
  };

  const filteredInsights =
    filterType === 'all'
      ? insights
      : insights.filter((insight) => insight.type === filterType);

  const highImpactInsights = insights.filter((i) => i.impact === 'high');
  const actionableInsights = insights.filter(
    (i) => i.recommendations.length > 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Predictive Analytics</h3>
          <p className="text-sm text-muted-foreground">
            AI-powered insights and forecasts for library management
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Tabs
            value={timeframe}
            onValueChange={(value: any) => onTimeframeChange(value)}
          >
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Insights
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.length}</div>
            <p className="text-xs text-muted-foreground">
              Generated this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {highImpactInsights.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actionable</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {actionableInsights.length}
            </div>
            <p className="text-xs text-muted-foreground">
              With recommendations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Confidence
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Math.round(
                (insights.reduce((sum, i) => sum + i.confidence, 0) /
                  insights.length) *
                  100
              )}
              %
            </div>
            <p className="text-xs text-muted-foreground">Prediction accuracy</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filterType} onValueChange={setFilterType}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Insights</TabsTrigger>
          <TabsTrigger value="demand_forecast">Demand</TabsTrigger>
          <TabsTrigger value="peak_prediction">Peaks</TabsTrigger>
          <TabsTrigger value="resource_optimization">Resources</TabsTrigger>
          <TabsTrigger value="anomaly_detection">Anomalies</TabsTrigger>
        </TabsList>

        <TabsContent value={filterType} className="space-y-4">
          {/* Insights Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {filteredInsights.map((insight, index) => (
              <Card
                key={index}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedInsight(insight)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getInsightIcon(insight.type)}
                      <CardTitle className="text-sm font-medium">
                        {insight.title}
                      </CardTitle>
                    </div>
                    <Badge className={getImpactColor(insight.impact)}>
                      {insight.impact}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {insight.description}
                  </p>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span>Confidence:</span>
                      <span
                        className={`font-medium ${getConfidenceColor(insight.confidence)}`}
                      >
                        {Math.round(insight.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 text-muted-foreground">
                      <Info className="h-3 w-3" />
                      <span>{insight.recommendations.length} actions</span>
                    </div>
                  </div>

                  {insight.recommendations.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {insight.recommendations[0]?.substring(0, 60)}...
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredInsights.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No insights found</h3>
                <p className="text-muted-foreground">
                  No {filterType === 'all' ? '' : filterType.replace('_', ' ')}{' '}
                  insights available for the selected period.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Selected Insight Detail */}
      {selectedInsight && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getInsightIcon(selectedInsight.type)}
                <div>
                  <CardTitle>{selectedInsight.title}</CardTitle>
                  <CardDescription>
                    {selectedInsight.description}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className={getImpactColor(selectedInsight.impact)}>
                  {selectedInsight.impact}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedInsight(null)}
                >
                  ×
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Confidence Score */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
              <span className="text-sm font-medium">Prediction Confidence</span>
              <div className="flex items-center space-x-2">
                <div className="w-24 bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${selectedInsight.confidence * 100}%` }}
                  />
                </div>
                <span
                  className={`text-sm font-medium ${getConfidenceColor(selectedInsight.confidence)}`}
                >
                  {Math.round(selectedInsight.confidence * 100)}%
                </span>
              </div>
            </div>

            {/* Validity Period */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Valid until:</span>
              <span>
                {new Date(selectedInsight.validUntil).toLocaleDateString()}
              </span>
            </div>

            {/* Recommendations */}
            {selectedInsight.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3">
                  Recommended Actions
                </h4>
                <div className="space-y-2">
                  {selectedInsight.recommendations.map(
                    (recommendation, index) => (
                      <div
                        key={index}
                        className="flex items-start space-x-3 p-3 bg-muted/30 rounded"
                      >
                        <div className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                          {index + 1}
                        </div>
                        <p className="text-sm flex-1">{recommendation}</p>
                        {onInsightAction && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onInsightAction(
                                selectedInsight,
                                `implement_${index}`
                              );
                            }}
                          >
                            Implement
                          </Button>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Raw Data (for advanced users) */}
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                View Technical Details
              </summary>
              <div className="mt-3 p-3 bg-muted/50 rounded text-xs font-mono">
                <pre>{JSON.stringify(selectedInsight.data, null, 2)}</pre>
              </div>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PredictiveInsights;
