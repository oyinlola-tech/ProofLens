export type ClaimStatus = "pending" | "analyzing" | "verified" | "rejected" | "unverified" | "failed";

export type ProcessingStatus = "uploaded" | "processing" | "processed" | "failed";

export type DocumentType = "pdf" | "text" | "html" | "unknown";

export type Verdict = "supported" | "partially_supported" | "contradicted" | "insufficient_evidence";

export interface AuthResponse {
  token: string;
  user_id: string;
}

export interface MeResponse {
  user_id: string;
  email: string;
}

export interface Claim {
  id: string;
  text: string;
  status: ClaimStatus;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  filename: string;
  document_type: DocumentType;
  content_length: number;
  processing_status: ProcessingStatus;
  created_at: string;
}

export interface DocumentPage {
  id: string;
  page_number: number;
  text: string;
  char_offset: number;
  char_length: number;
}

export interface DocumentPages {
  document_id: string;
  total_pages: number;
  pages: DocumentPage[];
}

export interface Evidence {
  id: string;
  claim_id: string;
  content: string;
  source_document_id: string | null;
  source_section: string | null;
  source_page: number | null;
  created_at: string;
}

export interface EvidenceDetail {
  id: string;
  content: string;
  source_document_id: string | null;
  source_section: string | null;
  source_page: number | null;
}

export type AssertionStrength = "hedged" | "moderate" | "absolute";

export type FindingKind =
  | "number_match"
  | "number_mismatch"
  | "date_match"
  | "date_mismatch"
  | "entity_mismatch"
  | "negation_conflict"
  | "qualifier_gap"
  | "exact_match"
  | "low_relevance";

export type ReferenceRole = "supports" | "contradicts" | "context";

export interface ClaimAnalysis {
  subject: string;
  proposition: string;
  assertion_strength: AssertionStrength;
  causal: boolean;
  quantitative: boolean;
  negated: boolean;
  entities: string[];
  numbers: string[];
  dates: string[];
}

export interface Finding {
  kind: FindingKind;
  description: string;
  claim_value: string;
  evidence_value: string;
  evidence_id: string | null;
  conflict: boolean;
}

export interface EvidenceReference {
  evidence_id: string;
  document_id: string | null;
  page: number | null;
  quote: string;
  role: ReferenceRole;
}

export interface AnalysisInfo {
  mode: "ai" | "deterministic";
  provider: string;
  model: string;
}

export interface Verification {
  id: string;
  claim_id: string;
  claim_text: string;
  verdict: Verdict | null;
  confidence: number | null;
  reasoning: string | null;
  source_grounded_statement: string | null;
  why_claim_does_not_match: string | null;
  unsupported_parts: string | null;
  source_limitations: string | null;
  supported_parts: string | null;
  conclusion: string | null;
  claim_analysis: ClaimAnalysis | null;
  findings: Finding[];
  evidence_references: EvidenceReference[];
  analysis: AnalysisInfo | null;
  evidence_refs: string[];
  evidence_used: EvidenceDetail[];
  created_at: string;
  completed_at: string | null;
}

export interface VerificationPending {
  message: string;
  code_length: number;
  expires_in_minutes: number;
  resend_cooldown_seconds: number;
}

export interface VerificationSummary {
  id: string;
  claim_id: string;
  claim_text: string;
  verdict: Verdict | null;
  confidence: number | null;
  evidence_count: number;
  created_at: string;
  completed_at: string | null;
}
