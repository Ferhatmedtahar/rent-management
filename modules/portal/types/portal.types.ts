export type TenantProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

export type TenantLeaseSummary = {
  id: string;
  unitId: string;
  unitName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  monthlyRentSen: number;
  depositSen: number;
};
