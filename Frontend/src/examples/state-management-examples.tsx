/**
 * Example: Using New State Management Hooks
 *
 * This file demonstrates how to use the new custom hooks to simplify components
 * and consolidate state management patterns across the CLMS application.
 */

// No React import needed - using JSX transform
import {
  useLoadingState,
  useModalState,
  useSearchFilters,
  useForm,
  useDataRefresh,
  useMultipleModals,
  useActionState,
} from '@/hooks';

// ============================================================================
// Example 1: Simplified Loading State Management
// ============================================================================

interface Student {
  id: string;
  name: string;
  gradeLevel: string;
  isActive: boolean;
}

function StudentListExample() {
  // Instead of multiple useState calls:
  // const [isLoading, setIsLoading] = useState(false);
  // const [error, setError] = useState<string | null>(null);
  // const [data, setData] = useState<Student[]>([]);

  // Use the new loading state hook:
  const [state, actions] = useLoadingState({
    data: [],
  });

  const fetchStudents = async () => {
    actions.start();
    try {
      const response = await fetch('/api/students');
      const students = await response.json();
      actions.finish(students);
    } catch (error) {
      actions.error('Failed to fetch students');
    }
  };

  return (
    <div>
      <button onClick={fetchStudents} disabled={state.isLoading}>
        {state.isLoading ? 'Loading...' : 'Fetch Students'}
      </button>

      {state.error && <div className="error">{state.error}</div>}
      {state.data && state.data.length > 0 && (
        <ul>
          {state.data.map((student: Student) => (
            <li key={student.id}>{student.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// Example 2: Modal State Management
// ============================================================================

function StudentModalExample() {
  // Instead of managing modal state manually:
  // const [isModalOpen, setIsModalOpen] = useState(false);
  // const [modalData, setModalData] = useState(null);

  // Use the new modal state hook:
  const [state, actions] = useModalState();

  const openStudentForm = (student?: Student) => {
    actions.open(student || null);
  };

  return (
    <>
      <button onClick={() => openStudentForm()}>Add New Student</button>

      <dialog open={state.isOpen}>
        <form onSubmit={() => actions.close()}>
          <h3>{state.data ? 'Edit Student' : 'Add New Student'}</h3>

          {state.data && (
            <input
              type="text"
              defaultValue={state.data.name}
              placeholder="Student Name"
            />
          )}

          <div>
            <button type="submit">Save</button>
            <button type="button" onClick={actions.close}>
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

// ============================================================================
// Example 3: _Search and Filter State Management
// ============================================================================

function StudentSearchExample() {
  // Instead of managing multiple filter states:
  // const [searchTerm, setSearchTerm] = useState('');
  // const [gradeFilter, setGradeFilter] = useState('');
  // const [statusFilter, setStatusFilter] = useState('');
  // const [sortBy, setSortBy] = useState('name');
  // const [sortOrder, setSortOrder] = useState('asc');

  // Use the new _search filters hook:
  const [state, actions, computed] = useSearchFilters({
    defaultFilters: { gradeLevel: '', isActive: '' },
    defaultSortBy: 'name',
    defaultSortOrder: 'asc',
  });

  const students: Student[] = [
    { id: '1', name: 'John Doe', gradeLevel: '10', isActive: true },
    { id: '2', name: 'Jane Smith', gradeLevel: '11', isActive: false },
    // ... more students
  ];

  // Apply filters to data
  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      !state.searchTerm ||
      student.name.toLowerCase().includes(state.searchTerm.toLowerCase());

    const matchesGrade =
      !state.filters.gradeLevel ||
      student.gradeLevel === state.filters.gradeLevel;

    const matchesStatus =
      !state.filters.isActive ||
      student.isActive.toString() === state.filters.isActive;

    return matchesSearch && matchesGrade && matchesStatus;
  });

  return (
    <div>
      {/* _Search Input */}
      <input
        type="text"
        placeholder="_Search students..."
        value={state.searchTerm}
        onChange={(e) => actions.setSearchTerm(e.target.value)}
      />

      {/* Filter Controls */}
      <select
        value={state.filters.gradeLevel || ''}
        onChange={(e) => actions.setFilter('gradeLevel', e.target.value)}
      >
        <option value="">All Grades</option>
        <option value="9">Grade 9</option>
        <option value="10">Grade 10</option>
        <option value="11">Grade 11</option>
      </select>

      <select
        value={state.filters.isActive || ''}
        onChange={(e) => actions.setFilter('isActive', e.target.value)}
      >
        <option value="">All Status</option>
        <option value="true">Active</option>
        <option value="false">Inactive</option>
      </select>

      {/* Sort Controls */}
      <button onClick={() => actions.setSortBy('name')}>
        Sort by Name {state.sortBy === 'name' && `(${state.sortOrder})`}
      </button>

      {/* Clear Filters */}
      {computed.hasActiveFilters && (
        <button onClick={actions.clearFilters}>Clear Filters</button>
      )}

      {/* Results */}
      <div>
        Found {filteredStudents.length} students
        {computed.hasActiveFilters && ' (filtered)'}
      </div>

      <ul>
        {filteredStudents.map((student) => (
          <li key={student.id}>
            {student.name} - Grade {student.gradeLevel} -
            {student.isActive ? 'Active' : 'Inactive'}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Example 4: Form State Management
// ============================================================================

function StudentFormExample() {
  // Instead of managing form state manually:
  // const [formData, setFormData] = useState({});
  // const [errors, setErrors] = useState({});
  // const [touched, setTouched] = useState({});
  // const [isSubmitting, setIsSubmitting] = useState(false);

  // Use the new form state hook:
  const [state, actions] = useForm({
    initialValues: {
      name: '',
      email: '',
      gradeLevel: '',
      isActive: true,
    },
    validationSchema: {
      name: { required: true, minLength: 2 },
      email: {
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
      gradeLevel: { required: true },
    },
    onSubmit: async (values) => {
      await submitStudent(values);
    },
  });

  const submitStudent = async (values: any) => {
    try {
      await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      // Handle success
    } catch (error) {
      // Handle error
    }
  };

  return (
    <form onSubmit={actions.submit}>
      <div>
        <input
          type="text"
          placeholder="Student Name"
          value={state.values.name}
          onChange={(e) => actions.setValue('name', e.target.value)}
          onBlur={() => actions.setTouched('name')}
        />
        {state.touched.name && state.errors.name && (
          <span className="error">{state.errors.name}</span>
        )}
      </div>

      <div>
        <input
          type="email"
          placeholder="Email"
          value={state.values.email}
          onChange={(e) => actions.setValue('email', e.target.value)}
          onBlur={() => actions.setTouched('email')}
        />
        {state.touched.email && state.errors.email && (
          <span className="error">{state.errors.email}</span>
        )}
      </div>

      <div>
        <select
          value={state.values.gradeLevel}
          onChange={(e) => actions.setValue('gradeLevel', e.target.value)}
          onBlur={() => actions.setTouched('gradeLevel')}
        >
          <option value="">Select Grade</option>
          <option value="9">Grade 9</option>
          <option value="10">Grade 10</option>
          <option value="11">Grade 11</option>
        </select>
        {state.touched.gradeLevel && state.errors.gradeLevel && (
          <span className="error">{state.errors.gradeLevel}</span>
        )}
      </div>

      <button
        type="submit"
        disabled={state.isSubmitting || Object.keys(state.errors).length > 0}
      >
        {state.isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}

// ============================================================================
// Example 5: Data Refresh and Polling
// ============================================================================

function DashboardExample() {
  // Instead of managing refresh intervals manually:
  // const [data, setData] = useState(null);
  // const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  // const [isRefreshing, setIsRefreshing] = useState(false);
  // const refreshInterval = useRef<NodeJS.Timeout>();

  // Use the new data refresh hook:
  const [state, actions] = useDataRefresh(
    () => fetch('/api/dashboard-metrics').then((res) => res.json()),
    {
      interval: 30000, // Refresh every 30 seconds
      onSuccess: (data) => {
        console.debug('Dashboard data refreshed:', data);
      },
      onError: (error) => {
        console.error('Dashboard refresh failed:', error);
      },
    }
  );

  return (
    <div>
      <div>
        <h2>Dashboard Metrics</h2>

        <div>
          <button onClick={actions.refresh} disabled={state.isRefreshing}>
            {state.isRefreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>

          {state.lastRefreshTime && (
            <span>
              Last updated: {state.lastRefreshTime.toLocaleTimeString()}
            </span>
          )}
        </div>

        {state.error && (
          <div className="error">
            Failed to refresh: {state.error.message}
            <button onClick={actions.clearError}>Dismiss</button>
          </div>
        )}

        {state.data && (
          <div>
            <h3>Today's Activity</h3>
            <p>Total Students: {state.data.totalStudents}</p>
            <p>Active Sessions: {state.data.activeSessions}</p>
            <p>Equipment in Use: {state.data.equipmentInUse}</p>
          </div>
        )}

        {!state.data && !state.error && <div>Loading dashboard...</div>}
      </div>
    </div>
  );
}

// ============================================================================
// Example 6: Multiple Modals with Consistent Patterns
// ============================================================================

function MultiModalExample() {
  // Use multiple modals with shared interface:
  const [states, actions] = useMultipleModals({
    addStudent: null,
    editStudent: null,
    deleteConfirm: null,
    importDialog: null,
  });

  return (
    <div>
      {/* Buttons to open different modals */}
      <button onClick={() => actions.addStudent.open()}>Add Student</button>

      <button
        onClick={() => actions.editStudent.open({ id: '1', name: 'John' })}
      >
        Edit Student
      </button>

      <button
        onClick={() =>
          actions.deleteConfirm.open({
            studentId: '1',
            studentName: 'John Doe',
          })
        }
      >
        Delete Student
      </button>

      {/* Student Form Modal */}
      <dialog open={states.addStudent.isOpen}>
        <form onSubmit={() => actions.addStudent.close()}>
          <h3>Add New Student</h3>
          {/* Form fields */}
          <button type="submit">Save</button>
          <button type="button" onClick={actions.addStudent.close}>
            Cancel
          </button>
        </form>
      </dialog>

      {/* Edit Student Modal */}
      <dialog open={states.editStudent.isOpen}>
        <form onSubmit={() => actions.editStudent.close()}>
          <h3>Edit Student</h3>
          {states.editStudent.data && (
            <input type="text" defaultValue={states.editStudent.data.name} />
          )}
          <button type="submit">Save</button>
          <button type="button" onClick={actions.editStudent.close}>
            Cancel
          </button>
        </form>
      </dialog>

      {/* Delete Confirmation Modal */}
      <dialog open={states.deleteConfirm.isOpen}>
        <form onSubmit={() => actions.deleteConfirm.close()}>
          <h3>Confirm Delete</h3>
          {states.deleteConfirm.data && (
            <p>
              Are you sure you want to delete{' '}
              <strong>{states.deleteConfirm.data.studentName}</strong>?
            </p>
          )}
          <button type="submit">Delete</button>
          <button type="button" onClick={actions.deleteConfirm.close}>
            Cancel
          </button>
        </form>
      </dialog>
    </div>
  );
}

// ============================================================================
// Example 7: Export and Action States
// ============================================================================

function ExportExample() {
  const [state, actions] = useActionState(
    async ({ format, data }) => {
      // Simulate export process
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, data }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      return blob;
    },
    {
      onSuccess: (blob) => {
        // Download the file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export.${state.data?.format || 'csv'}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      onError: (error) => {
        console.error('Export failed:', error);
      },
    }
  );

  const handleExport = (format: string) => {
    const data = getStudentData(); // Your data here
    actions.start({ format, data });
  };

  return (
    <div>
      <h3>Export Student Data</h3>

      <div>
        <button onClick={() => handleExport('csv')} disabled={state.isLoading}>
          Export as CSV
        </button>

        <button onClick={() => handleExport('xlsx')} disabled={state.isLoading}>
          Export as Excel
        </button>

        <button onClick={() => handleExport('pdf')} disabled={state.isLoading}>
          Export as PDF
        </button>
      </div>

      {state.isLoading && (
        <div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <p>Exporting... {Math.round(state.progress)}%</p>
          <button onClick={actions.cancel}>Cancel</button>
        </div>
      )}

      {state.error && (
        <div className="error">
          Export failed: {state.error}
          <button onClick={actions.reset}>Try Again</button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 8: Complete Component Using Multiple Hooks
// ============================================================================

function CompleteStudentManagerExample() {
  // Combine multiple hooks for a complete solution
  const [loadingState, loadingActions] = useLoadingState();
  const [modalState, modalActions] = useModalState();
  const [formState, formActions] = useForm({
    initialValues: {
      name: '',
      email: '',
      gradeLevel: '',
      isActive: true,
    },
    validationSchema: {
      name: { required: true, minLength: 2 },
      email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      gradeLevel: { required: true },
    },
  });

  const [refreshState, refreshActions] = useDataRefresh(
    () => fetch('/api/students').then((res) => res.json()),
    {
      interval: 60000, // Refresh every minute
      onSuccess: (students) => {
        loadingActions.finish(students);
      },
    }
  );

  const handleSubmit = async (values: any) => {
    try {
      await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      modalActions.close();
      refreshActions.refresh();
      formActions.resetForm();
    } catch (error) {
      formActions.setError('general', 'Failed to save student');
    }
  };

  return (
    <div>
      <div className="header">
        <h2>Student Management</h2>
        <div>
          <button
            onClick={refreshActions.refresh}
            disabled={refreshState.isRefreshing}
          >
            {refreshState.isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={() => modalActions.open()}>Add Student</button>
        </div>
      </div>

      {loadingState.error && (
        <div className="error">
          {loadingState.error}
          <button onClick={loadingActions.reset}>Dismiss</button>
        </div>
      )}

      {loadingState.isLoading ? (
        <div>Loading students...</div>
      ) : (
        <div className="student-list">{/* Render student list */}</div>
      )}

      <dialog open={modalState.isOpen}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(formState.values);
          }}
        >
          <h3>Add New Student</h3>

          {formState.errors.general && (
            <div className="error">{formState.errors.general}</div>
          )}

          <div>
            <input
              placeholder="Student Name"
              value={formState.values.name}
              onChange={(e) => formActions.setValue('name', e.target.value)}
              onBlur={() => formActions.setTouched('name')}
            />
            {formState.touched.name && formState.errors.name && (
              <span className="error">{formState.errors.name}</span>
            )}
          </div>

          <div>
            <input
              type="email"
              placeholder="Email"
              value={formState.values.email}
              onChange={(e) => formActions.setValue('email', e.target.value)}
              onBlur={() => formActions.setTouched('email')}
            />
            {formState.touched.email && formState.errors.email && (
              <span className="error">{formState.errors.email}</span>
            )}
          </div>

          <div>
            <select
              value={formState.values.gradeLevel}
              onChange={(e) =>
                formActions.setValue('gradeLevel', e.target.value)
              }
              onBlur={() => formActions.setTouched('gradeLevel')}
            >
              <option value="">Select Grade</option>
              <option value="9">Grade 9</option>
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
            </select>
            {formState.touched.gradeLevel && formState.errors.gradeLevel && (
              <span className="error">{formState.errors.gradeLevel}</span>
            )}
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={formState.values.isActive}
                onChange={(e) =>
                  formActions.setValue('isActive', e.target.checked)
                }
              />
              Active Student
            </label>
          </div>

          <div>
            <button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={modalActions.close}>
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

// Helper function
function getStudentData() {
  // Return student data for export
  return [];
}

export {
  StudentListExample,
  StudentModalExample,
  StudentSearchExample,
  StudentFormExample,
  DashboardExample,
  MultiModalExample,
  ExportExample,
  CompleteStudentManagerExample,
};
