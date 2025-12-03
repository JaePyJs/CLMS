/**
 * Kiosk Message Display Component
 * Animated message cards with various states
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Clock,
  CheckCircle,
  XCircle,
  LogOut,
  Sparkles,
} from 'lucide-react';

interface KioskMessageProps {
  type: 'welcome' | 'goodbye' | 'error' | 'scanning' | 'cooldown' | 'success';
  studentName?: string;
  message?: string;
  submessage?: string;
}

export function KioskMessage({
  type,
  studentName,
  message,
  submessage,
}: KioskMessageProps) {
  const getIcon = () => {
    switch (type) {
      case 'welcome':
        return <BookOpen className="w-12 h-12 sm:w-16 sm:h-16 text-white" />;
      case 'goodbye':
        return <LogOut className="w-12 h-12 sm:w-16 sm:h-16 text-white" />;
      case 'error':
        return <XCircle className="w-12 h-12 sm:w-16 sm:h-16 text-white" />;
      case 'cooldown':
        return <Clock className="w-12 h-12 sm:w-16 sm:h-16 text-white" />;
      case 'success':
        return <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-white" />;
      case 'scanning':
        return <Sparkles className="w-12 h-12 sm:w-16 sm:h-16 text-white" />;
    }
  };

  const getBgGradient = () => {
    switch (type) {
      case 'welcome':
        return 'from-emerald-500 to-emerald-700';
      case 'goodbye':
        return 'from-blue-500 to-blue-700';
      case 'error':
        return 'from-red-500 to-red-700';
      case 'cooldown':
        return 'from-amber-500 to-amber-700';
      case 'success':
        return 'from-green-500 to-green-700';
      case 'scanning':
        return 'from-purple-500 to-purple-700';
    }
  };

  const getDefaultMessage = () => {
    switch (type) {
      case 'welcome':
        return studentName
          ? `WELCOME, ${studentName.toUpperCase()}!`
          : 'WELCOME, CRUSADER!';
      case 'goodbye':
        return studentName
          ? `GOODBYE, ${studentName.toUpperCase()}!`
          : 'GOODBYE, CRUSADER!';
      case 'error':
        return 'OOPS! SOMETHING WENT WRONG';
      case 'cooldown':
        return 'PLEASE WAIT A MOMENT';
      case 'success':
        return 'SUCCESS!';
      case 'scanning':
        return 'PLEASE SCAN YOUR ID';
    }
  };

  const getDefaultSubmessage = () => {
    switch (type) {
      case 'welcome':
        return 'Happy Reading! 📚';
      case 'goodbye':
        return 'See you again soon! 👋';
      case 'error':
        return 'Please try again or ask for help';
      case 'cooldown':
        return 'You recently checked in';
      case 'success':
        return 'All done!';
      case 'scanning':
        return 'Hold your ID card near the scanner';
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={type + (studentName || '')}
        className="flex flex-col items-center gap-4 z-10"
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -20 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Icon with glow */}
        <motion.div
          className={`p-4 sm:p-6 rounded-full bg-gradient-to-br ${getBgGradient()} shadow-2xl`}
          animate={{
            boxShadow: [
              '0 0 20px rgba(255,255,255,0.3)',
              '0 0 40px rgba(255,255,255,0.5)',
              '0 0 20px rgba(255,255,255,0.3)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {getIcon()}
        </motion.div>

        {/* Main message */}
        <motion.div
          className="text-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-white tracking-wider"
            style={{
              textShadow:
                '3px 3px 6px rgba(0,0,0,0.6), 0 0 30px rgba(255,255,255,0.3)',
            }}
          >
            {message || getDefaultMessage()}
          </h2>

          <motion.p
            className="text-lg sm:text-xl lg:text-2xl text-white/90 mt-3 font-medium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.4)' }}
          >
            {submessage || getDefaultSubmessage()}
          </motion.p>
        </motion.div>

        {/* Decorative sparkles for welcome/goodbye */}
        {(type === 'welcome' || type === 'goodbye' || type === 'success') && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-yellow-300 rounded-full"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  top: `${20 + Math.random() * 60}%`,
                }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  y: [0, -30],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
