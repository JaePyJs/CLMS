import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AutomationDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Automation
          </h2>
          <p className="text-muted-foreground">
            Monitor and control automated tasks
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
          <CardDescription>Status overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Jobs content</div>
        </CardContent>
      </Card>
    </div>
  );
}
