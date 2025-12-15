import React, { useState, useEffect } from 'react';
import {
  LeaderboardService,
  type LeaderboardEntry,
} from '../../services/leaderboardService';
import {
  Trophy,
  Medal,
  Calendar,
  Clock,
  BarChart2,
  Award,
  RotateCcw,
  RefreshCw,
  GraduationCap,
  Users,
  Download,
} from 'lucide-react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';

const LeaderboardDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monthly' | 'yearly'>('monthly');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Filter states
  const [gradeFilter, setGradeFilter] = useState<number | undefined>(undefined);
  const [sectionFilter, setSectionFilter] = useState<string>('');
  const [allSections, setAllSections] = useState<string[]>([]);

  // WebSocket for real-time updates
  const { recentActivities } = useWebSocketContext();

  // Fetch all sections once on initial load (without filters)
  useEffect(() => {
    const fetchAllSections = async () => {
      try {
        // Get unfiltered data to extract all sections
        let data;
        if (activeTab === 'monthly') {
          data = await LeaderboardService.getMonthlyLeaderboard(year, month);
        } else {
          data = await LeaderboardService.getYearlyLeaderboard(year);
        }
        const sections = new Set<string>();
        data.forEach((entry) => {
          if (entry.section) sections.add(entry.section);
        });
        setAllSections(Array.from(sections).sort());
      } catch (error) {
        console.error('Failed to fetch sections:', error);
      }
    };
    fetchAllSections();
  }, [activeTab, year, month]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let data;
      if (activeTab === 'monthly') {
        data = await LeaderboardService.getMonthlyLeaderboard(
          year,
          month,
          gradeFilter,
          sectionFilter || undefined
        );
      } else {
        data = await LeaderboardService.getYearlyLeaderboard(
          year,
          gradeFilter,
          sectionFilter || undefined
        );
      }
      setLeaderboardData(data);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [activeTab, year, month, gradeFilter, sectionFilter]);

  // Auto-refresh when new attendance activity comes in
  useEffect(() => {
    if (recentActivities.length > 0) {
      const latestActivity = recentActivities[0];
      const activityTypes = [
        'CHECK_IN',
        'CHECK_OUT',
        'ACTIVITY_LOG',
        'LIBRARY_VISIT',
        'KIOSK_CHECK_IN',
      ];
      if (activityTypes.includes(latestActivity.type)) {
        // Debounce refresh to avoid too many calls
        const timer = setTimeout(() => {
          fetchLeaderboard();
        }, 2000); // 2 second debounce
        return () => clearTimeout(timer);
      }
    }
  }, [recentActivities]);

  const handleResetLeaderboard = async () => {
    setResetting(true);
    try {
      const yearToReset = activeTab === 'monthly' ? year : year;
      const monthToReset = activeTab === 'monthly' ? month : undefined;

      await LeaderboardService.resetLeaderboard(yearToReset, monthToReset);
      setShowResetConfirm(false);
      fetchLeaderboard();
    } catch (error) {
      console.error('Failed to reset leaderboard:', error);
      alert('Failed to reset leaderboard. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  const exportToCSV = () => {
    if (leaderboardData.length === 0) {
      alert('No data to export');
      return;
    }

    // Create CSV headers
    const headers = [
      'Rank',
      'Student ID',
      'Name',
      'Grade Level',
      'Section',
      'Visits',
      'Time Spent (minutes)',
    ];

    // Create CSV rows
    const rows = leaderboardData.map((entry) => [
      entry.rank,
      entry.studentId,
      entry.name,
      entry.gradeLevel || 'N/A',
      entry.section || 'N/A',
      entry.scanCount,
      entry.totalMinutes,
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // Create filename with date and filters
    const monthName = new Date(0, month - 1).toLocaleString('default', {
      month: 'long',
    });
    const gradeText = gradeFilter !== undefined ? `_Grade${gradeFilter}` : '';
    const sectionText = sectionFilter
      ? `_${sectionFilter.replace(/\s+/g, '-')}`
      : '';
    const filename =
      activeTab === 'monthly'
        ? `Leaderboard_${monthName}_${year}${gradeText}${sectionText}.csv`
        : `Leaderboard_Yearly_${year}${gradeText}${sectionText}.csv`;

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg">
            <Trophy className="w-5 h-5 text-white" />
          </div>
        );
      case 2:
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 shadow-md">
            <Medal className="w-5 h-5 text-white" />
          </div>
        );
      case 3:
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-md">
            <Medal className="w-5 h-5 text-white" />
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700">
            <span className="text-gray-600 dark:text-gray-300 font-bold text-lg">
              {rank}
            </span>
          </div>
        );
    }
  };

  return (
    <div className="bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-800 dark:to-indigo-950/20 rounded-xl shadow-lg border border-indigo-100 dark:border-indigo-900/30 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md">
            <Award className="w-6 h-6 text-white" />
          </div>
          Student Leaderboard
        </h2>

        <div className="flex gap-2 bg-gray-100 dark:bg-slate-700 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'monthly'
                ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setActiveTab('yearly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'yearly'
                ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600">
          <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-200 font-medium"
          >
            {[...Array(5)].map((_, i) => {
              const y = new Date().getFullYear() - i;
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              );
            })}
          </select>
        </div>

        {activeTab === 'monthly' && (
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600">
            <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-200 font-medium"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m} className="dark:bg-slate-800">
                  {new Date(0, m - 1).toLocaleString('default', {
                    month: 'long',
                  })}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Grade Level Filter */}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600">
          <GraduationCap className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <select
            value={gradeFilter ?? ''}
            onChange={(e) =>
              setGradeFilter(
                e.target.value ? Number(e.target.value) : undefined
              )
            }
            className="bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-200 font-medium"
          >
            <option value="" className="dark:bg-slate-800">
              All Grades
            </option>
            {[...Array(13)].map((_, i) => (
              <option key={i} value={i} className="dark:bg-slate-800">
                {i === 0 ? 'Kindergarten' : `Grade ${i}`}
              </option>
            ))}
          </select>
        </div>

        {/* Section Filter */}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600">
          <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-200 font-medium min-w-[120px]"
          >
            <option value="" className="dark:bg-slate-800">
              All Sections
            </option>
            {allSections.map((section) => (
              <option
                key={section}
                value={section}
                className="dark:bg-slate-800"
              >
                {section}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => fetchLeaderboard()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
          title="Refresh leaderboard"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <button
          onClick={exportToCSV}
          disabled={loading || leaderboardData.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
          title="Export to CSV"
        >
          <Download className="w-4 h-4" />
          Export
        </button>

        <button
          onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
          title="Reset leaderboard"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Reset Leaderboard?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {activeTab === 'monthly'
                ? `This will reset all scan statistics for ${new Date(0, month - 1).toLocaleString('default', { month: 'long' })} ${year}.`
                : `This will reset all scan statistics for the year ${year}.`}
              <br />
              <strong className="text-red-600 dark:text-red-400">
                This action cannot be undone.
              </strong>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                disabled={resetting}
              >
                Cancel
              </button>
              <button
                onClick={handleResetLeaderboard}
                disabled={resetting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {resetting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Resetting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : leaderboardData.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-700">
          <BarChart2 className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            No Data Available
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            No scan activity recorded for this period.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Grade/Section
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Visits
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Time Spent
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {leaderboardData.map((entry) => (
                <tr
                  key={entry.studentId}
                  className={`transition-all duration-200 ${
                    entry.rank === 1
                      ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 hover:from-yellow-100 hover:to-amber-100'
                      : entry.rank === 2
                        ? 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 hover:from-gray-100 hover:to-slate-100'
                        : entry.rank === 3
                          ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 hover:from-orange-100 hover:to-amber-100'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getRankIcon(entry.rank)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div
                        className={`h-12 w-12 rounded-full flex items-center justify-center font-bold mr-3 shadow-md ${
                          entry.rank === 1
                            ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white text-lg'
                            : entry.rank === 2
                              ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white text-lg'
                              : entry.rank === 3
                                ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white text-lg'
                                : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                        }`}
                      >
                        {entry.name.charAt(0)}
                      </div>
                      <div>
                        <div
                          className={`font-medium ${entry.rank <= 3 ? 'text-base' : 'text-sm'} text-gray-900 dark:text-gray-100`}
                        >
                          {entry.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {entry.studentId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="inline-flex items-center px-2.5 py-1 rounded-full text-sm bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                      {entry.gradeLevel === '0'
                        ? 'Pre-School'
                        : entry.gradeLevel && entry.gradeLevel !== ''
                          ? `Grade ${entry.gradeLevel}`
                          : 'N/A'}
                    </div>
                    {entry.section && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {entry.section}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div
                      className={`font-bold ${entry.rank <= 3 ? 'text-lg' : 'text-sm'} text-gray-900 dark:text-gray-100`}
                    >
                      {entry.scanCount}
                    </div>
                    <div className="text-xs text-gray-500">visits</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                    {Math.floor(entry.totalMinutes / 60)}h{' '}
                    {entry.totalMinutes % 60}m
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaderboardDashboard;
