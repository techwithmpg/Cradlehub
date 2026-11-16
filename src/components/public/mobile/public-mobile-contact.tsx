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
    <div className="md:hidden bg-[#071A12] pb-24 pt-16 text-[#FAF5E9]">
      <section className="border-b border-[#D4B57A]/15 bg-[#05140E] px-5 pb-12 pt-8 text-center text-[#FAF5E9]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#E5C98B]">
          Contact Us
        </p>
        <h1
          className="mt-2 text-[30px] font-medium leading-tight text-[#FAF5E9]"
          style={{ fontFamily: "var(--sp-font-display)" }}
        >
          We&apos;re Here to Help
        </h1>
        <p className="mt-2 text-[13px] text-[#CBD6CD]">
          Call, message, or visit our Bacolod sanctuaries.
        </p>
      </section>

      <section className="relative z-10 -mt-6 px-4">
        <div className="eg-glass-card rounded-2xl p-3">
          {actions.map(({ label, href, external, Icon }, index) => (
            <a
              key={label}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className={[
                "flex min-h-12 min-w-0 items-center gap-4 rounded-xl border border-[#D4B57A]/20 bg-[#0A251A]/80 px-4 text-[13px] font-semibold text-[#FAF5E9] transition hover:border-[#D4B57A]/45 hover:bg-[#103828]",
                index < actions.length - 1 ? "mb-2" : "",
              ].join(" ")}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D4B57A]/30 bg-[#071A12] text-[#E5C98B]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 truncate">{label}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="px-4 py-6">
        <h2
          className="mb-3 text-[16px] font-semibold text-[#FAF5E9]"
          style={{ fontFamily: "var(--sp-font-display)" }}
        >
          Visit Our Branches
        </h2>
        <div className="eg-glass-card rounded-2xl px-4">
          {branches.length > 0 ? (
            branches.map((branch) => (
              <a
                key={branch.id}
                href={branchMapHref(branch)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 border-b border-[#D4B57A]/15 py-4 last:border-b-0"
              >
                <MapPin
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#E5C98B]"
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[#FAF5E9]">
                    {branch.name}
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-[#CBD6CD]">
                    {branch.address}
                  </span>
                </span>
              </a>
            ))
          ) : (
            <div className="py-5 text-center">
              <MapPin className="mx-auto h-5 w-5 text-[#E5C98B]" aria-hidden="true" />
              <p className="mt-2 text-[12px] font-semibold text-[#FAF5E9]">
                Branch details are being updated.
              </p>
              <p className="mt-1 text-[11px] text-[#B7C6BC]">
                Please call us for the latest branch information.
              </p>
            </div>
          )}
        </div>

        <div className="eg-glass-card mt-4 rounded-2xl p-4">
          <h2
            className="mb-2 text-[15px] font-semibold text-[#FAF5E9]"
            style={{ fontFamily: "var(--sp-font-display)" }}
          >
            Opening Hours
          </h2>
          <div className="flex items-start justify-between gap-3 text-[12px] text-[#CBD6CD]">
            <span className="shrink-0 font-medium text-[#FAF5E9]">Daily</span>
            <span className="min-w-0 text-right leading-5 font-medium text-[#E5C98B]">
              {branches[0]?.opening_hours ?? "10:00 AM - 10:00 PM"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
