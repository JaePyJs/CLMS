import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Activity, Users, Monitor } from 'lucide-react'

interface HeatMapData {
  hour: number
  dayOfWeek: number
  intensity: number
  activityType?: string
  gradeLevel?: string
}

interface UsageHeatMapProps {
  data: HeatMapData[]
  title?: string
  description?: string
  onCellClick?: (data: HeatMapData) => void
  filterType?: 'all' | 'activity' | 'grade'
}

const ACTIVITY_COLORS = {
  COMPUTER_USE: '#3b82f6',
  GAMING: '#8b5cf6',
  STUDY: '#10b981',
  BOOK_BORROW: '#f59e0b',
  BOOK_RETURN: '#ef4444',
  VR_SESSION: '#06b6d4'
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`)

export function UsageHeatMap({
  data,
  title = 'Library Usage Heat Map',
  description = 'Visual representation of library usage patterns throughout the week',
  onCellClick,
  filterType = 'all'
}: UsageHeatMapProps) {
  const [selectedActivity, setSelectedActivity] = React.useState<string>('all')
  const [selectedGrade, setSelectedGrade] = React.useState<string>('all')

  // Process and aggregate data for heat map
  const heatMapData = useMemo(() => {
    const processed: { [key: string]: HeatMapData } = {}

    data.forEach(item => {
      const key = `${item.dayOfWeek}-${item.hour}`

      // Apply filters
      if (filterType === 'activity' && selectedActivity !== 'all' && item.activityType !== selectedActivity) {
        return
      }
      if (filterType === 'grade' && selectedGrade !== 'all' && item.gradeLevel !== selectedGrade) {
        return
      }

      if (!processed[key]) {
        processed[key] = {
          hour: item.hour,
          dayOfWeek: item.dayOfWeek,
          intensity: 0,
          activityType: item.activityType,
          gradeLevel: item.gradeLevel
        }
      }

      processed[key].intensity += item.intensity
    })

    return Object.values(processed)
  }, [data, selectedActivity, selectedGrade, filterType])

  // Find max intensity for normalization
  const maxIntensity = useMemo(() => {
    return Math.max(...heatMapData.map(d => d.intensity), 1)
  }, [heatMapData])

  // Get unique activity types and grades for filters
  const activityTypes = useMemo(() => {
    const types = [...new Set(data.map(d => d.activityType).filter(Boolean))]
    return types.sort()
  }, [data])

  const gradeLevels = useMemo(() => {
    const grades = [...new Set(data.map(d => d.gradeLevel).filter(Boolean))]
    return grades.sort()
  }, [data])

  // Get color based on intensity
  const getCellColor = (intensity: number, maxIntensity: number) => {
    const normalizedIntensity = intensity / maxIntensity
    if (normalizedIntensity === 0) return 'bg-gray-100'
    if (normalizedIntensity < 0.2) return 'bg-blue-100'
    if (normalizedIntensity < 0.4) return 'bg-blue-200'
    if (normalizedIntensity < 0.6) return 'bg-blue-300'
    if (normalizedIntensity < 0.8) return 'bg-blue-400'
    return 'bg-blue-500'
  }

  // Format cell tooltip
  const getCellTooltip = (cellData: HeatMapData) => {
    const dayName = DAY_LABELS[cellData.dayOfWeek]
    const hour = HOUR_LABELS[cellData.hour]
    const activity = cellData.activityType ? ` (${cellData.activityType.replace('_', ' ')})` : ''
    const grade = cellData.gradeLevel ? ` - Grade: ${cellData.gradeLevel.replace('_', ' ')}` : ''

    return `${dayName} ${hour}${activity}${grade}: ${cellData.intensity} activities`
  }

  // Get peak usage information
  const peakUsage = useMemo(() => {
    return heatMapData
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 5)
      .map(d => ({
        day: DAY_LABELS[d.dayOfWeek],
        hour: HOUR_LABELS[d.hour],
        intensity: d.intensity
      }))
  }, [heatMapData])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {filterType === 'activity' && (
              <Select value={selectedActivity} onValueChange={setSelectedActivity}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  {activityTypes.map(type => (
                    <SelectItem key={type} value={type || ''}>
                      {type?.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {filterType === 'grade' && (
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {gradeLevels.map(grade => (
                    <SelectItem key={grade} value={grade || ''}>
                      {grade?.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Peak Usage Summary */}
          <div className="grid gap-4 md:grid-cols-5">
            {peakUsage.map((peak, index) => (
              <div key={index} className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{peak.intensity}</div>
                <div className="text-sm font-medium">{peak.day}</div>
                <div className="text-xs text-muted-foreground">{peak.hour}</div>
              </div>
            ))}
          </div>

          {/* Heat Map Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Hour labels */}
              <div className="grid grid-cols-25 gap-1 mb-2">
                <div className="w-16" /> {/* Empty corner */}
                {HOUR_LABELS.map((hour, index) => (
                  <div key={index} className="text-xs text-center text-muted-foreground rotate-45 origin-bottom">
                    {hour}
                  </div>
                ))}
              </div>

              {/* Heat map rows */}
              {DAY_LABELS.map((day, dayIndex) => (
                <div key={dayIndex} className="grid grid-cols-25 gap-1 mb-1">
                  {/* Day label */}
                  <div className="w-16 text-sm font-medium text-right pr-2 flex items-center justify-end">
                    {day}
                  </div>

                  {/* Heat map cells */}
                  {HOUR_LABELS.map((_, hourIndex) => {
                    const cellData = heatMapData.find(
                      d => d.dayOfWeek === dayIndex && d.hour === hourIndex
                    )
                    const intensity = cellData?.intensity || 0
                    const color = getCellColor(intensity, maxIntensity)

                    return (
                      <div
                        key={hourIndex}
                        className={`w-8 h-8 rounded cursor-pointer transition-all duration-200 hover:scale-110 ${color}`}
                        title={cellData ? getCellTooltip(cellData) : `${day} ${HOUR_LABELS[hourIndex]}: No activity`}
                        onClick={() => cellData && onCellClick?.(cellData)}
                      >
                        {intensity > 0 && (
                          <div className="w-full h-full flex items-center justify-center">
                            {cellData?.activityType && (
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: ACTIVITY_COLORS[cellData.activityType as keyof typeof ACTIVITY_COLORS] || '#666'
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium">Intensity:</span>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-100 rounded" />
                <span className="text-xs text-muted-foreground">None</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-200 rounded" />
                <span className="text-xs text-muted-foreground">Low</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-300 rounded" />
                <span className="text-xs text-muted-foreground">Medium</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-400 rounded" />
                <span className="text-xs text-muted-foreground">High</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded" />
                <span className="text-xs text-muted-foreground">Peak</span>
              </div>
            </div>

            {filterType === 'activity' && (
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium">Activities:</span>
                <div className="flex items-center space-x-2">
                  {Object.entries(ACTIVITY_COLORS).slice(0, 4).map(([type, color]) => (
                    <div key={type} className="flex items-center space-x-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs text-muted-foreground">
                        {type.replace('_', ' ').substring(0, 6)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Statistics */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-3 bg-muted/30 rounded">
              <div className="flex items-center space-x-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Activities</span>
              </div>
              <div className="text-2xl font-bold">
                {heatMapData.reduce((sum, d) => sum + d.intensity, 0)}
              </div>
            </div>

            <div className="p-3 bg-muted/30 rounded">
              <div className="flex items-center space-x-2 mb-1">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Active Hours</span>
              </div>
              <div className="text-2xl font-bold">
                {heatMapData.filter(d => d.intensity > 0).length}
              </div>
            </div>

            <div className="p-3 bg-muted/30 rounded">
              <div className="flex items-center space-x-2 mb-1">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Peak Intensity</span>
              </div>
              <div className="text-2xl font-bold">{maxIntensity}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default UsageHeatMap