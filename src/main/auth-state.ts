let _userId: string | null = null
let _userRole: string | null = null

export function setCurrentUser(id: string | null, role: string | null): void {
  _userId = id
  _userRole = role
}

export function getCurrentUserId(): string | null {
  return _userId
}

export function getCurrentUserRole(): string | null {
  return _userRole
}

// Legacy alias kept for internal callers that only need the ID
export function setCurrentUserId(id: string | null): void {
  _userId = id
}
