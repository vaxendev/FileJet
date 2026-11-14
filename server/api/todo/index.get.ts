import { prisma } from '../../utils/prisma'
import { todoOwner, todoSelect } from '../../utils/todo'

export default defineEventHandler(async event => {
    const owner = todoOwner(event)
    const items = await prisma.todo_items.findMany({
        where: { user_id: owner },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        select: todoSelect
    })
    return { items }
})
