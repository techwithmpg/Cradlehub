import { Mail, MapPin, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import type { Database } from "@/types/supabase";

const CRADLE_FACEBOOK_HREF =
  "https://www.facebook.com/518084738045813?ref=NONE_xav_ig_profile_page_web";

type MobileContactBranch = Pick<
  Database["public"]["Tables"]["branches"]["Row"],
  "id" | "name" | "address" | "phone" | "secondary_phone" | "email" | "messenger_link" | "fb_page" | "opening_hours"
>;

type ContactAction = {
  label: string;
  href: string;
  external?: boolean;
  Icon: LucideIcon;
};

const MOBILE_PUBLIC_SURFACE =
  "md:hidden bg-[radial-gradient(circle_at_80%_8%,rgba(212,181,122,0.10),transparent_34%),linear-gradient(180deg,#031B16_0%,#05241D_50%,#02140F_100%)] pb-12 pt-14 text-[#F6EBD6]";
const MOBILE_GLASS_CARD =
  "box-border border border-[#D4B57A]/22 bg-[#0D2B20]/70 shadow-[0_24px_70px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(246,235,214,0.06)] backdrop-blur-xl";

function primaryPhoneHref(branch: MobileContactBranch | undefined) {
  if (branch?.phone) {
    return `tel:${branch.phone.replace(/\s/g, "")}`;
  }
  return "tel:+639177077070";
}

function branchMapHref(branch: MobileContactBranch) {
  return `https://maps.google.com/?q=${encodeURIComponent(branch.address || branch.name)}`;
}

function getContactActions(branches: MobileContactBranch[]): ContactAction[] {
  const firstBranchWithMessage = branches.find(
    (branch) => branch.messenger_link || branch.fb_page
  );
  const firstBranchWithEmail = branches.find((branch) => branch.email);
  const firstBranchWithPhone = branches.find((branch) => branch.phone);

  const actions: ContactAction[] = [
    {
      label: "Call Us",
      href: primaryPhoneHref(firstBranchWithPhone),
      Icon: Phone,
    },
  ];

  if (firstBranchWithMessage?.messenger_link || firstBranchWithMessage?.fb_page) {
    actions.push({
      label: "Message Us",
      href: firstBranchWithMessage.messenger_link ?? firstBranchWithMessage.fb_page ?? "",
      external: true,
      Icon: MessageCircle,
    });
  } else {
    actions.push({
      label: "Message Us",
      href: CRADLE_FACEBOOK_HREF,
      external: true,
      Icon: MessageCircle,
    });
  }

  if (firstBranchWithEmail?.email) {
    actions.push({
      label: "Send Email",
      href: `mailto:${firstBranchWithEmail.email}`,
      Icon: Mail,
    });
  }

  return actions;
}

export function PublicMobileContact({
  branches,
}: {
  branches: MobileContactBranch[];
}) {
  const actions = getContactActions(branches);

  return (
    <div className={MOBILE_PUBLIC_SURFACE}>
      <section className="bg-[#082E22] px-5 pb-8 pt-9 text-center text-[#FCFAF5]">
        <h1
          className="text-[30px] font-medium leading-tight"
          style={{ fontFamily: "var(--sp-font-display)" }}
        >
          Contact Us
        </h1>
        <p className="mt-2 text-[13px] text-[#FCFAF5]/80">We&apos;re here to help.</p>
      </section>

      <section className="-mt-5 overflow-hidden px-4">
        <div className={`max-w-full overflow-hidden rounded-[12px] p-3 ${MOBILE_GLASS_CARD}`}>
          {actions.map(({ label, href, external, Icon }, index) => (
            <a
              key={label}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className={[
                "flex min-h-12 min-w-0 items-center gap-4 rounded-[8px] border border-[#D4B57A]/22 bg-[#05241D]/72 px-4 text-[12px] font-semibold uppercase text-[#F6EBD6]",
                index < actions.length - 1 ? "mb-2" : "",
              ].join(" ")}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D4B57A]/22 bg-[#031B16]/70 text-[#D4B57A]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 truncate">{label}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="overflow-hidden px-4 py-6">
        <h2 className="mb-3 text-[14px] font-semibold text-[#F6EBD6]">Visit Our Branches</h2>
        <div className={`max-w-full overflow-hidden rounded-[10px] px-3 ${MOBILE_GLASS_CARD}`}>
          {branches.length > 0 ? (
            branches.map((branch) => (
              <a
                key={branch.id}
                href={branchMapHref(branch)}
                target="_blank"
                rel="noopener noreferrer"
                className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)] gap-3 overflow-hidden border-b border-[#D4B57A]/16 py-4 last:border-b-0"
              >
                <MapPin className="h-5 w-5 shrink-0 text-[#D4B57A]" aria-hidden="true" />
                <span
                  className="min-w-0 overflow-hidden"
                  style={{ maxWidth: "min(250px, calc(100vw - 130px))" }}
                >
                  <span className="block text-[12px] font-semibold leading-4 text-[#F6EBD6]">
                    {branch.name}
                  </span>
                  <span className="mt-1 block whitespace-normal text-[11px] leading-4 text-[#F6EBD6]/62">
                    {branch.address}
                  </span>
                </span>
              </a>
            ))
          ) : (
            <div className="py-5 text-center">
              <MapPin className="mx-auto h-5 w-5 text-[#D4B57A]" aria-hidden="true" />
              <p className="mt-2 text-[12px] font-semibold text-[#F6EBD6]">
                Branch details are being updated.
              </p>
              <p className="mt-1 text-[11px] text-[#F6EBD6]/62">
                Please call us for the latest branch information.
              </p>
            </div>
          )}
        </div>

        <div className={`mt-6 rounded-[10px] p-4 ${MOBILE_GLASS_CARD}`}>
          <h2 className="mb-3 text-[14px] font-semibold text-[#F6EBD6]">Opening Hours</h2>
          <div className="flex items-start justify-between gap-3 text-[12px] text-[#F6EBD6]/70">
            <span className="shrink-0">Daily</span>
            <span className="min-w-0 text-right leading-5 text-[#D4B57A]">
              {branches[0]?.opening_hours ?? "10:00 AM - 10:00 PM"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
