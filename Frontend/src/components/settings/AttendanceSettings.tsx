import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export default function AttendanceSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Attendance Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Attendance settings configuration coming soon.
        </p>
      </CardContent>
    </Card>
  );
}
