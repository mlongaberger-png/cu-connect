import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

const CU_LOGO = "https://media.base44.com/images/public/69bae2515552e76ca1fbd6a0/2ff00e9bd_file_0000000089d071f8be26c9f306ac7ce1.png";

const FALLBACK_POLICY = `
## 1. Introduction

Welcome to CU Connect ("App"), operated by Cornerstone United Athletics ("we," "us," or "our"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and website. Please read this policy carefully. If you disagree with its terms, please discontinue use of the App.

---

## 2. Information We Collect

**Account Information:** When you register, we collect your name, email address, phone number, and role (parent, guardian, coach, administrator).

**Athlete Information:** Coaches and administrators may enter athlete names, jersey numbers, positions, date of birth, parent contact details, medical notes, and emergency contact information.

**Communications:** Messages sent through the in-app messaging system are stored to facilitate team communication.

**Payment Information:** When processing fees or registrations, payment details are handled by Stripe, our PCI-compliant payment processor. We do not store full card numbers on our servers.

**Usage Data:** We collect information on how the App is accessed and used (e.g., log data, device type, pages visited) to improve functionality.

**Volunteer & Attendance Data:** We collect sign-up and RSVP information for volunteer opportunities and team events.

**Uploaded Files:** Documents, photos, and files you upload (e.g., waivers, team photos) are stored securely in our cloud infrastructure.

---

## 3. How We Use Your Information

We use the information we collect to:

- Provide, operate, and maintain the App and its features
- Manage team rosters, schedules, events, and communications
- Process payments and send payment-related notifications
- Send important updates about schedules, cancellations, and events
- Respond to inquiries and provide customer support
- Improve the App based on usage patterns
- Comply with legal obligations and enforce our Terms of Service

---

## 4. Children and Minor Athlete Data

Cornerstone United Athletics serves youth sports organizations. Athlete profiles may include information about minors (children under 13 and under 18).

- **Athlete profiles** are created and managed by authorized staff (coaches, administrators) or the parent/guardian of the minor.
- We do **not** knowingly collect personal information directly from children under 13. All minor athlete data is entered by adults.
- Parents and guardians have the right to review, correct, or request deletion of their child's information by contacting us.
- Athlete data (name, age, team, medical notes) is only visible to authorized staff and the athlete's linked parent or guardian.

If you believe we have inadvertently collected personal data from a child under 13 without proper parental consent, please contact us immediately at the address listed in Section 10.

---

## 5. Sharing of Your Information

We do not sell your personal information. We may share data in the following circumstances:

- **Within your organization:** Athlete and schedule data is shared with authorized coaches, administrators, and linked guardians within your Cornerstone United organization.
- **Service Providers:** We use trusted third-party service providers (e.g., Stripe for payments, cloud hosting providers) who process data on our behalf under strict data protection agreements.
- **Legal Requirements:** We may disclose information if required by law, court order, or government regulation.
- **Business Transfers:** In the event of a merger, acquisition, or sale of assets, user data may be transferred. We will notify affected users prior to any transfer.
- **With Your Consent:** We may share information for any other purpose with your explicit consent.

---

## 6. Payments and Third-Party Services

Payment processing is handled by **Stripe, Inc.** When you make a payment through the App:

- Payment card information is transmitted directly to Stripe's secure servers and is never stored on our systems.
- Stripe's Privacy Policy governs the processing of payment data: [https://stripe.com/privacy](https://stripe.com/privacy)
- We retain records of payment transactions (amounts, dates, descriptions) for bookkeeping and compliance.

---

## 7. Data Security

We implement industry-standard security measures to protect your personal information, including:

- Encrypted data transmission (HTTPS/TLS)
- Secure cloud-hosted infrastructure
- Role-based access controls (parents can only see their own children's data)
- Regular security reviews

However, no electronic transmission or storage system is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.

---

## 8. Account Deletion & Data Retention

**Account Deletion:** You may request deletion of your account at any time through the Account Settings page within the App or by contacting us at the address below. Upon deletion:

- Your personal profile and guardian links will be removed.
- Financial and compliance records may be retained as required by law.
- Anonymized aggregate data may be retained for statistical purposes.

**Data Retention:** We retain personal data only as long as necessary to provide the App's services or as required by law. Athlete records may be retained by administrators for compliance purposes beyond an individual account deletion.

---

## 9. Your Rights

Depending on your location, you may have the following rights regarding your personal data:

- **Access:** Request a copy of the personal data we hold about you.
- **Correction:** Request correction of inaccurate or incomplete data.
- **Deletion:** Request deletion of your personal data (subject to legal retention requirements).
- **Portability:** Request a portable copy of your data.
- **Opt-Out:** Opt out of non-essential communications at any time via Notification Settings.

To exercise any of these rights, please contact us using the information in Section 10.

---

## 10. Contact Us

If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us:

**Cornerstone United Athletics**
Email: privacy@cornerstoneunited.org

We will respond to your request within 30 days.

---

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy in the App and, where required, by email. Your continued use of the App after changes are posted constitutes your acceptance of the updated policy.

---

## 12. California Residents

If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal data we collect, the right to deletion, and the right to opt out of the sale of personal information. We do not sell personal information. To exercise your CCPA rights, contact us at the address above.

---

*Last updated: March 2026*
`;

function renderMarkdown(text) {
  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-foreground mt-8 mb-3">
          {line.replace("## ", "")}
        </h2>
      );
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="border-border my-4" />);
    } else if (line.startsWith("- ")) {
      elements.push(
        <li key={i} className="text-sm text-muted-foreground leading-relaxed ml-4 list-disc">
          <span dangerouslySetInnerHTML={{ __html: line.replace("- ", "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
        </li>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-muted-foreground leading-relaxed"
          dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, "<strong class='text-foreground'>$1</strong>") }}
        />
      );
    }
    i++;
  }

  return elements;
}

export default function PrivacyPolicy() {
  const { data: pages = [] } = useQuery({
    queryKey: ["legal-privacy-policy"],
    queryFn: () => base44.entities.LegalPage.filter({ page_type: "privacy_policy", is_published: true }),
  });

  const policy = pages[0];
  const content = policy?.content || FALLBACK_POLICY;
  const title = policy?.title || "Privacy Policy";
  const lastUpdated = policy?.updated_date
    ? new Date(policy.updated_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "March 2026";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link
          to="/welcome"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] pr-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0">
            <img src={CU_LOGO} alt="CU Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-semibold text-foreground text-sm truncate">Cornerstone United Athletics</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5 text-primary" />
          <span className="hidden sm:inline">Privacy</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-8 pb-16">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Legal</span>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        {/* Policy Body */}
        <div className="space-y-1">
          {renderMarkdown(content)}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 p-5 bg-card border border-border rounded-2xl text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Have questions about your privacy or data?
          </p>
          <a
            href="mailto:privacy@cornerstoneunited.org"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors min-h-[44px]"
          >
            Contact Us
          </a>
        </div>
      </main>

      <footer className="py-5 text-center text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} Cornerstone United Athletics · All rights reserved
      </footer>
    </div>
  );
}