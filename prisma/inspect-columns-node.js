const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()
const baseQuery =
  'SELECT a.attname, a.atttypid, a.attlen, a.attnotnull FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid WHERE c.relname=$1::text AND n.nspname=$2::text AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum'
async function columns(tableName) {
  const rows = await db.$queryRawUnsafe(baseQuery, [tableName, 'public'])
  const r = Array.isArray(rows) ? rows : []
  return r
}
(async () => {
  try {
    const tableList = await db.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('ReportDefinition','ReportRun','TenantPaymentGateway') ORDER BY table_name`
    console.log('tables present:', tableList.map((t) => t.table_name).join(', ') || 'NONE')
    const reportDef = await columns('ReportDefinition')
    console.log('ReportDefinition columns:')
    for (const c of reportDef)
      console.log('  ' + c.attname + '  typid=' + c.atttypid + '  len=' + c.attlen + '  notnull=' + c.attnotnull)
    const reportRun = await columns('ReportRun')
    console.log('ReportRun columns:')
    for (const c of reportRun)
      console.log('  ' + c.attname + '  typid=' + c.atttypid + '  len=' + c.attlen + '  notnull=' + c.attnotnull)
    const tenantGateway = await columns('TenantPaymentGateway')
    console.log('TenantPaymentGateway columns:')
    for (const c of tenantGateway)
      console.log('  ' + c.attname + '  typid=' + c.atttypid + '  len=' + c.attlen + '  notnull=' + c.attnotnull)
  } catch (e) {
    console.log('ERROR', e.code, (e.message || '').slice(0, 800))
  } finally {
    await db.$disconnect()
  }
})()
