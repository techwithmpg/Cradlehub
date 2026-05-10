import PptxGenJS from "pptxgenjs";

const pres = new PptxGenJS();
pres.layout = "LAYOUT_16x9";
pres.author = "Malcom P. Gwanmesia";
pres.title = "CradleHub: Spa Booking and Management System";
pres.subject = "Final Project Presentation";

// ── Theme Colors ─────────────────────────────────────────────────────────────
const C = {
  bgCream: "F5F0E8",
  bgWhite: "FAFAFA",
  forest: "163A2B",
  gold: "C8A96B",
  black: "1C1917",
  grey: "4A4A4A",
  muted: "6B7A6F",
  lightGold: "F0ECE5",
};

// ── Master Slide ─────────────────────────────────────────────────────────────
pres.defineSlideMaster({
  title: "MASTER_SLIDE",
  background: { color: C.bgCream },
  objects: [
    {
      rect: { x: 0, y: 0, w: "100%", h: 0.08, fill: { color: C.gold } },
    },
    {
      text: {
        text: "CradleHub  |  Cradle Massage & Wellness Spa",
        options: {
          x: 0.4,
          y: 5.35,
          w: 9,
          h: 0.2,
          fontSize: 9,
          color: C.muted,
          fontFace: "Calibri",
        },
      },
    },
    {
      rect: { x: 0, y: 5.55, w: "100%", h: 0.06, fill: { color: C.forest } },
    },
  ],
});

pres.defineSlideMaster({
  title: "MASTER_DARK",
  background: { color: C.forest },
  objects: [
    {
      rect: { x: 0, y: 0, w: "100%", h: 0.08, fill: { color: C.gold } },
    },
    {
      text: {
        text: "CradleHub  |  Cradle Massage & Wellness Spa",
        options: {
          x: 0.4,
          y: 5.35,
          w: 9,
          h: 0.2,
          fontSize: 9,
          color: C.gold,
          fontFace: "Calibri",
        },
      },
    },
    {
      rect: { x: 0, y: 5.55, w: "100%", h: 0.06, fill: { color: C.gold } },
    },
  ],
});

// ── Helper: content slide ────────────────────────────────────────────────────
function addContentSlide(title, subtitle = "") {
  const slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slide.addText(title, {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.6,
    fontSize: 32,
    bold: true,
    color: C.forest,
    fontFace: "Calibri",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: 0.9,
      w: 9,
      h: 0.35,
      fontSize: 16,
      color: C.muted,
      fontFace: "Calibri",
    });
  }
  // Gold underline accent
  slide.addShape(pres.ShapeType.rect, {
    x: 0.5,
    y: subtitle ? 1.22 : 0.92,
    w: 1.5,
    h: 0.04,
    fill: { color: C.gold },
  });
  return slide;
}

// ── Helper: dark slide ───────────────────────────────────────────────────────
function addDarkSlide(title, subtitle = "") {
  const slide = pres.addSlide({ masterName: "MASTER_DARK" });
  slide.addText(title, {
    x: 0.5,
    y: subtitle ? 1.8 : 2.2,
    w: 9,
    h: 0.8,
    fontSize: 40,
    bold: true,
    color: C.gold,
    fontFace: "Calibri",
    align: "center",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: 2.7,
      w: 9,
      h: 0.5,
      fontSize: 18,
      color: C.bgCream,
      fontFace: "Calibri",
      align: "center",
    });
  }
  return slide;
}

// ── Helper: bullet list ──────────────────────────────────────────────────────
function addBullets(slide, items, startY) {
  let y = startY;
  for (const item of items) {
    slide.addText(
      [
        { text: "•  ", options: { color: C.gold, bold: true, fontSize: 14 } },
        { text: item, options: { color: C.grey, fontSize: 14 } },
      ],
      { x: 0.7, y, w: 8.8, h: 0.35, fontFace: "Calibri" }
    );
    y += 0.38;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title Slide
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addDarkSlide(
    "CradleHub",
    "Spa Booking and Management System"
  );
  slide.addText("A System Proposal for Cradle Massage & Wellness Spa", {
    x: 0.5,
    y: 3.3,
    w: 9,
    h: 0.4,
    fontSize: 16,
    color: C.bgWhite,
    align: "center",
    fontFace: "Calibri",
  });
  slide.addText("Presented by: Malcom P. Gwanmesia", {
    x: 0.5,
    y: 4.0,
    w: 9,
    h: 0.35,
    fontSize: 14,
    color: C.gold,
    align: "center",
    fontFace: "Calibri",
  });
  slide.addText("System Analysis and Design  |  Final Project Presentation", {
    x: 0.5,
    y: 4.4,
    w: 9,
    h: 0.3,
    fontSize: 12,
    color: C.bgWhite,
    align: "center",
    fontFace: "Calibri",
  });
  slide.addNotes(
    "Good morning/afternoon everyone. I am Malcom P. Gwanmesia, and today I will present my final project: CradleHub, a Spa Booking and Management System designed for Cradle Massage & Wellness Spa. This presentation will walk you through the company background, business needs, system features, project management charts, cost-benefit analysis, and a preview of the proposed system interface."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Presentation Flow
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Presentation Flow", "What we will cover today");
  const flowItems = [
    "1. Company Background",
    "2. Business Need & Purpose",
    "3. System Objectives & Scope",
    "4. Target Users & Functional Requirements",
    "5. Key System Features & Workflows",
    "6. Project Management: Gantt Chart & PERT Chart",
    "7. Cost-Benefit Analysis",
    "8. GUI Proposal / System Screens",
    "9. Summary & Q&A",
  ];
  addBullets(slide, flowItems, 1.5);
  slide.addNotes(
    "Here is the flow of our presentation. We will begin with the company background and current problems, then move into the purpose and objectives of CradleHub. After that, we will explore the system features, project management charts, cost-benefit analysis, and GUI proposal. Finally, we will summarize and open the floor for questions."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — Company Background
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide(
    "Company Background",
    "Cradle Massage & Wellness Spa"
  );
  addBullets(slide, [
    "Cradle Massage & Wellness Spa is a wellness service business offering massage and spa-related treatments.",
    "The spa serves both in-spa customers and home-service clients who prefer treatments at their location.",
    "Services include therapeutic massage, facial treatments, nail care, and other wellness therapies.",
    "The business operates across multiple branches and employs therapists, nail technicians, aestheticians, and support staff.",
    "As the business grows, the need for organized appointment handling, staff coordination, and customer service support becomes essential.",
  ], 1.5);
  slide.addNotes(
    "Cradle Massage & Wellness Spa is a real wellness business that provides professional massage and spa services. They cater to walk-in customers, online bookers, and home-service clients. With multiple branches and a growing team, the business needs a structured system to manage daily operations efficiently."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Current Problems / Pain Points
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide(
    "Current Problems",
    "Business Pain Points"
  );
  addBullets(slide, [
    "Manual appointment handling through calls and messages causes confusion and missed bookings.",
    "Staff availability is difficult to track across branches and shift schedules.",
    "Walk-in, online, and home-service bookings are scattered across different channels.",
    "Managers lack clear visibility into branch operations, staff schedules, and daily bookings.",
    "Customers need a faster, easier way to browse services and book appointments.",
    "Front desk staff need a simple, unified system to manage and confirm appointments.",
  ], 1.5);
  slide.addNotes(
    "These are the key problems the spa currently faces. Without a centralized system, bookings get lost, schedules clash, and both staff and customers experience frustration. Managers also struggle to get a clear picture of what is happening across branches."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Purpose of the System
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide(
    "Purpose of the System",
    "Why CradleHub is needed"
  );
  slide.addText(
    '"To make spa booking, scheduling, and daily operations faster, clearer, and more organized."',
    {
      x: 0.7,
      y: 1.5,
      w: 8.6,
      h: 0.8,
      fontSize: 20,
      italic: true,
      color: C.forest,
      align: "center",
      fontFace: "Calibri",
    }
  );
  addBullets(slide, [
    "Create a centralized platform for all booking types: online, walk-in, and home service.",
    "Replace manual scheduling with an automated availability engine.",
    "Give managers and owners clear visibility into staff, schedules, and branch operations.",
    "Provide customers with a professional, easy-to-use online booking experience.",
    "Support front desk staff with a simple CRM workspace for daily operations.",
  ], 2.5);
  slide.addNotes(
    "The purpose of CradleHub is straightforward: to centralize and automate the spa's booking and management workflows. Instead of scattered messages and paper notes, everything lives in one system. This reduces errors, saves time, and improves the experience for both customers and staff."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 6 — System Objectives
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("System Objectives", "Five clear goals");
  const objectives = [
    "Provide customers with an easy online booking experience — browse services, select branch, pick date and time, and choose a therapist preference.",
    "Help staff and managers view accurate, real-time appointment schedules and staff availability.",
    "Reduce manual booking errors and prevent double bookings through automated conflict checking.",
    "Support walk-in, online, and home-service appointment flows within a single platform.",
    "Give owners and managers a clearer, data-driven view of branch operations and business performance.",
  ];
  addBullets(slide, objectives, 1.5);
  slide.addNotes(
    "These five objectives guide the design of CradleHub. Each one addresses a specific pain point: customer convenience, schedule accuracy, error prevention, multi-channel support, and management visibility."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Scope of the System
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Scope of the System", "Included vs Future Expansion");

  // Included box
  slide.addShape(pres.ShapeType.rect, {
    x: 0.5,
    y: 1.5,
    w: 4.4,
    h: 3.2,
    fill: { color: C.bgWhite },
    line: { color: C.gold, width: 1.5 },
  });
  slide.addText("Included", {
    x: 0.7,
    y: 1.6,
    w: 4,
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: C.forest,
    fontFace: "Calibri",
  });
  const included = [
    "Public booking page",
    "Service listing & branch selection",
    "Customer appointment creation",
    "Staff availability checking",
    "Manager & CSR workspaces",
    "Staff portal & schedules",
    "Booking status tracking",
    "Basic reports & dashboard",
  ];
  let y = 2.05;
  for (const item of included) {
    slide.addText(
      [{ text: "✓  ", options: { color: C.gold, bold: true, fontSize: 12 } },
       { text: item, options: { color: C.grey, fontSize: 12 } }],
      { x: 0.7, y, w: 4, h: 0.28, fontFace: "Calibri" }
    );
    y += 0.32;
  }

  // Future box
  slide.addShape(pres.ShapeType.rect, {
    x: 5.1,
    y: 1.5,
    w: 4.4,
    h: 3.2,
    fill: { color: C.bgWhite },
    line: { color: C.muted, width: 1 },
  });
  slide.addText("Future Expansion", {
    x: 5.3,
    y: 1.6,
    w: 4,
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: C.muted,
    fontFace: "Calibri",
  });
  const future = [
    "Online payment integration",
    "SMS / Messenger / WhatsApp notifications",
    "Advanced analytics & reports",
    "Customer loyalty program",
    "Native mobile app version",
  ];
  y = 2.05;
  for (const item of future) {
    slide.addText(
      [{ text: "○  ", options: { color: C.muted, bold: true, fontSize: 12 } },
       { text: item, options: { color: C.grey, fontSize: 12 } }],
      { x: 5.3, y, w: 4, h: 0.28, fontFace: "Calibri" }
    );
    y += 0.32;
  }

  slide.addNotes(
    "This slide shows what is included in the current scope of CradleHub and what can be added in future versions. The core system handles booking, scheduling, and management. Future expansions like online payments and SMS reminders can be integrated once the business is ready."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Target Users and Roles
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Target Users & Roles", "Who will use CradleHub");
  const rows = [
    [
      { text: "User", options: { bold: true, color: C.forest, fontSize: 13 } },
      { text: "Role Description", options: { bold: true, color: C.forest, fontSize: 13 } },
    ],
    [
      { text: "Customer", options: { color: C.grey, fontSize: 12 } },
      { text: "Browses services and books appointments online", options: { color: C.grey, fontSize: 12 } },
    ],
    [
      { text: "CSR / Front Desk", options: { color: C.grey, fontSize: 12 } },
      { text: "Creates walk-in bookings and manages daily appointments", options: { color: C.grey, fontSize: 12 } },
    ],
    [
      { text: "Manager", options: { color: C.grey, fontSize: 12 } },
      { text: "Manages staff, schedules, services, and branch operations", options: { color: C.grey, fontSize: 12 } },
    ],
    [
      { text: "Service Staff", options: { color: C.grey, fontSize: 12 } },
      { text: "Views assigned appointments and weekly schedules", options: { color: C.grey, fontSize: 12 } },
    ],
    [
      { text: "Owner", options: { color: C.grey, fontSize: 12 } },
      { text: "Monitors branches, staff, bookings, and business performance", options: { color: C.grey, fontSize: 12 } },
    ],
  ];
  slide.addTable(rows, {
    x: 0.6,
    y: 1.5,
    w: 8.8,
    h: 2.8,
    fontFace: "Calibri",
    border: { type: "solid", pt: 0.5, color: C.lightGold },
    fill: { color: C.bgWhite },
    colW: [2.5, 6.3],
    align: "left",
    valign: "middle",
  });
  slide.addNotes(
    "CradleHub is designed for five user groups. Customers use the public booking page. CSR and front desk staff use the CRM workspace. Managers handle staff and schedules. Service staff view their appointments. Owners monitor the overall business performance."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 9 — Functional Requirements
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Functional Requirements", "What the system must do");
  addBullets(slide, [
    "Customer can view available services with descriptions, durations, and prices.",
    "Customer can book an appointment by selecting branch, service, date, time, and therapist preference.",
    "System checks real-time staff availability and prevents double bookings.",
    "CSR can create or manage bookings for walk-in customers.",
    "Manager can manage staff profiles, schedules, services, and branch resources.",
    "Service staff can view assigned appointments and update booking progress.",
    "Owner can view business summaries, branch performance, and booking reports.",
    "System tracks booking statuses: pending, confirmed, in-progress, completed, cancelled, no-show.",
  ], 1.5);
  slide.addNotes(
    "These functional requirements define what CradleHub must be able to do. They cover the full lifecycle of a booking: from customer browsing to staff assignment to status tracking and reporting."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 10 — Non-Functional Requirements
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Non-Functional Requirements", "Quality and performance standards");
  addBullets(slide, [
    "User-friendly interface with clear navigation and visual feedback.",
    "Mobile responsive design for booking on phones and tablets.",
    "Fast loading pages with optimized database queries.",
    "Secure login with role-based access control for different user types.",
    "Reliable booking validation to prevent conflicts and data errors.",
    "Organized database with proper relationships and indexing.",
    "Scalable architecture to support multiple branches and growing staff.",
    "Clear error messages and helpful validation feedback.",
    "Professional visual design aligned with spa branding.",
  ], 1.5);
  slide.addNotes(
    "Non-functional requirements ensure the system is not just functional, but also usable, fast, secure, and professional. These standards guide the design decisions for the user interface, database, and deployment architecture."
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 11 — Key System Features Overview
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Key System Features", "Ten core capabilities");
  const features = [
    ["Public Booking Wizard", "Online service selection, branch pick, date/time slots, therapist choice"],
    ["Service Management", "Add, edit, categorize, and price spa services"],
    ["Branch Management", "Configure branches, resources, and booking rules"],
    ["Staff Scheduling", "Set weekly schedules, day overrides, and blocked times"],
    ["Availability Engine", "Real-time slot checking with conflict prevention"],
    ["CRM / Front Desk", "Walk-in booking, customer lookup, status updates"],
    ["Manager Workspace", "Dashboard, staff mgmt, schedules, bookings, reports"],
    ["Staff Portal", "My appointments, today’s schedule, weekly view"],
    ["Booking Tracking", "Statuses: pending, confirmed, in-progress, completed, cancelled, no-show"],
    ["Dashboard & Reports", "Daily summaries, payment tracking, branch stats"],
  ];
  let y = 1.45;
  for (const [title, desc] of features) {
    // Feature card background
    slide.addShape(pres.ShapeType.rect, {
      x: 0.5,
      y,
      w: 9,
      h: 0.34,
      fill: { color: C.bgWhite },
      line: { color: C.lightGold, width: 0.5 },
    });
    slide.addText(title, {
      x: 0.65,
      y: y + 0.04,
      w: 2.6,
      h: 0.26,
      fontSize: 12,
      bold: true,
      color: C.forest,
      fontFace: "Calibri",
    });
    slide.addText(desc, {
      x: 3.4,
      y: y + 0.04,
      w: 5.9,
      h: 0.26,
      fontSize: 12,
      color: C.grey,
      fontFace: "Calibri",
    });
    y += 0.38;
  }
  slide.addNotes(
    "CradleHub offers ten core features. The public booking wizard is the customer-facing entry point. Behind that, managers can configure services, branches, and staff. The availability engine prevents double bookings. The CRM workspace helps front desk staff. The staff portal keeps therapists informed. Dashboards give owners the big picture."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 12 — Booking Workflow
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Booking Workflow", "How a customer books an appointment");
  const steps = [
    "Customer selects a service from the spa menu",
    "Customer chooses a branch location",
    "Customer picks a preferred date and available time slot",
    "Customer selects a specific therapist or chooses 'Any Available Therapist'",
    "Customer enters contact details and submits the booking",
    "System checks real-time staff availability and blocks conflicting slots",
    "Booking is created with status 'pending' or 'confirmed'",
    "Staff and manager can view the appointment in their schedules",
  ];
  addBullets(slide, steps, 1.5);
  slide.addText(
    "The system is designed to reduce double bookings and organize appointments automatically.",
    {
      x: 0.7,
      y: 4.7,
      w: 8.6,
      h: 0.4,
      fontSize: 13,
      italic: true,
      color: C.forest,
      align: "center",
      fontFace: "Calibri",
    }
  );
  slide.addNotes(
    "This is the customer booking workflow. Each step is simple and guided. The system checks availability in real time, so customers only see times when a qualified therapist is free. This prevents the double-booking problem that manual systems often face."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 13 — Staff and Schedule Workflow
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Staff & Schedule Workflow", "How schedules drive availability");
  const steps = [
    "Manager sets each staff member's weekly schedule and working hours",
    "System stores recurring schedules and any day-specific overrides",
    "Booking engine queries staff availability for the selected date and service",
    "Only staff with valid schedules and no conflicts appear as available",
    "Appointment is assigned to the selected or auto-assigned therapist",
    "Staff views the assigned booking in their portal schedule",
  ];
  addBullets(slide, steps, 1.5);
  slide.addText(
    "Staff schedules are the foundation of accurate availability.",
    {
      x: 0.7,
      y: 4.5,
      w: 8.6,
      h: 0.4,
      fontSize: 13,
      italic: true,
      color: C.forest,
      align: "center",
      fontFace: "Calibri",
    }
  );
  slide.addNotes(
    "Behind every available time slot is a staff schedule. Managers set weekly hours, and the system respects those hours when generating slots. If a therapist is off, on break, or already booked, the system hides those slots automatically. This keeps the schedule accurate and trustworthy."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 14 — Gantt Chart
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Project Management: Gantt Chart", "Development timeline across 8 weeks");
  const tasks = [
    { label: "Requirement Gathering & Company Background", weekStart: 1, weekEnd: 1, color: C.forest },
    { label: "System Analysis & Feature Planning", weekStart: 2, weekEnd: 2, color: C.forest },
    { label: "Database & Architecture Design", weekStart: 3, weekEnd: 3, color: C.forest },
    { label: "GUI Design & Prototype", weekStart: 4, weekEnd: 4, color: C.gold },
    { label: "Booking Workflow Development", weekStart: 5, weekEnd: 5, color: C.gold },
    { label: "Staff & Manager Workspace Development", weekStart: 6, weekEnd: 6, color: C.gold },
    { label: "Testing & Debugging", weekStart: 7, weekEnd: 7, color: C.muted },
    { label: "Final Documentation & Presentation", weekStart: 8, weekEnd: 8, color: C.muted },
  ];

  // Header row
  slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.45, w: 3.8, h: 0.35, fill: { color: C.forest } });
  slide.addText("Task", { x: 0.55, y: 1.48, w: 3.7, h: 0.3, fontSize: 11, bold: true, color: C.bgWhite, fontFace: "Calibri" });
  for (let w = 1; w <= 8; w++) {
    slide.addShape(pres.ShapeType.rect, { x: 4.4 + (w - 1) * 0.65, y: 1.45, w: 0.63, h: 0.35, fill: { color: C.forest } });
    slide.addText(`W${w}`, { x: 4.4 + (w - 1) * 0.65, y: 1.48, w: 0.63, h: 0.3, fontSize: 10, bold: true, color: C.bgWhite, align: "center", fontFace: "Calibri" });
  }

  let y = 1.85;
  for (const task of tasks) {
    slide.addShape(pres.ShapeType.rect, { x: 0.5, y, w: 3.8, h: 0.32, fill: { color: C.bgWhite }, line: { color: C.lightGold, width: 0.5 } });
    slide.addText(task.label, { x: 0.55, y: y + 0.03, w: 3.7, h: 0.26, fontSize: 10, color: C.grey, fontFace: "Calibri" });
    for (let w = 1; w <= 8; w++) {
      const active = w >= task.weekStart && w <= task.weekEnd;
      slide.addShape(pres.ShapeType.rect, {
        x: 4.4 + (w - 1) * 0.65,
        y,
        w: 0.63,
        h: 0.32,
        fill: { color: active ? task.color : C.bgWhite },
        line: { color: C.lightGold, width: 0.5 },
      });
    }
    y += 0.35;
  }

  slide.addNotes(
    "This Gantt chart shows the 8-week development plan. Weeks 1 through 3 focus on planning and design. Weeks 4 through 6 are the core development phase for the GUI, booking engine, and workspaces. Week 7 is for testing and debugging. Week 8 is for documentation and this presentation."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 15 — PERT Chart
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Project Management: PERT Chart", "Task dependencies and flow");

  // Helper to draw a node
  function drawNode(s, x, y, label, id, color) {
    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: 1.3, h: 0.45, fill: { color },
      line: { color: C.bgWhite, width: 1 },
      rectRadius: 0.08,
    });
    s.addText(id, { x, y: y + 0.03, w: 1.3, h: 0.2, fontSize: 11, bold: true, color: C.bgWhite, align: "center", fontFace: "Calibri" });
    s.addText(label, { x, y: y + 0.2, w: 1.3, h: 0.22, fontSize: 8, color: C.bgWhite, align: "center", fontFace: "Calibri" });
  }

  // Helper to draw arrow
  function drawArrow(s, x1, y1, x2, y2) {
    s.addShape(pres.ShapeType.line, {
      x: Math.min(x1, x2), y: Math.min(y1, y2),
      w: Math.abs(x2 - x1) || 0.01, h: Math.abs(y2 - y1) || 0.01,
      line: { color: C.muted, width: 1.5, beginArrowType: "none", endArrowType: "arrow" },
    });
  }

  // Row 1
  drawNode(slide, 0.6, 1.55, "Requirement\nGathering", "A", C.forest);
  drawNode(slide, 2.4, 1.55, "Company\nBackground", "B", C.forest);
  drawNode(slide, 4.2, 1.55, "System Feature\nAnalysis", "C", C.forest);
  drawArrow(slide, 1.9, 1.78, 2.4, 1.78);
  drawArrow(slide, 3.7, 1.78, 4.2, 1.78);

  // Row 2
  drawNode(slide, 4.2, 2.35, "Database\nDesign", "D", C.gold);
  drawNode(slide, 6.0, 2.35, "GUI\nDesign", "E", C.gold);
  drawArrow(slide, 4.85, 2.0, 4.85, 2.35);
  drawArrow(slide, 5.5, 2.0, 6.35, 2.35);

  // Row 3
  drawNode(slide, 5.1, 3.15, "Booking\nModule", "F", C.gold);
  drawArrow(slide, 4.85, 2.8, 5.35, 3.15);
  drawArrow(slide, 6.65, 2.8, 5.75, 3.15);

  // Row 4
  drawNode(slide, 3.8, 3.95, "Staff Schedule\nModule", "G", C.gold);
  drawNode(slide, 6.0, 3.95, "Manager/CSR\nWorkspace", "H", C.gold);
  drawArrow(slide, 5.75, 3.6, 4.45, 3.95);
  drawArrow(slide, 5.75, 3.6, 6.65, 3.95);

  // Row 5
  drawNode(slide, 5.1, 4.75, "Testing", "I", C.muted);
  drawArrow(slide, 4.45, 4.4, 5.35, 4.75);
  drawArrow(slide, 6.65, 4.4, 5.75, 4.75);

  // Row 6
  drawNode(slide, 5.1, 5.35, "Documentation", "J", C.muted);
  drawArrow(slide, 5.75, 5.2, 5.75, 5.35);
  drawNode(slide, 7.4, 5.35, "Presentation", "K", C.muted);
  drawArrow(slide, 6.4, 5.58, 7.4, 5.58);

  slide.addNotes(
    "The PERT chart shows task dependencies. Requirements lead to background study, which leads to feature analysis. From there, database design and GUI design happen in parallel. Both feed into the booking module. The booking module then branches into staff scheduling and manager workspaces. Testing follows development, then documentation, and finally the presentation."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 16 — Cost-Benefit Analysis
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Cost-Benefit Analysis", "Investment vs value");

  // Costs
  slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.5, w: 4.4, h: 3.2, fill: { color: C.bgWhite }, line: { color: C.gold, width: 1.5 } });
  slide.addText("Costs", { x: 0.7, y: 1.6, w: 4, h: 0.4, fontSize: 18, bold: true, color: C.forest, fontFace: "Calibri" });
  addBullets(slide, [
    "Development time & labor",
    "Hosting & domain registration",
    "Database / Supabase setup",
    "UI design & testing effort",
    "Ongoing maintenance",
    "Staff training & onboarding",
  ], 2.05);

  // Benefits
  slide.addShape(pres.ShapeType.rect, { x: 5.1, y: 1.5, w: 4.4, h: 3.2, fill: { color: C.bgWhite }, line: { color: C.forest, width: 1.5 } });
  slide.addText("Benefits", { x: 5.3, y: 1.6, w: 4, h: 0.4, fontSize: 18, bold: true, color: C.forest, fontFace: "Calibri" });
  addBullets(slide, [
    "Faster booking process",
    "Fewer scheduling mistakes",
    "Better staff coordination",
    "Better customer experience",
    "More professional image",
    "Easier management & reporting",
  ], 2.05);

  slide.addNotes(
    "The cost-benefit analysis compares what the spa invests versus what it gains. Costs are mainly development time, hosting, and training. Benefits include faster operations, fewer errors, happier customers, and a more professional business image that can lead to more bookings."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 17 — Estimated Cost Table
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Estimated Costs", "Realistic student-project budget");
  const rows = [
    [{ text: "Cost Item", options: { bold: true, color: C.forest, fontSize: 13 } },
     { text: "Estimated Amount", options: { bold: true, color: C.forest, fontSize: 13 } }],
    [{ text: "Development (design + coding)", options: { color: C.grey, fontSize: 12 } },
     { text: "₱40,000", options: { color: C.grey, fontSize: 12 } }],
    [{ text: "Domain & Hosting (yearly)", options: { color: C.grey, fontSize: 12 } },
     { text: "₱1,500 – ₱5,000", options: { color: C.grey, fontSize: 12 } }],
    [{ text: "Database / Backend Tools", options: { color: C.grey, fontSize: 12 } },
     { text: "Free tier to paid plan", options: { color: C.grey, fontSize: 12 } }],
    [{ text: "Maintenance (monthly, optional)", options: { color: C.grey, fontSize: 12 } },
     { text: "₱2,000 – ₱5,000", options: { color: C.grey, fontSize: 12 } }],
    [{ text: "Training / Setup", options: { color: C.grey, fontSize: 12 } },
     { text: "Included or minimal", options: { color: C.grey, fontSize: 12 } }],
  ];
  slide.addTable(rows, {
    x: 1.5,
    y: 1.6,
    w: 7,
    h: 2.4,
    fontFace: "Calibri",
    border: { type: "solid", pt: 0.5, color: C.lightGold },
    fill: { color: C.bgWhite },
    colW: [4, 3],
    align: "left",
    valign: "middle",
  });
  slide.addText(
    "Note: Costs are estimates and may vary depending on actual deployment needs.",
    { x: 0.7, y: 4.5, w: 8.6, h: 0.3, fontSize: 11, italic: true, color: C.muted, align: "center", fontFace: "Calibri" }
  );
  slide.addNotes(
    "These are realistic estimates for a student-project level system. The main cost is development time. Hosting and database can start on free tiers and scale as the business grows. Maintenance costs are optional and depend on how much support the spa needs after launch."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 18 — Expected Benefits
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Expected Benefits", "Tangible and intangible value");

  slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.5, w: 4.4, h: 3.0, fill: { color: C.bgWhite }, line: { color: C.gold, width: 1.5 } });
  slide.addText("Tangible Benefits", { x: 0.7, y: 1.6, w: 4, h: 0.4, fontSize: 18, bold: true, color: C.forest, fontFace: "Calibri" });
  addBullets(slide, [
    "Reduced manual work for front desk staff",
    "Faster booking confirmation for customers",
    "Better use of staff time and schedules",
    "Better appointment tracking and history",
    "Potential increase in online bookings",
  ], 2.05);

  slide.addShape(pres.ShapeType.rect, { x: 5.1, y: 1.5, w: 4.4, h: 3.0, fill: { color: C.bgWhite }, line: { color: C.forest, width: 1.5 } });
  slide.addText("Intangible Benefits", { x: 5.3, y: 1.6, w: 4, h: 0.4, fontSize: 18, bold: true, color: C.forest, fontFace: "Calibri" });
  addBullets(slide, [
    "Better customer trust and satisfaction",
    "More professional business image",
    "Less stress for staff and managers",
    "Improved decision-making with clear data",
    "Better service consistency across branches",
  ], 2.05);

  slide.addNotes(
    "Tangible benefits are measurable: less manual work, faster bookings, better staff utilization. Intangible benefits are equally important: customer trust, professional image, and reduced stress for the team. Together, they create a stronger, more competitive spa business."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 19 — GUI Proposal: Public Home Page
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("GUI Proposal: Public Home Page", "Customer-facing landing page");
  const sections = [
    ["Hero Section", "Welcoming spa imagery with brand logo and tagline"],
    ["Book Appointment CTA", "Prominent button to start the booking wizard"],
    ["Services Preview", "Grid of featured spa services with images and descriptions"],
    ["Branch / Location", "Branch cards with addresses and contact details"],
    ["Trust Section", "Customer testimonials and spa certifications"],
    ["Contact / Footer", "Phone, email, social links, and business hours"],
  ];
  let y = 1.5;
  for (const [title, desc] of sections) {
    slide.addShape(pres.ShapeType.rect, { x: 0.5, y, w: 9, h: 0.5, fill: { color: C.bgWhite }, line: { color: C.lightGold, width: 0.5 } });
    slide.addText(title, { x: 0.65, y: y + 0.05, w: 2.4, h: 0.4, fontSize: 12, bold: true, color: C.forest, fontFace: "Calibri" });
    slide.addText(desc, { x: 3.2, y: y + 0.05, w: 6.1, h: 0.4, fontSize: 12, color: C.grey, fontFace: "Calibri" });
    y += 0.55;
  }
  slide.addNotes(
    "The public home page is the first impression for customers. It features a premium hero section, clear call-to-action to book, service previews, branch information, and trust signals. The design uses warm cream, forest green, and gold to match the spa's brand identity."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 20 — GUI Proposal: Public Booking Wizard
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("GUI Proposal: Booking Wizard", "Step-by-step customer booking");
  const steps = [
    ["1", "Choose Service", "Customer selects one or more spa services"],
    ["2", "Choose Branch", "Customer picks the branch location"],
    ["3", "Choose Date & Time", "Calendar shows available slots based on staff schedules"],
    ["4", "Choose Therapist", "Customer selects a specific therapist or auto-assign"],
    ["5", "Enter Details", "Name, phone, email, and any special requests"],
    ["6", "Confirm Booking", "Summary page with booking confirmation"],
  ];
  let y = 1.5;
  for (const [num, title, desc] of steps) {
    slide.addShape(pres.ShapeType.ellipse, { x: 0.6, y: y + 0.05, w: 0.35, h: 0.35, fill: { color: C.gold } });
    slide.addText(num, { x: 0.6, y: y + 0.08, w: 0.35, h: 0.3, fontSize: 12, bold: true, color: C.bgWhite, align: "center", fontFace: "Calibri" });
    slide.addText(title, { x: 1.1, y: y + 0.03, w: 2.2, h: 0.3, fontSize: 13, bold: true, color: C.forest, fontFace: "Calibri" });
    slide.addText(desc, { x: 3.5, y: y + 0.03, w: 5.8, h: 0.3, fontSize: 12, color: C.grey, fontFace: "Calibri" });
    if (num !== "6") {
      slide.addShape(pres.ShapeType.line, { x: 0.77, y: y + 0.42, w: 0.01, h: 0.18, line: { color: C.gold, width: 2 } });
    }
    y += 0.55;
  }
  slide.addNotes(
    "The booking wizard is a six-step guided experience. Customers never feel lost because each step is clear and visual. The system checks availability in real time, so customers only see valid options. The therapist step now shows role labels instead of internal tiers, keeping the experience customer-friendly."
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 21 — GUI Proposal: CRM / Front Desk Workspace
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("GUI Proposal: CRM / Front Desk", "Daily operations workspace");
  const items = [
    ["Today's Bookings", "Overview of all appointments for the current day with status badges"],
    ["Create Walk-in Booking", "Quick booking form for customers who arrive without an appointment"],
    ["Customer Details", "Search and view customer contact info and booking history"],
    ["Booking Status", "Update status: confirm, check-in, complete, cancel, or no-show"],
    ["Staff Assignment", "Assign or reassign therapists to bookings"],
    ["Schedule View", "Daily timeline showing all staff schedules and booking blocks"],
  ];
  let y = 1.5;
  for (const [title, desc] of items) {
    slide.addShape(pres.ShapeType.rect, { x: 0.5, y, w: 9, h: 0.5, fill: { color: C.bgWhite }, line: { color: C.lightGold, width: 0.5 } });
    slide.addText(title, { x: 0.65, y: y + 0.05, w: 2.6, h: 0.4, fontSize: 12, bold: true, color: C.forest, fontFace: "Calibri" });
    slide.addText(desc, { x: 3.4, y: y + 0.05, w: 5.9, h: 0.4, fontSize: 12, color: C.grey, fontFace: "Calibri" });
    y += 0.55;
  }
  slide.addNotes(
    "The CRM workspace is designed for front desk staff. It shows today's bookings at a glance, allows quick walk-in creation, and makes it easy to update booking statuses. The schedule view gives a visual timeline of who is working and when."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 22 — GUI Proposal: Manager Workspace
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("GUI Proposal: Manager Workspace", "Operations and staff management");
  const items = [
    ["Dashboard Summary", "Daily stats: bookings, revenue, staff availability, and branch performance"],
    ["Staff Management", "Add, edit, and organize staff by branch with role and schedule info"],
    ["Schedule Management", "Set weekly hours, day overrides, and blocked times for each staff member"],
    ["Booking List", "Filterable list of all bookings with status, payment, and action menus"],
    ["Branch Resources", "Manage rooms, beds, and equipment with availability tracking"],
    ["Services & Reports", "Update service catalog and view basic business reports"],
  ];
  let y = 1.5;
  for (const [title, desc] of items) {
    slide.addShape(pres.ShapeType.rect, { x: 0.5, y, w: 9, h: 0.5, fill: { color: C.bgWhite }, line: { color: C.lightGold, width: 0.5 } });
    slide.addText(title, { x: 0.65, y: y + 0.05, w: 2.6, h: 0.4, fontSize: 12, bold: true, color: C.forest, fontFace: "Calibri" });
    slide.addText(desc, { x: 3.4, y: y + 0.05, w: 5.9, h: 0.4, fontSize: 12, color: C.grey, fontFace: "Calibri" });
    y += 0.55;
  }
  slide.addNotes(
    "The manager workspace is the command center for branch operations. It combines a dashboard with staff management, schedule editing, booking oversight, resource tracking, and reporting. Everything a manager needs is in one place."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 23 — GUI Proposal: Staff Portal
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("GUI Proposal: Staff Portal", "Therapist and service staff view");
  const items = [
    ["My Appointments", "List of today's assigned bookings with customer and service details"],
    ["Today's Schedule", "Visual timeline of the staff member's work hours and appointments"],
    ["Booking Details", "View full booking info: customer, service, time, branch, and notes"],
    ["Status Updates", "Update booking progress: travel, arrived, session started, completed"],
    ["Weekly View", "Seven-day calendar showing all upcoming appointments"],
    ["Stats & Profile", "Personal performance summary and profile settings"],
  ];
  let y = 1.5;
  for (const [title, desc] of items) {
    slide.addShape(pres.ShapeType.rect, { x: 0.5, y, w: 9, h: 0.5, fill: { color: C.bgWhite }, line: { color: C.lightGold, width: 0.5 } });
    slide.addText(title, { x: 0.65, y: y + 0.05, w: 2.6, h: 0.4, fontSize: 12, bold: true, color: C.forest, fontFace: "Calibri" });
    slide.addText(desc, { x: 3.4, y: y + 0.05, w: 5.9, h: 0.4, fontSize: 12, color: C.grey, fontFace: "Calibri" });
    y += 0.55;
  }
  slide.addNotes(
    "The staff portal is designed for therapists and service staff. It focuses on what they need most: their appointments, their schedule, and the ability to update booking progress. The weekly view helps them plan ahead."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 24 — System Architecture Overview
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("System Architecture", "How CradleHub is structured");

  // Public layer
  slide.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: 1.5, w: 2.8, h: 1.0, fill: { color: C.gold }, rectRadius: 0.1,
  });
  slide.addText("Public Website", { x: 0.5, y: 1.6, w: 2.8, h: 0.3, fontSize: 13, bold: true, color: C.bgWhite, align: "center", fontFace: "Calibri" });
  slide.addText("Booking, Services, Branches, About, Contact", { x: 0.5, y: 1.95, w: 2.8, h: 0.4, fontSize: 10, color: C.bgWhite, align: "center", fontFace: "Calibri" });

  // Arrow down
  slide.addShape(pres.ShapeType.line, { x: 1.9, y: 2.5, w: 0.01, h: 0.4, line: { color: C.muted, width: 2, endArrowType: "arrow" } });

  // Booking Engine
  slide.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: 2.9, w: 2.8, h: 0.9, fill: { color: C.forest }, rectRadius: 0.1,
  });
  slide.addText("Booking Engine", { x: 0.5, y: 3.05, w: 2.8, h: 0.3, fontSize: 13, bold: true, color: C.gold, align: "center", fontFace: "Calibri" });
  slide.addText("Availability RPC, Conflict Checking", { x: 0.5, y: 3.35, w: 2.8, h: 0.4, fontSize: 10, color: C.bgWhite, align: "center", fontFace: "Calibri" });

  // Arrow right
  slide.addShape(pres.ShapeType.line, { x: 3.3, y: 3.35, w: 0.6, h: 0.01, line: { color: C.muted, width: 2, endArrowType: "arrow" } });

  // Database
  slide.addShape(pres.ShapeType.roundRect, {
    x: 3.9, y: 2.9, w: 2.2, h: 0.9, fill: { color: C.muted }, rectRadius: 0.1,
  });
  slide.addText("Supabase DB", { x: 3.9, y: 3.05, w: 2.2, h: 0.3, fontSize: 13, bold: true, color: C.bgWhite, align: "center", fontFace: "Calibri" });
  slide.addText("PostgreSQL + Auth + RLS", { x: 3.9, y: 3.35, w: 2.2, h: 0.4, fontSize: 10, color: C.bgWhite, align: "center", fontFace: "Calibri" });

  // Arrow up from DB to Admin
  slide.addShape(pres.ShapeType.line, { x: 5.0, y: 2.5, w: 0.01, h: 0.4, line: { color: C.muted, width: 2, endArrowType: "arrow" } });

  // Admin Workspaces
  slide.addShape(pres.ShapeType.roundRect, {
    x: 3.9, y: 1.5, w: 5.6, h: 1.0, fill: { color: C.bgWhite }, line: { color: C.forest, width: 2 }, rectRadius: 0.1,
  });
  slide.addText("Admin Workspaces", { x: 3.9, y: 1.58, w: 5.6, h: 0.25, fontSize: 13, bold: true, color: C.forest, align: "center", fontFace: "Calibri" });
  slide.addText("Owner  |  Manager  |  CRM / Front Desk  |  Staff Portal", { x: 3.9, y: 1.95, w: 5.6, h: 0.4, fontSize: 11, color: C.grey, align: "center", fontFace: "Calibri" });

  // Tech stack note
  slide.addText(
    "Built with: Next.js + TypeScript + Tailwind CSS + Supabase + Vercel",
    { x: 0.5, y: 4.6, w: 9, h: 0.3, fontSize: 12, italic: true, color: C.muted, align: "center", fontFace: "Calibri" }
  );

  slide.addNotes(
    "CradleHub uses a modern web architecture. The public website and admin workspaces are built with Next.js and Tailwind CSS. The booking engine runs as Supabase RPC functions for speed and reliability. Supabase provides the database, authentication, and row-level security. Deployment is on Vercel for fast global delivery."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 25 — Tools and Technologies Used
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Tools & Technologies", "The technology stack");
  const techs = [
    ["Frontend", "Next.js 15, TypeScript, Tailwind CSS", "Responsive, fast, type-safe UI"],
    ["UI Components", "shadcn/ui", "Consistent, accessible design system"],
    ["Backend / Database", "Supabase PostgreSQL", "Relational DB with real-time support"],
    ["Authentication", "Supabase Auth", "Secure login with role-based access"],
    ["Deployment", "Vercel", "Fast global hosting with CI/CD"],
    ["Version Control", "GitHub", "Collaborative code management"],
  ];
  let y = 1.5;
  for (const [category, tools, purpose] of techs) {
    slide.addShape(pres.ShapeType.rect, { x: 0.5, y, w: 9, h: 0.5, fill: { color: C.bgWhite }, line: { color: C.lightGold, width: 0.5 } });
    slide.addText(category, { x: 0.65, y: y + 0.05, w: 2.0, h: 0.4, fontSize: 12, bold: true, color: C.forest, fontFace: "Calibri" });
    slide.addText(tools, { x: 2.8, y: y + 0.05, w: 3.2, h: 0.4, fontSize: 12, color: C.grey, fontFace: "Calibri" });
    slide.addText(purpose, { x: 6.2, y: y + 0.05, w: 3.1, h: 0.4, fontSize: 11, italic: true, color: C.muted, fontFace: "Calibri" });
    y += 0.55;
  }
  slide.addNotes(
    "The tech stack is modern and proven. Next.js provides server-side rendering and API routes. TypeScript ensures type safety. Tailwind CSS enables rapid styling. Supabase handles the database, auth, and real-time features. Vercel deploys the app globally with minimal configuration."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 26 — Why This System Is Useful
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Why CradleHub Is Useful", "Real business value");
  addBullets(slide, [
    "It solves real booking and scheduling problems that spas face every day.",
    "It helps the spa look more professional with a branded online presence.",
    "It supports both customer-facing and staff-facing workflows in one platform.",
    "It can grow from a booking system into a complete business management solution.",
    "It improves speed, organization, and customer service quality.",
    "It reduces manual work so staff can focus on delivering great service.",
  ], 1.5);
  slide.addNotes(
    "CradleHub is useful because it addresses real problems. Spas lose bookings when customers have to call or message. Staff get confused when schedules are on paper. Managers lack visibility. CradleHub fixes all of these with one system that grows with the business."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 27 — Limitations
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Limitations", "Honest scope boundaries");
  addBullets(slide, [
    "Full online payment integration requires business account setup with providers like GCash or PayMongo.",
    "Real-time SMS and messaging notifications can be added in a future version.",
    "Staff role permissions may need refinement as the organization structure evolves.",
    "Actual testing depends on real business schedules, staff data, and customer traffic.",
    "Mobile app version is planned but not included in the current web-based scope.",
  ], 1.5);
  slide.addNotes(
    "Every system has limitations, and it is important to be transparent about them. Online payments and SMS notifications are powerful features but require third-party integrations. The current system is designed as a web application, with a mobile app as a future possibility."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 28 — Future Improvements
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Future Improvements", "What comes next");
  addBullets(slide, [
    "GCash / PayMongo payment integration for online pre-payment and deposits.",
    "SMS / Messenger / WhatsApp reminders and booking confirmations.",
    "Customer account and profile system with booking history.",
    "Loyalty rewards program for repeat customers.",
    "Advanced owner reports with revenue trends and staff performance.",
    "Native mobile app for iOS and Android.",
    "AI assistant for booking support and customer inquiries.",
  ], 1.5);
  slide.addNotes(
    "The future roadmap for CradleHub includes payment integration, automated notifications, customer loyalty, advanced analytics, and a mobile app. These features can be added incrementally as the business grows and the budget allows."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 29 — Final Summary
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addContentSlide("Final Summary", "What CradleHub offers");
  slide.addText(
    '"CradleHub is a proposed spa booking and management system that helps Cradle Massage & Wellness Spa manage appointments, staff schedules, branches, and customer bookings in one organized platform."',
    {
      x: 0.7,
      y: 1.5,
      w: 8.6,
      h: 1.0,
      fontSize: 18,
      italic: true,
      color: C.forest,
      align: "center",
      fontFace: "Calibri",
    }
  );
  addBullets(slide, [
    "Improves customer convenience with online booking.",
    "Strengthens staff coordination with real-time schedules.",
    "Gives managers and owners clear operational visibility.",
    "Replaces manual processes with an organized, automated system.",
    "Provides a foundation for future growth and expansion.",
  ], 2.7);
  slide.addNotes(
    "To summarize, CradleHub is more than just a booking page. It is a complete operations platform for the spa. It improves the customer experience, helps staff stay organized, gives managers the tools they need, and creates a foundation for future growth. Thank you for listening."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 30 — Thank You / Q&A
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = addDarkSlide("Thank You!", "Questions & Answers");
  slide.addText("Presented by: Malcom P. Gwanmesia", {
    x: 0.5, y: 3.4, w: 9, h: 0.4, fontSize: 16, color: C.bgWhite, align: "center", fontFace: "Calibri",
  });
  slide.addText("System Analysis and Design  |  Final Project", {
    x: 0.5, y: 3.85, w: 9, h: 0.3, fontSize: 12, color: C.gold, align: "center", fontFace: "Calibri",
  });
  slide.addNotes(
    "Thank you for your attention. I am now ready to answer any questions about CradleHub, the system design, the booking workflow, the project timeline, or anything else you would like to discuss."
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SAVE
// ══════════════════════════════════════════════════════════════════════════════
pres.writeFile({ fileName: "CradleHub_Presentation.pptx" })
  .then(() => console.log("✅ Presentation saved: CradleHub_Presentation.pptx"))
  .catch((err) => console.error("❌ Failed to save presentation:", err));
