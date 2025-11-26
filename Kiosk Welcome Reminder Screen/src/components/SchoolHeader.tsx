import { motion } from 'motion/react';
import schoolLogo from 'figma:asset/babbf66c0cab6e5aa5a1586850bb50097303b6c4.png';

export function SchoolHeader() {
  return (
    <div className="flex items-center justify-between w-full mb-2">
      {/* School Logo - LEFT */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative shrink-0"
      >
        <img
          src={schoolLogo}
          alt="SHJCS Library Logo"
          className="w-56 h-56 object-contain"
        />
      </motion.div>

      {/* School Name Banner - Large Oval */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="px-24 py-8 text-center flex-1 mx-12"
        style={{
          background: 'linear-gradient(135deg, #D4A574 0%, #C88B5C 50%, #D4A574 100%)',
          border: '4px solid #000',
          borderRadius: '50%',
          boxShadow: '0 8px 0 rgba(0,0,0,0.3), inset 0 2px 10px rgba(255,255,255,0.3)'
        }}
      >
        <p className="text-white tracking-wider text-2xl leading-snug"
           style={{ textShadow: '2px 2px 3px rgba(0,0,0,0.5)' }}>
          SACRED HEART OF JESUS CATHOLIC SCHOOL<br />
          LEARNING RESOURCE CENTER
        </p>
      </motion.div>

      {/* Empty space for symmetry */}
      <div className="w-56 shrink-0" />
    </div>
  );
}