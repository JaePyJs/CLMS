import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { toUserMessage } from '@/utils/error-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface Section {
  id: string;
  code: string;
  name: string;
}

export default function EnhancedSelfService() {
  const [sections, setSections] = useState<Section[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [scanData, setScanData] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadSections = async () => {
    try {
      const res = await apiClient.get<Section[]>('/api/sections?active=true');
      if (res.success && res.data) {
        setSections(res.data);
      } else {
        setSections([]);
        if (!import.meta.env.DEV)
          toast.error(res.error || 'Failed to load sections');
      }
    } catch (e) {
      setSections([]);
      toast.error(toUserMessage(e));
    }
  };

  useEffect(() => {
    loadSections();
    inputRef.current?.focus();
  }, []);

  const toggle = (code: string) => {
    setSelected((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const submit = async () => {
    const chosen = Object.keys(selected).filter((k) => selected[k]);
    if (!scanData || chosen.length === 0) {
      toast.warning('Scan data and at least one section required');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post(
        '/api/self-service/check-in-with-sections',
        { scanData, sectionCodes: chosen }
      );
      if ((res as any).success) {
        toast.success('Checked in');
        setScanData('');
        setSelected({});
        inputRef.current?.focus();
      } else {
        toast.error((res as any).error || 'Failed to check in');
      }
    } catch (e) {
      toast.error(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enhanced Self-Service</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            ref={inputRef}
            placeholder="Scan ID"
            value={scanData}
            onChange={(e) => setScanData(e.target.value)}
          />
          <Button onClick={submit} disabled={loading}>
            {loading ? 'Processing...' : 'Check In'}
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          {sections.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 border rounded-md p-2"
            >
              <Checkbox
                checked={Boolean(selected[s.code])}
                onCheckedChange={() => toggle(s.code)}
              />
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
