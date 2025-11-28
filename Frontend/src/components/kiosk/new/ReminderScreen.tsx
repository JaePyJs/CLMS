// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckeredBackground } from './CheckeredBackground';
import { SchoolHeader } from './SchoolHeader';
import { CharacterWithBooks, FloatingBook } from './CharacterWithBooks';
import { Sparkles } from 'lucide-react';

const reminders = [
  {
    title: 'BRING BOOKS TO THE DESK\nBEFORE READING',
    icon: '📚',
    fontSize: 'text-2xl',
  },
  {
    title: 'NO FOOD AND DRINKS\nALLOWED IN THE LIBRARY',
    icon: '🚫',
    fontSize: 'text-2xl',
  },
  {
    title:
      'BORROWING PERIODS:\nGeneral Collection / Filipiniana – 3 days\nFiction / Story Books – 7 days\nReturn books on time.',
    icon: '📅',
    fontSize: 'text-lg',
  },
  {
    title: 'ALWAYS BRING YOUR\nLIBRARY CARD',
    icon: '🪪',
    fontSize: 'text-2xl',
  },
  {
    title: 'KEEP THE LIBRARY QUIET\nAND ORDERLY',
    icon: '🤫',
    fontSize: 'text-2xl',
  },
];

interface ReminderScreenProps {
  // eslint-disable-next-line no-unused-vars
  onScan: (code: string) => void;
}

export function ReminderScreen({ onScan }: ReminderScreenProps) {
  const [currentReminderIndex, setCurrentReminderIndex] = useState(0);
  const [manualInput, setManualInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput('');
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentReminderIndex((prev) => (prev + 1) % reminders.length);
    }, 6000); // Change reminder every 6 seconds

    return () => clearInterval(interval);
  }, []);

  const currentReminder = reminders[currentReminderIndex];

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <CheckeredBackground />

      {/* Floating Book in Top Right */}
      <FloatingBook />

      <div className="relative z-10 flex flex-col h-full px-8 py-2">
        <SchoolHeader />

        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-6xl mx-auto py-1">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: -30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative mb-3"
          >
            <h1
              className="text-7xl leading-tight tracking-wider text-white"
              style={{
                fontWeight: 900,
                WebkitTextStroke: '5px black',
                paintOrder: 'stroke fill',
                textShadow: '4px 4px 0px rgba(0,0,0,0.5)',
              }}
            >
              REMINDER
            </h1>

            <motion.svg
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2"
              width="320"
              height="25"
              viewBox="0 0 320 25"
            >
              <motion.path
                d="M 10 12 Q 80 7, 160 12 T 310 12"
                stroke="#FCD34D"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
              />
            </motion.svg>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentReminderIndex}
              initial={{ y: 50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -50, opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="relative px-16 py-6 text-white text-center"
              style={{
                background: 'linear-gradient(90deg, #3B4BA8 0%, #8B3A62 100%)',
                boxShadow:
                  '0 8px 0 rgba(0,0,0,0.3), 0 12px 20px rgba(0,0,0,0.4)',
                borderRadius: '150px',
                minWidth: '600px',
                maxWidth: '750px',
                minHeight: '150px',
              }}
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="text-4xl mb-2"
              >
                {currentReminder.icon}
              </motion.div>
              <p
                className={`${currentReminder.fontSize} tracking-wide whitespace-pre-line leading-snug`}
                style={{
                  fontWeight: 700,
                }}
              >
                {currentReminder.title}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Manual Input Section */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-md">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Enter ID or Barcode manually..."
              className="flex-1 px-4 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-full bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition-colors"
            >
              GO
            </button>
          </form>
        </div>

        <div className="flex justify-between items-end w-full px-2 pb-1">
          <CharacterWithBooks type="girl" />
          <CharacterWithBooks type="boy" />
        </div>

        {/* Animated sparkles - LEFT */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="absolute top-1/2 left-32 text-yellow-200"
        >
          <Sparkles size={56} fill="currentColor" />
        </motion.div>

        {/* Animated sparkles - RIGHT */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, -180, -360],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
            delay: 0.5,
          }}
          className="absolute top-1/2 right-32 text-yellow-200"
        >
          <Sparkles size={56} fill="currentColor" />
        </motion.div>
      </div>
    </div>
  );
}
