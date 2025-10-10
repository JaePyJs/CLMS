# CLMS Frontend

Comprehensive Library Management System frontend for Sacred Heart of Jesus Catholic School Library.

## Features

### 🎯 Core Functionality
- **Real-time Dashboard**: Live metrics, system status, and recent activity monitoring
- **Scan Workspace**: Multi-method barcode scanning (camera, USB, manual entry)
- **Equipment Management**: Live station status, session timers, and manual overrides
- **Automation Hub**: Job monitoring, execution history, and Google Sheets sync
- **Analytics & Reporting**: Usage charts, time tracking, and export functionality

### 🔧 Technical Features
- **Offline-First Architecture**: IndexedDB queue for offline operations
- **Real-time Updates**: WebSocket connections for live status
- **Progressive Web App**: Works seamlessly on desktop and tablet devices
- **Barcode Scanning**: Support for camera, USB scanners, and manual entry
- **Grade-based Access Control**: Time limits and permissions by grade level
- **Accessibility**: Keyboard-first UX with ARIA labels

## Technology Stack

- **React 18.3.1** with TypeScript
- **Vite 6.3.5** for development and building
- **shadcn/ui** component library (30+ Radix UI components)
- **Tailwind CSS** for styling
- **TanStack Query (React Query)** for server state management
- **Zustand** for client state management
- **ZXing** for barcode scanning
- **Recharts** for data visualization
- **Framer Motion** for animations
- **IndexedDB** for offline storage

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd CLMS/Frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run test` - Run tests
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage

## Project Structure

```
src/
├── components/
│   ├── ui/                     # 30+ shadcn/ui components
│   └── dashboard/              # Main dashboard components
│       ├── DashboardOverview.tsx
│       ├── EquipmentDashboard.tsx
│       ├── ScanWorkspace.tsx
│       ├── AutomationDashboard.tsx
│       └── AnalyticsDashboard.tsx
├── hooks/
│   └── api-hooks.ts            # React Query hooks
├── lib/
│   ├── api.ts                  # API client layer
│   ├── offline-queue.ts        # IndexedDB offline queue
│   ├── scanner.ts              # Barcode scanning utilities
│   ├── query-client.ts         # React Query configuration
│   └── utils.ts                # Utility functions
├── store/
│   └── useAppStore.ts          # Zustand store
├── App.tsx                     # Main application
└── main.tsx                    # Application entry point
```

## Key Features Explained

### Scan Workspace
The Scan workspace supports three scanning methods:

1. **Camera Scanning**: Uses device camera with ZXing library
2. **USB Scanner**: Captures keyboard input from USB barcode scanners
3. **Manual Entry**: Fallback option for manual barcode input

### Offline Queue
- Automatically queues actions when offline
- Syncs when connection is restored
- Supports activity logging, session management, and API calls
- Uses IndexedDB for persistent storage

### Equipment Management
- Real-time equipment status monitoring
- Session timers with automatic expiration
- Grade-based time limits
- Manual session control

### Automation Dashboard
- Monitor Google Sheets integration
- Track scheduled backup jobs
- Manual job triggering
- Execution history and logs

### Analytics
- Usage charts and statistics
- Export functionality (CSV/JSON)
- Grade distribution analysis
- Equipment utilization metrics

## API Integration

The frontend integrates with the CLMS backend API:

### Base URL: `http://localhost:3001`

### Key Endpoints:
- `/api/students` - Student management
- `/api/equipment` - Equipment management
- `/api/automation` - Automation jobs
- `/api/analytics` - Usage analytics

## Grade-Based Access Control

Time limits and permissions:

| Grade Category | Time Limit | Features |
|---|---|---|
| Primary (K-3) | 15 minutes | Supervised activities only |
| Grade School (4-6) | 30 minutes | Basic computer access |
| Junior High (7-10) | 45 minutes | Full computer + gaming |
| Senior High (11-12) | 60 minutes | Premium access + research |

## Scanner Setup

### Camera Scanner
- Uses device camera (preferably rear camera)
- Supports multiple barcode formats
- Real-time scanning with visual feedback

### USB Scanner
- Connect USB barcode scanner
- Activate scanner mode in Scan workspace
- Automatically detects barcode input
- Works even when app is not focused

### Supported Barcode Formats
- QR Code
- Code 128
- Code 39
- EAN-13
- EAN-8
- UPC-A
- UPC-E

## Offline Functionality

When offline:
- ✅ Scanner works normally
- ✅ Activities are queued locally
- ✅ Equipment status updates work
- ✅ Dashboard shows cached data
- ❌ Real-time updates pause
- ❌ Google Sheets sync pauses

Queue automatically syncs when connection is restored.

## Environment Variables

Create `.env.local` for development:

```env
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_SHEETS_ENABLED=true
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Contributing

1. Follow existing code patterns
2. Use TypeScript for all new code
3. Add comments for complex logic
4. Test with different scanner types
5. Verify offline functionality

## Deployment

### Production Build
```bash
npm run build
```

### Preview Build
```bash
npm run preview
```

Build files are output to `dist/` directory.

## Security Considerations

- All API calls use HTTPS in production
- Barcode data is validated before processing
- Offline queue encrypts sensitive data
- No sensitive information stored in localStorage

## Troubleshooting

### Scanner Not Working
1. Check camera permissions
2. Try different scanning method
3. Verify barcode format is supported
4. Test with known good barcode

### Offline Queue Not Syncing
1. Check network connection
2. Verify backend is accessible
3. Clear browser cache and retry
4. Check browser console for errors

### Build Errors
1. Clear node_modules and reinstall
2. Check for TypeScript errors
3. Verify all dependencies are installed
4. Run `npm run lint` to check for issues

## Development Notes

- Uses React Query for server state
- Zustand for client state management
- Component architecture follows shadcn/ui patterns
- Responsive design works on desktop and tablet
- Accessibility features built-in

## License

Private use for Sacred Heart of Jesus Catholic School Library.