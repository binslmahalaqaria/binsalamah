/**
 * Sales CRM record shapes (Firestore collections `clients`, `properties`,
 * `requests`, `tasks`, `chat`, `goals`, `hr`, `payroll`,
 * `attendance/{uid}/days`, and the `crm/settings` doc). Field names are
 * kept identical to the original artifact CRM so migrated data loads
 * unchanged. Timestamps are ISO strings; dates are `YYYY-MM-DD`;
 * `visitAt` is a local `YYYY-MM-DDTHH:MM`. See CLAUDE.md §5.
 */

export interface LogEntry {
  at: string;
  byId: string | null;
  type: string;
  text: string;
  propertyId?: string | null;
}

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  source: string | null;
  assignee: string | null;
  assignedAt?: string | null;
  assignedBy?: string | null;
  unseen?: boolean;
  escalatedFrom?: string | null;
  escalatedAt?: string | null;
  temp: string | null;
  status: string | null;
  nextCall: string | null;
  visitAt: string | null;
  visitProperty?: string | null;
  visitConfirmed?: boolean;
  notes: string | null;
  log: LogEntry[];
  lastUpdate?: string | null;
  lastUpdateAt?: string | null;
  interestIn?: string | null;
  // Demand fields mirrored from the client's latest request (legacy shape).
  purpose?: string | null;
  propTypes?: string[];
  districts?: string | null;
  budget?: number | null;
  payment?: string | null;
  bank?: string | null;
  areaMin?: number | null;
  bedroomsMin?: number | null;
  floors?: string[];
  requirements?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  name: string;
  type?: string | null;
  area?: number | null;
  price?: number | null;
  bedrooms?: number | null;
  floor?: string | null;
  status?: string;
}

export interface Property {
  id: string;
  title: string;
  type: string | null;
  purpose: string | null;
  price: number | null;
  status: string | null;
  district: string | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  priceNote: string | null;
  link: string | null;
  images: string[];
  videoLink: string | null;
  ownerKind: string | null;
  contactName: string | null;
  contactPhone: string | null;
  commissionNote: string | null;
  developerId?: string | null;
  waMessage: string | null;
  units: Unit[];
  features: string | null;
  city: string | null;
  buildArea: number | null;
  livingRooms: number | null;
  floors: number | null;
  facing: string | null;
  streetWidth: number | null;
  age: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What a client wants. Requests carry their own stage through to deposit/sale. */
export interface Demand {
  purpose?: string | null;
  propTypes?: string[];
  districts?: string | null;
  budget?: number | null;
  payment?: string | null;
  bank?: string | null;
  areaMin?: number | null;
  bedroomsMin?: number | null;
  floors?: string[];
  requirements?: string | null;
}

export interface Request extends Demand {
  id: string;
  clientId: string;
  priority: string | null;
  source: string | null;
  notes: string | null;
  status: string;
  assignee: string | null;
  propertyId: string | null;
  unit: string | null;
  price: number | null;
  commissionPct: number | null;
  deposit?: number | null;
  depositAt?: string | null;
  closedAt?: string | null;
  sent?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  assignee: string | null;
  due: string | null;
  priority: string | null;
  clientId: string | null;
  propertyId: string | null;
  notes: string | null;
  done: boolean;
  doneAt?: string | null;
  doneBy?: string | null;
  seen?: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMsg {
  id: string;
  text: string;
  by: string;
  at: string;
  clientId: string | null;
}

export interface Goal {
  id: string; // `${month}_${uid}`
  uid: string;
  month: string;
  calls: number | null;
  reqs: number | null;
  visits: number | null;
  deals: number | null;
  commission: number | null;
  note: string;
  by?: string;
  updatedAt?: string;
}

export interface HrDoc {
  name: string;
  url: string;
}

export interface HrFile {
  id: string; // staff uid
  jobTitle: string | null;
  contractType: string | null;
  hireDate: string | null;
  contractEnd: string | null;
  workStart: string | null;
  workEnd: string | null;
  salary: number | null;
  housing: number | null;
  transport: number | null;
  otherAllow: number | null;
  commissionPct: number | null;
  iban: string | null;
  docs: HrDoc[];
  notes: string | null;
}

export interface PayrollRow {
  id: string; // `${month}_${uid}`
  month: string;
  member: string;
  bonus?: number | null;
  deduction?: number | null;
  note?: string;
  paid?: boolean;
}

export interface AttendanceDay {
  id: string; // YYYY-MM-DD
  date: string;
  in: string | null;
  out: string | null;
  editedBy?: string;
}

export interface CrmSettings {
  salesManager: string | null;
  escalateDays: number;
  escalateOff: boolean;
}
