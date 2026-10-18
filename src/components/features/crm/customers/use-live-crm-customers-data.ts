"use client";

import { useCallback, useState } from "react";
import { refreshCrmCustomersWorkspaceAction } from "@/lib/actions/crm-customers-data-actions";
import { useGenerationAwareWorkspaceSWR } from "@/components/features/dashboard/use-workspace-generation";
import {
  customerWorkspaceRequestKey,
  type CrmCustomersWorkspaceData,
  type CrmCustomersWorkspaceRequest,
} from "./customer-workspace-data";

export function useLiveCrmCustomersData(params: {
  request: CrmCustomersWorkspaceRequest;
  fallbackData: CrmCustomersWorkspaceData;
}) {
  const requestKey = customerWorkspaceRequestKey(params.request);
  const [initialKey] = useState(() =>
    customerWorkspaceRequestKey({
      tab: params.fallbackData.tab,
      page: params.fallbackData.page,
      search: params.fallbackData.search,
    })
  );
  const fetcher = useCallback(
    () =>
      refreshCrmCustomersWorkspaceAction({
        tab: params.request.tab,
        page: params.request.page,
        search: params.request.search,
      }),
    [params.request.page, params.request.search, params.request.tab]
  );

  return useGenerationAwareWorkspaceSWR<CrmCustomersWorkspaceData>(
    "crm-customers",
    requestKey,
    fetcher,
    requestKey === initialKey ? params.fallbackData : undefined
  );
}
