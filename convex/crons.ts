import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// A fixed interval rather than `*/3` day-of-month, which restarts on the 1st and gives uneven gaps.
crons.interval('scan author repos for skills', { hours: 72 }, internal.skillScan.start, {
  trigger: 'cron',
})

export default crons
