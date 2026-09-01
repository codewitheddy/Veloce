import api from './client';

export interface SalesReportParams {
  startDate?: string;
  endDate?: string;
}

export interface CeleryJobStatusResponse {
  job_id: string;
  status: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'RETRY' | 'REVOKED';
  ready: boolean;
  successful?: boolean | null;
  result?: any;
  error?: string;
}

export const reportsApi = {
  /**
   * Triggers asynchronous background sales report generation (Celery)
   */
  startSalesReport: async (params?: SalesReportParams): Promise<{ job_id: string; status: string; check_url: string }> => {
    const response = await api.post('/reports/sales/', params || {});
    return response.data;
  },

  /**
   * Triggers asynchronous inventory health valuation report (Celery)
   */
  startInventoryReport: async (): Promise<{ job_id: string; status: string; check_url: string }> => {
    const response = await api.post('/reports/inventory/');
    return response.data;
  },

  /**
   * Polls the lifecycle status and result of a background Celery task
   */
  getJobStatus: async (jobId: string): Promise<CeleryJobStatusResponse> => {
    const response = await api.get(`/jobs/${jobId}/`);
    return response.data;
  },
};
