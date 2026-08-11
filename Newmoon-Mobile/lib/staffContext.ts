import NetInfo from '@react-native-community/netinfo';
import api from './api';
import { getUser, saveUser } from './userStorage';
import { isNetworkError } from './network';
import { normalizeUserType } from './userType';

export function normalizeUser(user: any): any | null {
  if (!user) return null;
  return user?.user ? user.user : user;
}

export function getBranchIdFromUser(user: any): string | null {
  const u = normalizeUser(user);
  if (!u) return null;

  if (u.branch_id != null) return String(u.branch_id);
  if (u.branchId != null) return String(u.branchId);
  if (u.branch?.id != null) return String(u.branch.id);
  if (u.branch?.branch_id != null) return String(u.branch.branch_id);

  const assignments = Array.isArray(u.branch_assignments)
    ? u.branch_assignments
    : Array.isArray(u.branchAssignments)
      ? u.branchAssignments
      : [];

  const activeAssignment =
    assignments.find((a: any) => a?.is_active) || assignments[0];

  if (activeAssignment) {
    const id =
      activeAssignment.branch_id ??
      activeAssignment.branch?.id ??
      activeAssignment.branch?.branch_id ??
      activeAssignment.id;
    if (id != null) return String(id);
  }

  if (u.staff_assignment?.branch_id != null) {
    return String(u.staff_assignment.branch_id);
  }
  if (u.staff?.branch_id != null) return String(u.staff.branch_id);
  if (u.staff?.branch?.id != null) return String(u.staff.branch.id);

  return null;
}

export async function loadStaffUser(): Promise<any | null> {
  return normalizeUser(await getUser());
}

export async function hasNetworkConnection(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
}

function parseStaffAssignment(data: any): any | null {
  if (!data) return null;
  if (Array.isArray(data) && data.length > 0) return data[0];
  if (Array.isArray(data?.data) && data.data.length > 0) return data.data[0];
  if (typeof data === 'object' && data.branch_id) return data;
  return null;
}

export async function resolveStaffBranch(
  existingUser?: any
): Promise<{ user: any | null; branchId: string | null }> {
  let user = normalizeUser(existingUser) ?? (await loadStaffUser());
  if (!user?.id) {
    return { user, branchId: null };
  }

  let branchId = getBranchIdFromUser(user);
  if (branchId) {
    return { user, branchId };
  }

  const connected = await hasNetworkConnection();
  if (!connected) {
    return { user, branchId: null };
  }

  try {
    const meResponse = await api.get('/me');
    user = meResponse.data;
    branchId = getBranchIdFromUser(user);
    if (branchId) {
      await saveUser({ ...user, branch_id: branchId });
      return { user, branchId };
    }
  } catch (error) {
    if (!isNetworkError(error)) {
      console.warn('[staffContext] /me failed:', error);
    }
  }

  try {
    const staffResponse = await api.get(`/staff/${user.id}`);
    const staffData = staffResponse.data;
    branchId = getBranchIdFromUser(staffData);
    if (branchId) {
      user = {
        ...user,
        branch_id: branchId,
        branchAssignments: staffData?.branchAssignments ?? user.branchAssignments,
      };
      await saveUser(user);
      return { user, branchId };
    }
  } catch (error) {
    if (!isNetworkError(error)) {
      console.warn('[staffContext] /staff failed:', error);
    }
  }

  try {
    const assignmentResponse = await api.get('/staff-assignments', {
      params: { user_id: user.id, is_active: true },
    });
    const assignment = parseStaffAssignment(assignmentResponse.data);
    if (assignment?.branch_id) {
      branchId = String(assignment.branch_id);
      user = {
        ...user,
        branch_id: branchId,
        staff_assignment: assignment,
        branchAssignments: [assignment],
      };
      await saveUser(user);
      return { user, branchId };
    }
  } catch (error) {
    if (!isNetworkError(error)) {
      console.warn('[staffContext] staff-assignments failed:', error);
    }
  }

  try {
    const altResponse = await api.get(`/staff/${user.id}/assignment`);
    if (altResponse.data?.branch_id) {
      branchId = String(altResponse.data.branch_id);
      user = {
        ...user,
        branch_id: branchId,
        staff_assignment: altResponse.data,
      };
      await saveUser(user);
      return { user, branchId };
    }
  } catch (error) {
    if (!isNetworkError(error)) {
      console.warn('[staffContext] staff assignment alt failed:', error);
    }
  }

  return { user, branchId: null };
}

export async function cacheStaffContextAfterLogin(user: any): Promise<any> {
  const normalized = normalizeUser(user) ?? user;

  if (['rider', 'customer'].includes(normalizeUserType(normalized?.userType || normalized?.role) || '')) {
    await saveUser(normalized);
    return normalized;
  }

  await saveUser(normalized);
  
  try {
    const { user: resolved, branchId } = await resolveStaffBranch(normalized);
    if (resolved && branchId) {
      const merged = { ...resolved, branch_id: branchId };
      await saveUser(merged);
      console.log('[STAFF CONTEXT] User data cached with branch ID:', branchId);
      return merged;
    }
  } catch (error) {
    console.warn('[STAFF CONTEXT] Could not resolve branch, caching basic user data:', error);
  }
  
  console.log('[STAFF CONTEXT] Cached basic user data');
  return normalized;
}
