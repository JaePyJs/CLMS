import {
  HelpCircle,
  Keyboard,
  Mail,
  Bug,
  MessageSquare,
  Book,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';

export const HelpSupportModal: React.FC = () => {
  const [view, setView] = useState<
    'tabs' | 'guide-scanning' | 'guide-printing'
  >('tabs');

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const bugReport = {
      category: formData.get('category'),
      severity: formData.get('severity'),
      description: formData.get('description'),
      steps: formData.get('steps'),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };
    // Log to console for now - can be collected from browser dev tools
    console.info('[Bug Report]', bugReport);
    toast.info(
      'Bug report logged. Please contact IT support directly for urgent issues.',
      { duration: 5000 }
    );
  };

  // Guide View Component
  if (view === 'guide-scanning') {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
            title="Help & Support"
            data-testid="help-modal-trigger"
          >
            <HelpCircle className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="p-6 pb-2 border-b flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('tabs')}
                className="gap-1 pl-0 hover:bg-transparent"
              >
                <span className="text-muted-foreground mr-1">←</span> Back
              </Button>
              <div className="h-4 w-px bg-border mx-2" />
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <ScanIcon className="w-5 h-5 text-purple-500" />
                Scanning Guide
              </h2>
            </div>
          </div>
          <ScrollArea className="flex-1 p-8">
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">
                  Mastering the Scan Station
                </h3>
                <p className="text-muted-foreground text-lg">
                  The Scan Station is the heart of daily library operations.
                  This guide covers everything from checking out books to
                  managing daily attendance.
                </p>
              </div>

              <div className="grid gap-6">
                <section className="space-y-3">
                  <h4 className="text-xl font-semibold text-foreground">
                    1. Quick Check-In/Out
                  </h4>
                  <p className="text-muted-foreground">
                    The system automatically detects whether a scan is for a{' '}
                    <strong>Student ID</strong> or a{' '}
                    <strong>Book Barcode</strong>.
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                    <li>Scan a Student ID to active their session.</li>
                    <li>
                      Subsequently scanning a book will assign it to that
                      student (Checkout).
                    </li>
                    <li>
                      Scanning a book that is already checked out will trigger a
                      Return.
                    </li>
                  </ul>
                </section>

                <section className="space-y-3">
                  <h4 className="text-xl font-semibold text-foreground">
                    2. Manual Entry
                  </h4>
                  <p className="text-muted-foreground">
                    If a barcode is damaged or missing, you can manually type
                    the ID into the input field and press <strong>Enter</strong>
                    .
                  </p>
                  <div className="bg-muted p-4 rounded-md border text-sm">
                    <strong>Tip:</strong> Use the global search{' '}
                    <kbd className="bg-background px-1 border rounded text-xs">
                      Ctrl+K
                    </kbd>{' '}
                    to find a student's ID number if they forgot their card.
                  </div>
                </section>

                <section className="space-y-3">
                  <h4 className="text-xl font-semibold text-foreground">
                    3. Troubleshooting Scans
                  </h4>
                  <p className="text-muted-foreground">
                    Common issues and fixes:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                    <li>
                      <strong>"Student Not Found":</strong> Verify the ID is
                      active in the Students tab.
                    </li>
                    <li>
                      <strong>"Book Already Checked Out":</strong> The book must
                      be returned before it can be borrowed again.
                    </li>
                    <li>
                      <strong>Scanner not typing:</strong> Ensure the input
                      field is focused (clicked) before scanning.
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  if (view === 'guide-printing') {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
            title="Help & Support"
            data-testid="help-modal-trigger"
          >
            <HelpCircle className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="p-6 pb-2 border-b flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('tabs')}
                className="gap-1 pl-0 hover:bg-transparent"
              >
                <span className="text-muted-foreground mr-1">←</span> Back
              </Button>
              <div className="h-4 w-px bg-border mx-2" />
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <PrinterIcon className="w-5 h-5 text-blue-500" />
                Printing Services Guide
              </h2>
            </div>
          </div>
          <ScrollArea className="flex-1 p-8">
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">
                  Managing Student Printing
                </h3>
                <p className="text-muted-foreground text-lg">
                  Track print jobs, manage quotas, and handle payments for
                  printing services directly from the dashboard.
                </p>
              </div>

              <div className="grid gap-6">
                <section className="space-y-3">
                  <h4 className="text-xl font-semibold text-foreground">
                    1. Recording a Print Job
                  </h4>
                  <p className="text-muted-foreground">
                    Navigate to the <strong>Printing</strong> tab or use the
                    quick action menu.
                  </p>
                  <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                    <li>Select the student requesting the print.</li>
                    <li>Enter the number of pages (Black & White or Color).</li>
                    <li>
                      The system calculates the total cost based on settings.
                    </li>
                    <li>
                      Click <strong>Record Job</strong>.
                    </li>
                  </ol>
                </section>

                <section className="space-y-3">
                  <h4 className="text-xl font-semibold text-foreground">
                    2. Payment Status
                  </h4>
                  <p className="text-muted-foreground">
                    Print jobs are recorded as <strong>Unpaid</strong> by
                    default. To mark a job as paid:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                    <li>Go to the Printing History table.</li>
                    <li>Locate the specific job.</li>
                    <li>
                      Toggle the status from{' '}
                      <span className="text-red-500">Unpaid</span> to{' '}
                      <span className="text-green-500">Paid</span>.
                    </li>
                  </ul>
                </section>

                <section className="space-y-3">
                  <h4 className="text-xl font-semibold text-foreground">
                    3. Updating Prices
                  </h4>
                  <p className="text-muted-foreground">
                    You can change the cost per page in{' '}
                    <strong>Settings Admin &gt; Pricing</strong>. These changes
                    apply to all future print jobs.
                  </p>
                </section>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
          title="Help & Support"
          data-testid="help-modal-trigger"
        >
          <HelpCircle className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="p-6 pb-2 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <HelpCircle className="w-5 h-5 text-primary" />
              Help & Support Center
            </DialogTitle>
            <DialogDescription>
              Guides, shortcuts, and support for the Library Management System.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs
          defaultValue="shortcuts"
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-6 pt-2 border-b bg-muted/30">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger
                value="shortcuts"
                className="flex items-center gap-2"
              >
                <Keyboard className="w-4 h-4" />
                Keyboard Shortcuts
              </TabsTrigger>
              <TabsTrigger value="guides" className="flex items-center gap-2">
                <Book className="w-4 h-4" />
                User Guides
              </TabsTrigger>
              <TabsTrigger value="report" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Report Issue
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-6">
            <TabsContent value="shortcuts" className="mt-0 space-y-6">
              <div className="grid gap-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <h3 className="font-semibold text-lg">Global Navigation</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ShortcutItem
                    keys={['Ctrl', 'K']}
                    description="Open Global Search"
                  />
                  <ShortcutItem
                    keys={['Esc']}
                    description="Close Modals / Search"
                  />
                  <ShortcutItem
                    keys={['Alt', 'D']}
                    description="Go to Dashboard"
                  />
                  <ShortcutItem
                    keys={['Alt', 'S']}
                    description="Go to Scan Station"
                  />
                </div>

                <div className="flex items-center justify-between pb-2 border-b mt-4">
                  <h3 className="font-semibold text-lg">Scan Station</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ShortcutItem keys={['Enter']} description="Confirm Scan" />
                  <ShortcutItem
                    keys={['Ctrl', 'Z']}
                    description="Undo Last Scan"
                  />
                  <ShortcutItem keys={['F8']} description="Toggle Quick Mode" />
                </div>

                <div className="flex items-center justify-between pb-2 border-b mt-4">
                  <h3 className="font-semibold text-lg">Data Tables</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ShortcutItem keys={['Shift', 'N']} description="Next Page" />
                  <ShortcutItem
                    keys={['Shift', 'P']}
                    description="Previous Page"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="guides" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ScanIcon className="w-4 h-4 text-purple-500" />
                    Scanning Books & IDs
                  </CardTitle>
                  <CardDescription>
                    Learn how to efficiently check in/out students and
                    materials.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                    <li>Ensure the cursor is in the active scan field.</li>
                    <li>Listen for the "Success" beep to confirm a scan.</li>
                    <li>
                      For students without IDs, use the "Manual Entry" option.
                    </li>
                  </ul>
                  <Button
                    variant="link"
                    className="px-0 h-auto mt-2 text-primary"
                    onClick={() => setView('guide-scanning')}
                  >
                    Read full guide →
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <PrinterIcon className="w-4 h-4 text-blue-500" />
                    Managing Print Jobs
                  </CardTitle>
                  <CardDescription>
                    Configuration and tracking for student printing services.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                    <li>Set default pricing in "Settings" before starting.</li>
                    <li>Track paid/unpaid status in the history tab.</li>
                  </ul>
                  <Button
                    variant="link"
                    className="px-0 h-auto mt-2 text-primary"
                    onClick={() => setView('guide-printing')}
                  >
                    Read full guide →
                  </Button>
                </CardContent>
              </Card>

              <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between mt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">Need Direct Support?</h4>
                    <p className="text-sm text-muted-foreground">
                      Contact the IT Admin department.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => window.open('mailto:support@school.edu')}
                >
                  Contact Support
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="report" className="mt-0">
              <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>Report a Bug</CardTitle>
                  <CardDescription>
                    Found something broken? Let us know so we can fix it.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <form onSubmit={handleReportSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Issue Type
                        </label>
                        <select
                          className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background"
                          required
                        >
                          <option value="bug">Bug / Error</option>
                          <option value="ui">UI / Design Issue</option>
                          <option value="feature">Feature Request</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Severity</label>
                        <select
                          className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background"
                          required
                        >
                          <option value="low">Low - Annoyance</option>
                          <option value="medium">
                            Medium - Functional Issue
                          </option>
                          <option value="high">High - Critical Blocker</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subject</label>
                      <Input
                        placeholder="Brief summary of the issue..."
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        placeholder="Steps to reproduce, expected behavior, etc."
                        className="min-h-[120px]"
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="submit" className="gap-2">
                        <Bug className="w-4 h-4" />
                        Submit Report
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// Helper components for icons
const ShortcutItem = ({
  keys,
  description,
}: {
  keys: string[];
  description: string;
}) => (
  <div className="flex items-center justify-between bg-muted/40 p-3 rounded-lg border border-border/50">
    <span className="text-sm font-medium">{description}</span>
    <div className="flex gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="px-2 py-0.5 text-xs font-semibold bg-background border border-border rounded shadow-sm text-foreground min-w-[1.5rem] text-center"
        >
          {k}
        </kbd>
      ))}
    </div>
  </div>
);

const ScanIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <rect width="10" height="6" x="7" y="9" rx="2" />
  </svg>
);

const PrinterIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 14h12v8H6z" />
  </svg>
);
