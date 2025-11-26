import { useState, useEffect } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ReminderScreen } from './components/ReminderScreen';
import { AnimatePresence } from 'motion/react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'reminder'>('welcome');

  const handleScanClick = () => {
    // Simulate scan action - show reminders after scan
    setCurrentScreen('reminder');
  };

  useEffect(() => {
    // After showing reminders for 30 seconds (5 reminders × 6 seconds each), return to welcome
    if (currentScreen === 'reminder') {
      const timer = setTimeout(() => {
        setCurrentScreen('welcome');
      }, 30000); // 30 seconds total for all reminders

      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  return (
    <div className="w-full h-screen overflow-hidden">
      <AnimatePresence mode="wait">
        {currentScreen === 'welcome' ? (
          <WelcomeScreen key="welcome" onScanClick={handleScanClick} />
        ) : (
          <ReminderScreen key="reminder" />
        )}
      </AnimatePresence>
    </div>
  );
}