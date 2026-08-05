import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/Card'

interface ModulePageProps {
  title: string
  description: string
  icon?: string
}

export function ModulePlaceholder({ title, description, icon = '🔧' }: ModulePageProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        title={`${title} — coming online`}
        description="This module is scaffolded and will be implemented in the upcoming build phases."
        icon={icon}
      />
    </div>
  )
}
