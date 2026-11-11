import { deliverTeamFile } from '../../../../../utils/teamFileDelivery'
export default defineEventHandler(event => deliverTeamFile(event, true))
