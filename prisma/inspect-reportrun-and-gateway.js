const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()
const baseQuery = [
  'SELECT a.attname, a.atttypid, a.attlen, a.attnotnull',
  'FROM pg_catalog.pg_class c',
  'JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace',
  'JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid',
  "WHERE c.relname='PLACEHOLDER'",
  "AND n.nspname='public'",
  'AND a.attnum>0',
  'AND NOT a.attisdropped',
  'ORDER BY a.attnum',
].join(' ')
async function inspect(tableName) {
  const sql = baseQuery.replace("'PLACEHOLDER'", "'" + tableName.toUpperCase() + "'")
  const rows = await db.$queryRawUnsafe(sql)
  const r = Array.isArray(rows) ? rows : []
  return r
}
(async () => {
  try {
    const reportRun = await inspect('ReportRun')
    console.log('ReportRun columns:')
    for (const c of reportRun)
      console.log('  ' + c.attname + '  typid=' + c.atttypid + '  len=' + c.attlen + '  notnull=' + c.attnotnull)
    const tenantGateway = await inspect('TenantPaymentGateway')
    console.log('TenantPaymentGateway columns:')
    for (const c of tenantGateway)
      console.log('  ' + c.attname + '  typid=' + c.atttypid + '  len=' + c.attlen + '  notnull=' + c.attnotnull)
  } catch (e) {
    console.log('ERROR', e.code, (e.message || '').slice(0, 800))
  } finally {
    await db.$disconnect()
  }
})()
