import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Parses a safety officer's coach compliance spreadsheet (Excel/CSV, PDF, or
// image) using AI and returns extracted rows for review before import.
// Mirrors the established parseRosterFile pattern (AI extraction via
// InvokeLLM + file_urls + response_json_schema) since coach lists arrive in
// unpredictable column layouts, same as roster files.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    // Import-only management action -- admin/AD, same as CoachCompliance RLS.
    if (!user || (user.role !== 'admin' && user.role !== 'athletic_director')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are extracting a coach compliance list (background checks and NAYS/coaching-certification training) from a document.

Extract ALL coaches listed in this document.

For each coach, extract:
- user_name: coach's full name
- user_email: coach's email address if listed, else empty string
- bg_check_passed: true if the document indicates a background check was completed/passed for this coach, false if explicitly marked not done/failed/missing, else false
- bg_check_expires: background check expiration date in YYYY-MM-DD format if available, else empty string
- nays_completed: true if the document indicates NAYS or equivalent coaching training/certification was completed, false otherwise
- nays_expires: training/certification expiration date in YYYY-MM-DD format if available, else empty string
- notes: any other relevant notes about this coach's compliance (e.g. "cert pending", "renewal submitted"), else empty string

Dates may appear in many formats (MM/DD/YYYY, "Jan 2027", etc.) -- normalize to YYYY-MM-DD. If only a year or month/year is given, use the 1st of that month/year.

Return ONLY coaches you can confidently identify by name. If a field is unknown, use an empty string (or false for booleans) — never null.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          coaches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                user_name: { type: "string" },
                user_email: { type: "string" },
                bg_check_passed: { type: "boolean" },
                bg_check_expires: { type: "string" },
                nays_completed: { type: "boolean" },
                nays_expires: { type: "string" },
                notes: { type: "string" },
              }
            }
          }
        }
      }
    });

    const rawCoaches = result?.coaches;
    if (!Array.isArray(rawCoaches)) {
      const msg = 'AI returned no parseable coach array from the file. The document may be scanned, image-only, or in an unsupported format.';
      console.error('parseCoachComplianceFile: bad LLM output', JSON.stringify(result));
      return Response.json({
        coaches: [],
        parse_error: true,
        parse_error_message: msg,
        parse_error_detail: JSON.stringify(result).slice(0, 500),
      }, { status: 422 });
    }

    const coaches = rawCoaches
      .filter(c => c.user_name) // drop fully empty rows
      .map(c => ({
        user_name: c.user_name || '',
        user_email: (c.user_email || '').trim(),
        bg_check_passed: !!c.bg_check_passed,
        bg_check_expires: c.bg_check_expires || '',
        nays_completed: !!c.nays_completed,
        nays_expires: c.nays_expires || '',
        notes: c.notes || '',
      }));

    if (coaches.length === 0) {
      console.warn('parseCoachComplianceFile: 0 usable coaches extracted');
      return Response.json({
        coaches: [],
        parse_error: true,
        parse_error_message: 'No coaches with valid names could be extracted from this document.',
      }, { status: 422 });
    }

    console.log(`Parsed ${coaches.length} coaches from compliance file`);
    return Response.json({ coaches, parse_error: false });
  } catch (error) {
    console.error('parseCoachComplianceFile error:', error.message);
    return Response.json({
      coaches: [],
      parse_error: true,
      parse_error_message: `Unexpected error during parsing: ${error.message}`,
    }, { status: 500 });
  }
});
