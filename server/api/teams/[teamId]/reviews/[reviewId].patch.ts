import { throwError } from '../../../../utils/error'
import { collaborationText } from '../../../../utils/teamCollaboration'
import { readTeamBody, teamFile, teamParam, teamWrite } from '../../../../utils/teamSpaces'
import { reviewSelect, serializeTeamReview } from '../../../../utils/teamWork'

export default defineEventHandler(async event => {
    const id = teamParam(event, 'reviewId')
    const body = await readTeamBody(event)
    const status = body.status
    if (status !== 'APPROVED' && status !== 'CHANGES_REQUESTED') throwError(400, 'Invalid request body.')
    const note = collaborationText(body.note, 1000)
    return teamWrite(event, 'view', async (tx, team, actor) => {
        const review = await tx.team_file_reviews.findFirst({ where: { id, team_id: team.id }, select: reviewSelect })
        if (!review) throwError(404, 'File review not found.')
        if (review.reviewer_id !== actor) throwError(403, 'Only the assigned reviewer can respond.')
        const file = await teamFile(tx, team, review.file.id)
        if (review.revision !== file.revision) throwError(409, 'This file version has changed. Request a new review.')
        if (review.status === status && review.response_note === note)
            return { review: serializeTeamReview(review, actor, true) }
        if (review.status !== 'PENDING') throwError(409, 'This review has already been answered.')
        const updated = await tx.team_file_reviews.update({
            where: { id }, data: { status, response_note: note, responded_at: new Date() }, select: reviewSelect
        })
        return { review: serializeTeamReview(updated, actor, true) }
    })
})
