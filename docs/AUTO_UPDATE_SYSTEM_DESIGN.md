# CLMS Auto-Update System - Design Document

**Version:** 1.0
**Date:** November 4, 2025
**Status:** Approved for Implementation

---

## Executive Summary

The CLMS Auto-Update System provides a comprehensive, secure, and user-friendly update mechanism for school deployments. The system allows administrators to easily check for, schedule, and apply updates while ensuring security through signature verification and providing offline fallback options.

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  CLMS Update Server (clms-updates.example.com)              │
│  - Hosts latest CLMS Docker images                           │
│  - Stores update metadata (versions, changelogs)            │
│  - Serves update packages                                    │
│  - Admin dashboard for managing updates                      │
└──────────────────┬───────────────────────────────────────────┘
                   │ HTTPS API Calls
                   │
┌──────────────────▼───────────────────────────────────────────┐
│  CLMS School Installation                                   │
│  - Update Service (backend API endpoints)                   │
│  - Update Manager (React UI component)                      │
│  - Scheduler (background job processor)                     │
│  - Docker Registry Client (pulls images)                    │
│  - ZIP Update Handler (offline fallback)                    │
│  - Backup Manager (pre-update safety)                       │
│  - Rollback Service (automatic on failure)                  │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Key Components

1. **Update Service Backend (Express.js)**
   - REST API endpoints for update operations
   - Update checker and scheduler
   - Docker registry integration
   - Backup and rollback management

2. **Update Manager Frontend (React)**
   - Notification banners for available updates
   - Admin page for update management
   - Scheduling interface
   - Progress tracking

3. **Update Server Infrastructure**
   - Version metadata API
   - Docker image registry
   - Update package storage
   - Admin management dashboard

4. **Offline Update Mechanism**
   - ZIP-based fallback
   - Manual update option
   - Local file server support

---

## 2. Update Flow Process

### 2.1 Complete Update Workflow

**Phase 1: Detection & Notification**
```
1. Admin clicks "Check for Updates" in CLMS
   ↓
2. Update Service queries update server
   ↓
3. Server returns latest version info
   ↓
4. System compares versions
   ↓
5. If update available:
   - Shows notification banner
   - Displays version and changelog
   - Indicates if critical or optional
```

**Phase 2: Scheduling**
```
1. Admin clicks "View Details"
   ↓
2. Review update information:
   - What's new
   - What's changed
   - Breaking changes (if any)
   - Estimated update time
   ↓
3. Admin chooses schedule:
   - Immediately (after hours warning)
   - Tonight at specific time
   - Weekend
   - Custom date/time
   ↓
4. System schedules update job
```

**Phase 3: Pre-Update Backup**
```
At scheduled time:
1. Create database backup (MySQL dump)
2. Save current Docker image tags
3. Archive configuration files
4. Save to local storage + optional external drive
5. Verify backup integrity
6. Log backup location
```

**Phase 4: Update Execution**
```
1. Pull new Docker images from registry
   ↓
2. Stop services gracefully (drain connections)
   ↓
3. Start new containers
   ↓
4. Run database migrations (if needed)
   ↓
5. Health check all services
   ↓
6. Verify database connectivity
   ↓
7. Update version numbers in database
```

**Phase 5: Verification & Rollback**
```
1. Test key CLMS operations:
   - Login
   - Student management
   - Book checkout
   - Database access

2. If all checks pass:
   - Mark update as COMPLETED
   - Notify admin: "Update successful"
   - Clean up old backup

3. If any check fails:
   - Automatically rollback to previous version
   - Restore database from backup
   - Start old containers
   - Mark as ROLLED_BACK
   - Notify admin: "Update failed, rolled back"
```

---

## 3. Technical Implementation

### 3.1 Backend Changes (Express.js)

#### New API Routes (`src/routes/updates.ts`)

```typescript
// Check for available updates
GET /api/updates/check
Response: {
  updateAvailable: boolean,
  currentVersion: string,
  latestVersion: string,
  updateInfo?: UpdateInfo
}

// Get detailed update information
GET /api/updates/latest
Response: UpdateInfo

// Schedule an update
POST /api/updates/schedule
Body: {
  updateId: string,
  scheduledFor: Date,
  createBackup: boolean
}
Response: { success: boolean, updateId: string }

// Get update status
GET /api/updates/status/:updateId
Response: SystemUpdate

// List all updates
GET /api/updates/history
Response: SystemUpdate[]

// Cancel scheduled update
DELETE /api/updates/cancel/:updateId
Response: { success: boolean }
```

#### Update Service (`src/services/updateService.ts`)

```typescript
interface UpdateInfo {
  version: string;
  releaseDate: string;
  changelog: string;
  critical: boolean;
  forceAfterDate?: Date;
  minVersion?: string;
  dockerTags: {
    backend: string;
    frontend: string;
  };
  backupRequired: boolean;
  migrationNotes?: string;
}

interface SystemUpdate {
  id: string;
  version: string;
  status: UpdateStatus;
  scheduledFor?: Date;
  executedAt?: Date;
  backupPath?: string;
  changelog: string;
  critical: boolean;
  createdAt: Date;
  updatedAt: Date;
}

enum UpdateStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  DOWNLOADING = 'DOWNLOADING',
  UPDATING = 'UPDATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK'
}

class UpdateService {
  async checkForUpdates(): Promise<UpdateInfo | null>
  async scheduleUpdate(updateInfo: UpdateInfo, scheduleTime: Date): Promise<string>
  async executeUpdate(updateId: string): Promise<void>
  async rollback(updateId: string): Promise<void>
  async createBackup(): Promise<string>
  async verifyBackup(backupPath: string): Promise<boolean>
  async cleanupOldBackups(): Promise<void>
  async getUpdateHistory(): Promise<SystemUpdate[]>
}
```

#### Docker Registry Client (`src/services/dockerRegistryClient.ts`)

```typescript
class DockerRegistryClient {
  async pullImage(imageName: string, tag: string): Promise<void>
  async getLatestTag(imageName: string): Promise<string>
  async listTags(imageName: string): Promise<string[]>
  async verifyImage(imageName: string, tag: string): Promise<boolean>
}
```

### 3.2 Frontend Changes (React)

#### 1. Update Notification Banner
- Location: Top of main dashboard
- Visible: When update available
- Actions: "View Details" or "Dismiss" (if optional)

```tsx
const UpdateBanner: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-blue-700">
            <strong>Update Available:</strong> v{updateInfo?.version}
          </p>
          <p className="text-xs text-blue-600">
            {updateInfo?.critical ? 'Critical Security Update' : 'New Features Available'}
          </p>
        </div>
        <div className="space-x-2">
          <Button onClick={() => navigate('/admin/updates')}>View Details</Button>
          {!updateInfo?.critical && (
            <Button variant="outline" onClick={() => dismissNotification()}>
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
```

#### 2. Update Manager Page (`/admin/updates`)

```tsx
const UpdateManager: React.FC = () => {
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateHistory, setUpdateHistory] = useState<SystemUpdate[]>([]);

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Current Version</p>
              <p className="text-2xl font-bold">{currentVersion}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Latest Version</p>
              <p className="text-2xl font-bold text-green-600">
                {latestVersion || 'Unknown'}
              </p>
            </div>
          </div>
          <Button onClick={checkForUpdates} className="mt-4">
            Check for Updates
          </Button>
        </CardContent>
      </Card>

      {/* Update Details */}
      {updateInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Update Available: v{updateInfo.version}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">{updateInfo.changelog}</p>
            <div className="flex justify-between items-center">
              <Badge variant={updateInfo.critical ? 'destructive' : 'secondary'}>
                {updateInfo.critical ? 'Critical' : 'Optional'}
              </Badge>
              <Button onClick={() => setShowScheduleDialog(true)}>
                Schedule Update
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scheduled Updates */}
      <Card>
        <CardHeader>
          <CardTitle>Update History</CardTitle>
        </CardHeader>
        <CardContent>
          <UpdateHistoryTable updates={updateHistory} />
        </CardContent>
      </Card>
    </div>
  );
};
```

#### 3. Update Schedule Dialog

```tsx
const ScheduleUpdateDialog: React.FC = () => {
  const [scheduleTime, setScheduleTime] = useState<Date>(new Date());
  const [backupLocation, setBackupLocation] = useState<'local' | 'external'>('local');

  const handleSchedule = async () => {
    await updateService.scheduleUpdate(updateInfo.id, scheduleTime, backupLocation);
    showSuccess('Update scheduled successfully');
  };

  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>Schedule Update</DialogTitle>
        <DialogDescription>
          Choose when to apply the update. We recommend during off-peak hours.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Schedule Time</Label>
          <DateTimePicker
            value={scheduleTime}
            onChange={setScheduleTime}
            minDate={new Date()}
          />
        </div>
        <div>
          <Label>Backup Location</Label>
          <Select value={backupLocation} onValueChange={setBackupLocation}>
            <SelectItem value="local">Local Storage</SelectItem>
            <SelectItem value="external">External Drive</SelectItem>
          </Select>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleSchedule}>Schedule Update</Button>
        </div>
      </div>
    </Dialog>
  );
};
```

### 3.3 Database Schema Changes (Prisma)

```prisma
model SystemUpdate {
  id            String      @id @default(cuid())
  version       String
  status        UpdateStatus
  scheduledFor  DateTime?
  executedAt    DateTime?
  backupPath    String?
  changelog     String
  critical      Boolean     @default(false)
  forceAfter    DateTime?
  dockerTags    Json
  errorMessage  String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([status])
  @@index([scheduledFor])
}

model SystemSettings {
  id                    String   @id @default(cuid())
  key                   String   @unique
  value                 String
  updatedAt             DateTime @updatedAt

  @@index([key])
}

enum UpdateStatus {
  PENDING
  SCHEDULED
  DOWNLOADING
  UPDATING
  COMPLETED
  FAILED
  ROLLED_BACK
}
```

### 3.4 Configuration Changes

#### Environment Variables

```bash
# Update Server Configuration
UPDATE_SERVER_URL=https://clms-updates.example.com
UPDATE_API_KEY=your-api-key-here

# Docker Registry
DOCKER_REGISTRY=registry.example.com
DOCKER_USERNAME=clms-deploy
DOCKER_PASSWORD=secure-password

# Backup Configuration
BACKUP_PATH=./backups
MAX_BACKUPS=5
EXTERNAL_BACKUP_PATH=  # Optional, e.g., Z:/clms-backups

# Update Settings
CHECK_FOR_UPDATES_ON_STARTUP=false
AUTO_CHECK_INTERVAL_DAYS=7
```

---

## 4. Security Implementation

### 4.1 Update Security Features

1. **Signature Verification**
   - Each update package signed with GPG
   - Schools verify with public key
   - Prevent malicious updates

2. **HTTPS Communication**
   - All API calls over HTTPS
   - Certificate pinning for update server

3. **Authentication**
   - API keys for each school
   - Rate limiting on update endpoints
   - Request signing for critical operations

4. **Encryption**
   - Backup files encrypted at rest
   - Transport encryption for all communications

### 4.2 Force Update Mechanism

For critical security updates:

```typescript
interface CriticalUpdateInfo extends UpdateInfo {
  critical: true;
  forceAfterDate: Date;
  gracePeriodDays: number;
}

// At startup, check if critical update is overdue
async function checkForceUpdate(): Promise<void> {
  const updateInfo = await updateService.getCriticalUpdateInfo();
  if (updateInfo && new Date() > updateInfo.forceAfterDate) {
    // Block all operations except updates
    showForceUpdateDialog(updateInfo);
    blockUI();
  }
}
```

Force Update Process:
1. Display blocking dialog: "Critical security update required"
2. Block all user actions except update
3. Auto-schedule update for next reboot or immediate (if after hours)
4. Require admin confirmation
5. Update or prevent system use

---

## 5. Offline/Fallback Mechanism

### 5.1 ZIP-Based Update Fallback

When Docker registry is unreachable:

```typescript
class ZipUpdateHandler {
  async checkLocalUpdates(): Promise<ZipUpdateInfo[]> {
    const updatesDir = path.join(process.cwd(), 'updates');
    const files = await fs.readdir(updatesDir);
    const zipFiles = files.filter(f => f.endsWith('.zip'));

    return Promise.all(
      zipFiles.map(async (file) => {
        const info = await this.extractZipInfo(file);
        return info;
      })
    );
  }

  async applyZipUpdate(zipPath: string): Promise<void> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clms-update-'));

    try {
      // Extract ZIP
      await extract(zipPath, { dir: tempDir });

      // Build Docker images from source
      await this.buildImagesFromSource(tempDir);

      // Apply update
      await this.replaceContainers();

      // Update database version
      await this.updateVersionInDatabase();
    } finally {
      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
```

### 5.2 Manual Update Process

For completely offline environments:

1. Download update ZIP from your website
2. Place in `/updates` folder
3. CLMS detects and shows as available
4. Admin schedules update
5. System builds images locally
6. No internet required

---

## 6. Update Server Infrastructure

### 6.1 API Endpoints

```typescript
// GET /api/latest
Response: {
  version: '1.0.2',
  releaseDate: '2025-11-01',
  changelog: '...',
  critical: false,
  dockerTags: {
    backend: 'registry.example.com/clms/backend:1.0.2',
    frontend: 'registry.example.com/clms/frontend:1.0.2'
  }
}

// GET /api/updates/:version
Response: {
  version: '1.0.2',
  downloadUrl: 'https://files.clms-updates.example.com/v1.0.2.zip',
  signatureUrl: 'https://files.clms-updates.example.com/v1.0.2.sig',
  size: '500MB',
  sha256: '...',
  changelog: '...',
  critical: false,
  forceAfterDate: '2025-11-15',
  minVersion: '1.0.0',
  dockerTags: { ... }
}
```

### 6.2 Admin Dashboard Features

1. **Upload New Version**
   - Drag and drop ZIP package
   - Enter version number
   - Write changelog
   - Mark as critical (optional)
   - Set force date (if critical)

2. **Version Management**
   - List all versions
   - View update statistics
   - Disable old versions
   - Delete versions (with confirmation)

3. **Analytics**
   - Schools using each version
   - Update success/failure rates
   - Critical update adoption
   - Update time statistics

### 6.3 Update Distribution Process

Developer Workflow:
1. Build new images: `docker build -t registry/clms/backend:v1.0.3 .`
2. Push to registry: `docker push registry/clms/backend:v1.0.3`
3. Create update package:
   - Source code snapshot
   - Migration scripts
   - Changelog
   - Version info
4. Generate signature: `gpg --sign --detach-sig update.zip`
5. Upload via admin dashboard
6. System automatically notifies schools

---

## 7. User Experience

### 7.1 Admin Experience

**Checking for Updates:**
- One-click "Check for Updates" button
- Automatic notification when update available
- Clear version comparison display

**Scheduling Updates:**
- Simple calendar picker
- Recommended times (tonight, weekend)
- Visual timeline of scheduled updates
- One-click to schedule immediately

**During Update:**
- Progress bar with steps
- Estimated time remaining
- Can cancel (if not started)
- Automatic success/failure notification

**After Update:**
- Success message with what's new
- Option to view full changelog
- Automatic backup cleanup
- Update logged in history

### 7.2 Error Handling

**Network Errors:**
- Retry with exponential backoff
- Fallback to ZIP update
- Clear error message with next steps

**Update Failures:**
- Automatic rollback
- Clear error message
- Option to retry
- Log diagnostic information

**Corrupt Backups:**
- Verify backup before update
- Require manual backup if auto fails
- Don't proceed without valid backup

---

## 8. Monitoring & Logging

### 8.1 Update Events Logged

```typescript
enum UpdateEventType {
  UPDATE_CHECKED = 'UPDATE_CHECKED',
  UPDATE_AVAILABLE = 'UPDATE_AVAILABLE',
  UPDATE_SCHEDULED = 'UPDATE_SCHEDULED',
  UPDATE_STARTED = 'UPDATE_STARTED',
  UPDATE_DOWNLOADED = 'UPDATE_DOWNLOADED',
  BACKUP_CREATED = 'BACKUP_CREATED',
  UPDATE_COMPLETED = 'UPDATE_COMPLETED',
  UPDATE_FAILED = 'UPDATE_FAILED',
  ROLLBACK_COMPLETED = 'ROLLBACK_COMPLETED'
}

interface UpdateEvent {
  id: string;
  type: UpdateEventType;
  updateId: string;
  timestamp: Date;
  message: string;
  metadata?: Record<string, any>;
}
```

### 8.2 Metrics & Analytics

1. **Update Success Rate**: Percentage of successful updates
2. **Average Update Time**: Time from start to completion
3. **Critical Update Adoption**: Schools updating critical patches
4. **Rollback Rate**: How often rollbacks occur
5. **Version Distribution**: Schools on each version

---

## 9. Testing Strategy

### 9.1 Unit Tests

- Update service logic
- Backup creation and verification
- Version comparison
- Rollback procedures
- Signature verification

### 9.2 Integration Tests

- End-to-end update flow
- Docker registry integration
- Database migration tests
- Network error handling
- Rollback scenarios

### 9.3 Test Scenarios

1. **Happy Path**: Normal update from v1.0.0 to v1.0.1
2. **Network Error**: Registry unavailable, use ZIP fallback
3. **Update Failure**: Service fails, automatic rollback
4. **Critical Update**: Force update after expiration date
5. **Offline Update**: No internet, manual ZIP update
6. **Partial Failure**: Backend updates, frontend fails, rollback
7. **Long-Running**: Update during school hours with warnings

---

## 10. Deployment Timeline

### Phase 1: Core Update System (Weeks 1-2)
- Backend API endpoints
- Update service logic
- Database schema changes
- Basic frontend UI

### Phase 2: Advanced Features (Week 3)
- Scheduling system
- Backup management
- Rollback automation
- Signature verification

### Phase 3: Offline Mode (Week 4)
- ZIP update handler
- Local file server support
- Manual update process
- Documentation

### Phase 4: Polish & Testing (Week 5)
- UI/UX improvements
- Error handling
- Comprehensive testing
- Documentation

### Phase 5: Update Server (Week 6)
- Deploy update server
- Set up Docker registry
- Admin dashboard
- Monitoring

---

## 11. Maintenance & Operations

### 11.1 Regular Maintenance

1. **Weekly**
   - Review update success metrics
   - Check for failed updates needing attention
   - Monitor server load and performance

2. **Monthly**
   - Clean up old backup files
   - Review and update documentation
   - Update security certificates

3. **Per Release**
   - Test update process thoroughly
   - Verify rollback procedures
   - Update changelog

### 11.2 Support Procedures

1. **School Reports Update Issue**
   - Gather logs from update system
   - Identify failure point
   - Provide manual update instructions
   - Track resolution

2. **Critical Update Emergency**
   - Push immediate update
   - Monitor adoption rate
   - Follow up with schools
   - Document lessons learned

---

## 12. Cost Analysis

### Infrastructure Costs

1. **Update Server Hosting** (monthly)
   - Basic VPS: $20-50/month
   - CDN for downloads: $50-100/month
   - Total: $70-150/month

2. **Docker Registry**
   - Docker Hub: Free (public) or $5-50/month (private)
   - Self-hosted: $20/month

### Development Time

- Backend development: ~80 hours
- Frontend development: ~60 hours
- Testing & QA: ~40 hours
- Documentation: ~20 hours
- **Total: ~200 hours**

---

## 13. Risks & Mitigation

### Risk: Schools don't update regularly

**Mitigation:**
- Critical updates auto-force after deadline
- Regular notifications
- Simple update process
- Update incentives (new features)

### Risk: Update corruption during download

**Mitigation:**
- SHA256 checksums
- Signature verification
- Verify before applying
- Automatic rollback on failure

### Risk: Update server downtime

**Mitigation:**
- Multiple fallback mechanisms
- ZIP-based offline updates
- Local cache of updates
- Distributed CDN

### Risk: Schools lose data during update

**Mitigation:**
- Mandatory backup before update
- Automatic backup verification
- Tested rollback procedures
- Multiple backup locations

---

## 14. Success Criteria

✅ **Functional Requirements**
- Schools can check for updates with one click
- Updates can be scheduled for convenient times
- Automatic backup before updates
- Automatic rollback on failure
- Offline update capability

✅ **Performance Requirements**
- Update check completes in <5 seconds
- Update download <10 minutes (typical)
- System restart <2 minutes
- Rollback completes in <5 minutes

✅ **Security Requirements**
- All updates cryptographically signed
- HTTPS only for all communications
- No data leakage during updates
- Secure backup storage

✅ **Usability Requirements**
- Admin can update with <5 clicks
- Clear progress indication
- Understandable error messages
- Minimal disruption to school operations

---

## 15. Conclusion

The CLMS Auto-Update System provides a comprehensive solution for managing updates across multiple school deployments. The design balances:

- **Security**: Cryptographic signatures and HTTPS
- **Reliability**: Automatic backups and rollbacks
- **Usability**: Simple one-click operations
- **Flexibility**: Online and offline update modes
- **Control**: Admin-scheduled updates

The system is designed to minimize IT burden on schools while ensuring all installations stay up-to-date with the latest features and security patches.

---

**Document Version:** 1.0
**Last Updated:** November 4, 2025
**Next Review:** Upon Implementation Completion
