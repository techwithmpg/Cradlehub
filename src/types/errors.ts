export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, "NOT_FOUND", 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class SlotUnavailableError extends AppError {
  constructor() {
    super(
      "This time slot is no longer available. Please select another.",
      "SLOT_UNAVAILABLE",
      409
    );
  }
}

export class GroupTherapistAllocationError extends SlotUnavailableError {
  readonly reason: "INDIVIDUAL_THERAPIST_UNAVAILABLE" | "GROUP_THERAPIST_CAPACITY_EXCEEDED";
  readonly attendeeIndex?: number;
  readonly serviceIds?: string[];

  constructor(
    reason: "INDIVIDUAL_THERAPIST_UNAVAILABLE" | "GROUP_THERAPIST_CAPACITY_EXCEEDED",
    attendeeIndex?: number,
    serviceIds?: string[],
    message?: string
  ) {
    super();
    this.name = "GroupTherapistAllocationError";
    this.reason = reason;
    this.attendeeIndex = attendeeIndex;
    this.serviceIds = serviceIds;
    if (message) {
      this.message = message;
    }
  }
}
