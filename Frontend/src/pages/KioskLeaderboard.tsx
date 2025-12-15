import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Zap } from 'lucide-react';
import {
  LeaderboardService,
  type LeaderboardEntry,
} from '@/services/leaderboardService';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { CheckeredBackground } from '@/components/kiosk/new/CheckeredBackground';

export default function KioskLeaderboard() {
  const [monthlyData, setMonthlyData] = useState<LeaderboardEntry[]>([]);
  const [yearlyData, setYearlyData] = useState<LeaderboardEntry[]>([]);
  const { recentActivities } = useWebSocketContext();

  const fetchData = async () => {
    try {
      const now = new Date();
      const [monthly, yearly] = await Promise.all([
        LeaderboardService.getMonthlyLeaderboard(
          now.getFullYear(),
          now.getMonth() + 1
        ),
        LeaderboardService.getYearlyLeaderboard(now.getFullYear()),
      ]);
      setMonthlyData(monthly.slice(0, 10)); // Limit to top 10
      setYearlyData(yearly.slice(0, 10));
    } catch (error) {
      console.error('Failed to fetch leaderboard', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (recentActivities.length > 0) {
      const timeout = setTimeout(fetchData, 2000);
      return () => clearTimeout(timeout);
    }
  }, [recentActivities]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0A0B14] font-sans text-white selection:bg-cyan-500/30">
      {/* Background Layers */}
      <div className="absolute inset-0 z-0">
        <CheckeredBackground />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0B14]/80 to-[#0A0B14] z-0" />

      {/* Ambient Spotlights */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[150px] animate-pulse mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/20 rounded-full blur-[150px] animate-pulse mix-blend-screen pointer-events-none delay-1000" />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-full p-4 lg:p-6">
        {/* Cinematic Header */}
        <header className="flex items-end justify-between mb-4 shrink-0 relative">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-50 animate-pulse" />
              <div className="relative p-2.5 bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-xl shadow-2xl ring-1 ring-white/10">
                <Trophy className="w-6 h-6 text-indigo-400 drop-shadow-[0_0_10px_rgba(129,140,248,0.8)]" />
              </div>
            </div>
            <div>
              <motion.h1
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, type: 'spring' }}
                className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-slate-400 drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]"
              >
                HALL OF FAME
              </motion.h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="h-[1px] w-6 bg-indigo-500/50" />
                <p className="text-indigo-300/80 font-bold tracking-[0.2em] text-[10px] uppercase">
                  Ultimate Reader Rankings
                </p>
                <span className="h-[1px] w-16 bg-gradient-to-r from-indigo-500/50 to-transparent" />
              </div>
            </div>
          </div>
        </header>

        {/* Dual Leaderboard Grid */}
        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          <LeaderboardSection
            title="MONTHLY ELITE"
            theme="cyan"
            data={monthlyData}
            icon={<Zap className="w-4 h-4 text-cyan-400" />}
          />
          <LeaderboardSection
            title="LEGENDS OF THE YEAR"
            theme="gold"
            data={yearlyData}
            icon={<Crown className="w-4 h-4 text-yellow-400" />}
          />
        </div>
      </div>
    </div>
  );
}

interface ThemeConfig {
  primary: string;
  bg: string;
  border: string;
  glow: string;
  gradient: string;
  podium: string;
  rankBadge: string;
}

const themeConfig: Record<string, ThemeConfig> = {
  cyan: {
    primary: 'text-cyan-400',
    bg: 'from-cyan-500/10 to-blue-600/10',
    border: 'border-cyan-500/30',
    glow: 'shadow-cyan-500/20',
    gradient: 'from-cyan-400 to-blue-500',
    podium: 'from-cyan-900/80 via-cyan-800/50 to-slate-900/80',
    rankBadge: 'bg-cyan-500',
  },
  gold: {
    primary: 'text-yellow-400',
    bg: 'from-yellow-500/10 to-orange-600/10',
    border: 'border-yellow-500/30',
    glow: 'shadow-yellow-500/20',
    gradient: 'from-yellow-400 to-orange-500',
    podium: 'from-yellow-900/80 via-yellow-800/50 to-slate-900/80',
    rankBadge: 'bg-yellow-500',
  },
};

interface LeaderboardSectionProps {
  title: string;
  theme: string;
  data: LeaderboardEntry[];
  icon: React.ReactNode;
}

function LeaderboardSection({
  title,
  theme,
  data,
  icon,
}: LeaderboardSectionProps) {
  const config = themeConfig[theme];
  const topThree = data.slice(0, 3);
  const runnersUp = data.slice(3, 10); // Top 10

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full relative"
    >
      {/* Glass Pane Background */}
      <div
        className={`absolute inset-0 bg-gradient-to-b ${config.bg} rounded-[1.5rem] border ${config.border} backdrop-blur-xl`}
      />

      {/* Header */}
      <div className="relative p-3 px-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <div
            className={`p-1 rounded-lg bg-black/30 border border-white/10 ${config.primary}`}
          >
            {icon}
          </div>
          <h2
            className={`text-lg font-black italic tracking-wide text-transparent bg-clip-text bg-gradient-to-r ${config.gradient}`}
          >
            {title}
          </h2>
        </div>
        <div className="flex gap-1">
          <span
            className={`w-1 h-1 rounded-full ${config.rankBadge} animate-pulse`}
          />
          <span
            className={`w-1 h-1 rounded-full ${config.rankBadge} opacity-50`}
          />
          <span
            className={`w-1 h-1 rounded-full ${config.rankBadge} opacity-25`}
          />
        </div>
      </div>

      <div className="relative flex-1 p-3 flex flex-col gap-2 overflow-hidden">
        {/* Podium Section */}
        <div className="flex items-end justify-center min-h-[140px] px-1 mb-1">
          {topThree[1] && (
            <CyberPodium
              entry={topThree[1]}
              rank={2}
              config={config}
              delay={0.2}
            />
          )}
          {topThree[0] && (
            <CyberPodium
              entry={topThree[0]}
              rank={1}
              config={config}
              delay={0}
              isFirst
            />
          )}
          {topThree[2] && (
            <CyberPodium
              entry={topThree[2]}
              rank={3}
              config={config}
              delay={0.4}
            />
          )}
        </div>

        {/* List Section */}
        <div className="flex-1 space-y-1.5 overflow-y-auto scrollbar-hide">
          {runnersUp.map((student: LeaderboardEntry, idx: number) => (
            <CyberListItem
              key={student.studentId}
              student={student}
              rank={idx + 4}
              config={config}
              delay={0.6 + idx * 0.1}
            />
          ))}
          {runnersUp.length === 0 && (
            <div className="h-full flex items-center justify-center opacity-30 text-[10px] font-medium tracking-widest uppercase">
              Awaiting Challengers
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface CyberPodiumProps {
  entry: LeaderboardEntry;
  rank: number;
  config: ThemeConfig;
  delay: number;
  isFirst?: boolean;
}

function CyberPodium({
  entry,
  rank,
  config,
  delay,
  isFirst,
}: CyberPodiumProps) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', bounce: 0.4, delay: delay }}
      className={`relative flex flex-col items-center justify-end w-1/3 ${isFirst ? 'z-20 -mx-2' : 'z-10'}`}
    >
      {/* Avatar / Crown */}
      <div className={`relative mb-1.5 flex flex-col items-center w-full`}>
        {isFirst && (
          <motion.div
            animate={{ y: [0, -4, 0], rotate: [0, -5, 5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-8 z-50"
          >
            <Crown
              className={`w-6 h-6 ${config.primary} drop-shadow-[0_0_15px_currentColor]`}
              strokeWidth={2}
            />
          </motion.div>
        )}

        <div
          className={`relative rounded-full border-2 ${isFirst ? `border-white ${config.glow}` : 'border-white/20'} bg-slate-900/90 flex items-center justify-center ${isFirst ? 'w-14 h-14 shadow-xl' : 'w-10 h-10'}`}
        >
          <span
            className={`font-black ${isFirst ? 'text-lg' : 'text-sm'} text-white`}
          >
            {entry.name.charAt(0)}
          </span>
          {isFirst && (
            <div
              className={`absolute -inset-1 rounded-full border-2 ${config.border} animate-ping opacity-20`}
            />
          )}
        </div>
      </div>

      {/* Podium Block */}
      <div className={`w-full ${isFirst ? 'h-28' : 'h-20'} relative group`}>
        {/* Block Design */}
        <div
          className={`absolute inset-0 bg-gradient-to-b ${config.podium} backdrop-blur-md rounded-t-lg border-x border-t border-white/10 ${isFirst && 'shadow-[0_0_20px_-5px_rgba(0,0,0,0.5)]'}`}
        >
          {/* Inner Shine */}
          <div
            className={`absolute inset-0 bg-gradient-to-t ${config.bg} opacity-50`}
          />
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col items-center pt-2 text-center px-0.5">
          <div
            className={`text-2xl font-black text-white/10 absolute top-1 select-none`}
          >
            0{rank}
          </div>

          <div className="mt-auto mb-2 w-full px-1">
            <div className="font-bold text-white text-[10px] leading-tight line-clamp-2 drop-shadow-md mb-0.5">
              {entry.name.split(' ')[0]}
            </div>
            <div
              className={`inline-flex items-center gap-1 px-1 py-px rounded-full bg-black/40 border border-white/10`}
            >
              <span className={`text-[9px] font-bold ${config.primary}`}>
                {entry.scanCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface CyberListItemProps {
  student: LeaderboardEntry;
  rank: number;
  config: ThemeConfig;
  delay: number;
}

function CyberListItem({ student, rank, config, delay }: CyberListItemProps) {
  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: delay }}
      className="group relative flex items-center justify-between p-1.5 rounded-md bg-slate-900/40 border border-white/5 hover:bg-white/5 transition-all duration-300 hover:border-white/10 hover:shadow-lg hover:translate-x-1"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-5 h-5 flex items-center justify-center font-bold text-slate-500 bg-white/5 rounded text-[10px] group-hover:text-white transition-colors">
          {rank}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-slate-200 text-[11px] truncate group-hover:text-white transition-colors w-[120px]">
            {student.name}
          </span>
          <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
            <span className="truncate max-w-[80px]">
              {student.section || '-'}
            </span>
            {student.gradeLevel && (
              <span className="px-1 py-px rounded bg-white/5 text-white/40">
                Gr.{student.gradeLevel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        className={`text-right font-black text-xs ${config.primary} drop-shadow-sm`}
      >
        {student.scanCount}
      </div>

      {/* Hover Glow */}
      <div
        className={`absolute inset-0 bg-gradient-to-r ${config.bg} opacity-0 group-hover:opacity-10 rounded-md transition-opacity duration-300 pointer-events-none`}
      />
    </motion.div>
  );
}
