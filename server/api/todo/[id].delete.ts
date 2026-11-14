import { prisma } from '../../utils/prisma'
import { todoId, todoOwner } from '../../utils/todo'

export default defineEventHandler(async event => {
    const owner = todoOwner(event)
    const id = todoId(getRouterParam(event, 'id'))
    await prisma.todo_items.deleteMany({ where: { user_id: owner, id } })
    return { success: true }
})
