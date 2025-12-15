// @ts-nocheck
import { useState, useEffect } from 'react';
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

export function ReminderScreen() {
  const [currentReminderIndex, setCurrentReminderIndex] = useState(0);

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
            className="relative mb-4"
          >
            <h1
              className="text-6xl md:text-7xl leading-tight tracking-wider text-white"
              style={{
                fontWeight: 900,
                WebkitTextStroke: '4px black',
                paintOrder: 'stroke fill',
                textShadow:
                  '4px 4px 0px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.5)',
              }}
            >
              REMINDER
            </h1>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentReminderIndex}
              initial={{ y: 50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -50, opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="relative px-12 md:px-16 py-6 text-white text-center"
              style={{
                background: 'linear-gradient(90deg, #3B4BA8 0%, #8B3A62 100%)',
                boxShadow:
                  '0 8px 0 rgba(0,0,0,0.4), 0 12px 20px rgba(0,0,0,0.5), inset 0 2px 10px rgba(255,255,255,0.1)',
                borderRadius: '80px',
                minWidth: '550px',
                maxWidth: '700px',
                minHeight: '140px',
                border: '3px solid rgba(255,255,255,0.2)',
              }}
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="text-4xl mb-3"
              >
                {currentReminder.icon}
              </motion.div>
              <p
                className={`${currentReminder.fontSize} tracking-wide whitespace-pre-line leading-relaxed`}
                style={{
                  fontWeight: 700,
                  textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                {currentReminder.title}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-between items-end w-full px-2 pb-1">
          <CharacterWithBooks type="girl" />
          <CharacterWithBooks type="boy" />
        </div>

        {/* Animated sparkles - TOP LEFT (moved away from center content) */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="absolute top-24 left-8 text-yellow-200 opacity-80"
        >
          <Sparkles size={48} fill="currentColor" />
        </motion.div>

        {/* Animated sparkles - BOTTOM LEFT */}
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -180, -360],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'linear',
            delay: 1,
          }}
          className="absolute bottom-48 left-16 text-yellow-200 opacity-70"
        >
          <Sparkles size={40} fill="currentColor" />
        </motion.div>

        {/* Animated sparkles - TOP RIGHT */}
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
          className="absolute top-48 right-48 text-yellow-200 opacity-80"
        >
          <Sparkles size={48} fill="currentColor" />
        </motion.div>

        {/* Animated sparkles - BOTTOM RIGHT */}
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'linear',
            delay: 1.5,
          }}
          className="absolute bottom-48 right-16 text-yellow-200 opacity-70"
        >
          <Sparkles size={40} fill="currentColor" />
        </motion.div>
      </div>
    </div>
  );
}
