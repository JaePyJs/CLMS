import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface Section {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export default function LibrarySectionsManager() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const loadSections = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Section[]>('/api/sections');
      if (res.success && res.data) setSections(res.data);
    } catch {
      toast.error('Failed to load sections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSections();
  }, []);

  const createSection = async () => {
    if (!code || !name) {
      toast.warning('Code and name are required');
      return;
    }
    try {
      const res = await apiClient.post<Section>('/api/sections', {
        code,
        name,
        description,
      });
      if (res.success && res.data) {
        toast.success('Section created');
        setCode('');
        setName('');
        setDescription('');
        loadSections();
      }
    } catch {
      toast.error('Failed to create section');
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const res = await apiClient.put<Section>(`/api/sections/${id}`, {
        is_active: !current,
      });
      if (res.success) {
        toast.success('Section updated');
        setSections((prev) =>
          prev.map((s) => (s.id === id ? { ...s, is_active: !current } : s))
        );
      }
    } catch {
      toast.error('Failed to update section');
    }
  };

  const removeSection = async (id: string) => {
    try {
      const res = await apiClient.delete(`/api/sections/${id}`);
      if (res.success) {
        toast.success('Section deleted');
        setSections((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      toast.error('Failed to delete section');
    }
  };

  const seedDefaults = async () => {
    try {
      const res = await apiClient.post('/api/sections/ensure-defaults');
      if (res.success) {
        toast.success('Defaults ensured');
        loadSections();
      }
    } catch {
      toast.error('Failed to seed defaults');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Library Sections</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button onClick={createSection}>Add</Button>
          <Button variant="outline" onClick={seedDefaults}>
            Seed Defaults
          </Button>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4}>Loading...</TableCell>
                </TableRow>
              ) : sections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>No sections</TableCell>
                </TableRow>
              ) : (
                sections.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.code}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{s.is_active ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => toggleActive(s.id, s.is_active)}
                      >
                        {s.is_active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeSection(s.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
