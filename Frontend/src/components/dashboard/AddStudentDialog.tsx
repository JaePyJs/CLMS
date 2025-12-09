import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { studentsApi } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface AddStudentDialogProps {
  open?: boolean;
  onOpenChange?: (_open: boolean) => void;
  trigger?: React.ReactNode;
}

export function AddStudentDialog({
  open: externalOpen,
  onOpenChange,
  trigger,
}: AddStudentDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    studentId: '',
    firstName: '',
    lastName: '',
    grade: '',
    section: '',
  });

  // Use external open state if provided, otherwise use internal
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const getGradeCategory = (grade: string): string => {
    const g = grade.toLowerCase();
    if (
      g.includes('k') ||
      g.includes('grade 1') ||
      g.includes('grade 2') ||
      g.includes('grade 3')
    )
      return 'primary';
    if (g.includes('grade 4') || g.includes('grade 5') || g.includes('grade 6'))
      return 'gradeSchool';
    if (g.includes('grade 7') || g.includes('grade 8') || g.includes('grade 9'))
      return 'juniorHigh';
    if (
      g.includes('grade 10') ||
      g.includes('grade 11') ||
      g.includes('grade 12')
    )
      return 'seniorHigh';
    return 'unknown';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (!formData.firstName || !formData.lastName || !formData.grade) {
        toast.error('Please fill in required fields');
        setIsSubmitting(false);
        return;
      }
      const payload = {
        student_id: formData.studentId || `TMP-${Date.now()}`,
        first_name: formData.firstName,
        last_name: formData.lastName,
        grade_level: Number(formData.grade.match(/\d+/)?.[0] || 0),
        grade_category: getGradeCategory(formData.grade),
        section: formData.section || undefined,
      };
      const response = await studentsApi.createStudent(payload);
      if (response.success) {
        toast.success('Student added successfully');
        setOpen(false);
        setFormData({
          studentId: '',
          firstName: '',
          lastName: '',
          grade: '',
          section: '',
        });
      } else {
        toast.error(response.error || 'Failed to add student');
      }
    } catch (error) {
      console.error('Error adding student:', error);
      toast.error('Failed to add student. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {!trigger && (
        <DialogTrigger asChild>
          <Button>Add Student</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>
            Enter the details of the new student below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="studentId" className="text-right">
                Student ID
              </Label>
              <Input
                id="studentId"
                value={formData.studentId}
                onChange={handleInputChange}
                placeholder="S-0001"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstName" className="text-right">
                First Name
              </Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastName" className="text-right">
                Last Name
              </Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="grade" className="text-right">
                Grade
              </Label>
              <Select
                value={formData.grade}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, grade: value }))
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Grade 1">Grade 1</SelectItem>
                  <SelectItem value="Grade 2">Grade 2</SelectItem>
                  <SelectItem value="Grade 3">Grade 3</SelectItem>
                  <SelectItem value="Grade 4">Grade 4</SelectItem>
                  <SelectItem value="Grade 5">Grade 5</SelectItem>
                  <SelectItem value="Grade 6">Grade 6</SelectItem>
                  <SelectItem value="Grade 7">Grade 7</SelectItem>
                  <SelectItem value="Grade 8">Grade 8</SelectItem>
                  <SelectItem value="Grade 9">Grade 9</SelectItem>
                  <SelectItem value="Grade 10">Grade 10</SelectItem>
                  <SelectItem value="Grade 11">Grade 11</SelectItem>
                  <SelectItem value="Grade 12">Grade 12</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="section" className="text-right">
                Section
              </Label>
              <Input
                id="section"
                value={formData.section}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Student'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
