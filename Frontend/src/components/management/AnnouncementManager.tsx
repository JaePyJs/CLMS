import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { toUserMessage } from '@/utils/error-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface Announcement {
  id: string;
  title: string;
  content: string;
  start_time: string;
  end_time?: string;
  is_active: boolean;
  priority: string;
}

export default function AnnouncementManager() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const loadAll = async () => {
    try {
      const res = await apiClient.get<Announcement[]>('/api/announcements');
      if (res.success && res.data) {
        setItems(res.data);
      } else {
        setItems([]);
        if (!import.meta.env.DEV) toast.error(res.error || 'Failed to load announcements');
      }
    } catch (e) {
      setItems([]);
      toast.error(toUserMessage(e));
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const create = async () => {
    if (!title || !content || !start) {
      toast.warning('Title, content and start time are required');
      return;
    }
    try {
      const res = await apiClient.post<Announcement>('/api/announcements', {
        title,
        content,
        start_time: start,
        end_time: end || undefined,
        is_active: true,
      });
      if (res.success && res.data) {
        toast.success('Announcement created');
        setTitle('');
        setContent('');
        setStart('');
        setEnd('');
        loadAll();
      } else {
        toast.error(res.error || 'Failed to create announcement');
      }
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await apiClient.delete(`/api/announcements/${id}`);
      if (res.success) {
        toast.success('Announcement deleted');
        setItems((prev) => prev.filter((a) => a.id !== id));
      } else {
        toast.error(res.error || 'Failed to delete announcement');
      }
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Announcements</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          <Textarea placeholder="Content" value={content} onChange={(e) => setContent(e.target.value)} />
          <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          <div className="col-span-2">
            <Button onClick={create}>Add</Button>
          </div>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.title}</TableCell>
                  <TableCell>{new Date(a.start_time).toLocaleString()}</TableCell>
                  <TableCell>{a.end_time ? new Date(a.end_time).toLocaleString() : '-'}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="destructive" onClick={() => remove(a.id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}