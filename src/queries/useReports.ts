import { useQuery, useMutation } from '@tanstack/react-query';
import { reportsApi, SalesReportParams, CeleryJobStatusResponse } from '../api/reports';
import { queryKeys } from './keys';

/**
 * Reusable hook for monitoring asynchronous Celery background task progress.
 * Polls every 2 seconds until task reaches SUCCESS or FAILURE terminal state.
 */
export const useJobStatus = (jobId: string | null | undefined, enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.reports.job(jobId || ''),
    queryFn: () => reportsApi.getJobStatus(jobId!),
    enabled: Boolean(jobId) && enabled,
    refetchInterval: (query) => {
      const data = query.state.data as CeleryJobStatusResponse | undefined;
      // Stop polling once job is finished or failed
      if (data?.ready || data?.status === 'SUCCESS' || data?.status === 'FAILURE') {
        return false;
      }
      return 2000; // Poll every 2 seconds while PENDING/STARTED
    },
    staleTime: 0, // Always keep fresh
  });
};

/**
 * Mutation hook to initiate async sales report generation.
 */
export const useStartSalesReport = () => {
  return useMutation({
    mutationFn: (params?: SalesReportParams) => reportsApi.startSalesReport(params),
  });
};

/**
 * Mutation hook to initiate async inventory health report generation.
 */
export const useStartInventoryReport = () => {
  return useMutation({
    mutationFn: () => reportsApi.startInventoryReport(),
  });
};
