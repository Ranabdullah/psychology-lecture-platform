export type SessionUser = {
  id: string;
  role: "TEACHER" | "STUDENT";
  username: string;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Guard for any resource scoped to a single student (notes, questions,
 * confusions, bookmarks, highlights). Prevents IDOR: a student can only
 * ever act on rows where `ownerId === session.user.id`, regardless of
 * what id is in the URL/body. Teachers do NOT get a bypass here —
 * private student content stays private unless explicitly submitted.
 */
export function assertOwnsResource(ownerId: string, sessionUser: SessionUser) {
  if (ownerId !== sessionUser.id) {
    throw new ApiError(403, "You do not have access to this resource");
  }
}
