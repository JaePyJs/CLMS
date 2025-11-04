import { useState, useCallback } from 'react';

interface ModalState {
  isOpen: boolean;
  data: any;
  isClosing: boolean;
}

interface ModalActions {
  open: (data?: any) => void;
  close: () => void;
  toggle: (data?: any) => void;
  reset: () => void;
}

/**
 * Hook for managing modal/dialog states consistently across components
 * 
 * @param initialData - Initial data to pass to modal
 * @returns [state, actions] - Current state and actions to modify it
 * 
 * @example
 * const [state, actions] = useModalState();
 * 
 * // In JSX
 * <Dialog open={state.isOpen} onOpenChange={actions.toggle}>
 *   <DialogContent>
 *     <StudentForm 
 *       data={state.data} 
 *       onSave={() => actions.close()}
 *     />
 *   </DialogContent>
 * </Dialog>
 * 
 * // Open with data
 * actions.open(studentData);
 */
export function useModalState(initialData: any = null) {
  const [state, setState] = useState<ModalState>({
    isOpen: false,
    data: initialData,
    isClosing: false,
  });

  const open = useCallback((data?: any) => {
    setState({
      isOpen: true,
      data: data ?? initialData,
      isClosing: false,
    });
  }, [initialData]);

  const close = useCallback(() => {
    setState(prev => ({
      ...prev,
      isClosing: true,
    }));
    
    // Delay actual close for animation
    setTimeout(() => {
      setState({
        isOpen: false,
        data: initialData,
        isClosing: false,
      });
    }, 150);
  }, [initialData]);

  const toggle = useCallback((data?: any) => {
    setState(prev => {
      if (prev.isOpen) {
        return {
          ...prev,
          isClosing: true,
        };
      }
      return {
        isOpen: true,
        data: data ?? initialData,
        isClosing: false,
      };
    });

    // Handle closing animation
    if (state.isOpen) {
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          isOpen: false,
          data: initialData,
          isClosing: false,
        }));
      }, 150);
    }
  }, [initialData, state.isOpen]);

  const reset = useCallback(() => {
    setState({
      isOpen: false,
      data: initialData,
      isClosing: false,
    });
  }, [initialData]);

  const actions: ModalActions = { open, close, toggle, reset };

  return [state, actions] as const;
}

/**
 * Hook for managing multiple modals with shared interface
 * 
 * @param modals - Object mapping modal names to initial data
 * @returns [states, actions] - Current states and actions to modify them
 * 
 * @example
 * const [states, actions] = useMultipleModals({
 *   studentForm: null,
 *   deleteConfirm: null,
 *   importDialog: null,
 * });
 * 
 * // Access specific modal
 * const studentModal = states.studentForm;
 * actions.studentForm.open(studentData);
 */
export function useMultipleModals<T extends Record<string, any>>(
  modals: T
) {
  const [modalStates, setModalStates] = useState<Record<keyof T, ModalState>>(() => {
    const result = {} as Record<keyof T, ModalState>;
    Object.entries(modals).forEach(([key, initialData]) => {
      result[key as keyof T] = {
        isOpen: false,
        data: initialData,
        isClosing: false,
      };
    });
    return result;
  });

  const createActions = useCallback((modalKey: keyof T): ModalActions => ({
    open: (data?: any) => {
      setModalStates(prev => ({
        ...prev,
        [modalKey]: {
          isOpen: true,
          data: data ?? modals[modalKey],
          isClosing: false,
        },
      }));
    },
    close: () => {
      setModalStates(prev => ({
        ...prev,
        [modalKey]: {
          ...prev[modalKey],
          isClosing: true,
        },
      }));
      
      setTimeout(() => {
        setModalStates(prev => ({
          ...prev,
          [modalKey]: {
            isOpen: false,
            data: modals[modalKey],
            isClosing: false,
          },
        }));
      }, 150);
    },
    toggle: (data?: any) => {
      setModalStates(prev => {
        const currentState = prev[modalKey];
        if (currentState.isOpen) {
          return {
            ...prev,
            [modalKey]: {
              ...currentState,
              isClosing: true,
            },
          };
        }
        return {
          ...prev,
          [modalKey]: {
            isOpen: true,
            data: data ?? modals[modalKey],
            isClosing: false,
          },
        };
      });

      // Handle closing animation
      setTimeout(() => {
        setModalStates(prev => {
          const currentState = prev[modalKey];
          if (currentState.isClosing) {
            return {
              ...prev,
              [modalKey]: {
                isOpen: false,
                data: modals[modalKey],
                isClosing: false,
              },
            };
          }
          return prev;
        });
      }, 150);
    },
    reset: () => {
      setModalStates(prev => ({
        ...prev,
        [modalKey]: {
          isOpen: false,
          data: modals[modalKey],
          isClosing: false,
        },
      }));
    },
  }), [modals]);

  // Create actions object with all modal keys
  const actions = Object.keys(modals).reduce((acc, key) => {
    acc[key as keyof T] = createActions(key as keyof T);
    return acc;
  }, {} as any);

  return [modalStates, actions] as const;
}

/**
 * Hook for managing confirm dialog states
 * 
 * @returns [state, actions] - Current state and actions for confirmation
 * 
 * @example
 * const [state, actions] = useConfirmDialog();
 * 
 * // Show confirmation
 * actions.show({
 *   title: 'Delete Student',
 *   message: 'Are you sure you want to delete this student?',
 *   onConfirm: () => deleteStudent(studentId),
 * });
 */
export function useConfirmDialog() {
  const [state, setState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
  });

  const show = useCallback((
    options: {
      title: string;
      message: string;
      onConfirm: () => void;
      onCancel?: () => void;
      confirmText?: string;
      cancelText?: string;
      variant?: 'default' | 'destructive';
    }
  ) => {
    setState({
      isOpen: true,
      ...options,
    });
  }, []);

  const hide = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const confirm = useCallback(() => {
    state.onConfirm?.();
    hide();
  }, [state.onConfirm, hide]);

  const cancel = useCallback(() => {
    state.onCancel?.();
    hide();
  }, [state.onCancel, hide]);

  return [{
    ...state,
    hide,
    confirm,
    cancel,
    show,
  }] as const;
}

export default useModalState;