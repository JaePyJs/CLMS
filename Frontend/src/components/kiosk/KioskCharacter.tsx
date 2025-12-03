/**
 * Kiosk Character Component
 * Animated cartoon character with floating books
 */

import { motion } from 'framer-motion';
import boyIcon from '@/assets/kiosk/boy-icon.png';
import girlIcon from '@/assets/kiosk/girl-icon.png';
import booksStack from '@/assets/kiosk/books-stack.png';
import openBook1 from '@/assets/kiosk/open-book-1.png';
import openBook2 from '@/assets/kiosk/open-book-2.png';

interface KioskCharacterProps {
  gender?: 'boy' | 'girl';
  side: 'left' | 'right';
  showBooks?: boolean;
  animationType?: 'wave' | 'bounce' | 'float';
}

export function KioskCharacter({
  gender = 'boy',
  side,
  showBooks = true,
  animationType = 'bounce',
}: KioskCharacterProps) {
  const characterImage = gender === 'boy' ? boyIcon : girlIcon;

  const animationVariants = {
    wave: {
      y: [0, -10, 0],
      rotate: side === 'left' ? [0, -5, 0] : [0, 5, 0],
    },
    bounce: {
      y: [0, -15, 0],
    },
    float: {
      y: [0, -8, 0],
    },
  };

  return (
    <motion.div
      className={`absolute bottom-0 ${side === 'left' ? 'left-4 sm:left-8 lg:left-16' : 'right-4 sm:right-8 lg:right-16'} flex flex-col items-center`}
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {/* Floating books behind character */}
      {showBooks && (
        <div className="relative">
          {/* Open book floating above */}
          <motion.img
            src={side === 'left' ? openBook1 : openBook2}
            alt="Floating book"
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-16 h-12 sm:w-20 sm:h-16 object-contain"
            animate={{
              y: [0, -8, 0],
              rotate: side === 'left' ? [-5, 5, -5] : [5, -5, 5],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Sparkle effects */}
          <motion.div
            className="absolute -top-24 left-1/2 w-2 h-2 bg-yellow-300 rounded-full shadow-lg shadow-yellow-300/50"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
            }}
          />
          <motion.div
            className="absolute -top-16 right-2 w-1.5 h-1.5 bg-yellow-200 rounded-full shadow-md shadow-yellow-200/50"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: 0.5,
            }}
          />
        </div>
      )}

      {/* Main character */}
      <motion.img
        src={characterImage}
        alt={`${gender} character`}
        className="w-32 h-48 sm:w-40 sm:h-56 lg:w-48 lg:h-64 object-contain drop-shadow-2xl"
        animate={animationVariants[animationType]}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Book stack at bottom */}
      {showBooks && (
        <motion.img
          src={booksStack}
          alt="Stack of books"
          className="absolute bottom-0 w-24 h-16 sm:w-28 sm:h-20 object-contain"
          style={{
            left: side === 'left' ? '-20px' : 'auto',
            right: side === 'right' ? '-20px' : 'auto',
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        />
      )}
    </motion.div>
  );
}
