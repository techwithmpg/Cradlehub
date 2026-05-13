import {
  ChevronRight,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  type LucideIcon,
} from "lucide-react";
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
    <div className="md:hidden bg-[#FBF6EC] pb-12 pt-14 text-[#10261D]">
      <section className="bg-[#082E22] px-5 pb-8 pt-9 text-center text-[#FCFAF5]">
        <h1
          className="text-[30px] font-medium leading-tight"
          style={{ fontFamily: "var(--sp-font-display)" }}
        >
          Contact Us
        </h1>
        <p className="mt-2 text-[13px] text-[#FCFAF5]/80">We&apos;re here to help.</p>
      </section>

      <section className="-mt-5 px-4">
        <div className="rounded-[12px] bg-[#FCFAF5] p-3 shadow-[0_10px_24px_rgba(16,38,29,0.12)]">
          {actions.map(({ label, href, external, Icon }, index) => (
            <a
              key={label}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className={[
                "flex min-h-12 items-center gap-4 rounded-[8px] border border-[#E8DDCA] bg-white px-4 text-[12px] font-semibold uppercase",
                index < actions.length - 1 ? "mb-2" : "",
              ].join(" ")}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#063D2D] text-[#C8A96B]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              {label}
            </a>
          ))}
        </div>
      </section>

      <section className="px-4 py-6">
        <h2 className="mb-3 text-[14px] font-semibold">Visit Our Branches</h2>
        <div className="rounded-[10px] bg-[#FCFAF5]">
          {branches.length > 0 ? (
            branches.map((branch) => (
              <a
                key={branch.id}
                href={branchMapHref(branch)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 border-b border-[#E8DDCA] py-4 last:border-b-0"
              >
                <MapPin className="h-5 w-5 shrink-0 text-[#B68A3C]" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold">{branch.name}</span>
                  <span className="block line-clamp-1 text-[11px] text-[#5F6F63]">
                    {branch.address}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-[#5F6F63]" aria-hidden="true" />
              </a>
            ))
          ) : (
            <div className="py-5 text-center">
              <MapPin className="mx-auto h-5 w-5 text-[#B68A3C]" aria-hidden="true" />
              <p className="mt-2 text-[12px] font-semibold">Branch details are being updated.</p>
              <p className="mt-1 text-[11px] text-[#5F6F63]">
                Please call us for the latest branch information.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-[#E8DDCA] pt-5">
          <h2 className="mb-3 text-[14px] font-semibold">Opening Hours</h2>
          <div className="flex items-center justify-between text-[12px]">
            <span>Daily</span>
            <span>{branches[0]?.opening_hours ?? "10:00 AM - 10:00 PM"}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
