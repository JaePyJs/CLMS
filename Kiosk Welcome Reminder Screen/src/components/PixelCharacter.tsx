import { motion } from 'motion/react';
import boyIcon from 'figma:asset/93e6af844fa97f9b2616d41900b6b61d70d5cfcb.png';
import girlIcon from 'figma:asset/8151437889e232585ba4f793979922658b4e10f1.png';

interface PixelCharacterProps {
  type: 'girl' | 'boy';
}

export function PixelCharacter({ type }: PixelCharacterProps) {
  if (type === 'girl') {
    return (
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="flex flex-col items-center shrink-0"
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <img 
            src={girlIcon} 
            alt="Girl Character" 
            className="h-80 w-auto object-contain"
            style={{ imageRendering: 'pixelated' }}
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
      className="flex flex-col items-center shrink-0"
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      >
        <img 
          src={boyIcon} 
          alt="Boy Character" 
          className="h-80 w-auto object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      </motion.div>
    </motion.div>
  );
}