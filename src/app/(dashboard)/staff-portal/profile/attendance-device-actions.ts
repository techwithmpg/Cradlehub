"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  cancelOwnAttendancePhoneRequest,
  completeOwnAttendancePhoneRequest,
  renameOwnAttendanceDevice,
  requestAttendancePhoneRegistration,
  type StaffDeviceRegistrationRequestType,
} from "@/lib/attendance/device-registration";
import { createDeviceCredential, DEVICE_COOKIE_NAME } from "@/lib/attendance/tokens";
import { ATTENDANCE_REGISTRATION_COOKIE_NAME } from "@/lib/attendance/scan-continuation";

type ActionResult = { success: true; message: string } | { success: false; message: string };

function revalidateDeviceSurfaces(): void {
  revalidatePath("/staff-portal/profile");
  revalidatePath("/staff-portal/attendance");
  revalidatePath("/crm/attendance");
  revalidatePath("/owner/attendance");
}

async function getOrCreateRegistrationCredential(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(ATTENDANCE_REGISTRATION_COOKIE_NAME)?.value;
  if (existing) return existing;
  const credential = createDeviceCredential();
  cookieStore.set(ATTENDANCE_REGISTRATION_COOKIE_NAME, credential, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return credential;
}

function safeMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function requestAttendancePhoneAction(input: {
  requestType: StaffDeviceRegistrationRequestType;
  existingDeviceId?: string | null;
}): Promise<ActionResult> {
  try {
    const headerStore = await headers();
    await requestAttendancePhoneRegistration({
      rawCredential: await getOrCreateRegistrationCredential(),
      userAgent: headerStore.get("user-agent"),
      requestType: input.requestType,
      existingDeviceId: input.existingDeviceId,
    });
    revalidateDeviceSurfaces();
    return { success: true, message: "Request sent to CRM for review." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "The phone request could not be sent.") };
  }
}

export async function cancelAttendancePhoneRequestAction(requestId: string): Promise<ActionResult> {
  try {
    await cancelOwnAttendancePhoneRequest(requestId);
    revalidateDeviceSurfaces();
    return { success: true, message: "Phone request cancelled." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "The request could not be cancelled.") };
  }
}

export async function completeAttendancePhoneRequestAction(requestId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const credential = cookieStore.get(ATTENDANCE_REGISTRATION_COOKIE_NAME)?.value;
  if (!credential) {
    return { success: false, message: "Open this page on the same phone that submitted the request." };
  }
  try {
    const headerStore = await headers();
    await completeOwnAttendancePhoneRequest({
      requestId,
      rawCredential: credential,
      userAgent: headerStore.get("user-agent"),
    });
    cookieStore.set(DEVICE_COOKIE_NAME, credential, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
    cookieStore.set(ATTENDANCE_REGISTRATION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    revalidateDeviceSurfaces();
    return { success: true, message: "This phone is ready for attendance scans." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "This approval could not be activated.") };
  }
}

export async function renameOwnAttendancePhoneAction(input: {
  deviceId: string;
  label: string;
}): Promise<ActionResult> {
  try {
    await renameOwnAttendanceDevice(input.deviceId, input.label);
    revalidateDeviceSurfaces();
    return { success: true, message: "Phone name updated." };
  } catch (error) {
    return { success: false, message: safeMessage(error, "The phone name could not be updated.") };
  }
}
