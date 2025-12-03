/**
 * Kiosk School Header Component
 * Displays school logo and name with animations
 */

import { motion } from 'framer-motion';
import schoolLogo from '@/assets/kiosk/school-logo.png';

interface KioskSchoolHeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
}

export function KioskSchoolHeader({
  title = 'SHJCS Library',
  subtitle,
  showLogo = true,
}: KioskSchoolHeaderProps) {
  return (
    <motion.div
      className="flex flex-col items-center gap-3 z-10"
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {showLogo && (
        <motion.img
          src={schoolLogo}
          alt="School Logo"
          className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 object-contain drop-shadow-lg"
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      <div className="text-center">
        <motion.h1
          className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white drop-shadow-lg"
          style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
        >
          {title}
        </motion.h1>

        {subtitle && (
          <motion.p
            className="text-sm sm:text-base lg:text-lg text-white/90 mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
