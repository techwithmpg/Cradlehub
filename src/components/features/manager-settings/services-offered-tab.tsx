"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Home,
  Plus,
  Search,
  Store,
  Trash2,
} from "lucide-react";
import {
  addBranchServiceAction,
  removeBranchServiceAction,
  updateBranchServiceEligibilityAction,
  updateBranchServicePriceAction,
  updateBranchServiceVisibilityAction,
} from "@/app/(dashboard)/owner/branches/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  GlobalService,
  ServiceLite,
} from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import { InlineSwitch } from "./setting-controls";
import { SettingsSectionCard } from "./settings-section-card";
import { formatCurrency } from "./settings-format";
import type { ActiveBranchService } from "./types";

type ServiceFilter =
  | "all"
  | "in_spa"
  | "home_service"
  | "public"
  | "csr_only"
  | "vip";

type ActionStatus = {
  type: "success" | "error";
  message: string;
};

type BranchServiceActionResult =
  | { success: true }
  | { success: false; error?: string };

type BranchServiceVisibility = "public" | "csr_only" | "vip";

function isActiveService(service: ServiceLite): service is ActiveBranchService {
  return service.is_active && service.services !== null;
}

function toBranchServiceVisibility(value: string): BranchServiceVisibility {
  if (value === "csr_only" || value === "vip") return value;
  return "public";
}

function getServiceName(service: ActiveBranchService) {
  return service.public_title?.trim() || service.services.name;
}

function getServiceDescription(service: ActiveBranchService) {
  return service.public_description?.trim() || service.services.description || null;
}

function getServiceDuration(service: ActiveBranchService) {
  return service.custom_duration_minutes ?? service.services.duration_minutes;
}

function getServiceVisibility(service: ActiveBranchService) {
  return service.visibility ?? service.booking_visibility ?? "public";
}

function getServiceCategory(service: ActiveBranchService) {
  const relation = service.services.service_categories;
  if (!relation) return null;
  const category = Array.isArray(relation) ? relation[0] : relation;
  return category?.name ?? null;
}

function getVisibilityOptions(service: ActiveBranchService) {
  const value = getServiceVisibility(service);
  const options: Array<{ value: BranchServiceVisibility; label: string }> = [
    { value: "public", label: "Public" },
    { value: "csr_only", label: "CSR only" },
    { value: "vip", label: "VIP" },
  ];

  if (!options.some((option) => option.value === value)) {
    options.push({
      value: toBranchServiceVisibility(value),
      label: value.replace(/_/g, " "),
    });
  }

  return options;
}

export function ServicesOfferedTab({
  branchId,
  services,
  allServices,
  loadError,
}: {
  branchId: string;
  services: ServiceLite[];
  allServices: GlobalService[];
  loadError?: string | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ServiceFilter>("all");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [status, setStatus] = useState<ActionStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeServices = useMemo(
    () => services.filter(isActiveService),
    [services]
  );
  const activeCatalogIds = useMemo(
    () =>
      new Set(
        activeServices.map((service) => service.service_id ?? service.services.id)
      ),
    [activeServices]
  );
  const availableToAdd = useMemo(
    () => allServices.filter((service) => !activeCatalogIds.has(service.id)),
    [activeCatalogIds, allServices]
  );
  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activeServices.filter((service) => {
      const name = getServiceName(service).toLowerCase();
      const category = getServiceCategory(service)?.toLowerCase() ?? "";
      const visibility = getServiceVisibility(service);
      const nameMatches =
        query.length === 0 ||
        name.includes(query) ||
        category.includes(query);
      const filterMatches =
        filter === "all" ||
        (filter === "in_spa" && (service.available_in_spa ?? true)) ||
        (filter === "home_service" &&
          (service.available_home_service ?? false)) ||
        (filter === "public" && visibility === "public") ||
        visibility === filter;

      return nameMatches && filterMatches;
    });
  }, [activeServices, filter, search]);

  function runServiceAction(
    label: string,
    action: () => Promise<BranchServiceActionResult>
  ) {
    setStatus(null);
    startTransition(() => {
      void (async () => {
        const result = await action();
        if (result.success) {
          setStatus({ type: "success", message: label });
          router.refresh();
          return;
        }

        setStatus({
          type: "error",
          message: result.error ?? "Service action failed.",
        });
      })();
    });
  }

  function handleAddService() {
    if (!selectedServiceId) return;

    runServiceAction("Service added to this branch.", async () => {
      const result = await addBranchServiceAction(branchId, selectedServiceId);
      if (result.success) setSelectedServiceId("");
      return result;
    });
  }

  function handleRemoveService(service: ActiveBranchService) {
    const confirmed = window.confirm(
      `Remove ${getServiceName(service)} from this branch?`
    );
    if (!confirmed) return;

    runServiceAction("Service removed from this branch.", () =>
      removeBranchServiceAction(branchId, service.service_id ?? service.services.id)
    );
  }

  function handleEligibilityChange(
    service: ActiveBranchService,
    field: "spa" | "home",
    checked: boolean
  ) {
    const nextInSpa = field === "spa" ? checked : service.available_in_spa;
    const nextHome =
      field === "home" ? checked : service.available_home_service;

    runServiceAction("Service availability updated.", () =>
      updateBranchServiceEligibilityAction(
        branchId,
        service.service_id ?? service.services.id,
        nextInSpa ?? true,
        nextHome ?? false
      )
    );
  }

  function handlePriceChange(service: ActiveBranchService, value: string) {
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);

    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setStatus({
        type: "error",
        message: "Enter a valid service price.",
      });
      return;
    }

    runServiceAction("Service price updated for this branch.", () =>
      updateBranchServicePriceAction(
        branchId,
        service.service_id ?? service.services.id,
        parsed
      )
    );
  }

  function handleVisibilityChange(
    service: ActiveBranchService,
    visibility: BranchServiceVisibility
  ) {
    runServiceAction("Service visibility updated for this branch.", () =>
      updateBranchServiceVisibilityAction(
        branchId,
        service.service_id ?? service.services.id,
        visibility
      )
    );
  }

  return (
    <SettingsSectionCard
      title="Active Services"
      description="Manage the services offered by this branch, including branch price, booking visibility, and in-spa or home-service availability."
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-[var(--cs-border)] bg-[var(--cs-sand-tint)] text-[var(--cs-sand-dark)]"
            >
              Active Services ({activeServices.length})
            </Badge>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_160px_minmax(220px,1fr)_auto] xl:min-w-[720px]">
            <label className="relative block">
              <span className="sr-only">Search service</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search service..."
                className="h-10 border-[var(--cs-border)] pl-9"
              />
            </label>

            <label>
              <span className="sr-only">Filter services</span>
              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as ServiceFilter)
                }
                className="h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm text-[var(--cs-text)]"
              >
                <option value="all">All</option>
                <option value="in_spa">In-spa</option>
                <option value="home_service">Home service</option>
                <option value="public">Public</option>
                <option value="csr_only">CSR only</option>
                <option value="vip">VIP</option>
              </select>
            </label>

            <label>
              <span className="sr-only">Add service from catalog</span>
              <select
                value={selectedServiceId}
                disabled={isPending || !!loadError || availableToAdd.length === 0}
                onChange={(event) => setSelectedServiceId(event.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm text-[var(--cs-text)] disabled:opacity-60"
              >
                <option value="">
                  {availableToAdd.length > 0
                    ? "Add service from catalog"
                    : "All catalog services added"}
                </option>
                {availableToAdd.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.duration_minutes} min)
                  </option>
                ))}
              </select>
            </label>

            <Button
              type="button"
              disabled={!selectedServiceId || isPending || !!loadError}
              className="bg-[var(--cs-sand)] text-white hover:bg-[var(--cs-sand-dark)]"
              onClick={handleAddService}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add Service
            </Button>
          </div>
        </div>

        {status ? (
          <Alert
            variant={status.type === "error" ? "destructive" : "default"}
            className={
              status.type === "error"
                ? "border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)]"
                : "border-[var(--cs-success-bg)] bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]"
            }
          >
            {status.type === "error" ? (
              <AlertTriangle className="size-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            )}
            <AlertTitle>
              {status.type === "error" ? "Action failed" : "Updated"}
            </AlertTitle>
            <AlertDescription
              className={
                status.type === "error"
                  ? undefined
                  : "text-[var(--cs-success-text)]/80"
              }
            >
              {status.message}
            </AlertDescription>
          </Alert>
        ) : null}

        {loadError ? (
          <Alert variant="destructive" className="border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)]">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertTitle>Unable to load branch services.</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        {loadError ? null : activeServices.length === 0 ? (
          <div className="rounded-[var(--cs-r-lg)] border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-4 py-10 text-center">
            <p className="text-sm font-semibold text-[var(--cs-text)]">
              No services offered at this branch.
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--cs-text-secondary)]">
              Add services from the global catalog so customers and staff have
              bookable options for this branch.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-[var(--cs-r-lg)] border border-[var(--cs-border-soft)] lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[var(--cs-surface-warm)] hover:bg-[var(--cs-surface-warm)]">
                    <TableHead className="px-4 text-xs font-bold text-[var(--cs-text)]">
                      Service
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[var(--cs-text)]">
                      Duration
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[var(--cs-text)]">
                      Price
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[var(--cs-text)]">
                      In-spa
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[var(--cs-text)]">
                      Home
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[var(--cs-text)]">
                      Visibility
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold text-[var(--cs-text)]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="px-4 font-semibold text-[var(--cs-text)]">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{getServiceName(service)}</span>
                            {service.is_featured ? (
                              <Badge variant="outline">Featured</Badge>
                            ) : null}
                          </div>
                          {getServiceCategory(service) ? (
                            <p className="text-xs font-normal text-[var(--cs-text-muted)]">
                              {getServiceCategory(service)}
                            </p>
                          ) : null}
                          {getServiceDescription(service) ? (
                            <p className="max-w-md text-xs font-normal leading-5 text-[var(--cs-text-secondary)]">
                              {getServiceDescription(service)}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-[var(--cs-text-secondary)]">
                        {getServiceDuration(service)} min
                      </TableCell>
                      <TableCell className="text-[var(--cs-text-secondary)]">
                        <BranchPriceControl
                          basePrice={service.services.price}
                          customPrice={service.custom_price}
                          disabled={isPending}
                          serviceName={getServiceName(service)}
                          onSave={(value) => handlePriceChange(service, value)}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineSwitch
                          label={`Toggle in-spa availability for ${service.services.name}`}
                          checked={service.available_in_spa ?? true}
                          disabled={isPending}
                          onChange={(checked) =>
                            handleEligibilityChange(service, "spa", checked)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <InlineSwitch
                          label={`Toggle home-service availability for ${service.services.name}`}
                          checked={service.available_home_service ?? false}
                          disabled={isPending}
                          onChange={(checked) =>
                            handleEligibilityChange(service, "home", checked)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <VisibilitySelect
                          disabled={isPending}
                          value={toBranchServiceVisibility(
                            getServiceVisibility(service)
                          )}
                          options={getVisibilityOptions(service)}
                          onChange={(value) =>
                            handleVisibilityChange(service, value)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleRemoveService(service)}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 lg:hidden">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="rounded-[var(--cs-r-lg)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-[var(--cs-text)]">
                        {getServiceName(service)}
                      </h3>
                      {getServiceCategory(service) ? (
                        <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                          {getServiceCategory(service)}
                        </p>
                      ) : null}
                      {getServiceDescription(service) ? (
                        <p className="mt-2 text-sm leading-5 text-[var(--cs-text-secondary)]">
                          {getServiceDescription(service)}
                        </p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-[var(--cs-text-secondary)]">
                        <span>{getServiceDuration(service)} min</span>
                        <span aria-hidden="true">·</span>
                        <BranchPriceControl
                          basePrice={service.services.price}
                          customPrice={service.custom_price}
                          disabled={isPending}
                          serviceName={getServiceName(service)}
                          onSave={(value) => handlePriceChange(service, value)}
                        />
                      </div>
                    </div>
                    <VisibilitySelect
                      disabled={isPending}
                      value={toBranchServiceVisibility(
                        getServiceVisibility(service)
                      )}
                      options={getVisibilityOptions(service)}
                      onChange={(value) =>
                        handleVisibilityChange(service, value)
                      }
                    />
                  </div>

                  <div className="mt-4 grid gap-3">
                    <MobileSwitchRow
                      icon={Store}
                      label="In-spa"
                      checked={service.available_in_spa ?? true}
                      disabled={isPending}
                      onChange={(checked) =>
                        handleEligibilityChange(service, "spa", checked)
                      }
                    />
                    <MobileSwitchRow
                      icon={Home}
                      label="Home service"
                      checked={service.available_home_service ?? false}
                      disabled={isPending}
                      onChange={(checked) =>
                        handleEligibilityChange(service, "home", checked)
                      }
                    />
                  </div>

                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    className="mt-4"
                    onClick={() => handleRemoveService(service)}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Remove service
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}

        {activeServices.length > 0 && filteredServices.length === 0 ? (
          <div className="rounded-[var(--cs-r-md)] border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-4 text-sm text-[var(--cs-text-secondary)]">
            No services match the current search or filter.
          </div>
        ) : null}
      </div>
    </SettingsSectionCard>
  );
}

function BranchPriceControl({
  basePrice,
  customPrice,
  disabled,
  serviceName,
  onSave,
}: {
  basePrice: number;
  customPrice: number | null;
  disabled: boolean;
  serviceName: string;
  onSave: (value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(customPrice ?? basePrice));

  if (!isEditing) {
    return (
      <button
        type="button"
        disabled={disabled}
        className="text-left text-sm text-[var(--cs-text-secondary)] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => {
          setDraft(String(customPrice ?? basePrice));
          setIsEditing(true);
        }}
      >
        {formatCurrency(customPrice ?? basePrice)}
        {customPrice !== null ? (
          <span className="ml-1 text-xs text-[var(--cs-text-muted)]">
            custom
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="number"
        min={0}
        value={draft}
        disabled={disabled}
        aria-label={`Custom price for ${serviceName}`}
        className="h-8 w-28 border-[var(--cs-border)] text-sm"
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        className="h-8 bg-[var(--cs-sand)] text-white hover:bg-[var(--cs-sand-dark)]"
        onClick={() => {
          onSave(draft);
          setIsEditing(false);
        }}
      >
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        className="h-8"
        onClick={() => setIsEditing(false)}
      >
        Cancel
      </Button>
      {customPrice !== null ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          className="h-8"
          onClick={() => {
            onSave("");
            setIsEditing(false);
          }}
        >
          Reset
        </Button>
      ) : null}
    </div>
  );
}

function VisibilitySelect({
  disabled,
  value,
  options,
  onChange,
}: {
  disabled: boolean;
  value: BranchServiceVisibility;
  options: Array<{ value: BranchServiceVisibility; label: string }>;
  onChange: (value: BranchServiceVisibility) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label="Booking visibility"
      onChange={(event) =>
        onChange(event.target.value as BranchServiceVisibility)
      }
      className="h-9 rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2 text-sm font-medium text-[var(--cs-text)] disabled:opacity-60"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function MobileSwitchRow({
  icon: Icon,
  label,
  checked,
  disabled,
  onChange,
}: {
  icon: typeof Store;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--cs-r-md)] bg-[var(--cs-surface-warm)] px-3 py-2">
      <span className="flex items-center gap-2 text-sm font-medium text-[var(--cs-text)]">
        <Icon className="size-4 text-[var(--cs-text-muted)]" aria-hidden="true" />
        {label}
      </span>
      <InlineSwitch
        label={label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
