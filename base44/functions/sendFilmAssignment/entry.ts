import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !["admin", "athletic_director", "coach"].includes(user.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { assignment_id } = await req.json();
    if (!assignment_id) return Response.json({ error: "assignment_id required" }, { status: 400 });

    // Fetch the assignment
    const assignments = await base44.asServiceRole.entities.FilmAssignment.filter({ id: assignment_id });
    const assignment = assignments[0];
    if (!assignment) return Response.json({ error: "Assignment not found" }, { status: 404 });

    // Fetch the film clip
    const clips = await base44.asServiceRole.entities.FilmClip.filter({ id: assignment.film_clip_id });
    const clip = clips[0];
    if (!clip) return Response.json({ error: "Film clip not found" }, { status: 404 });

    // Fetch players assigned
    const allPlayers = await base44.asServiceRole.entities.Player.filter({ team_id: assignment.team_id });
    let targetPlayers = [];
    if (assignment.assigned_to === "all") {
      targetPlayers = allPlayers.filter(p => p.is_active !== false);
    } else {
      try {
        const ids = JSON.parse(assignment.assigned_to);
        targetPlayers = allPlayers.filter(p => ids.includes(p.id));
      } catch {
        targetPlayers = allPlayers.filter(p => p.is_active !== false);
      }
    }

    const appUrl = `https://app.base44.com/apps/${Deno.env.get("BASE44_APP_ID")}/ParentPortal#film`;
    const dueText = assignment.due_date ? ` — due ${new Date(assignment.due_date + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "";

    let emailsSent = 0;
    const errors = [];

    for (const player of targetPlayers) {
      const recipientEmail = player.parent_email;
      const recipientName = player.parent_name || "Parent/Guardian";

      if (!recipientEmail) continue;

      const subject = `📹 New Film Assignment: ${clip.title}`;
      const body = `Hi ${recipientName},

${user.full_name || "Your coach"} has assigned new film for ${player.first_name} ${player.last_name} to watch.

🎬 Film: ${clip.title}
📋 Team: ${assignment.team_name}${dueText}
${assignment.instructions ? `\n📝 Notes: ${assignment.instructions}\n` : ""}
Watch here: ${appUrl}

This assignment is tracked — so please make sure ${player.first_name} watches the film before the due date.

— Cornerstone United Athletics`;

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: recipientEmail,
          subject,
          body,
        });
        emailsSent++;
      } catch (err) {
        console.error(`Failed to email ${recipientEmail}:`, err.message);
        errors.push(recipientEmail);
      }

      // Also email athlete if they have an account
      if (player.athlete_email && player.athlete_email !== recipientEmail) {
        const athleteSubject = `📹 Film Assignment: ${clip.title}`;
        const athleteBody = `Hey ${player.first_name},

You have a new film assignment to watch.

🎬 Film: ${clip.title}
📋 Team: ${assignment.team_name}${dueText}
${assignment.instructions ? `\n📝 Notes: ${assignment.instructions}\n` : ""}
Watch here: ${appUrl}

Your watch time is being tracked. Make sure you watch before the due date!

— ${user.full_name || "Your Coach"}`;

        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: player.athlete_email,
            subject: athleteSubject,
            body: athleteBody,
          });
          emailsSent++;
        } catch (err) {
          console.error(`Failed to email athlete ${player.athlete_email}:`, err.message);
        }
      }
    }

    return Response.json({ success: true, emails_sent: emailsSent, errors });
  } catch (error) {
    console.error("sendFilmAssignment error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});