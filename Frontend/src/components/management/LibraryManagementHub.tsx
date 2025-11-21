import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { toUserMessage } from '@/utils/error-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LibrarySectionsManager from './LibrarySectionsManager';
import BorrowingPolicyManager from './BorrowingPolicyManager';
import FineManagement from './FineManagement';
import PrintingTracker from './PrintingTracker';
import AnnouncementManager from './AnnouncementManager';
import EnhancedSelfService from './EnhancedSelfService';
import MonthlyReportGenerator from './MonthlyReportGenerator';

export default function LibraryManagementHub() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div>Loading management...</div>}>
        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Card>
              <CardHeader>
                <CardTitle>Self Service</CardTitle>
              </CardHeader>
              <CardContent>{toUserMessage(error)}</CardContent>
            </Card>
          )}
        >
          <Card>
            <CardHeader>
              <CardTitle>Self Service</CardTitle>
            </CardHeader>
            <CardContent>
              <EnhancedSelfService />
            </CardContent>
          </Card>
        </ErrorBoundary>

        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Card>
              <CardHeader>
                <CardTitle>Library Sections</CardTitle>
              </CardHeader>
              <CardContent>{toUserMessage(error)}</CardContent>
            </Card>
          )}
        >
          <LibrarySectionsManager />
        </ErrorBoundary>

        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Card>
              <CardHeader>
                <CardTitle>Borrowing Policies</CardTitle>
              </CardHeader>
              <CardContent>{toUserMessage(error)}</CardContent>
            </Card>
          )}
        >
          <BorrowingPolicyManager />
        </ErrorBoundary>

        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Card>
              <CardHeader>
                <CardTitle>Fines & Overdue</CardTitle>
              </CardHeader>
              <CardContent>{toUserMessage(error)}</CardContent>
            </Card>
          )}
        >
          <FineManagement />
        </ErrorBoundary>

        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Card>
              <CardHeader>
                <CardTitle>Printing Service Tracker</CardTitle>
              </CardHeader>
              <CardContent>{toUserMessage(error)}</CardContent>
            </Card>
          )}
        >
          <PrintingTracker />
        </ErrorBoundary>

        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Card>
              <CardHeader>
                <CardTitle>Announcements</CardTitle>
              </CardHeader>
              <CardContent>{toUserMessage(error)}</CardContent>
            </Card>
          )}
        >
          <AnnouncementManager />
        </ErrorBoundary>

        <ErrorBoundary
          fallbackRender={({ error }) => (
            <Card>
              <CardHeader>
                <CardTitle>Monthly Report Generator</CardTitle>
              </CardHeader>
              <CardContent>{toUserMessage(error)}</CardContent>
            </Card>
          )}
        >
          <MonthlyReportGenerator />
        </ErrorBoundary>
      </Suspense>
    </div>
  );
}
