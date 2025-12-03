// @ts-nocheck
import React from 'react';
import { motion } from 'framer-motion';
import { CheckeredBackground } from './CheckeredBackground';
import { SchoolHeader } from './SchoolHeader';
import { CharacterWithBooks, FloatingBook } from './CharacterWithBooks';
import { Sparkles } from 'lucide-react';

interface WelcomeScreenProps {
  studentName?: string;
  gender?: string;
}

export function WelcomeScreen({ studentName, gender }: WelcomeScreenProps) {
  // Determine honorific based on gender
  const getHonorific = () => {
    if (!gender) return '';
    const g = gender.toLowerCase();
    if (g === 'male' || g === 'm') return 'Mr. ';
    if (g === 'female' || g === 'f') return 'Ms. ';
    return '';
  };

  const displayName = studentName ? `${getHonorific()}${studentName}` : null;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <CheckeredBackground />

      {/* Floating Book in Top Right */}
      <FloatingBook />

      <div className="relative z-10 flex flex-col h-full px-8 py-3">
        <SchoolHeader />

        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-6xl mx-auto py-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative mb-6 text-center"
          >
            <h1
              className="text-7xl md:text-8xl leading-tight tracking-wider text-white"
              style={{
                fontWeight: 900,
                WebkitTextStroke: '4px black',
                paintOrder: 'stroke fill',
                textShadow:
                  '4px 4px 0px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.5)',
              }}
            >
              WELCOME, CRUSADER
            </h1>

            {displayName && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-6 px-8 py-4 rounded-2xl"
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <h2
                  className="text-5xl md:text-6xl text-yellow-400 font-bold tracking-wide"
                  style={{
                    textShadow:
                      '3px 3px 0px rgba(0,0,0,1), 0 0 20px rgba(250, 204, 21, 0.6)',
                    WebkitTextStroke: '1px rgba(0,0,0,0.5)',
                  }}
                >
                  {displayName}
                </h2>
              </motion.div>
            )}

            <motion.svg
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2"
              width="420"
              height="30"
              viewBox="0 0 420 30"
            >
              <motion.path
                d="M 10 15 Q 105 8, 210 15 T 410 15"
                stroke="#FCD34D"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
              />
            </motion.svg>
          </motion.div>
        </div>

        <div className="flex justify-between items-end w-full px-2 pb-2">
          <CharacterWithBooks type="girl" />
          <CharacterWithBooks type="boy" />
        </div>

        {/* Animated sparkles - TOP LEFT (moved away from center text) */}
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
