import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../lib/api';
import { toast } from 'sonner';
import React from 'react';

export const useAttendanceSync = () => {
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: attendanceApi.importGoogleSheets,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      const response = data.data || data; // Handle potential unwrapping
      toast.success('Import Successful', {
        description: `Imported ${response.imported} records.`,
      });
      // Invalidate attendance queries
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['active-sessions'] });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error('Import Failed', {
        description:
          error.response?.data?.message ||
          'Failed to import from Google Sheets',
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: attendanceApi.exportGoogleSheets,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      const response = data.data || data;
      toast.success('Export Successful', {
        description: `Exported ${response.exported} records to Google Sheet.`,
        action: (
          <a
            href={response.sheetUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium underline"
          >
            Open Sheet
          </a>
        ),
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      console.log(error);
      toast.error('Export Failed', {
        description:
          error.response?.data?.message || 'Failed to export to Google Sheets',
      });
    },
  });

  const validateSheet = async (spreadsheetId: string, sheetName: string) => {
    try {
      const res = await attendanceApi.validateGoogleSheet({
        spreadsheetId,
        sheetName,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (res as any).data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Validation failed');
    }
  };

  return {
    importFromHelpers: importMutation,
    exportToHelpers: exportMutation,
    validateSheet,
  };
};
