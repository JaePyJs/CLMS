import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import StudentManagement from './StudentManagement';
import {
  customRender,
  createTestQueryClient,
  createMockStudent,
  createMockStudentActivity,
  createMockApiResponse,
  createMockErrorResponse,
  mockAuthContext,
  flushPromises,
  measureRenderPerformance
} from '@/test/setup-comprehensive';
import * as apiHooks from '@/hooks/api-hooks';

// Mock API hooks
vi.mock('@/hooks/api-hooks');

const mockUseStudents = vi.mocked(apiHooks.useStudents);
const mockUseCreateStudent = vi.mocked(apiHooks.useCreateStudent);
const mockUseUpdateStudent = vi.mocked(apiHooks.useUpdateStudent);
const mockUseDeleteStudent = vi.mocked(apiHooks.useDeleteStudent);
const mockUseStudentActivities = vi.mocked(apiHooks.useStudentActivities);
const mockUseCreateStudentActivity = vi.mocked(apiHooks.useCreateStudentActivity);

describe('StudentManagement Component - Comprehensive Tests', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    user = userEvent.setup();

    // Reset mocks
    vi.clearAllMocks();

    // Default successful mocks
    mockUseStudents.mockReturnValue({
      data: {
        students: [],
        total: 0,
        pagination: { page: 1, limit: 10, total: 0, pages: 0 }
      },
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any);

    mockUseCreateStudent.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(createMockStudent()),
      isPending: false,
      error: null
    } as any);

    mockUseUpdateStudent.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(createMockStudent()),
      isPending: false,
      error: null
    } as any);

    mockUseDeleteStudent.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
      error: null
    } as any);

    mockUseStudentActivities.mockReturnValue({
      data: { activities: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } },
      isLoading: false,
      error: null
    } as any);

    mockUseCreateStudentActivity.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(createMockStudentActivity()),
      isPending: false,
      error: null
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render student management interface correctly', async () => {
      const { duration } = await measureRenderPerformance(() => {
        customRender(<StudentManagement />);
      });

      expect(duration).toBeLessThan(100); // Performance threshold

      // Check main sections are present
      expect(screen.getByRole('heading', { name: /student management/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add student/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/search students/i)).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should render loading state correctly', () => {
      mockUseStudents.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn()
      } as any);

      customRender(<StudentManagement />);

      expect(screen.getByText(/loading students/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render error state correctly', () => {
      mockUseStudents.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load students'),
        refetch: vi.fn()
      } as any);

      customRender(<StudentManagement />);

      expect(screen.getByText(/error loading students/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should render empty state when no students exist', () => {
      mockUseStudents.mockReturnValue({
        data: {
          students: [],
          total: 0,
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      customRender(<StudentManagement />);

      expect(screen.getByText(/no students found/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add first student/i })).toBeInTheDocument();
    });
  });

  describe('Student List Display', () => {
    it('should display students correctly when data is available', () => {
      const mockStudents = [
        createMockStudent({ id: '1', studentId: 'STU001', firstName: 'John', lastName: 'Doe' }),
        createMockStudent({ id: '2', studentId: 'STU002', firstName: 'Jane', lastName: 'Smith' }),
      ];

      mockUseStudents.mockReturnValue({
        data: {
          students: mockStudents,
          total: mockStudents.length,
          pagination: { page: 1, limit: 10, total: mockStudents.length, pages: 1 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      customRender(<StudentManagement />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('STU001')).toBeInTheDocument();
      expect(screen.getByText('STU002')).toBeInTheDocument();
    });

    it('should display pagination controls when multiple pages exist', () => {
      const mockStudents = Array.from({ length: 25 }, (_, i) =>
        createMockStudent({ id: `${i + 1}`, studentId: `STU${String(i + 1).padStart(3, '0')}` })
      );

      mockUseStudents.mockReturnValue({
        data: {
          students: mockStudents.slice(0, 10),
          total: 25,
          pagination: { page: 1, limit: 10, total: 25, pages: 3 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      customRender(<StudentManagement />);

      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
    });

    it('should handle grade category filtering', async () => {
      const mockStudents = [
        createMockStudent({ gradeCategory: 'GRADE_7' }),
        createMockStudent({ gradeCategory: 'GRADE_8' }),
      ];

      mockUseStudents.mockReturnValue({
        data: {
          students: mockStudents,
          total: mockStudents.length,
          pagination: { page: 1, limit: 10, total: mockStudents.length, pages: 1 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      customRender(<StudentManagement />);

      const gradeFilter = screen.getByRole('combobox', { name: /grade category/i });
      await user.selectOptions(gradeFilter, 'GRADE_7');

      // Should trigger refetch with filter
      await waitFor(() => {
        expect(mockUseStudents.mock.calls[0][0].gradeCategory).toBe('GRADE_7');
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter students by search term', async () => {
      const mockStudents = [
        createMockStudent({ firstName: 'John', lastName: 'Doe' }),
        createMockStudent({ firstName: 'Jane', lastName: 'Smith' }),
      ];

      mockUseStudents.mockReturnValue({
        data: {
          students: mockStudents,
          total: mockStudents.length,
          pagination: { page: 1, limit: 10, total: mockStudents.length, pages: 1 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      customRender(<StudentManagement />);

      const searchInput = screen.getByPlaceholderText(/search students/i);
      await user.type(searchInput, 'John');

      await waitFor(() => {
        expect(mockUseStudents.mock.calls[0][0].search).toBe('John');
      });
    });

    it('should clear search when clear button is clicked', async () => {
      customRender(<StudentManagement />);

      const searchInput = screen.getByPlaceholderText(/search students/i);
      await user.type(searchInput, 'John');

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });

    it('should debounce search input', async () => {
      customRender(<StudentManagement />);

      const searchInput = screen.getByPlaceholderText(/search students/i);

      // Type rapidly
      await user.type(searchInput, 'Joh');
      await user.keyboard('{backspace}');
      await user.type(searchInput, 'n');

      // Should only trigger search after debounce
      await waitFor(() => {
        expect(mockUseStudents).toHaveBeenCalledWith(expect.objectContaining({
          search: 'John'
        }));
      }, { timeout: 1000 });
    });
  });

  describe('Add Student Functionality', () => {
    it('should open add student dialog when button is clicked', async () => {
      customRender(<StudentManagement />);

      const addButton = screen.getByRole('button', { name: /add student/i });
      await user.click(addButton);

      expect(screen.getByRole('dialog', { name: /add new student/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /first name/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /last name/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /student id/i })).toBeInTheDocument();
    });

    it('should create new student when form is submitted with valid data', async () => {
      const mockStudent = createMockStudent({
        studentId: 'NEW001',
        firstName: 'New',
        lastName: 'Student'
      });

      mockUseCreateStudent.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue(mockStudent),
        isPending: false,
        error: null
      } as any);

      customRender(<StudentManagement />);

      // Open dialog
      const addButton = screen.getByRole('button', { name: /add student/i });
      await user.click(addButton);

      // Fill form
      const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
      const lastNameInput = screen.getByRole('textbox', { name: /last name/i });
      const studentIdInput = screen.getByRole('textbox', { name: /student id/i });
      const gradeSelect = screen.getByRole('combobox', { name: /grade category/i });

      await user.type(firstNameInput, 'New');
      await user.type(lastNameInput, 'Student');
      await user.type(studentIdInput, 'NEW001');
      await user.selectOptions(gradeSelect, 'GRADE_7');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create student/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUseCreateStudent.mock.results[0].value.mutateAsync).toHaveBeenCalledWith({
          firstName: 'New',
          lastName: 'Student',
          studentId: 'NEW001',
          gradeCategory: 'GRADE_7'
        });
      });

      // Dialog should close and success message shown
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /add new student/i })).not.toBeInTheDocument();
      });

      expect(screen.getByText(/student created successfully/i)).toBeInTheDocument();
    });

    it('should show validation errors for invalid form data', async () => {
      customRender(<StudentManagement />);

      const addButton = screen.getByRole('button', { name: /add student/i });
      await user.click(addButton);

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /create student/i });
      await user.click(submitButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/student id is required/i)).toBeInTheDocument();
      });

      // Submit button should be disabled
      expect(submitButton).toBeDisabled();
    });

    it('should handle duplicate student ID error', async () => {
      mockUseCreateStudent.mockReturnValue({
        mutateAsync: vi.fn().mockRejectedValue(new Error('Student ID already exists')),
        isPending: false,
        error: new Error('Student ID already exists')
      } as any);

      customRender(<StudentManagement />);

      const addButton = screen.getByRole('button', { name: /add student/i });
      await user.click(addButton);

      // Fill form with existing student ID
      const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
      const lastNameInput = screen.getByRole('textbox', { name: /last name/i });
      const studentIdInput = screen.getByRole('textbox', { name: /student id/i });

      await user.type(firstNameInput, 'John');
      await user.type(lastNameInput, 'Doe');
      await user.type(studentIdInput, 'EXISTING');

      const submitButton = screen.getByRole('button', { name: /create student/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/student id already exists/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edit Student Functionality', () => {
    it('should open edit dialog when edit button is clicked', async () => {
      const mockStudents = [createMockStudent({ id: '1', firstName: 'John', lastName: 'Doe' })];

      mockUseStudents.mockReturnValue({
        data: {
          students: mockStudents,
          total: 1,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      customRender(<StudentManagement />);

      const editButton = screen.getByRole('button', { name: /edit john doe/i });
      await user.click(editButton);

      expect(screen.getByRole('dialog', { name: /edit student/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    });

    it('should update student when edit form is submitted', async () => {
      const mockStudent = createMockStudent({ id: '1', firstName: 'John', lastName: 'Doe' });
      const updatedStudent = { ...mockStudent, firstName: 'Johnathan' };

      mockUseStudents.mockReturnValue({
        data: {
          students: [mockStudent],
          total: 1,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      mockUseUpdateStudent.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue(updatedStudent),
        isPending: false,
        error: null
      } as any);

      customRender(<StudentManagement />);

      const editButton = screen.getByRole('button', { name: /edit john doe/i });
      await user.click(editButton);

      // Update first name
      const firstNameInput = screen.getByDisplayValue('John');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Johnathan');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /update student/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUseUpdateStudent.mock.results[0].value.mutateAsync).toHaveBeenCalledWith({
          id: '1',
          firstName: 'Johnathan'
        });
      });

      expect(screen.getByText(/student updated successfully/i)).toBeInTheDocument();
    });
  });

  describe('Delete Student Functionality', () => {
    it('should show confirmation dialog when delete button is clicked', async () => {
      const mockStudents = [createMockStudent({ id: '1', firstName: 'John', lastName: 'Doe' })];

      mockUseStudents.mockReturnValue({
        data: {
          students: mockStudents,
          total: 1,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      customRender(<StudentManagement />);

      const deleteButton = screen.getByRole('button', { name: /delete john doe/i });
      await user.click(deleteButton);

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to delete john doe\?/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should delete student when confirmed', async () => {
      const mockStudents = [createMockStudent({ id: '1', firstName: 'John', lastName: 'Doe' })];

      mockUseStudents.mockReturnValue({
        data: {
          students: mockStudents,
          total: 1,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      mockUseDeleteStudent.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue(undefined),
        isPending: false,
        error: null
      } as any);

      customRender(<StudentManagement />);

      const deleteButton = screen.getByRole('button', { name: /delete john doe/i });
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockUseDeleteStudent.mock.results[0].value.mutateAsync).toHaveBeenCalledWith('1');
      });

      expect(screen.getByText(/student deleted successfully/i)).toBeInTheDocument();
    });

    it('should cancel delete when cancel button is clicked', async () => {
      const mockStudents = [createMockStudent({ id: '1', firstName: 'John', lastName: 'Doe' })];

      mockUseStudents.mockReturnValue({
        data: {
          students: mockStudents,
          total: 1,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      customRender(<StudentManagement />);

      const deleteButton = screen.getByRole('button', { name: /delete john doe/i });
      await user.click(deleteButton);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Dialog should close without deletion
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(mockUseDeleteStudent.mock.results[0].value.mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('Activity Management', () => {
    it('should show student activities when activities tab is selected', async () => {
      const mockActivities = [
        createMockStudentActivity({ activityType: 'CHECK_IN', status: 'ACTIVE' }),
        createMockStudentActivity({ activityType: 'CHECK_OUT', status: 'COMPLETED' }),
      ];

      mockUseStudentActivities.mockReturnValue({
        data: {
          activities: mockActivities,
          total: mockActivities.length,
          pagination: { page: 1, limit: 10, total: mockActivities.length, pages: 1 }
        },
        isLoading: false,
        error: null
      } as any);

      customRender(<StudentManagement />);

      const activitiesTab = screen.getByRole('tab', { name: /activities/i });
      await user.click(activitiesTab);

      expect(screen.getByText('CHECK_IN')).toBeInTheDocument();
      expect(screen.getByText('CHECK_OUT')).toBeInTheDocument();
    });

    it('should create new activity when check-in button is clicked', async () => {
      const mockStudents = [createMockStudent({ id: '1', firstName: 'John', lastName: 'Doe' })];
      const mockActivity = createMockStudentActivity({ studentId: '1', activityType: 'CHECK_IN' });

      mockUseStudents.mockReturnValue({
        data: {
          students: mockStudents,
          total: 1,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      mockUseCreateStudentActivity.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue(mockActivity),
        isPending: false,
        error: null
      } as any);

      customRender(<StudentManagement />);

      const checkInButton = screen.getByRole('button', { name: /check in john doe/i });
      await user.click(checkInButton);

      await waitFor(() => {
        expect(mockUseCreateStudentActivity.mock.results[0].value.mutateAsync).toHaveBeenCalledWith({
          studentId: '1',
          activityType: 'CHECK_IN'
        });
      });

      expect(screen.getByText(/check-in successful/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display network error message when API fails', () => {
      mockUseStudents.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network Error'),
        refetch: vi.fn()
      } as any);

      customRender(<StudentManagement />);

      expect(screen.getByText(/network error/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should retry loading when retry button is clicked', async () => {
      const mockRefetch = vi.fn();
      mockUseStudents.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network Error'),
        refetch: mockRefetch
      } as any);

      customRender(<StudentManagement />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should handle form submission errors gracefully', async () => {
      mockUseCreateStudent.mockReturnValue({
        mutateAsync: vi.fn().mockRejectedValue(new Error('Server error')),
        isPending: false,
        error: new Error('Server error')
      } as any);

      customRender(<StudentManagement />);

      const addButton = screen.getByRole('button', { name: /add student/i });
      await user.click(addButton);

      // Fill form with valid data
      const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
      const lastNameInput = screen.getByRole('textbox', { name: /last name/i });
      const studentIdInput = screen.getByRole('textbox', { name: /student id/i });

      await user.type(firstNameInput, 'John');
      await user.type(lastNameInput, 'Doe');
      await user.type(studentIdInput, 'NEW001');

      const submitButton = screen.getByRole('button', { name: /create student/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Tests', () => {
    it('should render large student lists efficiently', async () => {
      const largeStudentList = Array.from({ length: 1000 }, (_, i) =>
        createMockStudent({
          id: `${i + 1}`,
          studentId: `STU${String(i + 1).padStart(4, '0')}`,
          firstName: `Student ${i + 1}`,
          lastName: `Test`
        })
      );

      mockUseStudents.mockReturnValue({
        data: {
          students: largeStudentList.slice(0, 50), // First page
          total: 1000,
          pagination: { page: 1, limit: 50, total: 1000, pages: 20 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      const { duration } = await measureRenderPerformance(() => {
        customRender(<StudentManagement />);
      });

      expect(duration).toBeLessThan(200); // Should handle large lists efficiently
      expect(screen.getByText(/showing 1-50 of 1000 students/i)).toBeInTheDocument();
    });

    it('should handle rapid search input without performance issues', async () => {
      customRender(<StudentManagement />);

      const searchInput = screen.getByPlaceholderText(/search students/i);

      const { duration } = await measureRenderPerformance(async () => {
        // Simulate rapid typing
        for (let i = 0; i < 10; i++) {
          await user.type(searchInput, 'a');
          await flushPromises();
        }
      }, 'Rapid search input');

      expect(duration).toBeLessThan(500); // Should handle rapid input efficiently
    });
  });

  describe('Accessibility Tests', () => {
    it('should have proper ARIA labels and roles', () => {
      const mockStudents = [createMockStudent({ id: '1', firstName: 'John', lastName: 'Doe' })];

      mockUseStudents.mockReturnValue({
        data: {
          students: mockStudents,
          total: 1,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      customRender(<StudentManagement />);

      // Check main landmarks
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /student list/i })).toBeInTheDocument();

      // Check form elements have proper labels
      const searchInput = screen.getByRole('textbox', { name: /search students/i });
      expect(searchInput).toHaveAttribute('aria-label');
      expect(searchInput).toHaveAttribute('aria-describedby');
    });

    it('should support keyboard navigation', async () => {
      const mockStudents = [createMockStudent({ id: '1', firstName: 'John', lastName: 'Doe' })];

      mockUseStudents.mockReturnValue({
        data: {
          students: mockStudents,
          total: 1,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      customRender(<StudentManagement />);

      // Tab navigation
      await user.tab();
      expect(screen.getByRole('textbox', { name: /search students/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('combobox', { name: /grade category/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /add student/i })).toHaveFocus();

      // Enter key on add button
      await user.keyboard('{Enter}');
      expect(screen.getByRole('dialog', { name: /add new student/i })).toBeInTheDocument();
    });

    it('should announce important changes to screen readers', async () => {
      const mockStudents = [createMockStudent({ id: '1', firstName: 'John', lastName: 'Doe' })];

      mockUseStudents.mockReturnValue({
        data: {
          students: mockStudents,
          total: 1,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      mockUseDeleteStudent.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue(undefined),
        isPending: false,
        error: null
      } as any);

      customRender(<StudentManagement />);

      const deleteButton = screen.getByRole('button', { name: /delete john doe/i });
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      // Check for success announcement
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent(/student deleted successfully/i);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete student lifecycle workflow', async () => {
      // Create student
      const mockStudent = createMockStudent({
        studentId: 'WORKFLOW001',
        firstName: 'Workflow',
        lastName: 'Test'
      });

      mockUseCreateStudent.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue(mockStudent),
        isPending: false,
        error: null
      } as any);

      // Update student
      const updatedStudent = { ...mockStudent, firstName: 'Workflow Updated' };
      mockUseUpdateStudent.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue(updatedStudent),
        isPending: false,
        error: null
      } as any);

      // Delete student
      mockUseDeleteStudent.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue(undefined),
        isPending: false,
        error: null
      } as any);

      customRender(<StudentManagement />);

      // 1. Add student
      const addButton = screen.getByRole('button', { name: /add student/i });
      await user.click(addButton);

      const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
      const lastNameInput = screen.getByRole('textbox', { name: /last name/i });
      const studentIdInput = screen.getByRole('textbox', { name: /student id/i });

      await user.type(firstNameInput, 'Workflow');
      await user.type(lastNameInput, 'Test');
      await user.type(studentIdInput, 'WORKFLOW001');

      const submitButton = screen.getByRole('button', { name: /create student/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUseCreateStudent.mock.results[0].value.mutateAsync).toHaveBeenCalled();
        expect(screen.getByText(/student created successfully/i)).toBeInTheDocument();
      });

      // 2. Update student
      // Mock updated student list
      mockUseStudents.mockReturnValue({
        data: {
          students: [mockStudent],
          total: 1,
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
      } as any);

      await flushPromises();

      const editButton = screen.getByRole('button', { name: /edit workflow test/i });
      await user.click(editButton);

      const editFirstNameInput = screen.getByDisplayValue('Workflow');
      await user.clear(editFirstNameInput);
      await user.type(editFirstNameInput, 'Workflow Updated');

      const updateButton = screen.getByRole('button', { name: /update student/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockUseUpdateStudent.mock.results[0].value.mutateAsync).toHaveBeenCalledWith({
          id: mockStudent.id,
          firstName: 'Workflow Updated'
        });
        expect(screen.getByText(/student updated successfully/i)).toBeInTheDocument();
      });

      // 3. Delete student
      const deleteButton = screen.getByRole('button', { name: /delete workflow test/i });
      await user.click(deleteButton);

      const confirmDeleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmDeleteButton);

      await waitFor(() => {
        expect(mockUseDeleteStudent.mock.results[0].value.mutateAsync).toHaveBeenCalledWith(mockStudent.id);
        expect(screen.getByText(/student deleted successfully/i)).toBeInTheDocument();
      });
    });
  });
});