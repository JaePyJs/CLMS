import React, { useState } from 'react';
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
import { utilitiesApi } from '@/lib/api';
import { toast } from 'sonner';

interface AddStudentDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function AddStudentDialog({ open: externalOpen, onOpenChange, trigger }: AddStudentDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await utilitiesApi.quickAddStudent(formData);
      if (response.success) {
        toast.success(`Student ${response.data.student.firstName} ${response.data.student.lastName} added successfully!`);
        setOpen(false);
        window.location.reload();
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
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
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
              <Label htmlFor="firstName" className="text-right">
                First Name
              </Label>
              <Input id="firstName" value={formData.firstName} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastName" className="text-right">
                Last Name
              </Label>
              <Input id="lastName" value={formData.lastName} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="grade" className="text-right">
                Grade
              </Label>
              <Input id="grade" value={formData.grade} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="section" className="text-right">
                Section
              </Label>
              <Input id="section" value={formData.section} onChange={handleInputChange} className="col-span-3" />
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
