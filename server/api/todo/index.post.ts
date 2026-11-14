import { throwError } from '../../utils/error'
import { prisma } from '../../utils/prisma'
import { readShareBody } from '../../utils/shareBody'
import { todoId, todoOwner, todoSelect, todoTitle } from '../../utils/todo'

export default defineEventHandler(async event => {
    const owner = todoOwner(event)
    const body = await readShareBody(event, 2048)
    const id = todoId(body.id)
    await prisma.todo_items.createMany({ data: { user_id: owner, id, title: todoTitle(body.title) }, skipDuplicates: true })
    const item = await prisma.todo_items.findUnique({
        where: { user_id_id: { user_id: owner, id } },
        select: todoSelect
    })
    if (!item) throwError(404, 'Item not found.')
    return { item }
})
