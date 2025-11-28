import React, { useState, useEffect } from 'react';
import {
  LeaderboardService,
  type LeaderboardEntry,
} from '../../services/leaderboardService';
import { Trophy, Medal, Calendar, Clock, BarChart2, Award } from 'lucide-react';

const LeaderboardDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monthly' | 'yearly'>('monthly');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let data;
      if (activeTab === 'monthly') {
        data = await LeaderboardService.getMonthlyLeaderboard(year, month);
      } else {
        data = await LeaderboardService.getYearlyLeaderboard(year);
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
  }, [activeTab, year, month]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return (
          <span className="text-gray-500 font-bold w-6 text-center">
            {rank}
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
          <Award className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
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
      </div>

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
        <div className="overflow-x-auto">
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
                  className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getRankIcon(entry.rank)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold mr-3">
                        {entry.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {entry.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {entry.studentId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {entry.gradeLevel}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {entry.section}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                    {entry.scanCount}
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
