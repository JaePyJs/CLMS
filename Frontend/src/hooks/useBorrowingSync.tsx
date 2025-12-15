import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { borrowingApi } from '../lib/api';
import { toast } from 'sonner';

export const useBorrowingSync = () => {
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (data: { spreadsheetId: string; sheetName: string }) =>
      borrowingApi.importGoogleSheets(data),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      const response = data.data; // access body
      toast.success(`Broadcasting ${response.imported} borrowing records`, {
        description: `Parsed ${response.sheetParsed} records with ${
          response.errors?.length || 0
        } errors.`,
      });
      queryClient.invalidateQueries({ queryKey: ['borrows'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error('Import failed', {
        description: error.message || 'Failed to import from Google Sheets',
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: (data: {
      spreadsheetId: string;
      sheetName: string;
      startDate: string;
      endDate: string;
      overwrite: boolean;
    }) => borrowingApi.exportGoogleSheets(data),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      const response = data.data;
      toast.success('Export successful', {
        description: `Exported ${response.exported} records.`,
        action: (
          <a
            href={response.sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
          >
            Open Sheet
          </a>
        ),
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error('Export failed', {
        description: error.message || 'Failed to export to Google Sheets',
      });
    },
  });

  const validateSheet = async (spreadsheetId: string, sheetName: string) => {
    const response = await borrowingApi.validateGoogleSheet({
      spreadsheetId,
      sheetName,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (response as any).data;
  };

  return {
    importBorrowing: importMutation,
    exportBorrowing: exportMutation,
    validateBorrowingSheet: validateSheet,
  };
};
