import { throwError } from '../../utils/error'
import { prisma } from '../../utils/prisma'
import { readShareBody } from '../../utils/shareBody'
import { todoId, todoOwner, todoSelect, todoTitle } from '../../utils/todo'

export default defineEventHandler(async event => {
    const owner = todoOwner(event)
    const id = todoId(getRouterParam(event, 'id'))
    const { title, completed } = await readShareBody(event, 2048)
    if ((title === undefined && completed === undefined) || (completed !== undefined && typeof completed !== 'boolean'))
        throwError(400, 'Invalid request body.')

    const [item] = await prisma.todo_items.updateManyAndReturn({
        where: { user_id: owner, id },
        data: { title: title === undefined ? undefined : todoTitle(title), completed },
        select: todoSelect
    })
    if (!item) throwError(404, 'Item not found.')
    return { item }
})
