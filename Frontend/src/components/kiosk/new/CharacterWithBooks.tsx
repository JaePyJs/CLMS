// @ts-nocheck
import React from 'react';
import { motion } from 'framer-motion';
import boyIcon from '@/assets/kiosk/boy-icon.png';
import girlIcon from '@/assets/kiosk/girl-icon.png';
import booksStack from '@/assets/kiosk/books-stack.png';
import openBook1 from '@/assets/kiosk/open-book-1.png';
import openBook2 from '@/assets/kiosk/open-book-2.png';

interface CharacterWithBooksProps {
  type: 'girl' | 'boy';
}

export function CharacterWithBooks({ type }: CharacterWithBooksProps) {
  if (type === 'girl') {
    return (
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="flex items-end gap-4 shrink-0"
      >
        {/* Girl Character */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <img
            src={girlIcon}
            alt="Girl Character"
            className="h-52 w-auto object-contain"
          />
        </motion.div>

        {/* Stack of Books next to girl (2 books stacked) */}
        <motion.div
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="mb-3"
        >
          <img
            src={booksStack}
            alt="Stack of Books"
            className="h-28 w-auto object-contain"
          />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.6 }}
      className="flex items-end gap-4 shrink-0"
    >
      {/* Open Book next to boy */}
      <motion.div
        animate={{
          rotateY: [0, 10, 0, -10, 0],
        }}
        transition={{ duration: 3, repeat: Infinity }}
        className="mb-3"
      >
        <img
          src={openBook2}
          alt="Open Book"
          className="h-20 w-auto object-contain"
        />
      </motion.div>

      {/* Boy Character */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.3,
        }}
      >
        <img
          src={boyIcon}
          alt="Boy Character"
          className="h-52 w-auto object-contain"
        />
      </motion.div>
    </motion.div>
  );
}

// Floating Book Component for top right corner
export function FloatingBook() {
  return (
    <motion.div
      initial={{ x: 100, opacity: 0, rotate: 15 }}
      animate={{ x: 0, opacity: 1, rotate: 15 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className="absolute top-20 right-16 z-20"
    >
      <motion.img
        animate={{
          y: [0, -12, 0],
          rotate: [15, 20, 15],
        }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        src={openBook1}
        alt="Floating Book"
        className="h-24 w-auto object-contain"
      />
    </motion.div>
  );
}
