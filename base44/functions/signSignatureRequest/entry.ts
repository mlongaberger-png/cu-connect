import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

const schema = z.object({
  request_id: z.string(),
  signed_by_name: z.string().min(1),
}).strict();

// Self-service e-signature completion (ParentSignatureRequests.jsx's "Sign
// Document" flow). The old code called base44.entities.SignatureRequest.update()
// and base44.entities.PlayerDocument.create() directly from the client --
// but SignatureRequest's update RLS is admin/athletic_director ONLY, with no
// exception for the parent the request was actually addressed to. That meant
// literally no parent could ever complete a signature: every "Sign Document"
// click 403'd, and with no onError on that mutation the dialog just sat there
// with no feedback and the request stayed "pending" forever.
// This function re-implements the authorization inline (mirroring
// setAthletePauseState/inviteFamilyMember's ownership-check pattern): the
// caller must be the direct parent_email match or a linked PlayerGuardian for
// the request's player_id (or staff) before their signature is accepted. Once
// authorized, it performs both writes -- marking the request signed and
// creating the permanent PlayerDocument record -- together via asServiceRole,
// exactly matching what the old client-side code intended to do.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { request_id, signed_by_name } = parsed.data;

    const sigReq = await base44.asServiceRole.entities.SignatureRequest.get(request_id).catch(() => null);
    if (!sigReq) return Response.json({ error: 'Signature request not found.' }, { status: 404 });

    if (sigReq.status !== 'pending') {
      return Response.json({ error: 'This document has already been signed or is no longer pending.' }, { status: 409 });
    }

    const callerUsers = await base44.asServiceRole.entities.User.filter({ email: caller.email });
    const callerRole = callerUsers[0]?.role;
    const isStaff = ['admin', 'athletic_director', 'coach'].includes(callerRole);

    if (!isStaff) {
      const player = await base44.asServiceRole.entities.Player.get(sigReq.player_id).catch(() => null);
      if (!player) return Response.json({ error: 'Player not found.' }, { status: 404 });

      const isDirectParent = player.parent_email?.toLowerCase() === caller.email.toLowerCase();
      let isLinkedGuardian = false;
      if (!isDirectParent) {
        const links = await base44.asServiceRole.entities.PlayerGuardian.filter({
          player_id: sigReq.player_id,
          user_email: caller.email,
        });
        isLinkedGuardian = links.length > 0;
      }
      if (!isDirectParent && !isLinkedGuardian) {
        console.error(`signSignatureRequest: ${caller.email} has no access to player ${sigReq.player_id}, forbidden`);
        return Response.json({ error: 'You are not authorized to sign this document.' }, { status: 403 });
      }
    }

    const signedAt = new Date().toISOString();

    await base44.asServiceRole.entities.SignatureRequest.update(request_id, {
      status: 'signed',
      signed_by_email: caller.email,
      signed_by_name,
      signed_at: signedAt,
      signed_file_url: sigReq.file_url,
    });

    await base44.asServiceRole.entities.PlayerDocument.create({
      player_id: sigReq.player_id,
      player_name: sigReq.player_name,
      team_name: sigReq.team_name,
      doc_type: sigReq.doc_type === 'medical_form' ? 'physical'
        : sigReq.doc_type === 'liability_waiver' ? 'waiver'
        : sigReq.doc_type === 'consent_form' ? 'consent_form'
        : 'other',
      file_url: sigReq.file_url,
      file_name: sigReq.document_name,
      uploaded_by: caller.email,
      notes: `E-signed by ${signed_by_name} on ${signedAt}`,
    });

    console.log(`signSignatureRequest: ${caller.email} signed request ${request_id} for player ${sigReq.player_id}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('signSignatureRequest error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
