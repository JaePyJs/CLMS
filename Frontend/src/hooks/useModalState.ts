import { useState, useCallback } from 'react';

interface ModalState<T = unknown> {
  isOpen: boolean;
  data: T | null;
  isClosing: boolean;
}

interface ModalActions<T = unknown> {
  open: (data?: T) => void;
  close: () => void;
  toggle: (data?: T) => void;
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
export function useModalState<T = unknown>(initialData: T | null = null) {
  const [state, setState] = useState<ModalState<T>>({
    isOpen: false,
    data: initialData,
    isClosing: false,
  });

  const open = useCallback(
    (data?: T) => {
      setState({
        isOpen: true,
        data: data ?? initialData,
        isClosing: false,
      });
    },
    [initialData]
  );

  const close = useCallback(() => {
    setState((prev) => ({
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

  const toggle = useCallback(
    (data?: T) => {
      setState((prev) => {
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
          setState((prev) => ({
            ...prev,
            isOpen: false,
            data: initialData,
            isClosing: false,
          }));
        }, 150);
      }
    },
    [initialData, state.isOpen]
  );

  const reset = useCallback(() => {
    setState({
      isOpen: false,
      data: initialData,
      isClosing: false,
    });
  }, [initialData]);

  const actions: ModalActions<T> = { open, close, toggle, reset };

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
export function useMultipleModals<T extends Record<string, unknown>>(
  modals: T
) {
  const [modalStates, setModalStates] = useState<
    Record<keyof T, ModalState<T[keyof T]>>
  >(() => {
    const result = {} as Record<keyof T, ModalState<T[keyof T]>>;
    Object.entries(modals).forEach(([key, initialData]) => {
      result[key as keyof T] = {
        isOpen: false,
        data: initialData as T[keyof T],
        isClosing: false,
      };
    });
    return result;
  });

  const createActions = useCallback(
    (modalKey: keyof T): ModalActions<T[keyof T]> => ({
      open: (data?: T[keyof T]) => {
        setModalStates((prev) => ({
          ...prev,
          [modalKey]: {
            isOpen: true,
            data: data ?? modals[modalKey],
            isClosing: false,
          },
        }));
      },
      close: () => {
        setModalStates((prev) => ({
          ...prev,
          [modalKey]: {
            ...prev[modalKey],
            isClosing: true,
          },
        }));

        setTimeout(() => {
          setModalStates((prev) => ({
            ...prev,
            [modalKey]: {
              isOpen: false,
              data: modals[modalKey],
              isClosing: false,
            },
          }));
        }, 150);
      },
      toggle: (data?: T[keyof T]) => {
        setModalStates((prev) => {
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
          setModalStates((prev) => {
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
        setModalStates((prev) => ({
          ...prev,
          [modalKey]: {
            isOpen: false,
            data: modals[modalKey],
            isClosing: false,
          },
        }));
      },
    }),
    [modals]
  );

  // Create actions object with all modal keys
  const actions = Object.keys(modals).reduce(
    (acc, key) => {
      acc[key as keyof T] = createActions(key as keyof T);
      return acc;
    },
    {} as Record<keyof T, ModalActions<T[keyof T]>>
  );

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

  const show = useCallback(
    (options: {
      title: string;
      message: string;
      onConfirm: () => void;
      onCancel?: () => void;
      confirmText?: string;
      cancelText?: string;
      variant?: 'default' | 'destructive';
    }) => {
      setState({
        isOpen: true,
        ...options,
      });
    },
    []
  );

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const confirm = useCallback(() => {
    state.onConfirm?.();
    hide();
  }, [state.onConfirm, hide]);

  const cancel = useCallback(() => {
    state.onCancel?.();
    hide();
  }, [state.onCancel, hide]);

  return [
    {
      ...state,
      hide,
      confirm,
      cancel,
      show,
    },
  ] as const;
}

export default useModalState;
