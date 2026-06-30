import React, { useState } from "react";
import { HelpCircle, ChevronDown, ChevronRight, Search, MessageSquare, DollarSign, Users, FileText, Calendar, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";

const FAQ_SECTIONS = [
  {
    id: "payments",
    label: "Payments & Invoices",
    icon: DollarSign,
    color: "text-green-400",
    bg: "bg-green-500/10",
    faqs: [
      { q: "How do I pay an invoice?", a: "Go to the Payments tab in your Parent Portal. You'll see all outstanding balances for each player. Click 'Pay Now' to be securely redirected to our payment processor. Use test card 4242 4242 4242 4242 in sandbox mode." },
      { q: "What if my payment failed?", a: "If a payment fails, the invoice will remain marked as 'Unpaid'. Try again with a different card, or contact your admin if the issue persists. Common causes include incorrect card details or insufficient funds." },
      { q: "Can I pay for multiple players at once?", a: "Yes! If you have multiple players, click 'Pay All Balances' at the top of the Payments tab to settle all outstanding invoices in a single transaction." },
      { q: "When will I receive a payment receipt?", a: "A receipt is automatically emailed to you after a successful payment. Check your spam folder if you don't see it within a few minutes." },
    ],
  },
  {
    id: "volunteers",
    label: "Volunteer Sign-ups",
    icon: Users,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    faqs: [
      { q: "How do I sign up to volunteer?", a: "Navigate to the Volunteers tab in your Parent Portal. You'll see open slots with dates, times, and roles. Click 'Sign Up' on any available opportunity. Spots are first-come, first-served." },
      { q: "Can I cancel a volunteer sign-up?", a: "Yes, as long as the signup deadline hasn't passed and the slot isn't locked by an admin. Go to your Volunteers tab, find your assignment, and click 'Cancel'." },
      { q: "How do I add a volunteer shift to my calendar?", a: "After signing up, click 'Export to Calendar' to download an .ics file compatible with Google Calendar, Apple Calendar, and Outlook." },
      { q: "What happens if I miss a volunteer shift?", a: "Your admin will mark the assignment as 'No Show'. This is tracked in the system. Contact your admin if you need to excuse an absence." },
    ],
  },
  {
    id: "documents",
    label: "Documents & Signatures",
    icon: FileText,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    faqs: [
      { q: "I received a signature request — what do I do?", a: "Go to the Documents tab in your Parent Portal. Pending signature requests appear at the top. Click 'View & Sign', review the document, enter your full name, check the agreement box, and click 'Sign Document'." },
      { q: "How do I upload a required document (birth certificate, physical, etc.)?", a: "In the Documents tab, scroll to your child's document section. Click 'Upload' next to the required document type, select your file, and confirm. Accepted formats: PDF, JPG, PNG." },
      { q: "Can I download a document I already signed?", a: "Yes. In the Documents tab, completed signature requests show a 'View Document' button. Click it to open the original document in a new tab." },
    ],
  },
  {
    id: "schedule",
    label: "Schedule & Events",
    icon: Calendar,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    faqs: [
      { q: "Where can I see my child's upcoming events?", a: "The Overview tab shows upcoming events. The Schedule tab provides a full month/week/day calendar view filtered to your child's team(s) only." },
      { q: "How do I export the schedule to my calendar app?", a: "On the Schedule tab, click 'Export'. You can download an .ics file for your current team or copy a live subscription URL that automatically updates when the schedule changes." },
      { q: "What do I do if an event is cancelled?", a: "Cancelled events will appear crossed out or removed from the schedule. Your admin may send an announcement. Enable schedule notifications to get alerted automatically." },
    ],
  },
  {
    id: "account",
    label: "Account & Access",
    icon: ShieldCheck,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    faqs: [
      { q: "Why can't I see my child's information?", a: "Your account must be linked to your child's player profile. Go to the Parent Portal — if not linked, you'll see an option to search by player name. If your child isn't found, contact your admin to verify the email on file." },
      { q: "How do I invite another guardian (co-parent) to access the portal?", a: "On your child's player card in the Overview tab, click 'Invite Co-Guardian', enter their email, and they'll receive an invitation. Both guardians will have full read access." },
      { q: "How do I update my notification preferences?", a: "Click the bell icon or your profile name in the top bar and select 'Notification Settings'. You can enable/disable notifications per category and set quiet hours." },
      { q: "What if I forget my password?", a: "On the login page, click 'Forgot Password'. You'll receive a password reset email. Check your spam folder if it doesn't arrive within a few minutes." },
    ],
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface/50 transition-colors"
      >
        <span className="text-sm font-medium text-foreground pr-4">{q}</span>
        {open ? <ChevronDown className="w-4 h-4 text-primary flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function HelpCenter() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("all");

  const filteredSections = FAQ_SECTIONS.map(section => ({
    ...section,
    faqs: section.faqs.filter(faq =>
      !search ||
      faq.q.toLowerCase().includes(search.toLowerCase()) ||
      faq.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(s => (activeSection === "all" || s.id === activeSection) && s.faqs.length > 0);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <HelpCircle className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Help Center</h1>
        <p className="text-sm text-muted-foreground">Find answers to common questions about Cornerstone United</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search for help..."
          className="pl-9 bg-surface border-border"
        />
      </div>

      {/* Category Pills */}
      {!search && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveSection("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeSection === "all" ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground border border-border"}`}
          >
            All Topics
          </button>
          {FAQ_SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeSection === s.id ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground border border-border"}`}
              >
                <Icon className="w-3 h-3" /> {s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* FAQ Sections */}
      {filteredSections.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No results found for "{search}"</p>
          <p className="text-xs text-muted-foreground mt-1">Try different keywords or browse topics above</p>
        </div>
      ) : (
        filteredSections.map(section => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className={`flex items-center gap-3 px-5 py-4 border-b border-border`}>
                <div className={`w-8 h-8 rounded-lg ${section.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${section.color}`} />
                </div>
                <h2 className="font-semibold text-foreground">{section.label}</h2>
              </div>
              {section.faqs.map((faq, i) => <FAQItem key={i} {...faq} />)}
            </div>
          );
        })
      )}

      {/* Contact Admin */}
      <div className="bg-primary/10 border border-primary/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <MessageSquare className="w-8 h-8 text-primary flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-foreground">Still need help?</p>
          <p className="text-sm text-muted-foreground mt-0.5">Send a message through the Messages tab and your admin will get back to you.</p>
        </div>
      </div>

    </div>
  );
}