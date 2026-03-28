import { getChannelCounts } from '../../utils/viewer-state'

export default defineEventHandler(() => {
  return { counts: getChannelCounts() }
})
