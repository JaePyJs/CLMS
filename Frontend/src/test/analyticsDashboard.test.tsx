import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import * as apiModule from '@/services/api'
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard'
import { TestProviders } from './TestProviders'

// Mock heavy chart components to avoid JSDOM rendering issues
vi.mock('recharts', () => {
  const Mock = ({ children }: any) => children || null
  return {
    ResponsiveContainer: Mock,
    PieChart: Mock,
    Pie: Mock,
    Cell: Mock,
    Tooltip: Mock,
    CartesianGrid: Mock,
    BarChart: Mock,
    XAxis: Mock,
    YAxis: Mock,
    Bar: Mock,
  }
})

vi.mock('@/components/analytics/MetricsCards', () => ({ default: () => <div>Library Metrics</div> }))
vi.mock('@/components/analytics/ExportAnalytics', () => ({ default: () => <div>Export Analytics</div> }))
vi.mock('@/components/analytics/BookCirculationAnalytics', () => ({ default: () => <div>Book Circulation Analytics</div> }))
vi.mock('@/components/analytics/EquipmentUtilizationAnalytics', () => ({ default: () => <div>Equipment Utilization Analytics</div> }))
vi.mock('@/components/analytics/FineCollectionAnalytics', () => ({ default: () => <div>Fine Collection Analytics</div> }))
vi.mock('@/components/analytics/PredictiveInsights', () => ({ default: () => <div>Predictive Insights</div> }))
vi.mock('@/components/analytics/TimeSeriesForecast', () => ({ default: () => <div>Time Series Forecast</div> }))
vi.mock('@/components/analytics/UsageHeatMap', () => ({ default: () => <div>Usage Heat Map</div> }))
vi.mock('@/components/dashboard/AdvancedReporting', () => ({ default: () => <div>Advanced Reporting</div> }))

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders header and tabs', () => {
    render(<TestProviders><AnalyticsDashboard /></TestProviders>)
    expect(screen.getByText('Advanced Analytics Dashboard')).toBeTruthy()
    expect(screen.getByText('Overview')).toBeTruthy()
    expect(screen.getByText('Book Circulation')).toBeTruthy()
    expect(screen.getByText('Equipment')).toBeTruthy()
    expect(screen.getByText('Reports')).toBeTruthy()
  })

  it('refreshes live metrics with backend and falls back in dev', async () => {
    const getSpy = vi.spyOn(apiModule.default, 'get' as any).mockResolvedValueOnce({ data: { data: [1,2,3] } } as any)
      .mockResolvedValueOnce({ data: { data: [1] } } as any)
      .mockResolvedValueOnce({ data: { data: [1,2,3,4,5] } } as any)

    render(<TestProviders><AnalyticsDashboard /></TestProviders>)
    const btn = screen.getByText('Refresh')
    fireEvent.click(btn)

    // Allow promises to resolve
    await new Promise((r) => setTimeout(r, 10))

    expect(getSpy).toHaveBeenCalledTimes(3)
    // MetricsCards renders labels; we verify presence of section headings, not specific numbers
    expect(screen.getByText('Library Metrics')).toBeTruthy()
  })
})