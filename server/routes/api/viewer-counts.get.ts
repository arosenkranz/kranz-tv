import { defineHandler } from 'nitro'
import { getChannelCounts } from '../../utils/viewer-state'

export default defineHandler(() => {
  return { counts: getChannelCounts() }
})
