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
  /** Counted as a call in the figures (set from 2026-10-21; older entries are judged by their type, see isCall). */
  call?: boolean;
}

export interface Client {
  id: string;
  /** When the fourth-attempt WhatsApp message was sent; 48 h without a reply → «لا يوجد رد». */
  waSentAt?: string | null;
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
  /** Riyadh areas (شمال الرياض، شرق الرياض…) — required on new requests; districts are picked inside them. */
  zones?: string[];
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
  /** Staff uid who added / last edited the property (missing on records from before 2026-10-13). */
  createdBy?: string | null;
  updatedBy?: string | null;
}

/** What a client wants. Requests carry their own stage through to deposit/sale. */
export interface Demand {
  purpose?: string | null;
  propTypes?: string[];
  zones?: string[];
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
  /** Staff uid who recorded the deposit / the sale (may differ from the assignee). */
  depositBy?: string | null;
  closedBy?: string | null;
  /** Deposit receipt (سند قبض): number, when and by whom it was first issued, and how the deposit was paid. */
  receiptNo?: string | null;
  receiptAt?: string | null;
  receiptBy?: string | null;
  payMethod?: string | null;
  payRef?: string | null;
  payerIdNo?: string | null;
  /** Notes printed on the receipt (e.g. terms agreed for this deposit). */
  receiptNote?: string | null;
  sent?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  /** "wa4": the WhatsApp message after three unanswered calls (created automatically). */
  kind?: string | null;
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

/** Private message between two staff members (collection "dm"); only the two members can read it. */
export interface DirectMsg {
  id: string;
  members: [string, string];
  by: string;
  to: string;
  text: string;
  at: string;
  clientId: string | null;
  read: boolean;
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
  /** Working weekdays, 0 = Sunday … 6 = Saturday (default Sunday–Thursday). */
  workDays?: number[] | null;
  /** Required hours per working day (default: shift end − start). */
  dailyHours?: number | null;
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
  /** Where the check-in / check-out happened ({lat, lng, acc, dist from the office in m}). */
  inLoc?: { lat: number; lng: number; acc: number; dist: number | null } | null;
  outLoc?: { lat: number; lng: number; acc: number; dist: number | null } | null;
}

export interface CrmSettings {
  salesManager: string | null;
  escalateDays: number;
  escalateOff: boolean;
  /** Printed on receipts (سند قبض): commercial registration, bank account, and the owner's signature (PNG data URL). */
  crNo?: string | null;
  bankName?: string | null;
  iban?: string | null;
  accountNo?: string | null;
  accountName?: string | null;
  signerName?: string | null;
  signature?: string | null;
  /** Seller details for tax invoices: VAT number and national address. */
  vatNo?: string | null;
  addrBuilding?: string | null;
  addrStreet?: string | null;
  addrDistrict?: string | null;
  addrCity?: string | null;
  addrPostal?: string | null;
  addrExtra?: string | null;
  /** Attendance location rule: office point, allowed radius (m), and whether it is enforced. */
  geoOn?: boolean;
  /** Set by the server once linked to ZATCA (Phase 2): issued invoices are then signed and sent automatically. */
  zatcaOn?: boolean;
  zatcaEnv?: "sandbox" | "simulation" | "production";
  officeLat?: number | null;
  officeLng?: number | null;
  officeRadius?: number | null;
}

/** One line of an invoice; the price is before VAT. */
export interface ZatcaResult {
  status: "معتمدة" | "مُبلّغ عنها" | "مرفوضة";
  env?: string;
  uuid?: string;
  icv?: number;
  hash?: string;
  qr?: string | null;
  errors?: string[];
  warnings?: string[];
  submittedAt?: string;
}
export interface InvoiceLine { desc: string; qty: number; price: number }

/**
 * Tax invoice (فاتورة ضريبية). Drafts can be edited or deleted; once issued the
 * invoice gets its sequential number, issue time and ZATCA QR and is frozen —
 * a manager can only cancel it (with a reason).
 */
export interface Invoice {
  id: string;
  no: string | null;
  seq: number | null;
  /** "standard" = to a business (buyer VAT number), "simplified" = to an individual. */
  kind: "standard" | "simplified";
  status: "مسودة" | "صادرة" | "ملغاة";
  issueAt: string | null;
  supplyDate: string | null;
  buyerName: string;
  buyerPhone: string | null;
  buyerVat: string | null;
  buyerCr: string | null;
  buyerAddress: string | null;
  /** Structured national address — required by ZATCA for standard (B2B) invoices. */
  buyerStreet?: string | null;
  buyerBuilding?: string | null;
  buyerDistrict?: string | null;
  buyerCity?: string | null;
  buyerPostal?: string | null;
  clientId: string | null;
  requestId: string | null;
  lines: InvoiceLine[];
  vatRate: number;
  subtotal: number;
  vat: number;
  total: number;
  notes: string | null;
  qr: string | null;
  /** "credit" = إشعار دائن (cancels `billingRef`), "debit" = إشعار مدين. Missing = a normal invoice. */
  docType?: "invoice" | "credit" | "debit";
  billingRef?: string | null;
  reason?: string | null;
  /** The credit note that cancelled this invoice. */
  creditNoteId?: string | null;
  /** ZATCA Phase 2 result, written by the server (app/api/zatca/submit). */
  zatca?: ZatcaResult | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  issuedBy?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** A status change kept on offers and viewings (who, when, what). */
export interface StageEvent { at: string; by: string | null; status: string; note?: string | null }

/** A property sent to a customer for one of their requests (collection "proposals", trial 2026-10-22). */
export interface Proposal {
  id: string;
  requestId: string;
  clientId: string;
  propertyId: string;
  unit?: string | null;
  price?: number | null;
  sentAt: string;
  by: string | null;
  assignee: string | null;
  /** أُرسل · بانتظار الرد · مهتم · غير مناسب */
  status: string;
  feedback?: string | null;
  history: StageEvent[];
  updatedAt: string;
}

/** A property viewing (collection "viewings", trial 2026-10-22). */
export interface Viewing {
  id: string;
  requestId: string | null;
  clientId: string;
  propertyId: string | null;
  /** Local datetime "YYYY-MM-DDTHH:mm". */
  at: string;
  /** مجدولة · تمت · مؤجلة · ملغاة */
  status: string;
  feedback?: string | null;
  /** Follow-up date after the viewing. */
  followUp?: string | null;
  assignee: string | null;
  by: string | null;
  history: StageEvent[];
  createdAt: string;
  updatedAt: string;
}
