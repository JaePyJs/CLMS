/**
 * Export Utilities
 * Handles data export to CSV and Excel formats
 */

/**
 * Convert data to CSV format
 */
export function convertToCSV(data: any[], headers?: string[]): string {
  if (data.length === 0) {
    return '';
  }

  // Get headers from first object if not provided
  const keys = headers || Object.keys(data[0]);

  // Create CSV header row
  const csvHeaders = keys.join(',');

  // Create CSV data rows
  const csvRows = data.map((row) => {
    return keys
      .map((key) => {
        const value = row[key];
        // Escape commas and quotes
        if (value === null || value === undefined) {
          return '';
        }
        const stringValue = String(value);
        if (
          stringValue.includes(',') ||
          stringValue.includes('"') ||
          stringValue.includes('\n')
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(',');
  });

  return [csvHeaders, ...csvRows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(
  data: any[],
  filename: string,
  headers?: string[]
): void {
  const csv = convertToCSV(data, headers);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Convert data to JSON and download
 */
export function downloadJSON(data: any, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Export report data to CSV
 */
export function exportReportToCSV(reportData: any, reportType: string): void {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${reportType}-report-${timestamp}`;

  if (reportType === 'daily' && reportData.summary) {
    const data = [
      { Metric: 'Date', Value: reportData.date },
      { Metric: 'Check-Ins', Value: reportData.summary.checkIns },
      { Metric: 'Check-Outs', Value: reportData.summary.checkOuts },
      { Metric: 'Unique Students', Value: reportData.summary.uniqueStudents },
      { Metric: 'Books Circulated', Value: reportData.summary.booksCirculated },
      {
        Metric: 'Average Duration (min)',
        Value: reportData.summary.avgDuration,
      },
      { Metric: 'Peak Hour', Value: reportData.summary.peakHour },
      { Metric: '', Value: '' }, // Empty row
      { Metric: 'Book Checkouts', Value: reportData.details.bookCheckouts },
      { Metric: 'Book Returns', Value: reportData.details.bookReturns },
      { Metric: 'Computer Use', Value: reportData.details.computerUse },
      { Metric: 'Gaming Sessions', Value: reportData.details.gamingSessions },
      { Metric: 'AVR Sessions', Value: reportData.details.avrSessions },
    ];
    downloadCSV(data, filename);
  } else if (reportType === 'weekly' && reportData.summary) {
    const summaryData = [
      { Metric: 'Week Start', Value: reportData.weekStart },
      { Metric: 'Week End', Value: reportData.weekEnd },
      { Metric: 'Total Visits', Value: reportData.summary.totalVisits },
      { Metric: 'Unique Students', Value: reportData.summary.uniqueStudents },
      { Metric: 'Total Checkouts', Value: reportData.summary.totalCheckouts },
    ];

    // Add popular books
    if (reportData.popularBooks?.length > 0) {
      summaryData.push({ Metric: '', Value: '' });
      summaryData.push({ Metric: 'Popular Books', Value: '' });
      reportData.popularBooks.forEach((book: any, i: number) => {
        summaryData.push({
          Metric: `${i + 1}. ${book.title}`,
          Value: book.count,
        });
      });
    }

    downloadCSV(summaryData, filename);
  } else if (reportType === 'monthly' && reportData.summary) {
    const data = [
      { Metric: 'Month', Value: reportData.monthName },
      { Metric: 'Year', Value: reportData.year },
      { Metric: 'Total Visits', Value: reportData.summary.totalVisits },
      { Metric: 'Unique Students', Value: reportData.summary.uniqueStudents },
      { Metric: 'Books Borrowed', Value: reportData.summary.booksBorrowed },
      { Metric: 'Books Returned', Value: reportData.summary.booksReturned },
    ];
    downloadCSV(data, filename);
  } else if (reportType === 'custom' && reportData.summary) {
    const data = [
      { Metric: 'Start Date', Value: reportData.dateRange.start },
      { Metric: 'End Date', Value: reportData.dateRange.end },
      { Metric: 'Days', Value: reportData.dateRange.days },
      { Metric: 'Total Check-Ins', Value: reportData.summary.totalCheckIns },
      { Metric: 'Unique Students', Value: reportData.summary.uniqueStudents },
      { Metric: 'Books Borrowed', Value: reportData.summary.booksBorrowed },
      { Metric: 'Books Returned', Value: reportData.summary.booksReturned },
    ];
    downloadCSV(data, filename);
  }
}

/**
 * Export fines data to CSV
 */
export function exportFinesToCSV(fines: any[]): void {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `fines-report-${timestamp}`;

  const data = fines.map((fine) => ({
    'Student ID': fine.student?.studentId || '',
    'Student Name':
      `${fine.student?.firstName || ''} ${fine.student?.lastName || ''}`.trim(),
    'Book Title': fine.book?.title || '',
    'Accession No': fine.book?.accessionNo || '',
    'Due Date': fine.dueDate ? new Date(fine.dueDate).toLocaleDateString() : '',
    'Overdue Days': fine.overdueDays || 0,
    'Fine Amount': fine.fineAmount || 0,
    Status: fine.finePaid ? 'Paid' : 'Outstanding',
  }));

  downloadCSV(data, filename);
}

/**
 * Print report (opens print dialog)
 */
export function printReport(): void {
  window.print();
}
