export function findDistinctStaffAssignment(candidateStaffPerAttendee: string[][]): string[] | null {
  const staff = new Set(candidateStaffPerAttendee.flat());
  if (staff.size < candidateStaffPerAttendee.length) return null;

  const assignedAttendeeByStaff = new Map<string, number>();
  function assign(attendeeIndex: number, visitedStaff: Set<string>): boolean {
    for (const staffId of candidateStaffPerAttendee[attendeeIndex]!) {
      if (visitedStaff.has(staffId)) continue;
      visitedStaff.add(staffId);
      const currentAttendee = assignedAttendeeByStaff.get(staffId);
      if (currentAttendee === undefined || assign(currentAttendee, visitedStaff)) {
        assignedAttendeeByStaff.set(staffId, attendeeIndex);
        return true;
      }
    }
    return false;
  }

  // Match earlier guests last so their preferred qualified candidates retain priority.
  for (let index = candidateStaffPerAttendee.length - 1; index >= 0; index--) {
    if (!assign(index, new Set())) return null;
  }

  const result: string[] = Array(candidateStaffPerAttendee.length);
  for (const [staffId, attendeeIndex] of assignedAttendeeByStaff) result[attendeeIndex] = staffId;
  return result;
}
