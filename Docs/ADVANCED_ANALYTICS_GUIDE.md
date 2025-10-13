# Advanced Analytics Documentation

## Overview

CLMS includes a sophisticated analytics system that provides predictive insights, usage patterns, resource optimization recommendations, and comprehensive data visualization. The system uses statistical analysis, machine learning algorithms, and time series forecasting to help librarians make data-driven decisions.

## Features

### 1. Predictive Analytics

**Demand Forecasting:**
- Equipment usage prediction based on historical patterns
- Student visit forecasting with trend analysis
- Resource capacity planning recommendations
- Peak usage time predictions

**Anomaly Detection:**
- Statistical outlier detection in usage patterns
- Unusual activity pattern identification
- System health monitoring and alerts
- Data quality issue detection

**Resource Optimization:**
- Utilization rate analysis across all resources
- Underutilized resource identification
- Overutilized risk assessment
- Capacity planning recommendations

### 2. Time Series Analysis

**Trend Analysis:**
- Long-term usage trend identification
- Seasonal pattern detection
- Growth rate calculations
- Performance monitoring

**Forecasting Models:**
- Exponential smoothing for short-term predictions
- Linear regression for trend forecasting
- Moving averages for pattern smoothing
- Confidence interval calculations

### 3. Visualization Components

**Heat Maps:**
- Hour-by-day usage intensity visualization
- Activity type distribution analysis
- Grade level usage patterns
- Location-based usage mapping

**Interactive Charts:**
- Real-time updating dashboards
- Drill-down capabilities for detailed analysis
- Comparative analysis tools
- Historical trend visualization

## Predictive Analytics User Guide

### Accessing Analytics

1. **Navigate to Analytics Dashboard:**
   - Click on "Analytics" tab in the main navigation
   - Select "Predictive Insights" from the sidebar
   - Choose your preferred timeframe (Day/Week/Month)

2. **Understanding Predictive Insights:**

**Demand Forecast:**
```
Title: Equipment Demand Forecast
Description: Predicted weekly equipment demand: 45 sessions/day (15% increase from current)
Confidence: 85%
Impact: High
Recommendations:
- Consider adding 2 more computers to meet demand
- Implement time-based access controls during peak periods
- Schedule preventive maintenance during low-demand periods
```

**Peak Usage Prediction:**
```
Title: Peak Usage Prediction
Description: Peak usage expected at 10:00, 14:00, 16:00 on Mon, Tue, Wed
Confidence: 78%
Impact: Medium
Recommendations:
- Schedule staff breaks before peak hours
- Ensure all equipment is operational before peak times
- Prepare backup resources for unexpected demand spikes
```

**Resource Optimization:**
```
Title: Resource Utilization Analysis
Description: Current utilization ranges from 25% to 95%
Confidence: 85%
Impact: High (due to gaming console at 95%)
Recommendations:
- Add capacity for gaming resources
- Consider repurposing underutilized resources: study_areas
- Implement dynamic scheduling to balance load across all resources
```

### Interpreting Confidence Scores

- **90-100%**: Very high confidence - predictions based on strong historical patterns
- **75-89%**: High confidence - reliable predictions with minor uncertainty
- **60-74%**: Medium confidence - predictions should be used as guidance
- **50-59%**: Low confidence - limited data or high variability
- **Below 50%**: Very low confidence - treat as preliminary insights only

### Acting on Recommendations

**High Priority Recommendations:**
1. **Resource Capacity Issues**
   - Add resources when utilization exceeds 80%
   - Implement booking systems for overutilized equipment
   - Consider time limits during peak periods

2. **Staffing Optimization**
   - Schedule more staff during predicted peak hours
   - Cross-train staff for multiple resource types
   - Implement automated check-in to reduce staff workload

3. **Maintenance Planning**
   - Schedule maintenance during predicted low-demand periods
   - Implement preventive maintenance based on usage patterns
   - Keep backup equipment ready during maintenance

## Analytics API Documentation

### Base URL
```
Production: https://your-domain.com/api/analytics
Development: http://localhost:3001/api/analytics
```

### Authentication
All analytics endpoints require valid JWT authentication:
```javascript
Headers: {
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'Content-Type': 'application/json'
}
```

### Endpoints

#### 1. Get Predictive Insights

**Endpoint:** `GET /api/analytics/predictive-insights`

**Parameters:**
- `timeframe` (optional): `day` | `week` | `month` (default: `week`)
- `category` (optional): `demand` | `peak` | `optimization` | `anomaly`
- `confidence` (optional): Minimum confidence threshold (0-100)

**Request:**
```javascript
GET /api/analytics/predictive-insights?timeframe=week&confidence=70
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "insight_123",
      "type": "demand_forecast",
      "title": "Equipment Demand Forecast",
      "description": "Predicted weekly equipment demand: 45 sessions/day",
      "confidence": 85,
      "impact": "high",
      "recommendations": [
        "Consider adding 2 more computers",
        "Implement time-based access controls"
      ],
      "data": {
        "current": 39,
        "predicted": 45,
        "trend": 0.15,
        "timeframe": "week"
      },
      "validUntil": "2025-10-20T10:30:00Z",
      "createdAt": "2025-10-13T10:30:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "generatedAt": "2025-10-13T10:30:00Z",
    "timeframe": "week"
  }
}
```

#### 2. Get Usage Heat Map

**Endpoint:** `GET /api/analytics/heat-map`

**Parameters:**
- `timeframe` (optional): `day` | `week` | `month` (default: `week`)
- `activityType` (optional): Filter by activity type
- `gradeLevel` (optional): Filter by grade level
- `location` (optional): Filter by location

**Request:**
```javascript
GET /api/analytics/heat-map?timeframe=week&activityType=COMPUTER_USE
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "hour": 10,
      "dayOfWeek": 1,
      "intensity": 45,
      "activityType": "COMPUTER_USE",
      "gradeLevel": "SENIOR_HIGH"
    },
    {
      "hour": 14,
      "dayOfWeek": 1,
      "intensity": 67,
      "activityType": "COMPUTER_USE",
      "gradeLevel": "SENIOR_HIGH"
    }
  ],
  "meta": {
    "maxIntensity": 89,
    "totalDataPoints": 168,
    "timeframe": "week"
  }
}
```

#### 3. Get Time Series Forecast

**Endpoint:** `GET /api/analytics/time-series-forecast`

**Parameters:**
- `metric` (required): `student_visits` | `equipment_usage` | `book_circulation`
- `timeframe` (optional): `day` | `week` | `month` (default: `week`)
- `periods` (optional): Number of forecast periods (default: 7)

**Request:**
```javascript
GET /api/analytics/time-series-forecast?metric=student_visits&timeframe=week&periods=14
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-10-06T00:00:00Z",
      "value": 42
    },
    {
      "timestamp": "2025-10-07T00:00:00Z",
      "value": 45
    },
    {
      "timestamp": "2025-10-14T00:00:00Z",
      "value": 0,
      "predicted": 48,
      "upperBound": 55,
      "lowerBound": 41
    }
  ],
  "meta": {
    "metric": "student_visits",
    "timeframe": "week",
    "forecastPeriods": 14,
    "confidence": 78
  }
}
```

#### 4. Get Resource Forecasts

**Endpoint:** `GET /api/analytics/resource-forecasts`

**Parameters:**
- `timeframe` (optional): `day` | `week` | `month` (default: `week`)
- `resourceType` (optional): Filter by resource type

**Request:**
```javascript
GET /api/analytics/resource-forecasts?timeframe=month
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "resourceType": "computer",
      "currentUtilization": 67,
      "predictedUtilization": [65, 68, 72, 70, 75, 78, 80, 77, 74, 71],
      "recommendedCapacity": 96,
      "riskLevel": "medium",
      "timeHorizon": "month"
    },
    {
      "resourceType": "gaming",
      "currentUtilization": 95,
      "predictedUtilization": [97, 98, 96, 99, 98, 97, 99, 98, 97, 96],
      "recommendedCapacity": 100,
      "riskLevel": "high",
      "timeHorizon": "month"
    }
  ]
}
```

#### 5. Generate Insights Report

**Endpoint:** `POST /api/analytics/insights-report`

**Parameters:**
- `timeframe` (optional): `day` | `week` | `month` (default: `week`)
- `includeRecommendations` (optional): boolean (default: true)
- `format` (optional): `json` | `pdf` (default: `json`)

**Request:**
```javascript
POST /api/analytics/insights-report
Content-Type: application/json

{
  "timeframe": "month",
  "includeRecommendations": true,
  "format": "json"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": "Analytics report for month: Found 12 insights with 3 high-priority items requiring attention.",
    "insights": [
      {
        "type": "demand_forecast",
        "title": "Equipment Demand Forecast",
        "confidence": 85,
        "impact": "high"
      }
    ],
    "recommendations": [
      "Consider adding capacity for gaming resources",
      "Implement dynamic scheduling to balance load",
      "Schedule preventive maintenance during low-demand periods"
    ],
    "keyMetrics": {
      "totalInsights": 12,
      "highImpactCount": 3,
      "averageConfidence": 76.5,
      "seasonalStrength": 0.67,
      "resourceRisk": 2
    },
    "generatedAt": "2025-10-13T10:30:00Z"
  }
}
```

#### 6. Get Seasonal Patterns

**Endpoint:** `GET /api/analytics/seasonal-patterns`

**Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "period": "daily",
      "pattern": [12, 15, 18, 25, 32, 45, 67, 78, 89, 95, 87, 76, 65, 54, 45, 38, 32, 28, 24, 20, 18, 15, 13, 11],
      "peakTimes": [9, 10, 11],
      "trend": "stable",
      "seasonality": 0.78
    },
    {
      "period": "weekly",
      "pattern": [45, 67, 72, 68, 65, 34, 12],
      "peakTimes": [1, 2, 3],
      "trend": "increasing",
      "seasonality": 0.65
    }
  ]
}
```

## Custom Report Creation Guide

### Using the Reports Builder

1. **Access Reports Builder:**
   - Navigate to "Reports" tab in main navigation
   - Click "Create New Report"
   - Choose "Custom Analytics Report"

2. **Report Configuration:**

**Basic Settings:**
```javascript
{
  "name": "Monthly Library Usage Report",
  "description": "Comprehensive analysis of library usage patterns",
  "timeframe": "month",
  "recipients": ["librarian@school.edu", "principal@school.edu"],
  "schedule": {
    "frequency": "monthly",
    "day": 1,
    "time": "09:00"
  }
}
```

**Data Sources:**
- Student Activities (check-ins, check-outs, equipment usage)
- Equipment Utilization (computers, gaming consoles, study rooms)
- Book Circulation (borrowing, returns, overdue items)
- Time-based Analytics (peak hours, seasonal patterns)
- Predictive Insights (forecasts, recommendations)

**Visualization Options:**
- Line charts for trends over time
- Bar charts for categorical comparisons
- Heat maps for usage intensity
- Pie charts for distribution analysis
- Tables for detailed data

3. **Report Sections:**

**Executive Summary:**
```javascript
{
  "section": "summary",
  "metrics": [
    "totalStudentVisits",
    "averageDailyUsage",
    "peakUtilizationRate",
    "overdueItemsCount"
  ],
  "insights": true,
  "recommendations": true
}
```

**Usage Patterns:**
```javascript
{
  "section": "patterns",
  "visualizations": [
    {
      "type": "heat_map",
      "data": "hourly_usage",
      "title": "Library Usage Heat Map"
    },
    {
      "type": "line_chart",
      "data": "daily_visits",
      "title": "Daily Visitor Trends"
    }
  ]
}
```

**Resource Analysis:**
```javascript
{
  "section": "resources",
  "includeEquipment": true,
  "includeBooks": true,
  "utilizationThreshold": 80,
  "forecastPeriods": 30
}
```

**Predictive Insights:**
```javascript
{
  "section": "predictions",
  "confidenceThreshold": 70,
  "includeHighImpactOnly": false,
  "timeHorizon": "month"
}
```

### API-Based Custom Reports

**Creating Custom Report via API:**
```javascript
POST /api/reports/custom
Content-Type: application/json

{
  "name": "Weekly Performance Report",
  "config": {
    "timeframe": "week",
    "sections": [
      {
        "type": "summary",
        "metrics": ["totalVisits", "equipmentUtilization", "overdueItems"]
      },
      {
        "type": "chart",
        "chartType": "line",
        "dataEndpoint": "/api/analytics/time-series-forecast",
        "dataParams": {
          "metric": "student_visits",
          "periods": 7
        }
      },
      {
        "type": "table",
        "dataEndpoint": "/api/analytics/top-resources",
        "dataParams": {
          "limit": 10,
          "sortBy": "utilization"
        }
      }
    ]
  },
  "delivery": {
    "format": "pdf",
    "email": ["librarian@school.edu"],
    "schedule": {
      "frequency": "weekly",
      "day": "friday",
      "time": "16:00"
    }
  }
}
```

**Retrieving Custom Reports:**
```javascript
GET /api/reports/custom/{reportId}/data
```

**Exporting Reports:**
```javascript
GET /api/reports/custom/{reportId}/export?format=pdf|csv|excel
```

### Advanced Customization

**Custom Metrics:**
```javascript
// Define custom calculations
{
  "customMetrics": [
    {
      "name": "EngagementScore",
      "calculation": "(totalVisits * 0.4) + (equipmentUsage * 0.3) + (bookCirculation * 0.3)",
      "description": "Weighted student engagement score"
    },
    {
      "name": "EfficiencyRatio",
      "calculation": "totalVisits / (staffHours + 1)",
      "description": "Visits per staff hour"
    }
  ]
}
```

**Conditional Formatting:**
```javascript
{
  "conditionalFormatting": [
    {
      "field": "utilizationRate",
      "conditions": [
        {"operator": ">", "value": 80, "style": "red"},
        {"operator": ">", "value": 60, "style": "yellow"},
        {"operator": "<=", "value": 60, "style": "green"}
      ]
    }
  ]
}
```

## Data Interpretation Guide

### Understanding Key Metrics

**Utilization Rate:**
- **Calculation**: (Time in use / Total available time) × 100
- **Good**: 60-80% (efficient use without overcrowding)
- **High**: >80% (may need additional resources)
- **Low**: <30% (underutilized, consider repurposing)

**Peak Hours:**
- **Identification**: Top 3 hours with highest activity
- **Action**: Schedule staff breaks before peak times
- **Optimization**: Prepare resources and ensure availability

**Seasonal Patterns:**
- **Seasonality Strength**: 0-1 scale (higher = more predictable patterns)
- **Trend**: Increasing/decreasing/stable usage over time
- **Application**: Resource planning and scheduling

**Confidence Intervals:**
- **Upper Bound**: Best-case scenario prediction
- **Lower Bound**: Worst-case scenario prediction
- **Usage**: Plan for both optimistic and pessimistic scenarios

### Anomaly Detection

**Statistical Method:**
- Uses 2 standard deviations from mean as anomaly threshold
- Identifies unusual patterns in daily/weekly usage
- Flags both significant increases and decreases

**Common Anomaly Types:**
1. **Sudden Spikes**: Special events, system errors, or data issues
2. **Unusual Drops**: Holidays, system outages, or reporting errors
3. **Pattern Changes**: New programs, policy changes, or user behavior shifts

**Response Protocol:**
1. **Verify Data Quality**: Check for system errors or data entry issues
2. **Investigate Cause**: Look for explanations (events, announcements, etc.)
3. **Document Findings**: Record reasons for future reference
4. **Adjust Thresholds**: Modify anomaly detection if patterns are normal

### Forecasting Interpretation

**Trend Analysis:**
- **Positive Trend**: Increasing usage (growth or popularity)
- **Negative Trend**: Decreasing usage (decline or saturation)
- **Stable**: Consistent usage patterns

**Prediction Accuracy:**
- **Short-term**: Higher accuracy (1-7 days)
- **Medium-term**: Moderate accuracy (1-4 weeks)
- **Long-term**: Lower accuracy (1+ months)

**Resource Planning:**
- Use upper bound predictions for capacity planning
- Use lower bound for minimum staffing requirements
- Consider confidence intervals when making decisions

### Performance Benchmarks

**Library Performance Indicators:**
```javascript
{
  "excellent": {
    "dailyVisits": "> 100",
    "utilizationRate": "70-85%",
    "studentEngagement": "> 80%",
    "resourceEfficiency": "> 75%"
  },
  "good": {
    "dailyVisits": "50-100",
    "utilizationRate": "60-70%",
    "studentEngagement": "60-80%",
    "resourceEfficiency": "60-75%"
  },
  "needsImprovement": {
    "dailyVisits": "< 50",
    "utilizationRate": "< 60%",
    "studentEngagement": "< 60%",
    "resourceEfficiency": "< 60%"
  }
}
```

**Action Thresholds:**
- **Urgent**: Utilization > 90% (immediate action needed)
- **High**: Utilization 80-90% (plan action within week)
- **Medium**: Utilization 60-80% (monitor and optimize)
- **Low**: Utilization < 30% (investigate and promote)

### Data Quality Guidelines

**Required Data for Accurate Analytics:**
1. **Complete Activity Logs**: All check-ins, check-outs, and equipment usage
2. **Consistent Time Recording**: Accurate timestamps for all activities
3. **Student Information**: Grade levels and demographics for segmentation
4. **Equipment Details**: Types, locations, and capacity information
5. **Regular Updates**: Daily data entry and maintenance

**Data Validation Rules:**
```javascript
{
  "validationRules": [
    {
      "field": "timestamp",
      "rules": ["notNull", "validDate", "notFuture"]
    },
    {
      "field": "studentId",
      "rules": ["notNull", "existsInDatabase"]
    },
    {
      "field": "duration",
      "rules": ["positiveNumber", "reasonableRange(0, 480)"]
    }
  ]
}
```

**Common Data Issues:**
1. **Missing Timestamps**: Incomplete activity records
2. **Incorrect Durations**: Negative or unrealistic session lengths
3. **Duplicate Entries**: Multiple records for same activity
4. **Outlier Values**: Data entry errors or system glitches

## Implementation Examples

### Frontend Integration

**React Component for Predictive Insights:**
```javascript
import React, { useState, useEffect } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';

function PredictiveInsights() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('week');
  const { getPredictiveInsights } = useAnalytics();

  useEffect(() => {
    loadInsights();
  }, [timeframe]);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const data = await getPredictiveInsights(timeframe);
      setInsights(data);
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'bg-green-500';
    if (confidence >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return <div>Loading insights...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Predictive Insights</h2>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="day">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      <div className="grid gap-4">
        {insights.map((insight) => (
          <div key={insight.id} className="border rounded-lg p-4 shadow">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold">{insight.title}</h3>
              <div className="flex items-center gap-2">
                <div className={`text-sm ${getImpactColor(insight.impact)}`}>
                  {insight.impact.toUpperCase()}
                </div>
                <div className={`w-2 h-2 rounded-full ${getConfidenceColor(insight.confidence)}`}
                  title={`Confidence: ${insight.confidence}%`}
                />
              </div>
            </div>

            <p className="text-gray-600 mb-3">{insight.description}</p>

            <div className="mb-3">
              <div className="text-sm text-gray-500 mb-1">Confidence</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`${getConfidenceColor(insight.confidence)} h-2 rounded-full`}
                  style={{ width: `${insight.confidence}%` }}
                />
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Recommendations:</h4>
              <ul className="list-disc list-inside text-sm">
                {insight.recommendations.map((rec, index) => (
                  <li key={index} className="text-gray-700">{rec}</li>
                ))}
              </ul>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Valid until: {new Date(insight.validUntil).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Custom Hook for Analytics Data:**
```javascript
import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';

export function useAnalytics() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getPredictiveInsights = async (timeframe = 'week') => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get('/analytics/predictive-insights', {
        params: { timeframe }
      });
      return response.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getHeatMapData = async (timeframe = 'week') => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get('/analytics/heat-map', {
        params: { timeframe }
      });
      return response.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getTimeSeriesForecast = async (metric, timeframe = 'week', periods = 7) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get('/analytics/time-series-forecast', {
        params: { metric, timeframe, periods }
      });
      return response.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (config) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/analytics/insights-report', config);
      return response.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    getPredictiveInsights,
    getHeatMapData,
    getTimeSeriesForecast,
    generateReport,
    loading,
    error
  };
}
```

### Backend Integration

**Analytics Service Implementation:**
```javascript
import { analyticsService } from '../services/analyticsService';
import { logger } from '../utils/logger';

class AnalyticsController {
  async getPredictiveInsights(req, res) {
    try {
      const { timeframe = 'week', category, confidence } = req.query;

      let insights = await analyticsService.generatePredictiveInsights(timeframe);

      // Filter by category if specified
      if (category) {
        insights = insights.filter(insight => insight.type === category);
      }

      // Filter by confidence threshold if specified
      if (confidence) {
        insights = insights.filter(insight => insight.confidence >= parseInt(confidence));
      }

      res.json({
        success: true,
        data: insights,
        meta: {
          total: insights.length,
          generatedAt: new Date().toISOString(),
          timeframe
        }
      });
    } catch (error) {
      logger.error('Failed to get predictive insights', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to generate insights'
      });
    }
  }

  async getHeatMapData(req, res) {
    try {
      const { timeframe = 'week', activityType, gradeLevel, location } = req.query;

      const heatMapData = await analyticsService.generateUsageHeatMap(timeframe);

      // Apply filters
      let filteredData = heatMapData;

      if (activityType) {
        filteredData = filteredData.filter(d => d.activityType === activityType);
      }

      if (gradeLevel) {
        filteredData = filteredData.filter(d => d.gradeLevel === gradeLevel);
      }

      if (location) {
        // Implement location filtering based on your data structure
        filteredData = filteredData.filter(d => d.location === location);
      }

      const maxIntensity = Math.max(...filteredData.map(d => d.intensity));

      res.json({
        success: true,
        data: filteredData,
        meta: {
          maxIntensity,
          totalDataPoints: filteredData.length,
          timeframe
        }
      });
    } catch (error) {
      logger.error('Failed to generate heat map', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to generate heat map data'
      });
    }
  }

  async getTimeSeriesForecast(req, res) {
    try {
      const { metric, timeframe = 'week', periods = 7 } = req.query;

      if (!metric) {
        return res.status(400).json({
          success: false,
          error: 'Metric parameter is required'
        });
      }

      const forecastData = await analyticsService.generateTimeSeriesForecast(
        metric,
        timeframe,
        parseInt(periods)
      );

      res.json({
        success: true,
        data: forecastData,
        meta: {
          metric,
          timeframe,
          forecastPeriods: parseInt(periods),
          confidence: this.calculateAverageConfidence(forecastData)
        }
      });
    } catch (error) {
      logger.error('Failed to generate time series forecast', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to generate forecast'
      });
    }
  }

  async generateInsightsReport(req, res) {
    try {
      const { timeframe = 'week', includeRecommendations = true, format = 'json' } = req.body;

      const report = await analyticsService.generateInsightsReport(timeframe);

      if (!includeRecommendations) {
        delete report.recommendations;
      }

      if (format === 'pdf') {
        // Generate PDF version
        const pdfBuffer = await this.generatePDFReport(report);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="analytics-report.pdf"');
        res.send(pdfBuffer);
      } else {
        res.json({
          success: true,
          data: report
        });
      }
    } catch (error) {
      logger.error('Failed to generate insights report', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to generate report'
      });
    }
  }

  calculateAverageConfidence(forecastData) {
    const predictedData = forecastData.filter(d => d.predicted !== undefined);
    if (predictedData.length === 0) return 0;

    // Simple confidence calculation based on prediction distance
    const totalConfidence = predictedData.reduce((sum, d, index) => {
      const confidence = Math.max(0.5, 0.9 - (index * 0.05));
      return sum + confidence;
    }, 0);

    return Math.round((totalConfidence / predictedData.length) * 100);
  }

  async generatePDFReport(reportData) {
    // Implement PDF generation using your preferred library
    // This is a placeholder for the actual implementation
    const pdfBuffer = Buffer.from('PDF report content');
    return pdfBuffer;
  }
}

export const analyticsController = new AnalyticsController();
```

## Best Practices

### Data Collection

1. **Consistent Recording**: Ensure all activities are logged with accurate timestamps
2. **Complete Data**: Capture all relevant fields for comprehensive analysis
3. **Regular Updates**: Process data daily to maintain current insights
4. **Quality Checks**: Implement validation to catch data entry errors

### Interpretation Guidelines

1. **Context Matters**: Consider external factors (holidays, events, weather)
2. **Trend Analysis**: Look at long-term patterns, not just daily fluctuations
3. **Confidence Awareness**: Understand prediction limitations and uncertainty
4. **Action-Oriented**: Focus on insights that drive actionable decisions

### System Performance

1. **Caching**: Cache frequently accessed analytics data
2. **Background Processing**: Generate insights during off-peak hours
3. **Database Optimization**: Use appropriate indexes for analytics queries
4. **Resource Management**: Monitor system impact of analytics processing

### User Experience

1. **Clear Visualizations**: Use appropriate chart types for different data
2. **Progressive Disclosure**: Show summary first, details on demand
3. **Responsive Design**: Ensure analytics work on mobile devices
4. **Loading States**: Provide feedback during data processing

---

This comprehensive analytics system provides powerful insights for library management, enabling data-driven decision making and resource optimization while maintaining usability and performance standards.