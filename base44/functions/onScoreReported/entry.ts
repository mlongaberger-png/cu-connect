import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const event = payload.data;
    if (!event || !event.result || !event.team_id) {
      return Response.json({ skipped: true, reason: "No result or team_id" });
    }

    const teamId = event.team_id;
    const teamName = event.team_name || "Your team";
    const sportName = event.sport_name || "";
    const opponent = event.opponent ? `vs ${event.opponent}` : "";
    const scoreText = (event.our_score && event.opponent_score)
      ? `${event.our_score}–${event.opponent_score}`
      : null;

    const resultEmoji = event.result === "win" ? "🏆" : event.result === "loss" ? "😤" : "🤝";
    const resultWord = event.result === "win" ? "Won" : event.result === "loss" ? "Lost" : "Tied";
    const isChamp = event.is_championship_win;

    const headline = isChamp
      ? `🏆 CHAMPIONSHIP WIN! ${teamName} are champions!`
      : `${resultEmoji} ${teamName} ${resultWord}${scoreText ? ` ${scoreText}` : ""}${opponent ? ` ${opponent}` : ""}!`;

    const body = [
      sportName && `Sport: ${sportName}`,
      event.date && `Date: ${event.date}`,
      scoreText && `Final Score: ${scoreText}`,
      opponent && `Opponent: ${event.opponent}`,
      isChamp && "🎉 Championship victory!"
    ].filter(Boolean).join(" · ");

    // 1. Create an announcement for the team
    await base44.asServiceRole.entities.Announcement.create({
      title: headline,
      content: body,
      target: "team",
      target_id: teamId,
      target_name: teamName,
      is_pinned: isChamp || false,
    });

    // 2. Post a message in the team channel
    try {
      const teamChannels = await base44.asServiceRole.entities.Channel.filter({ team_id: teamId, type: 'team' });
      const teamChannel = teamChannels[0];
      if (teamChannel) {
        await base44.asServiceRole.entities.Message.create({
          channel_id: teamChannel.id,
          content_text: `${headline}\n${body}`,
          message_type: 'text',
          sender_name: 'Score Bot',
          sender_user_id: 'system',
        });
      }
    } catch (e) {
      console.warn(`Failed to post team message: ${e.message}`);
    }

    // 3. Find all players on the team and get their parent emails
    const players = await base44.asServiceRole.entities.Player.filter({ team_id: teamId, is_active: true });
    const parentEmails = [...new Set(players.map(p => p.parent_email).filter(Boolean))];

    console.log(`Score reported: ${headline}`);
    console.log(`Team: ${teamName} | Players: ${players.length} | Parent emails: ${parentEmails.length}`);

    // 4. Send push notifications — team_id enforces parent-team association at the push layer
    if (parentEmails.length > 0) {
      try {
        await base44.asServiceRole.functions.invoke('sendPushNotification', {
          user_emails: parentEmails,
          title: headline,
          body: body || "Check the app for details.",
          url: "/Dashboard",
          team_id: teamId,
        });
      } catch (e) {
        console.warn(`Push failed: ${e.message}`);
      }
    }

    // 6. Send email to parents who may not have push
    for (const email of parentEmails) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: headline,
          body: `<h2>${headline}</h2><p>${body}</p><p>Log in to the app to see full details and upcoming events.</p>`,
        });
      } catch (e) {
        console.warn(`Email failed for ${email}: ${e.message}`);
      }
    }

    return Response.json({
      success: true,
      headline,
      notified_parents: parentEmails.length,
    });

  } catch (error) {
    console.error("onScoreReported error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});