'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useCompanyEmployees, useCreateCompanyEmployee, useDeactivateCompanyEmployee, useReactivateCompanyEmployee, useEmployeeExport } from '@/hooks/queries/use-company-employees'
import { showToast } from '@/hooks/use-toast'
import { Search, Download, Plus, UserX, UserCheck } from 'lucide-react'

export default function CompanyEmployeesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', department: '', jobTitle: '' })

  const { data, isLoading } = useCompanyEmployees({ page, pageSize: 20, status: statusFilter, q: search })
  const createEmployee = useCreateCompanyEmployee()
  const deactivate = useDeactivateCompanyEmployee()
  const reactivate = useReactivateCompanyEmployee()
  const exportCsv = useEmployeeExport()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createEmployee.mutateAsync(form)
      showToast({ type: 'success', title: 'Employee created' })
      setShowForm(false)
      setForm({ firstName: '', lastName: '', email: '', department: '', jobTitle: '' })
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed', description: err.message })
    }
  }

  const handleDeactivate = async (id: string) => {
    try {
      await deactivate.mutateAsync({ id })
      showToast({ type: 'success', title: 'Employee deactivated' })
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed', description: err.message })
    }
  }

  const handleReactivate = async (id: string) => {
    try {
      await reactivate.mutateAsync({ id })
      showToast({ type: 'success', title: 'Employee reactivated' })
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed', description: err.message })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your company employees</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { exportCsv.mutateAsync().then(() => showToast({ type: 'success', title: 'Export started' })).catch((e: any) => showToast({ type: 'error', title: 'Export failed', description: e.message })) }} disabled={exportCsv.isPending}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1 h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Add Employee</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <Input placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              <Input placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="sm:col-span-2" />
              <Input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              <Input placeholder="Job Title" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" disabled={createEmployee.isPending}>
                  {createEmployee.isPending ? 'Saving...' : 'Save Employee'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search employees..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="flex h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="INVITED">Invited</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">Name</th>
                    <th className="p-3 font-medium">Email</th>
                    <th className="p-3 font-medium">Department</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Redemptions</th>
                    <th className="p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map((emp) => (
                    <tr key={emp.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-3 font-medium">{emp.firstName} {emp.lastName}</td>
                      <td className="p-3 text-muted-foreground">{emp.email}</td>
                      <td className="p-3 text-muted-foreground">{emp.department ?? '-'}</td>
                      <td className="p-3"><StatusBadge status={emp.status} /></td>
                      <td className="p-3">{emp._count.redemptions}</td>
                      <td className="p-3">
                        {emp.status === 'ACTIVE' ? (
                          <Button variant="ghost" size="sm" onClick={() => handleDeactivate(emp.id)} disabled={deactivate.isPending}>
                            <UserX className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => handleReactivate(emp.id)} disabled={reactivate.isPending}>
                            <UserCheck className="h-4 w-4 text-success" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!data?.data || data.data.length === 0) && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No employees found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {data.meta.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
