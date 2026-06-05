export interface User {
  id: number;
  username: string;
  role: 'super_admin' | 'admin' | 'finance';
  company_id: number | null;
  company_ids?: number[];
  company_name?: string;
  companies?: { id: number; name: string }[];
  created_at: string;
}

export interface Company {
  id: number;
  name: string;
  initial_balance: number;
  balance: number;
  remark: string;
  created_at: string;
}

export interface PaymentType {
  id: number;
  name: string;
  category: 'expense' | 'income' | 'other';
  is_active: number;
  created_at: string;
}

export interface Payment {
  id: number;
  company_id: number;
  type_id: number;
  amount: number;
  direction: 'expense' | 'income';
  description: string;
  payment_date: string;
  created_by: number;
  import_batch: string | null;
  created_at: string;
  company_name?: string;
  type_name?: string;
  type_category?: string;
  created_by_name?: string;
}

export interface Receivable {
  id: number;
  company_id: number;
  direction: 'receivable' | 'payable';
  counterparty: string;
  amount: number;
  settled_amount: number;
  due_date: string | null;
  description: string;
  status: 'pending' | 'partial' | 'settled';
  created_by: number;
  created_at: string;
  company_name?: string;
  created_by_name?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface CompanySummary {
  company_id: number;
  company_name: string;
  balance: number;
  remark: string;
  income: number;
  expense: number;
  net: number;
}

export interface ReceivableSummary {
  company_id: number;
  receivable_unsettled: number;
  payable_unsettled: number;
}

export interface DashboardData {
  companies: CompanySummary[];
  recent_payments: Payment[];
  receivables: ReceivableSummary[];
}
