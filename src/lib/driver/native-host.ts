"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
const native = () => navigator.userAgent.includes("CradleHubDriverAndroid/2.");
/** Presentation only. Server assignment/authentication never trusts this hint. */
export function useNativeDriverHost() {
  return useSyncExternalStore(subscribe, native, () => false);
}
