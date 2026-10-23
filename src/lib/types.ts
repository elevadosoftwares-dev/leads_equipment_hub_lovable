// Row shapes returned by the store server functions (see database/schema.sql).
// Dates are "yyyy-MM-dd" strings, timestamps ISO strings, ids lowercase UUIDs.

export type Equipment = {
  id: string;
  code: string;
  type: string;
  brand: string;
  model: string;
  serial_no: string;
  store_no: string;
  photo_path: string | null;
  specification: string;
  location: string;
  service_details: string;
  notes: string;
  status: string;
  condition: string;
  quarantine_reason: string;
  category_id: string | null;
  subcategory_id: string | null;
  department_id: string | null;
  set_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Calibration = {
  id: string;
  equipment_id: string;
  calibration_date: string;
  expiry_date: string;
  certificate_path: string | null;
  certificate_name: string | null;
  performed_by: string;
  remarks: string;
  created_at: string;
};

export type Issuance = {
  id: string;
  equipment_id: string;
  technician_id: string | null;
  report_no: string;
  issued_to: string;
  department: string;
  purpose: string;
  job_no: string;
  job_description: string;
  job_location: string;
  issuance_date: string;
  expected_return_date: string | null;
  return_date: string | null;
  return_condition: string | null;
  notes: string;
  return_notes: string;
  reconciled: boolean;
  reconciled_by: string;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  created_at: string;
};

export type Subcategory = {
  id: string;
  category_id: string;
  name: string;
  created_at: string;
};

export type Department = {
  id: string;
  name: string;
  created_at: string;
};

export type Technician = {
  id: string;
  name: string;
  employee_no: string;
  department_id: string | null;
  phone: string;
  created_at: string;
};

export type EquipmentSet = {
  id: string;
  name: string;
  notes: string;
  created_at: string;
};

export type EquipmentFile = {
  id: string;
  equipment_id: string;
  kind: string;
  path: string;
  name: string;
  created_at: string;
};

export type StoreSnapshot = {
  equipment: Equipment[];
  calibrations: Calibration[];
  issuances: Issuance[];
  categories: Category[];
  subcategories: Subcategory[];
  departments: Department[];
  technicians: Technician[];
  sets: EquipmentSet[];
  files: EquipmentFile[];
};
