// The unit fixtures execute Nuxt source without its auto-import transform.
import * as messages from '../app/utils/messages.ts'
import * as descriptors from '../shared/utils/messageDescriptor.ts'
import { messageKey } from '../shared/utils/locale.ts'
Object.assign(globalThis, messages, descriptors, { messageKey })
