import { throwError } from '../../../utils/error'
import { collaborationId, collaborationText, requireTeamParticipant } from '../../../utils/teamCollaboration'
import { readTeamBody, teamFile, teamWrite } from '../../../utils/teamSpaces'
import { reviewSelect, serializeTeamReview } from '../../../utils/teamWork'

export default defineEventHandler(async event => {
    const body = await readTeamBody(event)
    const fileId = collaborationId(body.fileId)
    const note = collaborationText(body.note, 1000)
    return teamWrite(event, 'view', async (tx, team, actor) => {
        const file = await teamFile(tx, team, fileId)
        const reviewer = await requireTeamParticipant(tx, team, body.reviewerId)
        if (reviewer === actor) throwError(400, 'Choose another team member to review the file.')
        const key = { team_id: team.id, file_id: fileId, revision: file.revision, reviewer_id: reviewer }
        const existing = await tx.team_file_reviews.findFirst({
            where: { ...key, status: 'PENDING' },
            select: { ...reviewSelect, requested_by_id: true }
        })
        if (existing && (existing.requested_by_id !== actor || existing.request_note !== note))
            throwError(409, 'This reviewer already has an open request for this file version.')
        const review = existing ?? await tx.team_file_reviews.create({
            data: { ...key, requested_by_id: actor, request_note: note },
            select: reviewSelect
        })
        return { review: serializeTeamReview(review, actor, true) }
    })
})
