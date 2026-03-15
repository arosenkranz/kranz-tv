import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

export default function DevToolsPanel() {
  return (
    <TanStackDevtools
      config={{
        position: 'bottom-right',
      }}
      plugins={[
        {
          name: 'Tanstack Router',
          render: <TanStackRouterDevtoolsPanel />,
        },
      ]}
    />
  )
}
