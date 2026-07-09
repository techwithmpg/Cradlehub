export type BranchCorrectionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type BranchCorrectionReviewStatus = Extract<
  BranchCorrectionStatus,
  "approved" | "rejected"
>;

export type BranchCorrectionScanDetails = {
  staffId: string;
  staffName: string;
  currentBranchId: string;
  currentBranchName: string;
  requestedBranchId: string;
  requestedBranchName: string;
  qrPointId: string;
  scanEventId?: string;
  publicCode?: string;
  deviceId?: string;
  canRequestBranchCorrection?: boolean;
  existingPendingRequest?: {
    id: string;
    createdAt: string;
    requestedBranchName: string;
  } | null;
};

export type BranchCorrectionInboxItem = {
  id: string;
  staffId: string;
  staffName: string;
  staffNickname: string | null;
  staffPhone: string | null;
  staffType: string | null;
  staffSystemRole: string | null;
  staffIsActive: boolean;
  currentBranchId: string | null;
  currentBranchName: string;
  requestedBranchId: string;
  requestedBranchName: string;
  qrPointLabel: string | null;
  qrPublicCode: string | null;
  scanEventId: string | null;
  requestSource: string;
  reason: string | null;
  status: BranchCorrectionStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
};

export type BranchCorrectionRequestResult =
  | {
      ok: true;
      requestId: string;
      alreadyPending: boolean;
      status: BranchCorrectionStatus;
      message: string;
    }
  | {
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "INVALID_INPUT"
        | "NOT_ELIGIBLE"
        | "QR_NOT_FOUND"
        | "ALREADY_MATCHES"
        | "REQUEST_FAILED";
      message: string;
    };

export type BranchCorrectionReviewResult =
  | {
      ok: true;
      requestId: string;
      status: BranchCorrectionStatus;
      message: string;
    }
  | {
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "UNAUTHORIZED"
        | "INVALID_INPUT"
        | "NOT_PENDING"
        | "STALE_REQUEST"
        | "INACTIVE_BRANCH"
        | "REVIEW_FAILED";
      message: string;
    };
