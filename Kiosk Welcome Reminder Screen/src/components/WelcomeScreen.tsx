import { motion } from 'motion/react';
import { CheckeredBackground } from './CheckeredBackground';
import { SchoolHeader } from './SchoolHeader';
import { CharacterWithBooks, FloatingBook } from './CharacterWithBooks';
import { Sparkles } from 'lucide-react';

interface WelcomeScreenProps {
  onScanClick: () => void;
}

export function WelcomeScreen({ onScanClick }: WelcomeScreenProps) {
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
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative mb-6"
          >
            <h1 className="text-8xl leading-tight tracking-wider text-white"
                style={{
                  fontWeight: 900,
                  WebkitTextStroke: '6px black',
                  paintOrder: 'stroke fill',
                  textShadow: '4px 4px 0px rgba(0,0,0,0.5)'
                }}>
              WELCOME, CRUSADER
            </h1>
            
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

          <motion.button
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onScanClick}
            className="px-32 py-6 rounded-full text-white text-3xl tracking-wider"
            style={{
              background: 'linear-gradient(90deg, #3B4BA8 0%, #8B3A62 100%)',
              boxShadow: '0 8px 0 rgba(0,0,0,0.3), 0 12px 20px rgba(0,0,0,0.4)',
              fontWeight: 600
            }}
          >
            SCAN AND SIGN IN
          </motion.button>
        </div>

        <div className="flex justify-between items-end w-full px-2 pb-2">
          <CharacterWithBooks type="girl" />
          <CharacterWithBooks type="boy" />
        </div>

        {/* Animated sparkles - LEFT */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-32 text-yellow-200"
        >
          <Sparkles size={56} fill="currentColor" />
        </motion.div>
        
        {/* Animated sparkles - RIGHT */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, -180, -360]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 0.5 }}
          className="absolute top-1/2 right-32 text-yellow-200"
        >
          <Sparkles size={56} fill="currentColor" />
        </motion.div>
      </div>
    </div>
  );
}