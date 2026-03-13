// This file is loaded server-side only via --require
// It should only be imported in server entry points

// Configure dd-trace
import tracer from 'dd-trace'

tracer.init({
  service: process.env.DD_SERVICE ?? 'kranz-tv',
  env: process.env.DD_ENV ?? 'local',
  version: process.env.DD_VERSION ?? '0.0.0',
  logInjection: true,
  runtimeMetrics: true,
})

export { tracer }
